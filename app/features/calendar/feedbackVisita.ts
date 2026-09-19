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

function rotulo<T extends ReadonlyArray<{ codigo: string; rotulo: string }>>(opcoes: T, codigo: string) {
  return opcoes.find((opcao) => opcao.codigo === codigo)?.rotulo ?? codigo;
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
  return null;
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
  if (!valor.startsWith("FEEDBACK_VISITA_V1 | ")
    || !presencas.has(valorDoEnvelope(valor, "Presença"))
    || !percepcoes.has(valorDoEnvelope(valor, "Percepção"))
    || valorDoEnvelope(valor, "Pontos positivos").length < 3
    || valorDoEnvelope(valor, "Pontos negativos").length < 3
    || valorDoEnvelope(valor, "Objeções").length < 3
    || !intencoes.has(valorDoEnvelope(valor, "Intenção"))
    || valorDoEnvelope(valor, "Próxima ação").length < 5) {
    return "Preencha o feedback estruturado da visita antes de salvar.";
  }
  return null;
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
    `Alternativas: ${texto(feedback.alternativasOferecidas) || "não oferecidas"}`,
    `Intenção: ${rotulo(INTENCOES_VISITA, feedback.intencao)}`,
    `Próxima ação: ${texto(feedback.proximaAcao)}`,
    `Resumo: ${texto(resumo, 120) || "sem observação adicional"}`,
  ];
  return partes.join(" | ").slice(0, 800);
}
