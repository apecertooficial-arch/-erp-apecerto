/**
 * CRM Nova Era — Sara: MODOS DE OPERAÇÃO (Fase 3, Regra 5).
 * ------------------------------------------------------------------
 * Módulo PURO. Define os 4 modos e a matriz de capacidades. Estado inicial
 * OBRIGATÓRIO: "observer". No modo observer a Sara só LÊ e REGISTRA análise;
 * nunca muta (não move lead, não altera etapa/ação, não cria visita/proposta,
 * não envia WhatsApp, não executa RPC de mutação, não ativa ingestão/migração).
 * Estas garantias são reforçadas no banco (a RPC de análise é insert-only).
 */

export type SaraModo = "off" | "observer" | "suggest" | "execute";

export const SARA_MODOS: SaraModo[] = ["off", "observer", "suggest", "execute"];

/** Estado inicial obrigatório desta fase. */
export const SARA_MODO_INICIAL: SaraModo = "observer";

export function saraModoValido(v: unknown): v is SaraModo {
  return typeof v === "string" && (SARA_MODOS as string[]).includes(v);
}

export interface SaraCapacidades {
  lerConversas: boolean;
  calcularSugestao: boolean;
  registrarAnalise: boolean;   // grava análise na auditoria ncrm (não é mutação operacional)
  proporAoHumano: boolean;     // aparece como sugestão para aprovação humana
  executarMutacao: boolean;    // move/etapa/visita/proposta/whatsapp/RPC de mutação
}

/** Matriz de capacidades por modo. Observer NUNCA executa mutação. */
export function capacidadesSara(modo: SaraModo): SaraCapacidades {
  switch (modo) {
    case "off":
      return { lerConversas: false, calcularSugestao: false, registrarAnalise: false, proporAoHumano: false, executarMutacao: false };
    case "observer":
      return { lerConversas: true, calcularSugestao: true, registrarAnalise: true, proporAoHumano: false, executarMutacao: false };
    case "suggest":
      return { lerConversas: true, calcularSugestao: true, registrarAnalise: true, proporAoHumano: true, executarMutacao: false };
    case "execute":
      return { lerConversas: true, calcularSugestao: true, registrarAnalise: true, proporAoHumano: true, executarMutacao: true };
  }
}

/** Uma mutação operacional só é permitida no modo execute. */
export function saraPodeMutar(modo: SaraModo): boolean {
  return capacidadesSara(modo).executarMutacao === true;
}

/** No observer (ou off), qualquer tentativa de mutação deve ser BLOQUEADA. */
export function saraMutacaoBloqueada(modo: SaraModo): boolean {
  return !saraPodeMutar(modo);
}

/* ============================ Análise da Sara ============================ */

export type SaraEtapaSugerida = "novo" | "tentando_contato" | "em_atendimento" | "em_acompanhamento";

export interface SaraAnalise {
  negocioId: number;
  etapaAtual: string | null;
  etapaSugerida: SaraEtapaSugerida | null;
  proximaAcaoSugerida: string | null;
  prazoSugerido: string | null;     // ISO
  justificativa: string;
  evidencias: string[];
  confianca: number;                // 0..1
  clienteAguardandoResposta: boolean;
  promessaRetorno: boolean;
  visitaMencionada: boolean;
  propostaMencionada: boolean;
  versaoPrompt: string;
  modo: SaraModo;
  analisadoEm: string;              // ISO
}

const ETAPAS_SUGERIDAS: SaraEtapaSugerida[] = ["novo", "tentando_contato", "em_atendimento", "em_acompanhamento"];

export interface SaraAnaliseValidacao {
  ok: boolean;
  erros: string[];
  analise?: SaraAnalise;
}

function isoValido(s: unknown): s is string {
  return typeof s === "string" && !Number.isNaN(Date.parse(s));
}

/**
 * Normaliza/valida uma análise da Sara (puro). Toda análise deve conter os campos
 * de auditoria obrigatórios (Regra 5). O campo `modo` só pode ser um modo válido e,
 * como esta é uma ANÁLISE (não mutação), é aceita em observer/suggest/execute.
 */
export function normalizarAnaliseSara(raw: unknown): SaraAnaliseValidacao {
  const erros: string[] = [];
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return { ok: false, erros: ["análise inválida (objeto esperado)"] };
  }
  const o = raw as Record<string, unknown>;
  const negocioId = Number(o.negocioId);
  if (!Number.isInteger(negocioId) || negocioId <= 0) erros.push("negocioId inválido");
  const modo = o.modo;
  if (!saraModoValido(modo)) erros.push("modo inválido");
  else if (modo === "off") erros.push("Sara em off não produz análise");
  const conf = Number(o.confianca);
  if (!(conf >= 0 && conf <= 1)) erros.push("confiança deve estar entre 0 e 1");
  const justificativa = typeof o.justificativa === "string" ? o.justificativa.trim() : "";
  if (!justificativa) erros.push("justificativa obrigatória");
  const evid = Array.isArray(o.evidencias) ? o.evidencias.filter((x) => typeof x === "string").slice(0, 30) as string[] : [];
  const etapaSug = ETAPAS_SUGERIDAS.includes(o.etapaSugerida as SaraEtapaSugerida) ? (o.etapaSugerida as SaraEtapaSugerida) : null;
  const analisadoEm = isoValido(o.analisadoEm) ? (o.analisadoEm as string) : null;
  if (!analisadoEm) erros.push("analisadoEm (ISO) obrigatório");
  const versaoPrompt = typeof o.versaoPrompt === "string" && o.versaoPrompt.trim() ? o.versaoPrompt.trim() : "";
  if (!versaoPrompt) erros.push("versaoPrompt obrigatória");
  if (erros.length) return { ok: false, erros };
  return {
    ok: true,
    erros: [],
    analise: {
      negocioId,
      etapaAtual: typeof o.etapaAtual === "string" ? o.etapaAtual : null,
      etapaSugerida: etapaSug,
      proximaAcaoSugerida: typeof o.proximaAcaoSugerida === "string" ? o.proximaAcaoSugerida : null,
      prazoSugerido: isoValido(o.prazoSugerido) ? (o.prazoSugerido as string) : null,
      justificativa,
      evidencias: evid,
      confianca: conf,
      clienteAguardandoResposta: o.clienteAguardandoResposta === true,
      promessaRetorno: o.promessaRetorno === true,
      visitaMencionada: o.visitaMencionada === true,
      propostaMencionada: o.propostaMencionada === true,
      versaoPrompt,
      modo: modo as SaraModo,
      analisadoEm: analisadoEm as string,
    },
  };
}
