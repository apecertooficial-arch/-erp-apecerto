/**
 * Schema explícito da sugestão da Sara (Nova Era). PURO e testável.
 * Normaliza/valida a resposta do ia-router. Se não for JSON válido no formato
 * esperado, retorna falha controlada — nunca deixa passar string/JSON cru.
 */
export interface SugestaoSara {
  acao_padrao_codigo: string;
  etapa_sugerida: "novo" | "tentando_contato" | "em_atendimento" | "em_acompanhamento" | null;
  temperatura: "frio" | "morno" | "quente" | "negociando" | null;
  intencao_detectada: string | null;
  proxima_acao: string;
  prazo_sugerido: string | null; // ISO
  objecoes: string[];
  risco_abandono: "baixo" | "medio" | "alto" | null;
  possibilidade_visita: "baixa" | "media" | "alta" | null;
  possibilidade_proposta: "baixa" | "media" | "alta" | null;
  justificativa: string | null;
  confianca: number; // 0..1
  evidencias: string[];
  /* Coach (Fase 5) — opcionais e tolerantes; nunca inventados pelo normalizador. */
  objetivo_abordagem: string | null;
  roteiro_ligacao: string[];
  whatsapp_sugerido: string | null;
  perguntas_faltantes: string[];
  cuidados: string[];
  evidencia_suficiente: boolean;
  /** Checklist de qualificação: chave canônica -> valor dito pelo cliente. */
  informacoes_descobertas: Record<string, string>;
}

/* Onze campos, e só eles. Chave que a IA inventar é descartada aqui — o
   normalizador é a fronteira entre o que o modelo diz e o que a tela mostra. */
const CAMPOS_QUALIFICACAO = [
  "regiao", "tipo_imovel", "metragem", "dormitorios", "vagas", "faixa_valor",
  "forma_pagamento", "prazo_compra", "motivo_compra", "quem_decide", "disponibilidade_visita",
] as const;

const ACOES_PADRAO = ["PRIMEIRA_ABORDAGEM","ENVIAR_CADENCIA","RESPONDER_CLIENTE","ENTENDER_NECESSIDADE","BUSCAR_E_ENVIAR_IMOVEIS","PEDIR_RETORNO","REATIVAR_CONVERSA","AGENDAR_VISITA","REGISTRAR_RESULTADO_VISITA","REGISTRAR_PROPOSTA"] as const;

function checklist(v: unknown): Record<string, string> {
  if (!v || typeof v !== "object" || Array.isArray(v)) return {};
  const bruto = v as Record<string, unknown>;
  const saida: Record<string, string> = {};
  for (const chave of CAMPOS_QUALIFICACAO) {
    const valor = bruto[chave];
    if (typeof valor !== "string") continue;
    const t = valor.trim();
    if (!t || t.toLowerCase() === "null" || t.toLowerCase() === "nao informado") continue;
    saida[chave] = t.slice(0, 120);
  }
  return saida;
}

const ETAPAS = ["novo", "tentando_contato", "em_atendimento", "em_acompanhamento"];
const TEMPS = ["frio", "morno", "quente", "negociando"];
const NIVEIS3 = ["baixo", "medio", "alto"];
const PROBS = ["baixa", "media", "alta"];

function enumOuNull<T extends string>(v: unknown, set: readonly string[]): T | null {
  return typeof v === "string" && set.includes(v) ? (v as T) : null;
}
function strOuNull(v: unknown, max = 600): string | null {
  return typeof v === "string" && v.trim() ? v.trim().slice(0, max) : null;
}
function arrStr(v: unknown, maxItens = 12, maxLen = 400): string[] {
  if (!Array.isArray(v)) return [];
  return v.filter((x) => typeof x === "string" && x.trim()).slice(0, maxItens).map((x) => (x as string).trim().slice(0, maxLen));
}

/** Extrai um objeto JSON de um valor cru (objeto, ou string com JSON embutido). */
export function extrairJson(raw: unknown): Record<string, unknown> | null {
  if (raw && typeof raw === "object" && !Array.isArray(raw)) return raw as Record<string, unknown>;
  if (typeof raw === "string") {
    const m = raw.match(/\{[\s\S]*\}/);
    if (m) { try { const o = JSON.parse(m[0]); return o && typeof o === "object" ? o : null; } catch { return null; } }
  }
  return null;
}

export function normalizarSugestaoSara(raw: unknown): { ok: true; sugestao: SugestaoSara } | { ok: false; erro: string } {
  const o = extrairJson(raw);
  if (!o) return { ok: false, erro: "resposta_da_sara_nao_e_json" };
  const proxima = strOuNull(o.proxima_acao, 400);
  const conf = typeof o.confianca === "number" ? o.confianca : Number(o.confianca);
  // Campos mínimos para considerar a sugestão utilizável.
  if (!proxima) return { ok: false, erro: "sugestao_sem_proxima_acao" };
  if (!Number.isFinite(conf) || conf < 0 || conf > 1) return { ok: false, erro: "confianca_invalida" };
  const prazo = typeof o.prazo_sugerido === "string" && !Number.isNaN(Date.parse(o.prazo_sugerido))
    ? new Date(o.prazo_sugerido).toISOString() : null;
  return {
    ok: true,
    sugestao: {
      etapa_sugerida: enumOuNull(o.etapa_sugerida, ETAPAS),
      acao_padrao_codigo: enumOuNull(o.acao_padrao_codigo, ACOES_PADRAO) ?? "ENTENDER_NECESSIDADE",
      temperatura: enumOuNull(o.temperatura, TEMPS),
      intencao_detectada: strOuNull(o.intencao_detectada),
      proxima_acao: proxima,
      prazo_sugerido: prazo,
      objecoes: arrStr(o.objecoes),
      risco_abandono: enumOuNull(o.risco_abandono, NIVEIS3),
      possibilidade_visita: enumOuNull(o.possibilidade_visita, PROBS),
      possibilidade_proposta: enumOuNull(o.possibilidade_proposta, PROBS),
      justificativa: strOuNull(o.justificativa),
      confianca: conf,
      evidencias: arrStr(o.evidencias),
      informacoes_descobertas: checklist(o.informacoes_descobertas),
      objetivo_abordagem: strOuNull(o.objetivo_abordagem, 300),
      roteiro_ligacao: arrStr(o.roteiro_ligacao, 6, 200),
      whatsapp_sugerido: strOuNull(o.whatsapp_sugerido, 300),
      perguntas_faltantes: arrStr(o.perguntas_faltantes, 8, 200),
      cuidados: arrStr(o.cuidados, 8, 200),
      evidencia_suficiente: o.evidencia_suficiente !== false,
    },
  };
}

/** Mapeia a etapa/ação sugerida para os campos do formulário (o humano confirma no fim). */
export function sugestaoParaFormulario(s: SugestaoSara): { proximaTipo: string; prazo: string | null } {
  // proxima_acao é texto livre; oferecemos um tipo comercial padrão coerente com a probabilidade.
  const tipo =
    s.possibilidade_proposta === "alta" ? "preparar_proposta" :
    s.possibilidade_visita === "alta" ? "agendar_visita" :
    "entender_necessidade";
  return { proximaTipo: tipo, prazo: s.prazo_sugerido };
}
