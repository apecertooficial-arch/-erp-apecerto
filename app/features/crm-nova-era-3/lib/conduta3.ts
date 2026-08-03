import type { AnaliseSara } from "./adapter3.ts";

export type StatusPrazo = "atrasada" | "vence_logo" | "no_prazo" | "sem_prazo";

/** Etapa organiza o funil. Momento descreve o que está acontecendo agora. */
export const MOMENTOS_PADRAO = Object.freeze([
  { codigo: "PRIMEIRA_ABORDAGEM", ordem: 1, etapa: "novo", rotulo: "Primeira abordagem", acao: "PRIMEIRA_ABORDAGEM", objetivo: "Chamar enquanto o interesse está fresco.", slaMin: 5 },
  { codigo: "CADENCIA_SEM_RESPOSTA", ordem: 2, etapa: "tentando_contato", rotulo: "Cadência sem resposta", acao: "ENVIAR_CADENCIA", objetivo: "Produzir a primeira resposta sem abandonar o lead.", slaMin: 360 },
  { codigo: "CONVERSANDO_QUALIFICANDO", ordem: 3, etapa: "em_atendimento", rotulo: "Conversando e qualificando", acao: "RESPONDER_E_QUALIFICAR", objetivo: "Manter a conversa viva e completar o perfil.", slaMin: 1440 },
  { codigo: "BUSCANDO_PRODUTO", ordem: 4, etapa: "em_atendimento", rotulo: "Buscando produto", acao: "BUSCAR_E_ENVIAR_IMOVEIS", objetivo: "Encontrar e enviar opções compatíveis em até 24 horas.", slaMin: 1440 },
  { codigo: "PRODUTO_ENVIADO", ordem: 5, etapa: "em_atendimento", rotulo: "Produto enviado", acao: "PEDIR_RETORNO_PRODUTO", objetivo: "Descobrir o que agradou e ajustar a busca.", slaMin: 1440 },
  { codigo: "TENTANDO_AGENDAMENTO", ordem: 6, etapa: "em_atendimento", rotulo: "Tentando agendamento", acao: "AGENDAR_VISITA", objetivo: "Converter interesse em visita com data e hora.", slaMin: 720 },
  { codigo: "VISITA_AGENDADA", ordem: 7, etapa: "em_atendimento", rotulo: "Visita agendada", acao: "CONFIRMAR_VISITA", objetivo: "Confirmar presença 24 horas antes da visita.", slaMin: 1440 },
  { codigo: "RETORNO_PROGRAMADO", ordem: 8, etapa: "em_atendimento", rotulo: "Retorno programado", acao: "RETOMAR_NO_COMBINADO", objetivo: "Retomar na data e hora combinadas, no máximo em 5 dias.", slaMin: 7200 },
  { codigo: "FEEDBACK_POS_VISITA", ordem: 9, etapa: "em_acompanhamento", rotulo: "Feedback pós-visita", acao: "REGISTRAR_RESULTADO_VISITA", objetivo: "Registrar o desfecho da visita em até 2 horas.", slaMin: 120 },
  { codigo: "DECISAO_POS_VISITA", ordem: 10, etapa: "em_acompanhamento", rotulo: "Decisão pós-visita", acao: "AVANCAR_POS_VISITA", objetivo: "Definir nova opção, retorno ou proposta em até 24 horas.", slaMin: 1440 },
] as const);

export const ACOES_OFICIAIS = Object.freeze([
  { codigo: "PRIMEIRA_ABORDAGEM", rotulo: "Fazer a primeira abordagem", objetivo: "No horário oficial, iniciar em até 5 minutos; fora dele, chamar agora ou no próximo período." },
  { codigo: "ENVIAR_CADENCIA", rotulo: "Enviar a mensagem da cadência", objetivo: "Conseguir a primeira resposta sem deixar o lead parar." },
  { codigo: "RESPONDER_E_QUALIFICAR", rotulo: "Responder e qualificar", objetivo: "Manter a conversa viva e completar o perfil." },
  { codigo: "BUSCAR_E_ENVIAR_IMOVEIS", rotulo: "Buscar e enviar imóveis", objetivo: "Entregar opções compatíveis em até 24 horas." },
  { codigo: "PEDIR_RETORNO_PRODUTO", rotulo: "Pedir retorno sobre as opções", objetivo: "Descobrir o que agradou e ajustar a busca." },
  { codigo: "AGENDAR_VISITA", rotulo: "Agendar uma visita", objetivo: "Transformar interesse em visita com data e hora." },
  { codigo: "CONFIRMAR_VISITA", rotulo: "Confirmar a visita", objetivo: "Confirmar presença 24 horas antes da visita." },
  { codigo: "RETOMAR_NO_COMBINADO", rotulo: "Retomar no horário combinado", objetivo: "Retomar no combinado, no máximo em 5 dias." },
  { codigo: "REGISTRAR_RESULTADO_VISITA", rotulo: "Registrar o resultado da visita", objetivo: "Registrar o desfecho em até 2 horas." },
  { codigo: "AVANCAR_POS_VISITA", rotulo: "Definir o avanço pós-visita", objetivo: "Definir nova opção, retorno ou proposta em até 24 horas." },
] as const);

