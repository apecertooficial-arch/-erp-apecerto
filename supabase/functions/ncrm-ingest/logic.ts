/**
 * ncrm-ingest — LÓGICA PURA (sem Deno/rede), testável em node.
 * Decide, a partir de um evento do backend de WhatsApp/automação, QUAL RPC ncrm_*
 * chamar e com quais parâmetros. A idempotência real é do ID da mensagem/evento:
 *  - mensagem automática -> ncrm_registrar_msg_automatica (idem interno 'auto:'+message_id)
 *  - resposta inbound     -> ncrm_registrar_resposta_cliente (idem interno 'wa:'+message_id)
 * As RPCs já são idempotentes (unique idempotency_key); retries do webhook não duplicam.
 * ESTAS RPCs são service_role-only (nunca chamadas pelo frontend).
 */
export type EventoIngest = {
  tipo: "msg_automatica" | "resposta_inbound";
  negocioId: number;
  messageId: string;
  em?: string | null; // ISO do envio/recebimento real
};

export type PlanoIngest =
  | { ok: true; rpc: "ncrm_registrar_msg_automatica"; args: { p_negocio_id: number; p_message_id: string; p_enviado_em: string } }
  | { ok: true; rpc: "ncrm_registrar_resposta_cliente"; args: { p_negocio_id: number; p_message_id: string; p_em: string } }
  | { ok: false; erro: string };

function inteiroPositivo(v: unknown): number | null {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isInteger(n) && n > 0 ? n : null;
}
function iso(v: unknown): string | null {
  if (typeof v !== "string" || !v) return null;
  const t = Date.parse(v);
  return Number.isNaN(t) ? null : new Date(t).toISOString();
}

/** Valida e planeja a chamada. `agoraISO` é injetado (sem Date.now interno). */
export function planejarIngest(e: Partial<EventoIngest>, agoraISO: string): PlanoIngest {
  const negocioId = inteiroPositivo(e.negocioId);
  if (negocioId === null) return { ok: false, erro: "negocio_invalido" };
  const mid = typeof e.messageId === "string" ? e.messageId.trim() : "";
  if (!mid) return { ok: false, erro: "message_id_obrigatorio" };
  const em = iso(e.em) ?? agoraISO;
  if (e.tipo === "msg_automatica") {
    return { ok: true, rpc: "ncrm_registrar_msg_automatica", args: { p_negocio_id: negocioId, p_message_id: mid, p_enviado_em: em } };
  }
  if (e.tipo === "resposta_inbound") {
    return { ok: true, rpc: "ncrm_registrar_resposta_cliente", args: { p_negocio_id: negocioId, p_message_id: mid, p_em: em } };
  }
  return { ok: false, erro: "tipo_desconhecido" };
}

/** Interpreta o retorno jsonb da RPC para a resposta do webhook (idempotente = 200). */
export function interpretarRetornoRpc(data: unknown): { status: number; body: Record<string, unknown> } {
  const r = (data ?? {}) as { ok?: boolean; ja_processado?: boolean; erro?: string; versao?: number };
  if (r.ok && r.ja_processado) return { status: 200, body: { ok: true, ja_processado: true } }; // retry do webhook
  if (r.ok) return { status: 200, body: { ok: true, versao: r.versao ?? null } };
  return { status: 409, body: { ok: false, erro: r.erro ?? "recusado" } };
}
