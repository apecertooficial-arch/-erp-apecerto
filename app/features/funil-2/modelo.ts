export const ETAPAS_FUNIL2 = [
  { codigo: "novo", rotulo: "Lead novo", ajuda: "Chegou agora; primeira abordagem em até 5 minutos." },
  { codigo: "tentando_contato", rotulo: "Tentando contato", ajuda: "Nunca respondeu; seis tentativas em dias úteis, a última é a despedida." },
  { codigo: "em_atendimento", rotulo: "Em atendimento", ajuda: "Respondeu; qualificar e provocar a visita." },
  { codigo: "visita", rotulo: "Visita", ajuda: "Agendada, realizada ou cancelada." },
  { codigo: "atualizar_manual", rotulo: "Atualizar manualmente", ajuda: "Sem conversa para a Sara ler; o corretor classifica com o que sabe." },
] as const;

export type EtapaFunil2 = string;

export type EtapaConfigFunil2 = {
  codigo: string;
  ordem: number;
  rotulo: string;
  ajuda: string;
  ativo: boolean;
};

export type MomentoFunil2 = {
  codigo: string;
  etapa: EtapaFunil2;
  ordem: number;
  rotulo: string;
  descricao: string;
  acao_codigo: string;
  acao_rotulo: string;
  prazo_minutos: number | null;
  prazo_rotulo: string;
  exige_dapi: boolean;
  ativo?: boolean;
};

export type VisitaFunil2 = {
  id: string;
  funil_lead_id: string;
  inicio_em: string;
  imovel: string;
  status: "agendada" | "confirmada" | "realizada" | "cancelada" | "nao_compareceu";
  observacao: string | null;
  feedback_em?: string | null;
  feedback_por?: string | null;
  atualizado_em: string;
};

export type NegociacaoFunil2 = {
  id: string;
  funil_lead_id: string;
  titulo: string;
  etapa: "qualificacao" | "simulacao" | "proposta" | "documentacao" | "contrato" | "venda" | "perdida";
  valor: number | null;
  observacao: string | null;
  atualizado_em: string;
};

export type CandidatoAquarioFunil2 = {
  negocio_id: number;
  nome: string;
};

export type SaraStatusFunil2 = {
  modo: string | null;
  runnerAtivo: boolean;
  analisesNoLaboratorio: number;
  reavaliacaoAutomaticaFunil2: boolean;
  loteFunil2?: number | null;
  modoExecucaoFunil2?: "canary" | "completo";
  canaryLimiteFunil2?: number | null;
};

export type OperacaoConfigFunil2 = {
  id: boolean;
  horario_inicio: string;
  horario_fim: string;
  presenca_ttl_min: number;
  primeira_abordagem_min: number;
  feedback_visita_min: number;
  notificacao_urgente_min: number;
  peso_primeira_abordagem: number;
  peso_acoes_prazo: number;
  peso_feedback_visita: number;
  peso_presenca_dapi: number;
  peso_coerencia_sara: number;
  suspensao_nivel_1_h: number;
  suspensao_nivel_2_h: number;
  suspensao_nivel_3_h: number;
};

/** Nota do atendimento, escrita pelo corretor no card. */
export type NotaFunil2 = {
  id: number;
  funil_lead_id: string;
  texto: string;
  origem: "corretor" | "gestao" | "sara";
  autor_nome: string | null;
  criado_em: string;
};

/** Por qual numero o contato esta sendo feito. Corretor com mais de uma
    instancia precisa disso para nao se perder. */
export type InstanciaDoLead = {
  rotulo: string | null;
  telefone: string | null;
  status: string | null;
};

export type LeadFunil2 = {
  id: string;
  origem_negocio_id: number;
  /** Lead original. Usado pelo mini-chat oficial para localizar a conversa real. */
  lead_id: number;
  nome: string;
  telefone: string | null;
  corretor_id: number | null;
  corretor_nome: string | null;
  instancia_rotulo?: string | null;
  instancia_telefone?: string | null;
  instancia_status?: string | null;
  etapa: EtapaFunil2;
  momento_codigo: string;
  acao_codigo: string;
  acao_rotulo: string;
  proxima_acao_em: string;
  cadencia_passo: number;
  ultima_interacao_em: string | null;
  ultima_acao_confirmada_em: string | null;
  ultima_acao_fonte: string | null;
  ultima_reavaliacao_sara_em: string | null;
  ultima_reavaliacao_resumo: string | null;
  corte_conversa_em: string;
  historico_completo: boolean;
  descartado_em?: string | null;
  descarte_motivo?: string | null;
  descarte_detalhe?: string | null;
  versao: number;
  atualizado_em: string;
};

