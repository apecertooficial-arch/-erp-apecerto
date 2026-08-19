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
