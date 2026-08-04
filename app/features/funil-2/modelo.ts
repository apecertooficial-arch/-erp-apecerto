export const ETAPAS_FUNIL2 = [
  { codigo: "novo", rotulo: "Novo", ajuda: "Chegou agora; primeira abordagem em até 5 minutos." },
  { codigo: "tentando_contato", rotulo: "Tentando contato", ajuda: "Nunca respondeu; seguir os dias 1, 2, 4, 6 e 7." },
  { codigo: "em_atendimento", rotulo: "Em atendimento", ajuda: "Respondeu; entender, avançar produto e produzir visita." },
  { codigo: "pos_visita", rotulo: "Pós-visita", ajuda: "Registrar feedback e transformar a visita em próximo avanço." },
] as const;

export type EtapaFunil2 = typeof ETAPAS_FUNIL2[number]["codigo"];

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
