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
  carteira_aberta: number;
  carteira_critica: number;
  etapas: EtapaOperacao[];
  sem_primeira_resposta: number;
  resposta_mediana_min: number | null;
  resposta_p90_min: number | null;
  visitas_agendadas: number;
  visitas_realizadas: number;
  visitas_canceladas: number;
  conversao_lead_visita: number | null;
  realizacao_visita: number | null;
  vendas: number;
  vgv: number;
  ticket_medio: number | null;
  comissao_media_pct: number | null;
  dias_presenca: number;
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
    leads_novos?: number;
    carteira_aberta?: number;
    carteira_critica?: number;
    sem_primeira_resposta?: number;
    visitas_agendadas?: number;
    visitas_realizadas?: number;
    visitas_canceladas?: number;
    vendas?: number;
    vgv?: number;
    ticket_medio?: number | null;
    conversao_lead_visita?: number | null;
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
