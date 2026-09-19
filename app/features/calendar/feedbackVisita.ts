import type { StatusResultadoVisita } from "./resultadoVisita.ts";

export const PRESENCAS_VISITA = [
  { codigo: "sozinho", rotulo: "Sozinho(a)" },
  { codigo: "casal", rotulo: "Com companheiro(a)" },
  { codigo: "familia", rotulo: "Com família" },
  { codigo: "outros", rotulo: "Outros" },
] as const;

export const PERCEPCOES_VISITA = [
  { codigo: "encantado", rotulo: "Encantado" },
  { codigo: "gostou", rotulo: "Gostou" },
  { codigo: "neutro", rotulo: "Neutro" },
  { codigo: "nao_gostou", rotulo: "Não gostou" },
] as const;

export const INTENCOES_VISITA = [
  { codigo: "proposta", rotulo: "Fazer proposta" },
  { codigo: "negociacao", rotulo: "Continuar negociação" },
  { codigo: "nova_opcao", rotulo: "Conhecer outra opção" },
  { codigo: "acompanhar", rotulo: "Manter acompanhamento" },
  { codigo: "encerrar", rotulo: "Solicitar encerramento" },
] as const;

export type PresencaVisita = (typeof PRESENCAS_VISITA)[number]["codigo"];
export type PercepcaoVisita = (typeof PERCEPCOES_VISITA)[number]["codigo"];
export type IntencaoVisita = (typeof INTENCOES_VISITA)[number]["codigo"];

export type FeedbackVisitaDetalhado = {
  presenca: PresencaVisita | "";
  acompanhantes: string;
  percepcao: PercepcaoVisita | "";
  pontosPositivos: string;
  pontosNegativos: string;
  objecoes: string;
  alternativasOferecidas: string;
  intencao: IntencaoVisita | "";
  proximaAcao: string;
};

export const NOTA_MINIMA_FEEDBACK_VISITA = 9;

export type AvaliacaoQualidadeFeedbackVisita = {
  nota: number;
  pendencias: string[];
};

export const FEEDBACK_VISITA_VAZIO: FeedbackVisitaDetalhado = {
  presenca: "",
  acompanhantes: "",
  percepcao: "",
  pontosPositivos: "",
  pontosNegativos: "",
  objecoes: "",
  alternativasOferecidas: "",
  intencao: "",
  proximaAcao: "",
};

function texto(value: string, max = 90) {
  return value.trim().replace(/\s+/g, " ").slice(0, max);
}

function temConteudo(value: string, minimo = 3) {
  return texto(value, 120).length >= minimo;
}

function rotulo<T extends ReadonlyArray<{ codigo: string; rotulo: string }>>(opcoes: T, codigo: string) {
  return opcoes.find((opcao) => opcao.codigo === codigo)?.rotulo ?? codigo;
}

/** Nota operacional transparente. Cada um dos dez critérios vale um ponto;
 * não há inferência de IA nem avaliação subjetiva escondida. */
export function avaliarQualidadeFeedbackVisita(
  feedback: FeedbackVisitaDetalhado,
): AvaliacaoQualidadeFeedbackVisita {
  const criterios: Array<[boolean, string]> = [
    [Boolean(feedback.presenca), "informe quem participou"],
    [feedback.presenca === "sozinho" || temConteudo(feedback.acompanhantes), "identifique quem participou com o cliente"],
    [Boolean(feedback.percepcao), "registre a percepção do cliente"],
    [temConteudo(feedback.pontosPositivos), "registre os pontos positivos"],
    [temConteudo(feedback.pontosNegativos), "registre os pontos negativos"],
    [temConteudo(feedback.objecoes), "registre as objeções"],
    [temConteudo(feedback.alternativasOferecidas), "informe as alternativas oferecidas ou escreva ‘nenhuma’"],
    [Boolean(feedback.intencao), "defina a intenção atual"],
    [temConteudo(feedback.proximaAcao, 5), "registre a próxima ação"],
    [temConteudo(feedback.proximaAcao, 12), "detalhe quando ou como a próxima ação será executada"],
  ];
  return {
    nota: criterios.filter(([atendido]) => atendido).length,
    pendencias: criterios.filter(([atendido]) => !atendido).map(([, pendencia]) => pendencia),
  };
}

function erroDeQualidade(avaliacao: AvaliacaoQualidadeFeedbackVisita) {
  if (avaliacao.nota >= NOTA_MINIMA_FEEDBACK_VISITA) return null;
  const principais = avaliacao.pendencias.slice(0, 3).join("; ");
  return `Qualidade do feedback: ${avaliacao.nota}/10. ${principais}. O mínimo é ${NOTA_MINIMA_FEEDBACK_VISITA}/10.`;
}

