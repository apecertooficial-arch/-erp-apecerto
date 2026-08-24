"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { TrackingLeadJourney } from "./TrackingLeadJourney";
import { TrackingLinkBuilder } from "./TrackingLinkBuilder";

type Row = Record<string, unknown>;
type Dashboard = {
  generated_at?: string;
  period_days?: number;
  site?: Row;
  crm?: Row;
  meta?: Row;
  consent?: Record<string, number>;
  top_pages?: Row[];
  crm_moments?: Row[];
  meta_events?: Row[];
  campaigns?: Row[];
  attribution?: Row & { origins?: Row[]; campaigns?: Row[] };
  quality?: Row;
};

const EVENT_LABEL: Record<string, string> = {
  responded: "Lead respondeu",
  qualification_started: "Qualificação iniciada",
  qualified: "Lead qualificado",
  visit_scheduled: "Visita agendada",
  visit: "Visita realizada",
  proposal: "Proposta enviada",
  purchase: "Venda concluída",
};

function n(value: unknown) { const parsed = Number(value); return Number.isFinite(parsed) ? parsed : 0; }
function fmt(value: unknown) { return new Intl.NumberFormat("pt-BR").format(n(value)); }
function pct(value: unknown) { return `${new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1 }).format(n(value))}%`; }
function ago(value: unknown) {
  if (!value) return "sem dado";
  const seconds = Math.max(0, Math.floor((Date.now() - new Date(String(value)).getTime()) / 1000));
  if (seconds < 60) return "agora";
  if (seconds < 3600) return `há ${Math.floor(seconds / 60)} min`;
  if (seconds < 86400) return `há ${Math.floor(seconds / 3600)} h`;
  return `há ${Math.floor(seconds / 86400)} d`;
}
function rate(a: unknown, b: unknown) { const base = n(b); return base > 0 ? (100 * n(a)) / base : 0; }

function Kpi({ label, value, detail, tone = "plain" }: { label: string; value: string; detail?: string; tone?: "plain" | "good" | "warn" | "brand" }) {
  return <article className={`t360-kpi ${tone}`}><span>{label}</span><strong>{value}</strong>{detail && <small>{detail}</small>}</article>;
}

function Bar({ label, value, max, note }: { label: string; value: number; max: number; note?: string }) {
  return <div className="t360-bar"><div><span>{label}</span><strong>{fmt(value)}</strong></div><i><b style={{ width: `${max > 0 ? Math.max(2, (100 * value) / max) : 0}%` }} /></i>{note && <small>{note}</small>}</div>;
}

