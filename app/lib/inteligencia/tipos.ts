/* Contratos da Inteligência — resposta padrão { data, meta } e formatos crus das
 * RPCs de telemetria. Compartilhado pelo endpoint (servidor) e pelas telas
 * (cliente). Nada aqui fala com Supabase: só tipos. */

export type FonteStatus = "ok" | "parcial" | "ausente";

export type FonteMeta = {
  nome: string;
  status: FonteStatus;
  motivo?: string;
};

export type MetaInteligencia = {
  tela: string;
  periodo: { rotulo: string; dias: number; inicio: string; fim: string };
  atualizadoEm: string;
  fontes: FonteMeta[];
  cobertura: string | null;
  avisos: string[];
  parcial: boolean;
};

export type RespostaInteligencia<T> = {
  data: T | null;
  meta: MetaInteligencia;
};

/* ---- formatos crus vindos das RPCs (jsonb) ---- */

export type ConsentTupla = { nivel: string; eventos?: number; pageviews: number };
export type DispositivoTupla = { dispositivo: string; eventos?: number; pageviews: number };
export type EventoTipoTupla = { evento: string; total: number };
export type HoraTupla = { hora: number; eventos: number };
export type SemanaTupla = { semana_inicio: string; essenciais: number; analytics: number; marketing: number };

export type PrivacidadePayload = {
  periodo_dias: number;
  atualizado_em: string;
  total_eventos: number;
  total_pageviews: number;
  consentimento: ConsentTupla[];
  dispositivos: DispositivoTupla[];
  eventos_por_tipo: EventoTipoTupla[];
  eventos_por_hora_hoje: HoraTupla[];
  semanas: SemanaTupla[];
  cobertura_utm: number | null;
  ultimo_evento_em: string | null;
};

export type OrigemTupla = { origem: string; pageviews: number; eventos: number };
export type PaginaTupla = { pagina: string; pageviews: number; eventos: number };

export type VisaoDigitalPayload = {
  periodo_dias: number;
  atualizado_em: string;
  total_eventos: number;
  total_pageviews: number;
  visualizacoes_item: number;
  intencao: number;
  leads_site: number;
  paginas: PaginaTupla[];
  origens: OrigemTupla[];
  dispositivos: DispositivoTupla[];
  consentimento: ConsentTupla[];
  cobertura_utm: number | null;
  ultimo_evento_em: string | null;
};

/* ---- Performance / CRM ---- */

export type FunilItem = { nome: string; volume: number };

export type VisaoCeoPayload = {
  periodo_dias: number;
  atualizado_em: string;
  leads: number;
  leads_site: number;
  negocios_f2_abertos: number;
  sla: { aguardando: number; mediana_min: number | null; p90_min: number | null };
  vendas: number;
  vgv: number;
  vgv_ano: number;
  meta_vgv_ano: number;
  comissoes_total: number;
  vendas_sem_comissao: number;
  pipeline_valor: number | null;
  funil: FunilItem[];
};

export type AtendimentoLead = { nome: string; responsavel: string | null; gerente: string | null; origem: string; espera_min: number; ultima: string | null; proxima: string };

export type AtendimentoPayload = {
  atualizado_em: string;
  periodo_dias: number;
  mediana_min: number | null;
  p90_min: number | null;
  aguardando: number;
  total_leads: number;
  recebidas: number;
  enviadas: number;
  baldes: { ate5: number; b5_15: number; b15_30: number; b30_60: number; acima60: number };
  filas: { sem_resposta: number; acima_sla: number; mensagens: number; followup_vencidos: number; sem_proxima: number };
  leads: AtendimentoLead[];
};

export type FinDegraus = { vgv: number; receita: number; comissoes_pessoas: number; custos: number; contribuicao: number; pagas: number; pendente: number };
export type FinVenda = { nome: string; codigo: string; vgv: number | null; percentual: number | null; receita: number | null; comissoes: number | null; custos: number | null; contribuicao: number | null; pagamento: string; sem_custo: boolean };
export type FinParticipante = { nome: string; papel: string; calculada: number | null; paga: number | null; pendente: number | null };
export type FinanceiroPayload = { atualizado_em: string; periodo_dias: number; total_vendas: number; degraus: FinDegraus; vendas: FinVenda[]; participantes: FinParticipante[] };
