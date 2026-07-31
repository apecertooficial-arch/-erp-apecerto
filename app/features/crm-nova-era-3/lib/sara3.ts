/**
 * SARA NA FICHA 3.0 — normalização da sugestão. PURO.
 *
 * A Sara continua observer/assist: ela SUGERE. Não envia mensagem, não move
 * etapa, não conclui ação. `execute` permanece bloqueado — este módulo não
 * tem, e não pode ter, nenhuma chamada de execução.
 *
 * Exibimos sempre os mesmos oito campos, na mesma ordem, e três decisões
 * humanas: usar, ajustar ou dizer que não faz sentido.
 */

export type SugestaoBruta = Record<string, unknown>;

export type SaraNaTela = {
  evidencias: string[];
  evidenciaSuficiente: boolean;
  momentoSugerido: string | null;
  proximaAcao: string | null;
  prazo: string | null;
  perguntasFaltantes: string[];
  roteiro: string[];
  textoParaCopiar: string | null;
  risco: string | null;
  confiancaPct: number;
};

export type DecisaoSara = "aceita" | "ajustada" | "rejeitada";

export const ACOES_SARA: ReadonlyArray<{ decisao: DecisaoSara; rotulo: string; ajuda: string }> = Object.freeze([
  { decisao: "aceita", rotulo: "Usar orientação", ajuda: "Abre o formulário já preenchido. Você ainda confirma." },
  { decisao: "ajustada", rotulo: "Ajustar", ajuda: "Abre o formulário em branco para você escrever o que vale." },
  { decisao: "rejeitada", rotulo: "Não faz sentido", ajuda: "Descarta a sugestão e registra o retorno para a Sara aprender." },
]);

function texto(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const t = v.trim();
  return t ? t : null;
}

function lista(v: unknown, max = 6): string[] {
  if (!Array.isArray(v)) return [];
  return v.map((x) => (typeof x === "string" ? x.trim() : "")).filter(Boolean).slice(0, max);
}

export function normalizarSara(bruta: SugestaoBruta | null | undefined): SaraNaTela | null {
  if (!bruta || typeof bruta !== "object") return null;
  const confianca = Number(bruta.confianca ?? 0);
  return {
    evidencias: lista(bruta.evidencias, 4),
    evidenciaSuficiente: bruta.evidencia_suficiente !== false,
    momentoSugerido: texto(bruta.temperatura) ?? texto(bruta.intencao_detectada),
    proximaAcao: texto(bruta.proxima_acao),
    prazo: texto(bruta.prazo_sugerido),
    perguntasFaltantes: lista(bruta.perguntas_faltantes, 5),
    roteiro: lista(bruta.roteiro_ligacao, 6),
    textoParaCopiar: texto(bruta.whatsapp_sugerido),
    risco: texto(bruta.risco_abandono),
    confiancaPct: Number.isFinite(confianca) ? Math.round(Math.max(0, Math.min(1, confianca)) * 100) : 0,
  };
}

/**
 * Tipo de próxima ação que a Sara sugeriu, traduzido para as opções que o
 * formulário aceita. A escolha final continua sendo do corretor.
 */
export function proximaAcaoSugerida(bruta: SugestaoBruta | null | undefined): string {
  if (!bruta) return "entender_necessidade";
  if (bruta.possibilidade_proposta === "alta") return "preparar_proposta";
  if (bruta.possibilidade_visita === "alta") return "agendar_visita";
  return "entender_necessidade";
}

/** A Sara nunca envia. Trava explícita para o teste e para quem editar depois. */
export const SARA_PODE_ENVIAR = false as const;
export const SARA_PODE_MOVER_ETAPA = false as const;
