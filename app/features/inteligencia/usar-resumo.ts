"use client";

import { useEffect, useMemo, useState } from "react";

export type FonteOperacao = {
  nome: string;
  status: "conectado" | "parcial" | "ausente";
  motivo?: string;
};

export type EtapaOperacao = { etapa: string; quantidade: number };

export type CorretorOperacao = {
  corretor_id: number;
  nome: string;
  leads_novos: number;
  carteira_ativa: number;
  pescados_na_carteira: number;
  clientes_aguardando: number;
  clientes_criticos: number;
  etapas: EtapaOperacao[];
  resposta_mediana_min: number | null;
  resposta_p90_min: number | null;
  conversas_respondidas: number;
  conversas_sem_resposta: number;
  visitas_agendadas: number;
  visitas_realizadas: number;
  visitas_canceladas: number;
  cohort_com_visita: number;
  conversao_coorte_visita: number | null;
  realizacao_visita: number | null;
  vendas: number;
  vgv: number;
  ticket_medio: number | null;
  comissao_media_pct: number | null;
  dias_presenca: number;
  dias_uteis_sem_confirmacao: number;
  no_escritorio_agora: boolean;
  ultima_presenca: string | null;
  captacoes: number;
  nota_ia: number | null;
  avaliacoes_ia: number;
  mensagens_texto: number;
  audios: number;
  imagens: number;
  followups_vencidos: number;
  horas_erp: number | null;
  horas_erp_motivo: string;
  pulos_distribuicao: number | null;
  pulos_distribuicao_motivo: string;
};

export type OperacaoResumo = {
  periodo?: { dias?: number; inicio?: string; fim?: string };
  operacao?: {
    corretores_ativos?: number;
    no_escritorio_agora?: number;
    leads_funil_ativos?: number;
    leads_entraram_periodo?: number;
    pescados_na_carteira?: number;
    leads_bolsao?: number;
    disponiveis_pesca?: number;
    clientes_aguardando?: number;
    clientes_criticos?: number;
    visitas_agendadas?: number;
    visitas_realizadas?: number;
    visitas_canceladas?: number;
    vendas?: number;
    vgv?: number;
    ticket_medio?: number | null;
    realizacao_visita?: number | null;
    nota_ia?: number | null;
    avaliacoes_ia?: number;
    dias_presenca?: number;
    captacoes?: number;
    followups_vencidos?: number;
    horas_erp?: number | null;
    horas_erp_motivo?: string;
    pulos_distribuicao?: number | null;
    pulos_distribuicao_motivo?: string;
  };
  funil?: EtapaOperacao[];
  equipe?: CorretorOperacao[];
  acoes?: Array<{ id: string; lead: string; corretor: string; etapa: string; prioridade: number; espera_min: number | null; motivo: string }>;
  bolsao?: {
    origens?: Array<{ origem: string; quantidade: number }>;
    oportunidades?: Array<{ id: number; nome: string; origem: string; negocio_id: number; ultima_interacao: string | null; qtd_recebidas: number | null; qtd_enviadas: number | null; criado_em: string }>;
  };
  regra_escopo?: { fonte: string; criterio: string; bolsao: string };
  fontes?: FonteOperacao[];
  atualizado_em?: string;
};

export type CampanhaMarketing = {
  source: string;
  medium: string;
  campaign: string;
  page_views: number;
  cta_clicks: number;
  leads: number;
  negocios: number;
  visitas_agendadas: number;
  visitas_realizadas: number;
  visitas_canceladas: number;
  vendas: number;
  vgv: number;
  investimento: number | null;
  impressoes: number | null;
  cliques_midia: number | null;
  ctr: number | null;
  cpc: number | null;
  cpl: number | null;
  roas: number | null;
};

