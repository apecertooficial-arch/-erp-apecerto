// Webhook D-API. A autenticacao acontece antes de ler ou persistir o payload.
// O hash permite manter o segredo fora do repositorio. A query `s` permanece
// apenas como compatibilidade temporaria; integracoes novas devem usar header.

import { createClient } from "jsr:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const CURRENT_SECRET_SHA256 =
  "9100c3293a363764eeb8bf3da2ca28e557daa68844aed7d0233966f1029680a5";
const admin = createClient(SUPABASE_URL, SERVICE_ROLE);

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "content-type,x-webhook-secret",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });

const RANK: Record<string, number> = { enviado: 1, entregue: 2, lido: 3 };

function mapAck(value: unknown): string | null {
  const text = String(value ?? "").toLowerCase();
  if (!text) return null;
  if (["3", "4", "read", "read_ack", "played", "lido"].includes(text)) {
    return "lido";
  }
  if (["2", "delivered", "delivery_ack", "device", "entregue"].includes(text)) {
    return "entregue";
  }
  if (["1", "sent", "server", "server_ack", "enviado"].includes(text)) {
    return "enviado";
  }
  if (
    text.includes("error") || text.includes("failed") ||
    text.includes("undeliver") || text === "0" || text === "-1"
  ) return "erro";
  return null;
}

function statusFromEvent(event: string): string | null {
  if (/read/.test(event)) return "lido";
  if (/deliver/.test(event)) return "entregue";
  if (/(fail|error|undeliver)/.test(event)) return "erro";
  if (/(\bsent\b|server_ack|\back\b)/.test(event)) return "enviado";
  return null;
}

async function sha256(value: string): Promise<string> {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

async function validSecret(provided: string): Promise<boolean> {
  if (!provided) return false;
  const actual = await sha256(provided);
  if (actual.length !== CURRENT_SECRET_SHA256.length) return false;
  let diff = 0;
  for (let index = 0; index < actual.length; index++) {
    diff |= actual.charCodeAt(index) ^ CURRENT_SECRET_SHA256.charCodeAt(index);
  }
  return diff === 0;
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (request.method === "GET") return json({ ok: true, service: "dapi-webhook" });
  if (request.method !== "POST") return json({ ok: false, error: "METHOD_NOT_ALLOWED" }, 405);

  const url = new URL(request.url);
  const providedSecret = request.headers.get("x-webhook-secret") ??
    url.searchParams.get("s") ?? "";
  if (!(await validSecret(providedSecret))) {
    return json({ ok: false, error: "WEBHOOK_UNAUTHORIZED" }, 401);
  }

  let payload: Record<string, unknown>;
  try {
    payload = await request.json();
  } catch {
    return json({ ok: false, error: "INVALID_JSON" }, 400);
  }

  const dataObj = (payload.data ?? payload.message ?? {}) as Record<string, unknown>;
  const session = payload.sessionId ?? payload.session ?? payload.session_id ?? null;
  const event = String(payload.event ?? payload.type ?? "mensagem");

  const inserted = await admin.from("wa_eventos").insert({
    evento: event.slice(0, 120),
    session_id: session ? String(session) : null,
    payload,
    processado: false,
    erro: null,
  }).select("id").maybeSingle();
  if (inserted.error) {
    return json({ ok: false, error: "EVENT_STORE_FAILED" }, 503);
  }
  const waEventoId = inserted.data?.id ?? null;

  const normalizedEvent = event.toLowerCase();
  const rawStatus = dataObj.status ?? dataObj.ack ?? dataObj.ackType ??
    payload.status ?? payload.ack ?? null;
  const hasContent = Boolean(
    dataObj.message || dataObj.content || dataObj.body || dataObj.text,
  );
  const nextStatus = mapAck(rawStatus) ?? statusFromEvent(normalizedEvent);
  const isAck = nextStatus !== null && !hasContent &&
    /ack|receipt|status|deliver|read|sent|update/.test(normalizedEvent);

  if (isAck) {
    const messageId = dataObj.message_id ?? dataObj.id ?? dataObj.messageId ??
      (dataObj.key as Record<string, unknown> | undefined)?.id ??
      payload.message_id ?? payload.id ?? null;
    let updated = 0;

    if (messageId && nextStatus) {
      const rows = await admin.from("wa_mensagens").select("id,status")
        .eq("wa_message_id", String(messageId));
      if (rows.error) return json({ ok: false, error: "ACK_LOOKUP_FAILED" }, 503);
      for (const row of rows.data ?? []) {
        const currentRank = RANK[String(row.status ?? "")] ?? 0;
        const nextRank = RANK[nextStatus] ?? 99;
        if (nextStatus === "erro" || nextRank >= currentRank) {
          const result = await admin.from("wa_mensagens").update({
            status: nextStatus,
            status_em: new Date().toISOString(),
          }).eq("id", row.id);
          if (!result.error) updated++;
        }
      }
    }

    if (waEventoId) {
      await admin.from("wa_eventos").update({ processado: true }).eq("id", waEventoId);
    }
    return json({
      ok: true,
      stored: true,
      tipo: "status",
      status: nextStatus,
      wa_message_id: messageId,
      atualizadas: updated,
    });
  }

  if (!/message|mensagem|chat/.test(normalizedEvent)) {
    if (waEventoId) {
      await admin.from("wa_eventos").update({ processado: true }).eq("id", waEventoId);
    }
    return json({ ok: true, stored: true, parsed: false, reason: "EVENT_NOT_MESSAGE" });
  }

  const ingested = await admin.rpc("wa_ingerir", { p_payload: payload });
  if (ingested.error || (ingested.data as { ok?: boolean } | null)?.ok === false) {
    const detail = ingested.error?.message ??
      String((ingested.data as { erro?: unknown } | null)?.erro ?? "INGEST_FAILED");
    if (waEventoId) {
      await admin.from("wa_eventos").update({ erro: detail.slice(0, 1000) })
        .eq("id", waEventoId);
    }
    return json({ ok: false, stored: true, error: "MESSAGE_INGEST_FAILED" }, 503);
  }

  if (waEventoId) {
    await admin.from("wa_eventos").update({ processado: true }).eq("id", waEventoId);
  }
  return json({ ok: true, stored: true, resultado: ingested.data });
});
