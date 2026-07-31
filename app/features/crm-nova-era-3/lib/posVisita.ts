/**
 * DEPOIS DA VISITA — os sete resultados e para onde cada um leva. PURO.
 *
 * Decisão de negócio (Rômulo, 31/07): o cliente NÃO fica parado no Pipe de
 * Visitas depois que a visita acontece. Ele volta para "Em acompanhamento"
 * com próxima ação obrigatória — menos quem fez proposta (vai para a Esteira)
 * e quem não gostou (vai para descarte com motivo).
 *
 * O motivo da decisão importa mais que a decisão: cliente sem próxima ação e
 * sem dono some do Meu Dia, e some do dia do corretor junto.
 *
 * COBRANÇA: a visita realizada vira pendência na MANHÃ SEGUINTE, às 9h. Cobrar
 * no minuto seguinte ao horário marcado pegaria o corretor ainda com o cliente.
 *
 * Este arquivo é a ESPECIFICAÇÃO executável. A gravação depende de migration
 * (a tabela `visitas` hoje só tem status), e enquanto ela não existir a tela
 * não oferece o registro — em vez de oferecer e perder o que o corretor digitou.
 */

export type ResultadoVisita =
  | "interessado"
  | "quer_outra_opcao"
  | "precisa_conversar"
  | "nao_gostou"
  | "nao_compareceu"
  | "remarcar"
  | "fara_proposta";

export type DestinoPosVisita = "funil_acompanhamento" | "esteira_vendas" | "descarte" | "nova_visita";

export type DefinicaoResultado = {
  chave: ResultadoVisita;
  rotulo: string;
  destino: DestinoPosVisita;
  /** Próxima ação já sugerida, para o corretor não sair da tela sem compromisso. */
  proximaAcaoTipo: string | null;
  /** Em quantas horas, a partir do registro, essa próxima ação vence. */
  prazoHoras: number | null;
  ajuda: string;
};

/** Os sete resultados possíveis. Ordem de uso real, não alfabética. */
export const RESULTADOS_VISITA: readonly DefinicaoResultado[] = Object.freeze([
  { chave: "fara_proposta", rotulo: "Vai fazer proposta", destino: "esteira_vendas",
    proximaAcaoTipo: "preparar_proposta", prazoHoras: 24,
    ajuda: "Registre a proposta na Esteira. Proposta não é venda." },
  { chave: "interessado", rotulo: "Gostou e está interessado", destino: "funil_acompanhamento",
    proximaAcaoTipo: "ligar_retorno", prazoHoras: 24,
    ajuda: "Volta ao acompanhamento: combine o próximo passo enquanto está quente." },
  { chave: "quer_outra_opcao", rotulo: "Quer ver outra opção", destino: "funil_acompanhamento",
    proximaAcaoTipo: "enviar_opcoes", prazoHoras: 24,
    ajuda: "Volta ao acompanhamento com data para enviar as novas opções." },
  { chave: "precisa_conversar", rotulo: "Precisa conversar com alguém", destino: "funil_acompanhamento",
    proximaAcaoTipo: "retornar_contato", prazoHoras: 72,
    ajuda: "Cônjuge, sócio, família. Volta ao acompanhamento com data de retorno." },
  { chave: "remarcar", rotulo: "Quer remarcar", destino: "nova_visita",
    proximaAcaoTipo: "agendar_visita", prazoHoras: 24,
    ajuda: "Só sai do Pipe quando a nova visita existir de verdade no calendário." },
  { chave: "nao_compareceu", rotulo: "Não compareceu", destino: "funil_acompanhamento",
    proximaAcaoTipo: "ligar_retorno", prazoHoras: 4,
    ajuda: "Volta ao acompanhamento hoje mesmo: entender o que houve antes de esfriar." },
  { chave: "nao_gostou", rotulo: "Não gostou", destino: "descarte",
    proximaAcaoTipo: null, prazoHoras: null,
    ajuda: "Exige motivo do descarte. O lead continua auditável e pode ser reativado." },
]);

const POR_CHAVE = new Map(RESULTADOS_VISITA.map((r) => [r.chave, r]));

export function definicaoResultado(chave: string): DefinicaoResultado | null {
  return POR_CHAVE.get(chave as ResultadoVisita) ?? null;
}

/** Todo resultado leva a algum lugar. Nenhum deixa o cliente parado. */
export function destinoDoResultado(chave: string): DestinoPosVisita | null {
  return definicaoResultado(chave)?.destino ?? null;
}

/**
 * Todo resultado que mantém o cliente vivo exige próxima ação com data.
 * Só o descarte pode terminar sem compromisso — porque ali o atendimento acabou.
 */
export function exigeProximaAcao(chave: string): boolean {
  const d = definicaoResultado(chave);
  return Boolean(d && d.destino !== "descarte");
}

/** Prazo concreto da próxima ação, a partir do momento do registro. */
export function prazoDoResultado(chave: string, registradoEm: Date): string | null {
  const d = definicaoResultado(chave);
  if (!d || d.prazoHoras === null) return null;
  return new Date(registradoEm.getTime() + d.prazoHoras * 60 * 60 * 1000).toISOString();
}

/* ---------------------------- Cobrança ---------------------------- */

/** 9h da manhã, horário de Brasília (UTC-3). */
const HORA_COBRANCA_UTC = 12;

/**
 * Quando o CRM cobra o resultado de uma visita: manhã seguinte, 9h.
 * Recebe a data/hora da visita e devolve o instante da cobrança.
 */
export function cobrancaDoResultado(visitaEm: Date): string {
  const seguinte = new Date(Date.UTC(
    visitaEm.getUTCFullYear(),
    visitaEm.getUTCMonth(),
    visitaEm.getUTCDate() + 1,
    HORA_COBRANCA_UTC, 0, 0, 0,
  ));
  return seguinte.toISOString();
}

/** A visita já deveria ter resultado registrado? */
export function resultadoAtrasado(visitaEm: Date, resultado: string | null, agora: Date): boolean {
  if (resultado) return false;
  return agora.getTime() >= Date.parse(cobrancaDoResultado(visitaEm));
}
