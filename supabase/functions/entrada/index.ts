import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import {
  classifyQueueFailure,
  firstScalarString,
  normalizePayloadEntrada,
  parseQueueSuccess,
  stableJson,
} from "../_shared/entrada-policy.ts";

const cors = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "content-type,x-automation-token,x-idempotency-key",
  "Access-Control-Allow-Methods": "POST,OPTIONS",
};

const response = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: cors });

async function sha256(value: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(value),
  );
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

Deno.serve(async (request: Request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (request.method !== "POST") {
    return response({ ok: false, error: "METHOD_NOT_ALLOWED" }, 405);
  }

  try {
    const url = new URL(request.url);
    const rawAutomationId = url.searchParams.get("auto") ?? "";
    if (!/^\d+$/.test(rawAutomationId)) {
      return response({
        ok: false,
        error: "AUTOMATION_ID_REQUIRED",
        message: "A entrada precisa apontar explicitamente para uma automacao",
      }, 400);
    }
    const automationId = Number.parseInt(rawAutomationId, 10);

    let rawBody: unknown;
    try {
      rawBody = await request.json();
    } catch {
      return response({ ok: false, error: "INVALID_JSON" }, 400);
    }
    const normalized = normalizePayloadEntrada(rawBody);
    if (!normalized.ok) return response({ ok: false, error: normalized.error }, normalized.status);
    const { body, lead } = normalized;

    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    if (!supabaseUrl || !serviceRoleKey) {
      return response({ ok: false, error: "SERVICE_CONFIGURATION_UNAVAILABLE" }, 503);
    }
    const headers = {
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
      "Content-Type": "application/json",
    };

    const automationResponse = await fetch(
      `${supabaseUrl}/rest/v1/automacoes?id=eq.${automationId}` +
        "&select=id,nome,ativa,status,arquivada,versao_publicada_id,webhook_token,webhook_token_enforced&limit=1",
      { headers },
    );
    if (!automationResponse.ok) {
      return response({ ok: false, error: "AUTOMATION_LOOKUP_FAILED" }, 502);
    }
    const automationRows = await automationResponse.json().catch(() => null);
    if (!Array.isArray(automationRows)) {
      return response({ ok: false, error: "AUTOMATION_LOOKUP_INVALID_RESPONSE" }, 502);
    }
    const automation = Array.isArray(automationRows) ? automationRows[0] : null;
    if (!automation) return response({ ok: false, error: "AUTOMATION_NOT_FOUND" }, 404);

    const runnable = automation.status === "publicado" &&
      automation.ativa === true && automation.arquivada !== true &&
      Number.isInteger(automation.versao_publicada_id);
    if (!runnable) {
      return response({ ok: false, error: "AUTOMATION_NOT_RUNNABLE" }, 409);
    }

    // A publicacao preserva esta configuracao: webhooks publicos continuam
    // publicos e integracoes explicitamente protegidas continuam protegidas.
    if (automation.webhook_token_enforced === true) {
      const requestToken = request.headers.get("x-automation-token") ??
        url.searchParams.get("token") ?? "";
      const expected = String(automation.webhook_token ?? "");
      if (!/^[a-f0-9]{48}$/.test(requestToken) || requestToken !== expected) {
        return response({ ok: false, error: "WEBHOOK_UNAUTHORIZED" }, 401);
      }
    }

    const digits = String(lead.telefone ?? "");
    if (!digits && !String(lead.email ?? "").includes("@")) {
      return response({ ok: false, error: "LEAD_WITHOUT_CONTACT" }, 400);
    }
    if (digits && digits.length < 10) lead.telefone_suspeito = true;

    const explicitIdempotencyKey = firstScalarString(
      request.headers.get("x-idempotency-key"),
      body.event_id,
      body.eventId,
      body.external_id,
      body.externalId,
      body.leadgen_id,
      body.lead_id,
      body.id,
    );
    // Webhooks de campanha sao publicos e nao exigem senha nem header customizado.
    // Se a origem nao enviar um ID, o payload canonico gera uma chave estavel:
    // retries identicos nao duplicam o lead, mas eventos diferentes continuam distintos.
    const idempotencyKey = explicitIdempotencyKey ||
      `auto:${automationId}:payload:${await sha256(stableJson(body))}`;

    const queued = await fetch(
      `${supabaseUrl}/rest/v1/rpc/motor_enfileirar_idempotente`,
      {
        method: "POST",
        headers,
        body: JSON.stringify({
          p_auto_id: automationId,
          p_lead: lead,
          p_idempotency_key: idempotencyKey,
        }),
      },
    );
    const rawQueueResult = await queued.text();
    if (!queued.ok) {
      const failure = classifyQueueFailure(queued.status, rawQueueResult);
      return response({
        ok: false,
        error: failure.error,
      }, failure.status);
    }
    const queueResult = parseQueueSuccess(rawQueueResult);
    if (!queueResult) {
      return response({ ok: false, error: "AUTOMATION_QUEUE_INVALID_RESPONSE" }, 502);
    }

    // Telemetria nao participa da decisao nem pode bloquear a entrada.
    fetch(`${supabaseUrl}/rest/v1/automacoes?id=eq.${automationId}`, {
      method: "PATCH",
      headers: { ...headers, Prefer: "return=minimal" },
      body: JSON.stringify({
        ultima_entrada: body,
        ultima_entrada_em: new Date().toISOString(),
      }),
    }).catch(() => undefined);

    return response({
      ok: true,
      enfileirado: true,
      duplicado: queueResult.duplicado === true,
      fila_id: queueResult.fila_id,
      automacao: automationId,
      versao_id: automation.versao_publicada_id,
      idempotencia_automatica: !explicitIdempotencyKey,
    });
  } catch {
    return response({ ok: false, error: "UNEXPECTED_ERROR" }, 500);
  }
});
