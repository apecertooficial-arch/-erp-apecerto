export const ETAPAS_FUNIL2 = [
  { codigo: "novo", rotulo: "Novo", ajuda: "Chegou agora; primeira abordagem em até 5 minutos." },
  { codigo: "tentando_contato", rotulo: "Tentando contato", ajuda: "Nunca respondeu; seguir os dias 1, 2, 4, 6 e 7." },
  { codigo: "em_atendimento", rotulo: "Em atendimento", ajuda: "Respondeu; entender, avançar produto e produzir visita." },
  { codigo: "pos_visita", rotulo: "Pós-visita", ajuda: "Registrar feedback e transformar a visita em próximo avanço." },
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
  corretor_nome: string | null;
  momento: string | null;
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

export type LeadFunil2 = {
  id: string;
  origem_negocio_id: number;
  nome: string;
  telefone: string | null;
  corretor_id: number | null;
  corretor_nome: string | null;
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

export const DIAS_CADENCIA = [1, 2, 4, 6, 7] as const;

export function diaCadencia(lead: Pick<LeadFunil2, "momento_codigo" | "cadencia_passo">): number | null {
  if (lead.momento_codigo !== "CADENCIA_SEM_RESPOSTA") return null;
  return DIAS_CADENCIA[lead.cadencia_passo] ?? null;
}

export function acaoVisivel(lead: Pick<LeadFunil2, "momento_codigo" | "cadencia_passo" | "acao_rotulo">) {
  const dia = diaCadencia(lead);
  if (dia !== null) return `Enviar mensagem da cadência · Dia ${dia}`;
  if (lead.momento_codigo === "CADENCIA_SEM_RESPOSTA") return "Cadência concluída · reavaliar o lead";
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