export type EventoFunil2 = {
  id: number;
  funil_lead_id: string;
  tipo: string;
  titulo: string;
  detalhe: string | null;
  payload: Record<string, unknown>;
  criado_em: string;
};

/* A cadencia nao conta data, conta TENTATIVA. Sao 6, e o que escorrega no fim
   de semana e o dia -- nunca a tentativa. Os numeros abaixo sao os dias uteis
   de folga entre uma tentativa e a anterior; a tentativa 5 tem 2 dias porque e
   o respiro que o Romulo chamava de "o dia 5 nao existe".
   O calculo real da data mora no banco (f2_soma_dias_uteis); aqui e so rotulo. */
export const TOTAL_TENTATIVAS_CADENCIA = 6;
export const FOLGA_ENTRE_TENTATIVAS = [0, 1, 1, 1, 2, 1] as const;

export const MOMENTOS_COM_CADENCIA: Record<string, number> = {
  CADENCIA_CONTATO: 6,
  CADENCIA_SEM_RESPOSTA: 3,
};

/** Em que tentativa o lead esta, ou null se o momento nao tem cadencia. */
export function tentativaAtual(lead: Pick<LeadFunil2, "momento_codigo" | "cadencia_passo">): number | null {
  const total = MOMENTOS_COM_CADENCIA[lead.momento_codigo];
  if (!total) return null;
  const passo = Number(lead.cadencia_passo) || 0;
  return passo >= 1 && passo <= total ? passo : null;
}

/** True quando a cadencia acabou e falta o corretor decidir: insistir ou descartar. */
export function aguardandoDecisao(lead: Pick<LeadFunil2, "momento_codigo" | "cadencia_passo">): boolean {
  const total = MOMENTOS_COM_CADENCIA[lead.momento_codigo];
  if (!total) return false;
  return (Number(lead.cadencia_passo) || 0) > total;
}

export function rotuloCadencia(lead: Pick<LeadFunil2, "momento_codigo" | "cadencia_passo">): string | null {
  const total = MOMENTOS_COM_CADENCIA[lead.momento_codigo];
  if (!total) return null;
  if (aguardandoDecisao(lead)) return "Decidir: insistir ou descartar";
  const tentativa = tentativaAtual(lead);
  if (tentativa === null) return null;
  const despedida = lead.momento_codigo === "CADENCIA_CONTATO" && tentativa === total;
  return `Tentativa ${tentativa} de ${total}${despedida ? " · despedida" : ""}`;
}

export function acaoVisivel(lead: Pick<LeadFunil2, "momento_codigo" | "cadencia_passo" | "acao_rotulo">) {
  if (aguardandoDecisao(lead)) return "Decidir: insistir mais ou descartar";
  const cadencia = rotuloCadencia(lead);
  if (cadencia) return `${lead.acao_rotulo} · ${cadencia}`;
  return lead.acao_rotulo;
}

export function prazoDaAcao(lead: Pick<LeadFunil2, "proxima_acao_em" | "momento_codigo" | "cadencia_passo" | "acao_rotulo">, agora = Date.now()) {
  const situacao = situacaoPrazo(lead.proxima_acao_em, agora);
  return { ...situacao, rotulo: `${situacao.rotulo} para ${acaoVisivel(lead).toLowerCase()}` };
}

export function entraNoMeuDia(lead: Pick<LeadFunil2, "proxima_acao_em">, agora = Date.now()) {
  return new Date(lead.proxima_acao_em).getTime() <= agora + 2 * 60 * 60 * 1000;
}

export function venceHoje(lead: Pick<LeadFunil2, "proxima_acao_em">, agora = Date.now()) {
  const limite = new Date(agora);
  limite.setHours(23, 59, 59, 999);
  return new Date(lead.proxima_acao_em).getTime() <= limite.getTime();
}

export function situacaoPrazo(data: string, agora = Date.now()) {
  const minutos = Math.round((new Date(data).getTime() - agora) / 60000);
  if (minutos < 0) return { classe: "atrasado", rotulo: `Atrasado há ${duracao(-minutos)}` };
  if (minutos <= 120) return { classe: "urgente", rotulo: `Vence em ${duracao(minutos)}` };
  return { classe: "no-prazo", rotulo: `No prazo · faltam ${duracao(minutos)}` };
}

export function duracao(minutos: number) {
  if (minutos < 60) return `${Math.max(0, minutos)} min`;
  if (minutos < 1440) return `${Math.floor(minutos / 60)}h ${minutos % 60}min`;
  return `${Math.floor(minutos / 1440)}d ${Math.floor((minutos % 1440) / 60)}h`;
}

export function dataCurta(data: string | null) {
  if (!data) return "ainda não confirmado";
  return new Date(data).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
}
