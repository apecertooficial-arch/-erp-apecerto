/**
 * SARA NA FICHA 3.0 — normalização da sugestão. PURO.
 *
 * A Sara SUGERE; quem executa é o corretor, com um clique. Ela não envia
 * mensagem e não escreve etapa em lugar nenhum — o momento do cliente é
 * recalculado pelo banco a partir da ação registrada.
 *
 * Este módulo é PURO: monta o payload da ação a partir da sugestão, e nada
 * mais. Quem chama a rede é a ficha.
 */

import { montarChecklist, type Checklist } from "./qualificacao.ts";
import { ACOES_PADRAO, codigoAcaoValido, politicaSara, type CodigoAcaoPadrao } from "./operacaoPadrao.ts";

export type SugestaoBruta = Record<string, unknown>;

export type SaraNaTela = {
  evidencias: string[];
  /** O que a Sara achou na conversa, campo a campo. */
  checklist: Checklist;
  evidenciaSuficiente: boolean;
  momentoSugerido: string | null;
  proximaAcao: string | null;
  prazo: string | null;
  perguntasFaltantes: string[];
  roteiro: string[];
  textoParaCopiar: string | null;
  risco: string | null;
  confiancaPct: number;
  codigoAcao: CodigoAcaoPadrao;
  politica: ReturnType<typeof politicaSara>;
};

export type DecisaoSara = "aceita" | "ajustada" | "rejeitada";

/**
 * O ciclo que esta tela existe para fechar:
 *   Sara le o historico -> devolve o momento e a proxima acao -> o corretor
 *   confirma com UM clique -> o banco registra e recalcula o momento -> a
 *   proxima analise da Sara ja parte do estado novo.
 *
 * "Usar orientacao" nao abre formulario: executa a acao que a Sara sugeriu.
 * Continua sendo decisao humana (o clique) e continua auditada (decisao=aceita),
 * mas o corretor deixa de reescrever o que a Sara ja escreveu.
 */

export const ACOES_SARA: ReadonlyArray<{ decisao: DecisaoSara; rotulo: string; ajuda: string }> = Object.freeze([
  { decisao: "aceita", rotulo: "Usar orientação", ajuda: "Registra a ação da Sara e atualiza o momento do cliente." },
  { decisao: "ajustada", rotulo: "Ajustar", ajuda: "Abre o formulário para você escrever o que realmente vale." },
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
  const evidencias = lista(bruta.evidencias, 4);
  const confiancaPct = Number.isFinite(confianca) ? Math.round(Math.max(0, Math.min(1, confianca)) * 100) : 0;
  const codigoAcao = codigoAcaoValido(bruta.acao_padrao_codigo) ? bruta.acao_padrao_codigo : "REVISAR_MANUALMENTE";
  return {
    evidencias,
    checklist: montarChecklist(bruta.informacoes_descobertas),
    evidenciaSuficiente: bruta.evidencia_suficiente !== false,
    momentoSugerido: texto(bruta.temperatura) ?? texto(bruta.intencao_detectada),
    proximaAcao: texto(bruta.proxima_acao),
    prazo: texto(bruta.prazo_sugerido),
    perguntasFaltantes: lista(bruta.perguntas_faltantes, 5),
    roteiro: lista(bruta.roteiro_ligacao, 6),
    textoParaCopiar: texto(bruta.whatsapp_sugerido),
    risco: texto(bruta.risco_abandono),
    confiancaPct,
    codigoAcao,
    politica: politicaSara(confiancaPct, bruta.evidencia_suficiente !== false, evidencias),
  };
}

/**
 * Tipo de próxima ação que a Sara sugeriu, traduzido para as opções que o
 * formulário aceita. A escolha final continua sendo do corretor.
 */
export function proximaAcaoSugerida(bruta: SugestaoBruta | null | undefined): string {
  if (!bruta) return "entender_necessidade";
  if (codigoAcaoValido(bruta.acao_padrao_codigo)) return ACOES_PADRAO[bruta.acao_padrao_codigo].tipo;
  if (bruta.possibilidade_proposta === "alta") return "preparar_proposta";
  if (bruta.possibilidade_visita === "alta") return "agendar_visita";
  return "entender_necessidade";
}

/** A Sara nunca envia mensagem. Trava explícita, com teste. */
export const SARA_PODE_ENVIAR = false as const;

/**
 * A Sara continua sem mover etapa SOZINHA: quem move é a ação registrada
 * depois do clique do corretor. O momento não é escrito à mão em lugar nenhum
 * — o banco recalcula a partir da próxima ação e de quem respondeu.
 */
export const SARA_PODE_MOVER_ETAPA = false as const;

export type AcaoConfirmada = {
  /** Contrato que já existia; nenhuma ação nova foi inventada. */
  action: "concluirAcao" | "registrarTentativa";
  payload: Record<string, unknown>;
  /** O que o corretor vai ver como confirmação. */
  resumo: string;
};

/** Prazo padrão quando a Sara não sugeriu um: daqui a duas horas. */
export function prazoOuPadrao(prazo: string | null | undefined, agora: Date = new Date()): string {
  if (typeof prazo === "string") {
    const t = Date.parse(prazo);
    if (Number.isFinite(t) && t > agora.getTime()) return new Date(t).toISOString();
  }
  return new Date(agora.getTime() + 2 * 60 * 60 * 1000).toISOString();
}

/**
 * Traduz a sugestão da Sara na chamada que o banco já aceita.
 *
 * Cliente que respondeu -> `concluirAcao` (acompanhamento comercial).
 * Cliente que ainda não respondeu -> `registrarTentativa`, porque o que existe
 * ali é cadência de prospecção, não ação comercial. Confundir os dois zeraria a
 * contagem de tentativas.
 */
export function acaoConfirmadaDaSara(
  bruta: SugestaoBruta | null | undefined,
  lead: { id: string; respondeu: boolean },
  versao: number,
  agora: Date = new Date(),
): AcaoConfirmada | null {
  const s = normalizarSara(bruta);
  if (!s || !s.proximaAcao || !s.politica.podeUsar) return null;

  const tipo = proximaAcaoSugerida(bruta);
  const prazo = prazoOuPadrao(s.prazo, agora);
  const base = { negocioId: Number(lead.id), versao };
  const titulo = s.proximaAcao.slice(0, 120);

  if (lead.respondeu) {
    return {
      action: "concluirAcao",
      payload: {
        action: "concluirAcao", ...base,
        resultado: "acao_concluida",
        obs: `Orientação da Sara aceita: ${titulo}`,
        proximaTipo: tipo, proximaTitulo: titulo, proximaEm: prazo,
        idem: `ui3:sara:${lead.id}:${versao}`,
      },
      resumo: `${titulo} · até ${new Date(prazo).toLocaleString("pt-BR")}`,
    };
  }

  return {
    action: "registrarTentativa",
    payload: {
      action: "registrarTentativa", ...base,
      canal: "whatsapp", resultado: "nao_respondeu",
      obs: `Orientação da Sara aceita: ${titulo}`,
      proximaTipo: null, proximaTitulo: null, proximaEm: null,
      idem: `ui3:sara:${lead.id}:${versao}`,
    },
    resumo: "Tentativa registrada — a cadência define o próximo contato.",
  };
}