export function validarFeedbackVisitaDetalhado(
  status: StatusResultadoVisita,
  feedback: FeedbackVisitaDetalhado | null,
) {
  if (status !== "realizada") return null;
  if (!feedback?.presenca) return "Informe quem participou da visita.";
  if (!feedback.percepcao) return "Informe a percepção do cliente.";
  if (texto(feedback.pontosPositivos, 120).length < 3) return "Registre os pontos positivos, mesmo que a resposta seja ‘nenhum’.";
  if (texto(feedback.pontosNegativos, 120).length < 3) return "Registre os pontos negativos, mesmo que a resposta seja ‘nenhum’.";
  if (texto(feedback.objecoes, 120).length < 3) return "Registre as objeções, mesmo que a resposta seja ‘nenhuma’.";
  if (!feedback.intencao) return "Defina a intenção atual do cliente.";
  if (texto(feedback.proximaAcao, 120).length < 5) return "Registre a próxima ação combinada.";
  return erroDeQualidade(avaliarQualidadeFeedbackVisita(feedback));
}

function valorDoEnvelope(valor: string, campo: string) {
  const marcador = ` | ${campo}: `;
  const inicio = valor.indexOf(marcador);
  if (inicio < 0) return "";
  const conteudoInicio = inicio + marcador.length;
  const fim = valor.indexOf(" | ", conteudoInicio);
  return valor.slice(conteudoInicio, fim < 0 ? undefined : fim).trim();
}

/** Defesa compartilhada pelas APIs contra clientes antigos ou chamadas
 * manuais que tentem concluir a visita com um texto livre curto. */
export function validarEnvelopeFeedbackVisita(status: StatusResultadoVisita, justificativa: string) {
  if (status !== "realizada") return null;
  const valor = justificativa.trim();
  const presencas = new Set<string>(PRESENCAS_VISITA.map((item) => item.rotulo));
  const percepcoes = new Set<string>(PERCEPCOES_VISITA.map((item) => item.rotulo));
  const intencoes = new Set<string>(INTENCOES_VISITA.map((item) => item.rotulo));
  const presenca = valorDoEnvelope(valor, "Presença");
  const percepcao = valorDoEnvelope(valor, "Percepção");
  const intencao = valorDoEnvelope(valor, "Intenção");
  if (!valor.startsWith("FEEDBACK_VISITA_V1 | ")
    || !presencas.has(presenca)
    || !percepcoes.has(percepcao)
    || valorDoEnvelope(valor, "Pontos positivos").length < 3
    || valorDoEnvelope(valor, "Pontos negativos").length < 3
    || valorDoEnvelope(valor, "Objeções").length < 3
    || !intencoes.has(intencao)
    || valorDoEnvelope(valor, "Próxima ação").length < 5) {
    return "Preencha o feedback estruturado da visita antes de salvar.";
  }
  const feedback: FeedbackVisitaDetalhado = {
    presenca: PRESENCAS_VISITA.find((item) => item.rotulo === presenca)?.codigo ?? "",
    acompanhantes: valorDoEnvelope(valor, "Acompanhantes").replace(/^não informado$/i, ""),
    percepcao: PERCEPCOES_VISITA.find((item) => item.rotulo === percepcao)?.codigo ?? "",
    pontosPositivos: valorDoEnvelope(valor, "Pontos positivos"),
    pontosNegativos: valorDoEnvelope(valor, "Pontos negativos"),
    objecoes: valorDoEnvelope(valor, "Objeções"),
    alternativasOferecidas: valorDoEnvelope(valor, "Alternativas").replace(/^não (informado|oferecidas)$/i, ""),
    intencao: INTENCOES_VISITA.find((item) => item.rotulo === intencao)?.codigo ?? "",
    proximaAcao: valorDoEnvelope(valor, "Próxima ação"),
  };
  return erroDeQualidade(avaliarQualidadeFeedbackVisita(feedback));
}

/**
 * Envelope de transição legível e determinístico. Ele cabe no contrato textual
 * vigente e pode ser convertido sem perda para JSONB quando a migration de
 * feedback estruturado atravessar o ensaio isolado.
 */
export function montarJustificativaFeedbackVisita(
  feedback: FeedbackVisitaDetalhado,
  resumo: string,
) {
  const partes = [
    "FEEDBACK_VISITA_V1",
    `Presença: ${rotulo(PRESENCAS_VISITA, feedback.presenca)}`,
    `Acompanhantes: ${texto(feedback.acompanhantes) || "não informado"}`,
    `Percepção: ${rotulo(PERCEPCOES_VISITA, feedback.percepcao)}`,
    `Pontos positivos: ${texto(feedback.pontosPositivos)}`,
    `Pontos negativos: ${texto(feedback.pontosNegativos)}`,
    `Objeções: ${texto(feedback.objecoes)}`,
    `Alternativas: ${texto(feedback.alternativasOferecidas) || "não informado"}`,
    `Intenção: ${rotulo(INTENCOES_VISITA, feedback.intencao)}`,
    `Próxima ação: ${texto(feedback.proximaAcao)}`,
    `Resumo: ${texto(resumo, 120) || "sem observação adicional"}`,
  ];
  return partes.join(" | ").slice(0, 800);
}
