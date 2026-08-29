"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

type Row = Record<string, unknown>;
type Journey = {
  lead?: Row;
  attribution?: Row;
  site_events?: Row[];
  crm_events?: Row[];
  meta_deliveries?: Row[];
  integrity?: Row;
};

const EVENT_LABEL: Record<string, string> = {
  page_view: "Abriu uma página",
  view_item: "Visualizou um imóvel",
  gallery_interaction: "Interagiu com a galeria",
  scroll_depth: "Rolou a página",
  engagement_time: "Permaneceu na página",
  page_exit: "Saiu da página",
  whatsapp_click: "Clicou no WhatsApp",
  phone_click: "Clicou para ligar",
  form_start: "Começou um formulário",
  form_submit_attempt: "Tentou enviar o formulário",
  form_error: "O formulário apresentou erro",
  generate_lead: "Enviou o formulário",
  schedule_start: "Começou a agendar visita",
  schedule_complete: "Agendou a visita",
  financing_open: "Abriu a simulação de financiamento",
  responded: "Lead respondeu",
  qualification_started: "Qualificação iniciada",
  qualified: "Lead qualificado",
  visit_scheduled: "Visita agendada",
  visit: "Visita realizada",
  proposal: "Proposta enviada",
  purchase: "Venda concluída",
};

function text(value: unknown, fallback = "—") { return value == null || value === "" ? fallback : String(value); }
function date(value: unknown) { return value ? new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: "America/Sao_Paulo" }).format(new Date(String(value))) : "—"; }
function eventDetail(row: Row) {
  const properties = (row.properties && typeof row.properties === "object" ? row.properties : {}) as Row;
  const pieces = [row.page_path, row.detail, properties.item_name, properties.property_name, properties.empreendimento_nome];
  if (properties.percent || properties.scroll_percent) pieces.push(`${properties.percent || properties.scroll_percent}% da página`);
  if (properties.engagement_seconds) pieces.push(`${properties.engagement_seconds}s ativos`);
  if (properties.error || properties.reason || properties.status) pieces.push(properties.error || properties.reason || properties.status);
  return pieces.filter(Boolean).map(String).join(" · ") || "Evento registrado sem detalhe adicional.";
}