export function Tracking360Workspace({ accessToken }: { accessToken: string }) {
  const [days, setDays] = useState(30);
  const [tab, setTab] = useState<"visao" | "site" | "crm" | "campanhas" | "jornada" | "links" | "saude">("visao");
  const [data, setData] = useState<Dashboard | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async (quiet = false) => {
    if (!quiet) setLoading(true);
    try {
      const response = await fetch(`/api/tracking-360?days=${days}`, { headers: { Authorization: `Bearer ${accessToken}` }, cache: "no-store" });
      const body = await response.json() as Dashboard & { error?: string };
      if (!response.ok) throw new Error(body.error || "Falha ao carregar");
      setData(body); setError("");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Falha ao carregar"); }
    finally { if (!quiet) setLoading(false); }
  }, [accessToken, days]);

  useEffect(() => {
    const first = window.setTimeout(() => void load(), 0);
    const id = window.setInterval(() => void load(true), 60000);
    return () => { window.clearTimeout(first); window.clearInterval(id); };
  }, [load]);

  const site = useMemo(() => data?.site ?? {}, [data]);
  const crm = useMemo(() => data?.crm ?? {}, [data]);
  const meta = useMemo(() => data?.meta ?? {}, [data]);
  const attribution = useMemo(() => data?.attribution ?? {}, [data]);
  const quality = useMemo(() => data?.quality ?? {}, [data]);
  const metaEvents = useMemo(() => data?.meta_events ?? [], [data]);
  const campaigns = useMemo(() => attribution.campaigns ?? data?.campaigns ?? [], [attribution, data]);
  const maxEvent = useMemo(() => Math.max(1, ...metaEvents.map((row) => n(row.total))), [metaEvents]);
  const maxCampaign = useMemo(() => Math.max(1, ...campaigns.map((row) => n(row.leads))), [campaigns]);
  const healthScore = useMemo(() => {
    if (!data) return 0;
    let score = 100;
    const observedAt = new Date(String(data.generated_at || 0)).getTime();
    if (!site.last_site_event_at || observedAt - new Date(String(site.last_site_event_at)).getTime() > 86400000) score -= 20;
    if (!meta.last_delivery_at || observedAt - new Date(String(meta.last_delivery_at)).getTime() > 604800000) score -= 15;
    if (n(meta.errors) > 0) score -= 20;
    if (n(quality.meta_id_coverage_percent) < 98) score -= 15;
    if (n(quality.campaign_hierarchy_coverage_percent) < 95) score -= 15;
    if (n(quality.site_crm_linkage_percent) < 95) score -= 15;
    if (n(quality.pageview_duplicate_rate_24h) > 5) score -= Math.min(25, Math.ceil(n(quality.pageview_duplicate_rate_24h) / 4));
    if (n(site.form_starts) > 0 && n(site.form_attempts) === 0) score -= 10;
    return Math.max(0, score);
  }, [data, site, meta, quality]);

  return <section className="t360-shell">
    <header className="t360-head">
      <div><p>INTELIGÊNCIA DE AQUISIÇÃO</p><h1>Tracking 360</h1><span>Do clique no site ao avanço real no CRM — sem misturar volume com resultado.</span></div>
      <div className="t360-head-actions"><span className="t360-live"><i /> Atualizado {ago(data?.generated_at)}</span><button type="button" onClick={() => void load()} disabled={loading}>↻ Atualizar</button></div>
    </header>

    <div className="t360-controls">
      <div>{[7,30,90].map((value) => <button type="button" className={days===value?"active":""} key={value} onClick={() => setDays(value)}>{value} dias</button>)}</div>
      <nav>{([
        ["visao","Visão executiva"],["site","Site e intenção"],["crm","CRM e Meta"],["campanhas","Campanhas"],["jornada","Jornada do lead"],["links","Links rastreáveis"],["saude","Saúde técnica"],
      ] as const).map(([key,label]) => <button type="button" className={tab===key?"active":""} key={key} onClick={() => setTab(key)}>{label}</button>)}</nav>
    </div>

    {loading && !data ? <div className="t360-loading"><i /><strong>Conectando site, CRM e mídia…</strong></div> : error ? <div className="t360-error"><strong>Não foi possível abrir o painel.</strong><span>{error}</span><button type="button" onClick={() => void load()}>Tentar novamente</button></div> : <>
      {tab === "visao" && <div className="t360-stack">
        <div className="t360-score"><div><span>Saúde interna comprovada</span><strong>{healthScore}<small>/100</small></strong></div><p>{healthScore >= 90 ? "Banco, atribuição e devolução estão coerentes. Meta, GA4 e Google Ads aparecem separadamente porque exigem prova na própria plataforma." : "Há sinais mensuráveis que merecem atenção antes de escalar mídia."}</p><i style={{ "--score": `${healthScore}%` } as React.CSSProperties} /></div>
        <div className="t360-kpis">
          <Kpi label="Páginas vistas" value={fmt(site.page_views)} detail={`${fmt(site.sessions)} sessões identificadas`} />
          <Kpi label="Imóveis visualizados" value={fmt(site.property_views)} detail={`${fmt(site.gallery_interactions)} interações em galerias`} tone="brand" />
          <Kpi label="Cliques no WhatsApp" value={fmt(site.whatsapp_clicks)} detail={`${pct(rate(site.whatsapp_clicks, site.page_views))} das visualizações`} tone="good" />
          <Kpi label="Leads Meta atribuídos" value={`${fmt(attribution.attributed)}/${fmt(attribution.eligible)}`} detail={`${pct(attribution.coverage_percent)} de cobertura elegível`} tone="good" />
          <Kpi label="Eventos CRM entregues" value={fmt(meta.delivered)} detail={`${fmt(meta.errors)} com erro`} tone={n(meta.errors)>0?"warn":"good"} />
          <Kpi label="Leads enviados pelo site" value={fmt(site.site_leads)} detail={`${fmt(site.form_starts)} formulários iniciados`} tone={n(site.form_starts)>0&&n(site.site_leads)===0?"warn":"plain"} />
        </div>
        <div className="t360-grid two">
          <article className="t360-card"><header><div><p>FUNIL DO SITE</p><h2>Da página ao contato</h2></div><span>{days} dias</span></header>
            <Bar label="Páginas vistas" value={n(site.page_views)} max={n(site.page_views)} />
            <Bar label="Imóveis vistos" value={n(site.property_views)} max={n(site.page_views)} note={pct(rate(site.property_views,site.page_views))} />
            <Bar label="WhatsApp" value={n(site.whatsapp_clicks)} max={n(site.page_views)} note={pct(rate(site.whatsapp_clicks,site.page_views))} />
            <Bar label="Formulário iniciado" value={n(site.form_starts)} max={n(site.page_views)} note={pct(rate(site.form_starts,site.page_views))} />
            <Bar label="Lead enviado" value={n(site.site_leads)} max={n(site.page_views)} note={pct(rate(site.site_leads,site.page_views))} />
          </article>
          <article className="t360-card"><header><div><p>DEVOLUÇÃO À META</p><h2>O que o algoritmo recebeu</h2></div><span>{fmt(meta.delivered)} entregues</span></header>
            {metaEvents.length ? metaEvents.map((row) => <Bar key={String(row.event_type)} label={EVENT_LABEL[String(row.event_type)] || String(row.event_type)} value={n(row.delivered)} max={maxEvent} note={`${fmt(row.errors)} erros`} />) : <p className="t360-empty">Nenhum evento CRM no período.</p>}
          </article>
        </div>
      </div>}

      {tab === "site" && <div className="t360-grid two">
        <article className="t360-card"><header><div><p>COMPORTAMENTO</p><h2>Intenções captadas</h2></div><span>tempo ativo médio: {fmt(site.avg_engagement_seconds)}s</span></header>
          <div className="t360-kpis compact"><Kpi label="Galeria" value={fmt(site.gallery_interactions)} /><Kpi label="WhatsApp" value={fmt(site.whatsapp_clicks)} tone="good" /><Kpi label="Telefone" value={fmt(site.phone_clicks)} /><Kpi label="Captação" value={fmt(site.owner_intents)} tone="brand" /></div>
          <div className="t360-callout"><strong>Abandono de formulário</strong><span>{fmt(Math.max(0,n(site.form_starts)-n(site.site_leads)))} pessoas iniciaram e não viraram lead medido. Acompanhe esse número antes de aumentar o orçamento.</span></div>
        </article>
        <article className="t360-card"><header><div><p>PÁGINAS</p><h2>Onde a atenção está</h2></div></header>
          <div className="t360-table">{(data?.top_pages ?? []).map((row) => <div key={String(row.path)}><span>{String(row.path)}</span><strong>{fmt(row.views)}</strong></div>)}</div>
        </article>
        <article className="t360-card wide"><header><div><p>CONSENTIMENTO</p><h2>Qual dado pode ser usado</h2></div></header>
          <div className="t360-kpis compact"><Kpi label="Essencial" value={fmt(data?.consent?.essential)} detail="medição própria, sem publicidade" /><Kpi label="Analytics" value={fmt(data?.consent?.analytics)} detail="GA4 e comportamento" tone="brand" /><Kpi label="Marketing" value={fmt(data?.consent?.marketing)} detail="Meta e remarketing" tone="good" /></div>
        </article>
      </div>}

      {tab === "crm" && <div className="t360-stack">
        <div className="t360-kpis"><Kpi label="Leads no período" value={fmt(crm.leads)} /><Kpi label="Leads atendidos" value={fmt(crm.attended)} detail={pct(rate(crm.attended,crm.leads))} /><Kpi label="Meta elegíveis" value={fmt(attribution.eligible)} /><Kpi label="Atribuição Meta" value={pct(attribution.coverage_percent)} detail={`${fmt(attribution.with_meta_lead_id)} com Meta Lead ID`} tone="good" /><Kpi label="Na fila de envio" value={fmt(meta.processing)} /><Kpi label="Erros de envio" value={fmt(meta.errors)} tone={n(meta.errors)>0?"warn":"good"} /></div>
        <div className="t360-grid two"><article className="t360-card"><header><div><p>MOMENTO ATUAL</p><h2>Distribuição do CRM</h2></div></header>{(data?.crm_moments ?? []).map((row) => <Bar key={String(row.moment)} label={String(row.moment).replaceAll("_"," ")} value={n(row.total)} max={Math.max(1,...(data?.crm_moments??[]).map(r=>n(r.total)))} />)}</article>
        <article className="t360-card"><header><div><p>EVENTOS CANÔNICOS</p><h2>Status das entregas</h2></div></header><div className="t360-table headed"><div><span>Evento</span><span>Entregue</span><span>Erro</span></div>{metaEvents.map((row)=><div key={String(row.event_type)}><span>{EVENT_LABEL[String(row.event_type)]||String(row.event_type)}</span><strong>{fmt(row.delivered)}</strong><em className={n(row.errors)>0?"bad":""}>{fmt(row.errors)}</em></div>)}</div></article></div>
      </div>}

      {tab === "campanhas" && <div className="t360-grid two">
        <article className="t360-card wide"><header><div><p>ATRIBUIÇÃO REAL</p><h2>Leads por campanha identificada</h2></div><span>{pct(attribution.coverage_percent)} de cobertura Meta</span></header>{campaigns.map((row)=><Bar key={`${String(row.campaign_id)}-${String(row.campaign)}`} label={String(row.campaign)} value={n(row.leads)} max={maxCampaign} note={row.campaign_id?`ID ${row.campaign_id}`:"ID não recebido"} />)}</article>
        <article className="t360-card"><header><div><p>ORIGENS DO CRM</p><h2>De onde os cadastros vieram</h2></div></header>{(attribution.origins??[]).map((row)=><Bar key={String(row.origin)} label={String(row.origin)} value={n(row.leads)} max={Math.max(1,...(attribution.origins??[]).map(r=>n(r.leads)))} />)}</article>
        <article className="t360-card"><header><div><p>LEITURA</p><h2>Como usar este painel</h2></div></header><ol className="t360-steps"><li>Compare campanhas pelo avanço no CRM, não só pelo lead barato.</li><li>Crie semelhantes de quem respondeu, qualificou e visitou.</li><li>Use WhatsApp e galeria para remarketing de intenção.</li><li>Não misture Miruna e Aratans: os IDs continuam separados.</li></ol></article>
      </div>}

      {tab === "jornada" && <TrackingLeadJourney accessToken={accessToken} />}

      {tab === "links" && <TrackingLinkBuilder />}

      {tab === "saude" && <div className="t360-grid two">
        <article className="t360-card"><header><div><p>COLETA</p><h2>Últimos sinais verificáveis</h2></div></header><div className="t360-health"><div><i className="ok"/><span>Site</span><strong>{ago(site.last_site_event_at)}</strong></div><div><i className={meta.last_delivery_at?"ok":"warn"}/><span>Meta CAPI CRM</span><strong>{ago(meta.last_delivery_at)}</strong></div><div><i className={n(quality.meta_id_coverage_percent)>=98?"ok":"warn"}/><span>Meta Lead ID</span><strong>{pct(quality.meta_id_coverage_percent)}</strong></div><div><i className={n(quality.campaign_hierarchy_coverage_percent)>=95?"ok":"warn"}/><span>Campanha + conjunto + anúncio</span><strong>{pct(quality.campaign_hierarchy_coverage_percent)}</strong></div><div><i className={n(quality.site_crm_linkage_percent)>=95?"ok":"warn"}/><span>Site ligado ao CRM</span><strong>{pct(quality.site_crm_linkage_percent)}</strong></div><div><i className={n(quality.pageview_duplicate_rate_24h)<=5?"ok":"bad"}/><span>Excesso de page_view · 24 h</span><strong>{pct(quality.pageview_duplicate_rate_24h)}</strong></div></div></article>
        <article className="t360-card"><header><div><p>DIAGNÓSTICO</p><h2>O que merece atenção</h2></div></header><ul className="t360-diagnostics"><li className={n(meta.errors)>0?"warn":"ok"}><strong>Meta CRM</strong><span>{n(meta.errors)>0?`${fmt(meta.errors)} entregas exigem correção.`:"Nenhum erro de entrega no período."}</span></li><li className={n(site.form_starts)>0&&n(site.form_attempts)===0?"warn":"ok"}><strong>Formulários</strong><span>{n(site.form_starts)>0&&n(site.form_attempts)===0?"Há início sem tentativa registrada; valide a jornada publicada.":"Eventos de início e envio estão coerentes."}</span></li><li className={n(quality.campaign_hierarchy_coverage_percent)<95?"warn":"ok"}><strong>Hierarquia de mídia</strong><span>{pct(quality.campaign_hierarchy_coverage_percent)} dos leads Meta têm campanha, conjunto e anúncio completos.</span></li><li className={n(quality.pageview_duplicate_rate_24h)>5?"warn":"ok"}><strong>Page views</strong><span>{n(quality.pageview_duplicate_rate_24h)>5?`${fmt(quality.pageview_duplicate_excess_24h)} eventos excedentes nas últimas 24 h; a correção entra na próxima publicação do site.`:"Sem inflação relevante nas últimas 24 h."}</span></li></ul></article>
      </div>}
    </>}
  </section>;
}
