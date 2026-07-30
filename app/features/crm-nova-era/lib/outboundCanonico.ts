// Contrato canonico do outbound enviado pelo WhatsApp NATIVO do corretor.
//
// Auditoria de 30/07/2026 sobre 7 dias de wa_mensagens identificou cinco
// familias distintas de payload em `raw`:
//
//   webhook D-API : tem 'fromMe' (+ from, to, timestamp, type...)  <- e esta
//   motor         : raw = {"origem":"motor"}
//   chat do ERP   : raw = {"via":"crm"}
//   espelho antigo: tem 'status' + 'wa_message_id' (parou em 24/07)
//
// Duas verificacoes fecharam o contrato: nenhuma mensagem via=crm tem gemeo no
// webhook (nao ha duplicacao) e nenhuma outbound de webhook vem sem fromMe=true.
//
// A regra e de RECONHECIMENTO POSITIVO: exigimos a marca da familia do webhook.
// Ausencia de campo nunca e prova.

export type MensagemBruta = {
  direcao?: string | null;
  criado_em?: string | Date | null;
  enviado_em?: string | Date | null;
  wa_message_id?: string | null;
  instancia_id?: string | null;
  raw?: Record<string, unknown> | null;
};

export type ContextoNegocio = {
  distribuidoEm: string | Date | null;
  instanciaId?: string | null;
};

export type MotivoRecusa =
  | "sem_raw" | "nao_e_outbound" | "sem_marca_de_webhook" | "from_me_nao_e_true"
  | "origem_motor" | "via_crm" | "espelho_interno" | "sem_message_id"
  | "sem_data" | "anterior_a_distribuicao" | "instancia_incompativel";

export type Veredito =
  | { ok: true; messageId: string; quando: Date }
  | { ok: false; motivo: MotivoRecusa };

const DIRECOES_SAIDA = new Set(["enviada", "saida", "out", "outbound", "sent"]);

/** fromMe chega como true, "true", 1 ou "1" conforme a variante do webhook. */
export function representaVerdadeiro(v: unknown): boolean {
  if (v === true) return true;
  if (v === 1) return true;
  if (typeof v === "string") {
    const s = v.trim().toLowerCase();
    return s === "true" || s === "1";
  }
  return false;
}

/** A marca positiva da familia do webhook D-API. */
export function ehFamiliaWebhookDapi(raw: Record<string, unknown>): boolean {
  return Object.prototype.hasOwnProperty.call(raw, "fromMe")
    || Object.prototype.hasOwnProperty.call(raw, "from_me");
}

function paraData(v: string | Date | null | undefined): Date | null {
  if (!v) return null;
  const d = v instanceof Date ? v : new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}

/**
 * Decide se a mensagem confirma a primeira abordagem humana.
 * Fail-closed: na duvida, recusa com motivo nomeado.
 */
export function ehOutboundNativo(m: MensagemBruta, ctx: ContextoNegocio): Veredito {
  const raw = m.raw;
  if (!raw || typeof raw !== "object") return { ok: false, motivo: "sem_raw" };

  if (!DIRECOES_SAIDA.has(String(m.direcao ?? "").toLowerCase())) {
    return { ok: false, motivo: "nao_e_outbound" };
  }

  // Exclui as outras familias ANTES de aceitar, mesmo que tambem tenham fromMe.
  if (raw["origem"] === "motor") return { ok: false, motivo: "origem_motor" };
  if (raw["via"] === "crm") return { ok: false, motivo: "via_crm" };
  if (Object.prototype.hasOwnProperty.call(raw, "status")
      && Object.prototype.hasOwnProperty.call(raw, "wa_message_id")) {
    return { ok: false, motivo: "espelho_interno" };
  }

  // Reconhecimento POSITIVO da familia do webhook.
  if (!ehFamiliaWebhookDapi(raw)) return { ok: false, motivo: "sem_marca_de_webhook" };
  const fromMe = Object.prototype.hasOwnProperty.call(raw, "fromMe") ? raw["fromMe"] : raw["from_me"];
  if (!representaVerdadeiro(fromMe)) return { ok: false, motivo: "from_me_nao_e_true" };

  const messageId = (m.wa_message_id ?? "").trim();
  if (!messageId) return { ok: false, motivo: "sem_message_id" };

  const quando = paraData(m.enviado_em) ?? paraData(m.criado_em);
  if (!quando) return { ok: false, motivo: "sem_data" };

  const distribuido = paraData(ctx.distribuidoEm);
  if (!distribuido) return { ok: false, motivo: "sem_data" };
  if (quando < distribuido) return { ok: false, motivo: "anterior_a_distribuicao" };

  if (ctx.instanciaId && m.instancia_id && ctx.instanciaId !== m.instancia_id) {
    return { ok: false, motivo: "instancia_incompativel" };
  }

  return { ok: true, messageId, quando };
}