export function TrackingLeadJourney({ accessToken }: { accessToken: string }) {
  const [query, setQuery] = useState("");
  const [leads, setLeads] = useState<Row[]>([]);
  const [selected, setSelected] = useState<number | null>(null);
  const [journey, setJourney] = useState<Journey | null>(null);
  const [channel, setChannel] = useState<"all" | "site" | "crm" | "meta">("all");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const search = useCallback(async (term = query) => {
    setLoading(true);
    try {
      const response = await fetch(`/api/tracking-360?action=search&q=${encodeURIComponent(term)}`, { headers: { Authorization: `Bearer ${accessToken}` }, cache: "no-store" });
      const body = await response.json() as { leads?: Row[]; error?: string };
      if (!response.ok) throw new Error(body.error || "Falha na busca");
      setLeads(Array.isArray(body.leads) ? body.leads : []); setError("");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Falha na busca"); }
    finally { setLoading(false); }
  }, [accessToken, query]);

  const loadJourney = useCallback(async (leadId: number) => {
    setSelected(leadId); setLoading(true);
    try {
      const response = await fetch(`/api/tracking-360?action=journey&lead_id=${leadId}`, { headers: { Authorization: `Bearer ${accessToken}` }, cache: "no-store" });
      const body = await response.json() as Journey & { error?: string };
      if (!response.ok) throw new Error(body.error || "Falha ao carregar a jornada");
      setJourney(body); setError("");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Falha ao carregar a jornada"); }
    finally { setLoading(false); }
  }, [accessToken]);

  useEffect(() => {
    let active = true;
    const loadRecent = async () => {
      try {
        const response = await fetch("/api/tracking-360?action=search", { headers: { Authorization: `Bearer ${accessToken}` }, cache: "no-store" });
        const body = await response.json() as { leads?: Row[]; error?: string };
        if (!response.ok) throw new Error(body.error || "Falha na busca");
        if (active) setLeads(Array.isArray(body.leads) ? body.leads : []);
      } catch (cause) { if (active) setError(cause instanceof Error ? cause.message : "Falha na busca"); }
    };
    void loadRecent();
    return () => { active = false; };
  }, [accessToken]);

  const timeline = useMemo(() => {
    const site: Array<Row & { channel: "site" }> = (journey?.site_events ?? []).map((row) => ({ ...row, channel: "site" }));
    const crm: Array<Row & { channel: "crm" }> = (journey?.crm_events ?? []).map((row) => ({ ...row, channel: "crm" }));
    const meta: Array<Row & { channel: "meta" }> = (journey?.meta_deliveries ?? []).map((row) => ({ ...row, channel: "meta" }));
    return [...site, ...crm, ...meta]
      .filter((row) => channel === "all" || row.channel === channel)
      .sort((a, b) => new Date(String(a.occurred_at)).getTime() - new Date(String(b.occurred_at)).getTime());
  }, [journey, channel]);

  const lead = journey?.lead ?? {};
  const attribution = journey?.attribution ?? {};
  const direct = journey?.integrity?.direct_site_link === true;

  return <div className="t360-journey-layout">
    <aside className="t360-lead-search t360-card">
      <header><div><p>LOCALIZAR</p><h2>Jornada por lead</h2></div></header>
      <form onSubmit={(event) => { event.preventDefault(); void search(); }}><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Nome, final do telefone, ID ou campanha"/><button type="submit">Buscar</button></form>
      <div className="t360-lead-results">{leads.map((row) => <button type="button" className={selected===Number(row.id)?"active":""} key={String(row.id)} onClick={() => void loadJourney(Number(row.id))}><strong>{text(row.nome)}</strong><span>#{text(row.id)} · final {text(row.telefone_final)} · {text(row.momento)}</span><small>{text(row.campaign, text(row.origem))}</small></button>)}</div>
    </aside>

    <main className="t360-journey-main">
      {loading && !journey ? <div className="t360-loading"><i/><strong>Montando a jornada…</strong></div> : error ? <div className="t360-error"><strong>{error}</strong></div> : !journey ? <div className="t360-card t360-empty-state"><strong>Escolha um lead</strong><span>Você verá a origem, os IDs técnicos traduzidos, os passos no site, o avanço no CRM e o que foi devolvido à Meta.</span></div> : <>
        <section className="t360-card t360-lead-head"><div><p>LEAD #{text(lead.id)}</p><h2>{text(lead.nome)}</h2><span>Telefone final {text(lead.telefone_final)} · {text(lead.momento)} · entrada {date(lead.criado_em)}</span></div><b className={direct?"ok":"warn"}>{direct?"Site vinculado diretamente":"Site sem vínculo determinístico"}</b></section>
        <section className={`t360-integrity ${direct?"ok":"warn"}`}><strong>{direct?"Jornada comprovada":"Limite de identificação respeitado"}</strong><span>{text(journey.integrity?.site_link_explanation)}</span></section>
        <section className="t360-attribution-grid">
          <article><span>Origem / mídia</span><strong>{text(attribution.source)} / {text(attribution.medium)}</strong></article>
          <article><span>Campanha</span><strong>{text(attribution.campaign)}</strong><small>ID {text(attribution.campaign_id)}</small></article>
          <article><span>Conjunto</span><strong>{text(attribution.adset)}</strong><small>ID {text(attribution.adset_id)}</small></article>
          <article><span>Anúncio</span><strong>{text(attribution.ad)}</strong><small>ID {text(attribution.ad_id)}</small></article>
          <article><span>Formulário Meta</span><strong>ID {text(attribution.form_id)}</strong><small>Lead ID {text(attribution.meta_lead_id)}</small></article>
          <article><span>Primeiro → último toque</span><strong>{date(attribution.first_seen_at)}</strong><small>até {date(attribution.last_seen_at)}</small></article>
        </section>
        <section className="t360-card">
          <header><div><p>LINHA DO TEMPO</p><h2>Site → CRM → Meta</h2></div><div className="t360-channel-filter">{([['all','Tudo'],['site','Site'],['crm','CRM'],['meta','Meta']] as const).map(([key,label])=><button type="button" className={channel===key?"active":""} key={key} onClick={()=>setChannel(key)}>{label}</button>)}</div></header>
          {timeline.length ? <div className="t360-timeline">{timeline.map((row,index)=><article className={String(row.channel)} key={`${String(row.channel)}-${String(row.id || row.event_id || index)}`}><i/><div><time>{date(row.occurred_at)}</time><strong>{EVENT_LABEL[String(row.event_name)] || text(row.title, String(row.event_name).replaceAll('_',' '))}</strong><span>{eventDetail(row)}</span>{row.channel==='meta'&&<small>Status: {text(row.status)} · tentativas: {text(row.attempt_count,'0')}</small>}</div></article>)}</div> : <p className="t360-empty">Nenhum evento comprovadamente vinculado neste canal.</p>}
        </section>
      </>}
    </main>
  </div>;
}
