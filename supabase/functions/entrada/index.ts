import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const cors = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "content-type,x-idempotency-key",
  "Access-Control-Allow-Methods": "POST,OPTIONS",
};

const response = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: cors });

function firstString(...values: unknown[]): string {
  const value = values.find((item) => typeof item === "string" && item.trim());
  return typeof value === "string" ? value.trim() : "";
}

function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  if (value && typeof value === "object") {
    const object = value as Record<string, unknown>;
    return `{${Object.keys(object).sort().map((key) =>
      `${JSON.stringify(key)}:${stableJson(object[key])}`
    ).join(",")}}`;
  }
  return JSON.stringify(value) ?? "null";
}

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

    let body: Record<string, unknown>;
    try {
      body = await request.json();
    } catch {
      return response({ ok: false, error: "INVALID_JSON" }, 400);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const headers = {
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
      "Content-Type": "application/json",
    };

    const automationRows = await fetch(
      `${supabaseUrl}/rest/v1/automacoes?id=eq.${automationId}` +
        "&select=id,nome,ativa,status,arquivada,versao_publicada_id&limit=1",
      { headers },
    ).then((result) => result.json());
    const automation = Array.isArray(automationRows) ? automationRows[0] : null;
    if (!automation) return response({ ok: false, error: "AUTOMATION_NOT_FOUND" }, 404);

    const runnable = automation.status === "publicado" &&
      automation.ativa === true && automation.arquivada !== true &&
      Number.isInteger(automation.versao_publicada_id);
    if (!runnable) {
      return response({ ok: false, error: "AUTOMATION_NOT_RUNNABLE" }, 409);
    }

    const lead: Record<string, unknown> = {
      nome: body.nome ?? body.name ?? body.full_name ?? body.fullName ?? "Lead",
      telefone: String(
        body.telefone ?? body.phone ?? body.whatsapp ?? body.numero ?? body.celular ?? "",
      ).replace(/\D/g, ""),
      email: body.email ?? "",
    };
    for (const key of Object.keys(body)) if (!(key in lead)) lead[key] = body[key];

    const digits = String(lead.telefone ?? "");
    if (!digits && !String(lead.email ?? "").includes("@")) {
      return response({ ok: false, error: "LEAD_WITHOUT_CONTACT" }, 400);
    }
    if (digits && digits.length < 10) lead.telefone_suspeito = true;

    const explicitIdempotencyKey = firstString(
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
      return response({
        ok: false,
        error: queued.status === 409 ? "IDEMPOTENCY_CONFLICT" : "AUTOMATION_QUEUE_REJECTED",
        detail: rawQueueResult.slice(0, 400),
      }, queued.status === 400 || queued.status === 409 ? 409 : 502);
    }
    const queueResult = JSON.parse(rawQueueResult) as {
      fila_id?: number;
      duplicado?: boolean;
    };

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
  } catch (error) {
    return response({ ok: false, error: "UNEXPECTED_ERROR", detail: String(error) }, 500);
  }
});
