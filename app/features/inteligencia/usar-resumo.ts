"use client";

import { useEffect, useMemo, useState } from "react";

export type Tracking360Resumo = {
  periodo?: { dias?: number; inicio?: string; fim?: string };
  digital?: {
    page_views?: number;
    page_view_ids?: number;
    engaged_page_views?: number;
    intent_events?: number;
    form_starts?: number;
    generated_leads?: number;
    property_views?: number;
    property_searches?: number;
    sara_searches?: number;
    sara_results?: number;
    sara_errors?: number;
    owner_cta_clicks?: number;
    last_event_at?: string | null;
    site_leads?: { total?: number; owners?: number; buyers?: number; synced?: number; sync_errors?: number; deals?: number };
    attribution?: { total?: number; with_source?: number; with_campaign?: number; with_click_id?: number };
  };
  crm?: { leads?: number; deals?: number; open_deals?: number; won_deals?: number; lost_deals?: number; open_without_value?: number; pipeline_value?: number | null };
  sla?: { total?: number; responded?: number; valid?: number; invalid?: number; within_5?: number; over_5?: number; unanswered?: number; median_minutes?: number | null; p90_minutes?: number | null };
  visitas?: { total?: number; scheduled?: number; completed?: number; cancelled?: number; with_result?: number; completed_without_result?: number };
  propostas?: { total?: number; accepted?: number; converted?: number; value?: number };
  vendas?: { total?: number; vgv?: number; gross_commission?: number; costs?: number; payouts?: number; net_contribution?: number; target_vgv?: number; target_sales?: number; target_coverage_percent?: number | null };
  proprietarios?: { total?: number; from_site?: number; published?: number; contacted?: number };
  processo?: { overdue_actions?: number; without_next_action?: number };
  qualidade_dados?: {
    sla_timestamp_invalido?: number;
    sla_sem_resposta?: number;
    visitas_realizadas_sem_resultado?: number;
    negocios_abertos_sem_valor?: number;
    leads_site_com_erro_crm?: number;
    atribuicoes_sem_origem?: number;
    tracking_atrasado?: boolean;
  };
  equipe?: Array<{
    corretor_id: number;
    nome: string;
    leads: number;
    respostas_validas: number;
    sla_5_percentual: number | null;
    mediana_primeira_resposta_min: number | null;
    p90_primeira_resposta_min: number | null;
    visitas: number;
    visitas_realizadas: number;
    visitas_sem_feedback: number;
    vendas: number;
    vgv: number;
    followups_vencidos: number;
  }>;
  digital_health?: {
    consent?: { total?: number; essential?: number; analytics?: number; marketing?: number };
    weeks?: Array<{ inicio: string; total: number; essential: number; analytics: number; marketing: number }>;
    hours_today?: Array<{ hora: number; eventos: number }>;
    quality?: { invalid_events?: number; possible_duplicates?: number; last_event_at?: string | null; total_events?: number };
    crm_sync?: { pending?: number; errors?: number; total?: number };
    attribution?: { total?: number; with_source?: number; with_campaign?: number; with_click_id?: number };
    events?: string[];
    updated_at?: string;
  };
  delivery_health?: {
    total?: number;
    delivered?: number;
    pending?: number;
    failed?: number;
    blocked?: number;
    skipped?: number;
    last_delivery_at?: string | null;
    last_error_at?: string | null;
    last_error?: string | null;
    by_channel?: Record<string, { total?: number; delivered?: number; pending?: number; failed?: number; blocked?: number }>;
    updated_at?: string;
  };
  digital_journey?: Tracking360JornadaDigital;
  atualizado_em?: string;
};

export type Tracking360LinhaCanal = {
  source: string;
  medium: string;
  campaign: string;
  page_views: number;
  tracked_page_visits: number;
  property_views: number;
  whatsapp_clicks: number;
  form_starts: number;
  leads: number;
};

export type Tracking360Jornada = {
  visit_ref: string;
  started_at: string;
  last_at: string;
  page_path: string;
  device: string | null;
  source: string;
  medium: string;
  campaign: string;
  max_scroll: number;
  products: string[];
  clicked_whatsapp: boolean;
  clicked_phone: boolean;
  started_form: boolean;
  generated_lead: boolean;
  identified: boolean;
  identified_first_name: string | null;
  masked_phone: string | null;
  crm_lead_id: number | null;
  crm_negocio_id: number | null;
  event_names: string[];
};

export type Tracking360JornadaDigital = {
  period?: { days?: number; since?: string; until?: string };
  overview?: {
    page_views?: number;
    tracked_page_visits?: number;
    engaged_page_visits?: number;
    property_views?: number;
    unique_properties?: number;
    whatsapp_clicks?: number;
    phone_clicks?: number;
    intent_clicks?: number;
    form_starts?: number;
    generated_leads?: number;
    attributed_page_visits?: number;
    last_event_at?: string | null;
  };
  behavior?: {
    form_abandonments?: number;
    scroll_25?: number;
    scroll_50?: number;
    scroll_75?: number;
    scroll_90?: number;
    page_visits_with_whatsapp?: number;
    page_visits_with_property?: number;
  };
  channels?: Tracking360LinhaCanal[];
  campaigns?: Tracking360LinhaCanal[];
  pages?: Array<{
    page_path: string;
    page_views: number;
    tracked_page_visits: number;
    property_views: number;
    whatsapp_clicks: number;
    form_starts: number;
    leads: number;
  }>;
  products?: Array<{
    item_id: string;
    item_name: string;
    neighborhood: string | null;
    value: number | null;
    views: number;
    tracked_page_visits: number;
  }>;
  daily?: Array<{ day: string; page_views: number; property_views: number; intent_clicks: number; leads: number }>;
  recent_journeys?: Tracking360Jornada[];
  identified_leads?: Array<{
    id: string;
    criado_em: string;
    lead_type: string;
    first_name: string;
    masked_phone: string;
    empreendimento_nome: string | null;
    source: string;
    campaign: string;
    crm_lead_id: number | null;
    crm_negocio_id: number | null;
    crm_synced_at: string | null;
    crm_sync_error: string | null;
  }>;
  whatsapp?: {
    new_conversations?: number;
    with_ad_source?: number;
    with_ctwa_click_id?: number;
    last_conversation_at?: string | null;
  };
  quality?: {
    qa_events_excluded?: number;
    site_clicks_without_identity?: number;
    whatsapp_attribution_gap?: number;
    session_scope?: string;
  };
  updated_at?: string;
};

export function diasDoPeriodo(periodo: string) {
  if (periodo === "Hoje") return 1;
  if (periodo === "7 dias") return 7;
  if (periodo === "90 dias") return 90;
  return 30;
}

export function useResumoInteligencia(accessToken: string, periodo: string) {
  const days = useMemo(() => diasDoPeriodo(periodo), [periodo]);
  const [data, setData] = useState<Tracking360Resumo | null>(null);
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
        return body?.resumo as Tracking360Resumo;
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
