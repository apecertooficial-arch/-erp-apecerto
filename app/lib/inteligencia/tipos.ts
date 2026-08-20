/* Contratos da Inteligência — tipos compartilhados por endpoint e telas. */

export type FonteStatus = "ok" | "parcial" | "ausente";
export type FonteMeta = { nome: string; status: FonteStatus; motivo?: string };
export type MetaInteligencia = { tela: string; periodo: { rotulo: string; dias: number; inicio: string; fim: string }; atualizadoEm: string; fontes: FonteMeta[]; cobertura: string | null; avisos: string[]; parcial: boolean };
export type RespostaInteligencia<T> = { data: T | null; meta: MetaInteligencia };

export type ConsentTupla = { nivel: string; eventos?: number; pageviews: number };
export type DispositivoTupla = { dispositivo: string; eventos?: number; pageviews: number };
export type EventoTipoTupla = { evento: string; total: number };
export type HoraTupla = { hora: number; eventos: number };
export type SemanaTupla = { semana_inicio: string; essenciais: number; analytics: number; marketing: number };

export type PrivacidadePayload = { periodo_dias: number; atualizado_em: string; total_eventos: number; total_pageviews: number; consentimento: ConsentTupla[]; dispositivos: DispositivoTupla[]; eventos_por_tipo: EventoTipoTupla[]; eventos_por_hora_hoje: HoraTupla[]; semanas: SemanaTupla[]; cobertura_utm: number | null; ultimo_evento_em: string | null };

export type OrigemTupla = { origem: string; pageviews: number; eventos: number };
export type PaginaTupla = { pagina: string; pageviews: number; eventos: number };
export type VisaoDigitalPayload = { periodo_dias: number; atualizado_em: string; total_eventos: number; total_pageviews: number; visualizacoes_item: number; intencao: number; leads_site: number; paginas: PaginaTupla[]; origens: OrigemTupla[]; dispositivos: DispositivoTupla[]; consentimento: ConsentTupla[]; cobertura_utm: number | null; ultimo_evento_em: string | null };

export type FunilItem = { nome: string; volume: number };
export type VisaoCeoPayload = { periodo_dias: number; atualizado_em: string; leads: number; leads_operacionais: number; leads_carga_historica: number; leads_site: number; negocios_f2_abertos: number; negocios_f2_parados: number; sla: { aguardando: number; mediana_min: number | null; p90_min: number | null }; vendas: number; vgv: number; vgv_ano: number; meta_vgv_ano: number; comissoes_total: number; vendas_sem_comissao: number; pipeline_valor: number | null; funil: FunilItem[] };

export type AtendimentoLead = { nome: string; responsavel: string | null; gerente: string | null; origem: string; espera_min: number; ultima: string | null; proxima: string };
export type AtendimentoPayload = { atualizado_em: string; periodo_dias: number; mediana_min: number | null; p90_min: number | null; aguardando: number; total_leads: number; recebidas: number; enviadas: number; baldes: { ate5: number; b5_15: number; b15_30: number; b30_60: number; acima60: number }; filas: { sem_resposta: number; acima_sla: number; mensagens: number; followup_vencidos: number; sem_proxima: number }; leads: AtendimentoLead[] };

export type FinDegraus = { vgv: number; receita: number; comissoes_pessoas: number; custos: number; contribuicao: number; pagas: number; pendente: number; excedente: number };
export type FinVenda = { nome: string; codigo: string; vgv: number | null; percentual: number | null; receita: number | null; comissoes: number | null; custos: number | null; contribuicao: number | null; pagamento: "pago" | "a pagar" | "bloqueado" | "divergente"; sem_custo: boolean };
export type FinParticipante = { nome: string; papel: string; calculada: number | null; paga: number | null; pendente: number | null; excedente: number | null };
export type FinanceiroPayload = { atualizado_em: string; periodo_dias: number; total_vendas: number; vendas_divergentes: number; degraus: FinDegraus; vendas: FinVenda[]; participantes: FinParticipante[] };

export type CorretorItem = { nome: string; gerente: string; gerente_id: number | null; limite: number | null; leads: number; negocios: number; vendas: number; vgv: number; visitas: number; vencidos: number; mediana: number | null; p90: number | null; aguardando: number };
export type CorretoresPayload = { atualizado_em: string; periodo_dias: number; totais: { leads: number; vendas: number }; corretores: CorretorItem[] };

export type EquipeRollup = { nome: string; corretores: number; leads: number; vendas: number; vgv: number; vencidos: number; lead_venda: number | null; mediana: number | null; p90: number | null };
export type EquipePayload = { atualizado_em: string; periodo_dias: number; leads: number; negocios: number; visitas: number; vendas: number; vgv: number; sla: { mediana_min: number | null; p90_min: number | null }; comissao_bruta: number; comissao_pessoas: number; followups_vencidos: number; negocios_sem_proxima: number; visitas_sem_feedback: number; perdas_sem_motivo: number; equipes: EquipeRollup[] };