export type CodigoMomento = typeof MOMENTOS_PADRAO[number]["codigo"];
export type CodigoAcao = typeof ACOES_OFICIAIS[number]["codigo"];

export function ehCodigoMomento(v: unknown): v is CodigoMomento {
  return typeof v === "string" && MOMENTOS_PADRAO.some((m) => m.codigo === v);
}

export function momentoPorCodigo(codigo: unknown) {
  return MOMENTOS_PADRAO.find((m) => m.codigo === codigo) ?? null;
}

export function momentosDaEtapa(etapa: string) {
  return MOMENTOS_PADRAO.filter((m) => m.etapa === etapa);
}

function textoBase(valor: string | null | undefined): string {
  return String(valor ?? "").toLowerCase().normalize("NFD").replace(/\p{Diacritic}/gu, "");
}

function inferirMomento(etapa: string, texto: string, respondeu: boolean, codigo?: string | null) {
  if (ehCodigoMomento(codigo)) return momentoPorCodigo(codigo)!;
  if (etapa === "novo") return momentoPorCodigo("PRIMEIRA_ABORDAGEM")!;
  if (etapa === "tentando_contato" || !respondeu) return momentoPorCodigo("CADENCIA_SEM_RESPOSTA")!;
  if (etapa === "em_acompanhamento") return /resultado|feedback/.test(texto)
    ? momentoPorCodigo("FEEDBACK_POS_VISITA")! : momentoPorCodigo("DECISAO_POS_VISITA")!;
  if (/visita.*agend|confirmar.*visita/.test(texto)) return momentoPorCodigo("VISITA_AGENDADA")!;
  if (/agendar|marcar.*visita|horario.*visita/.test(texto)) return momentoPorCodigo("TENTANDO_AGENDAMENTO")!;
  if (/buscar|procurar|outro produto|outra regiao/.test(texto)) return momentoPorCodigo("BUSCANDO_PRODUTO")!;
  if (/opcoes? enviada|produto enviado|o que achou|retorno.*imovel/.test(texto)) return momentoPorCodigo("PRODUTO_ENVIADO")!;
  if (/combinado|retorno programado|viagem/.test(texto)) return momentoPorCodigo("RETORNO_PROGRAMADO")!;
  return momentoPorCodigo("CONVERSANDO_QUALIFICANDO")!;
}

export function momentoHumano(etapa: string | null | undefined, codigo?: string | null): string {
  return inferirMomento(String(etapa ?? ""), "", true, codigo).rotulo;
}

export function prazoDaConduta(prazo: string | null | undefined, agora = new Date()): { status: StatusPrazo; rotulo: string } {
  if (!prazo) return { status: "sem_prazo", rotulo: "Prazo sendo definido" };
  const fim = Date.parse(prazo);
  if (!Number.isFinite(fim)) return { status: "sem_prazo", rotulo: "Prazo sendo definido" };
  const minutos = Math.round((fim - agora.getTime()) / 60000);
  if (minutos < 0) {
    const atraso = Math.abs(minutos);
    return { status: "atrasada", rotulo: atraso < 60 ? `Atrasada há ${atraso} min` : `Atrasada há ${Math.floor(atraso / 60)}h` };
  }
  if (minutos < 60) return { status: "vence_logo", rotulo: `Faltam ${Math.max(1, minutos)} min` };
  if (minutos < 1440) return { status: "no_prazo", rotulo: `Faltam ${Math.floor(minutos / 60)}h` };
  return { status: "no_prazo", rotulo: `Faltam ${Math.floor(minutos / 1440)}d` };
}

export function condutaOficial(
  estado: { etapa?: string | null; momentoCodigo?: string | null; proximaAcao?: string | null; proximaAcaoEm?: string | null; respondeu?: boolean; respostaPendente?: boolean; tentativasFeitas?: number },
  analise?: AnaliseSara | null,
) {
  const textoLivre = analise?.proxima_acao_sugerida?.trim() || estado.proximaAcao?.trim() || "";
  const texto = textoBase(textoLivre);
  const etapa = String(estado.etapa ?? "");
  const respondeu = Boolean(estado.respondeu);
  const momento = inferirMomento(etapa, texto, respondeu, estado.momentoCodigo);
  let acaoCodigo = momento.acao as CodigoAcao;
  if (estado.respostaPendente) acaoCodigo = "RESPONDER_E_QUALIFICAR";
  const acao = ACOES_OFICIAIS.find((a) => a.codigo === acaoCodigo)!;
  const tentativas = Math.max(0, estado.tentativasFeitas ?? 0);
  const rotuloAcao = acaoCodigo === "ENVIAR_CADENCIA"
    ? `Enviar cadência ${Math.min(5, tentativas + 1)} de 5`
    : acao.rotulo;
  const prazo = (analise?.proxima_acao_sugerida?.trim() ? analise.prazo_sugerido : null) || estado.proximaAcaoEm || null;
  return {
    momento: momento.rotulo, momentoCodigo: momento.codigo, momentoOrdem: momento.ordem,
    etapa: momento.etapa, situacao: momento.objetivo, acao: rotuloAcao, acaoCodigo,
    prazo, objetivo: acao.objetivo, prazoInfo: prazoDaConduta(prazo),
    fonte: analise ? "Sara" as const : "CRM" as const,
    justificativa: analise?.justificativa?.trim() || textoLivre || null,
  };
}