export type MarketingResumo = {
  periodo?: { dias?: number; inicio?: string; fim?: string };
  resumo?: {
    page_views?: number;
    visitas_rastreadas?: number;
    visitas_engajadas?: number;
    visualizacoes_imovel?: number;
    cliques_cta?: number;
    formularios_iniciados?: number;
    leads_gerados?: number;
    ultimo_evento_em?: string | null;
  };
  comportamento?: {
    tempo_engajamento_medio_seg?: number | null;
    saida_rapida_pct?: number | null;
    abandono_formulario?: number;
    chegou_metade?: number;
    chegou_final?: number;
  };
  campanhas?: CampanhaMarketing[];
  eventos?: Array<{ evento: string; quantidade: number }>;
  paginas?: Array<{ page_path: string; visualizacoes: number; cliques_cta: number; leads: number }>;
  imoveis?: Array<{ item_id: string; imovel: string; bairro: string | null; visualizacoes: number; visitas: number }>;
  midia?: {
    meta?: PlataformaMidia;
    google?: PlataformaMidia;
    atualizado_em?: string;
  };
  ga4?: {
    totais: { sessoes: number; visualizacoes: number; sessoesEngajadas: number; taxaEngajamento: number | null } | null;
    paginas: Array<{ pagina: string; visualizacoes: number; entradas: number }>;
    origens: Array<{ origem: string; sessoes: number; engajadas: number }>;
    dispositivos: Array<{ dispositivo: string; sessoes: number }>;
  } | null;
  ga4_configurado?: boolean;
  saude?: {
    total_eventos?: number;
    ultimo_evento_em?: string | null;
    eventos_invalidos?: number;
    tracking_atrasado?: boolean;
    meta_ads_conectado?: boolean;
    google_ads_conectado?: boolean;
    gtm_containers?: number | null;
    gtm_motivo?: string;
    atribuicao?: { total?: number; com_origem?: number; com_campanha?: number; com_click_id?: number };
    crm?: { total?: number; sincronizados?: number; erros?: number };
    entrega_midia?: { total?: number; entregues?: number; pendentes?: number; falhas?: number; ultima_entrega_em?: string | null };
  };
  atualizado_em?: string;
};

export type AnuncioMidia = {
  plataforma: "Meta" | "Google";
  campanha_id?: string;
  campanha: string;
  conjunto_id?: string;
  conjunto: string;
  anuncio_id?: string;
  anuncio: string;
  objetivo?: string | null;
  status: string;
  investimento: number;
  impressoes: number;
  alcance?: number;
  cliques: number;
  ctr: number;
  cpc: number;
  leads_plataforma: number;
  cpl_plataforma: number | null;
};

export type PlataformaMidia = {
  status: "conectado" | "nao_configurado" | "sem_permissao" | "sem_conta" | "erro" | "indisponivel";
  motivo?: string | null;
  contas?: Array<{ id: string; nome: string; moeda: string }>;
  anuncios?: AnuncioMidia[];
};

export type InteligenciaResumo = {
  operacao?: OperacaoResumo;
  marketing?: MarketingResumo;
};

export function diasDoPeriodo(periodo: string) {
  if (periodo === "Hoje") return 1;
  if (periodo === "7 dias") return 7;
  if (periodo === "90 dias") return 90;
  return 30;
}

export function useResumoInteligencia(accessToken: string, periodo: string) {
  const days = useMemo(() => diasDoPeriodo(periodo), [periodo]);
  const [data, setData] = useState<InteligenciaResumo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();

    fetch(`/api/inteligencia?days=${days}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
      cache: "no-store",
      signal: controller.signal,
    })
      .then(async (response) => {
        const body = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(body?.error ?? "Não foi possível carregar a Inteligência.");
        return body?.resumo as InteligenciaResumo;
      })
      .then((resumo) => {
        setData(resumo);
        setError(null);
      })
      .catch((reason: unknown) => {
        if (controller.signal.aborted) return;
        setError(reason instanceof Error ? reason.message : "Não foi possível carregar a Inteligência.");
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => controller.abort();
  }, [accessToken, days]);

  return { data, loading, error };
}