export type GerenteItem = { nome: string; corretores: number; neg: number; lim: number | null; leads: number; mediana: number | null; p90: number | null; lead_venda: number | null; visitas: number; vendas: number; vgv: number; vencidos: number };
export type GerentePaginaCorretor = { nome: string; carga_neg: number; carga_lim: number | null; leads: number; mediana: number | null; p90: number | null };
export type GerentesPayload = { atualizado_em: string; periodo_dias: number; lista: GerenteItem[]; pagina: { nome: string; equipe: number; corretores: GerentePaginaCorretor[]; funil: { leads: number; negocios: number; visitas: number; vendas: number }; vgv: number; meta_vgv: number; intervencao: { vencidos: number; aguardando: number } } };

export type VendasEtapa = { etapa: string; negocios: number; vgv: number | null; probabilidade: number | null; ponderado: number | null };
export type VendasItem = { nome: string; corretor: string; vgv: number | null; ciclo: number | null; canal: string };
export type VendasEquipe = { nome: string; meta: number; realizado: number; pct: number | null };
export type VendasPayload = { atualizado_em: string; periodo_dias: number; realizado: number; meta: number; realizado_pct: number | null; falta: number; previsao: number | null; cobertura_previsao: number | null; concluidas: number; ciclo_medio: number | null; ritmo: number | null; dias_uteis: number | null; equipes: VendasEquipe[]; etapas: VendasEtapa[]; total_etapas: { negocios: number; vgv: number | null; ponderado: number | null }; vendas: VendasItem[]; total_vendas: number; fora_da_lista: number };

export type QualidadeCriterios = Record<string, number | null>;
export type QualidadePessoa = { nome: string; nota: number | null; amostra: number; criterios: QualidadeCriterios };
export type QualidadePayload = { atualizado_em: string; periodo_dias: number; nota_empresa: number | null; amostra: number; criticas: number; criterios: QualidadeCriterios; pessoas: QualidadePessoa[] };

export type AlertasTipos = { sla: number; sla_criticos: number; followup: number; mensagem: number; negocio_parado: number; visita_sem_feedback: number; carga: number; venda_sem_comissao: number; meta_sem_cadastro: number; fonte_parada: number };
export type AlertasPayload = { atualizado_em: string; periodo_dias: number; tipos: AlertasTipos; engine: { total: number; abertos: number; reconhecidos: number } };

export type AquisicaoLinha = { origem: string; leads: number; negocios: number; leadNeg: number | null; carga_historica: boolean };
export type AquisicaoPayload = { atualizado_em: string; periodo_dias: number; visualizacoes: number; intencao: number; leads: number; leads_operacionais: number; leads_carga_historica: number; negocios: number; visitas: number; vendas: number; linhas: AquisicaoLinha[]; nao_atribuido: number };

export type ComportamentoPagina = { pagina: string; pageviews: number; eventos: number };
export type ComportamentoEvento = { evento: string; total: number };
export type ComportamentoPayload = { atualizado_em: string; periodo_dias: number; total_pageviews: number; total_eventos: number; scroll_depth: number; paginas: ComportamentoPagina[]; eventos: ComportamentoEvento[]; dispositivos: { dispositivo: string; pageviews: number; eventos?: number }[] };

export type ImoveisItem = { pagina: string; pageviews: number; view_item: number };
export type ImoveisPayload = { atualizado_em: string; periodo_dias: number; view_item: number; property_search: number; filter_change: number; paginas: ImoveisItem[] };

export type ConversaoEtapa = { etapa: string; volume: number; taxa: number | null };
export type ConversaoCorretor = { nome: string; negocios: number; vendas: number; conv: number | null };
export type ConversaoPayload = { atualizado_em: string; periodo_dias: number; leads: number; leads_carga_historica: number; negocios: number; visitas: number; vendas: number; ganho: number; perdido: number; pipeline_valor: number | null; valor_fechado: number; sla_mediana_min: number | null; sem_atendimento: number; parados: number; etapas: ConversaoEtapa[]; corretores: ConversaoCorretor[] };

export type ProprietariosPayload = { atualizado_em: string; periodo_dias: number; owner_events: number; vendas_com_proprietario: number; proprietarios_distintos: number; empreendimentos: { nome: string; vendas: number; vgv: number }[] };

export type SaraPayload = { atualizado_em: string; periodo_dias: number; sara_open: number; sara_search: number; sara_results: number; sara_error: number; eventos: { evento: string; total: number }[] };
