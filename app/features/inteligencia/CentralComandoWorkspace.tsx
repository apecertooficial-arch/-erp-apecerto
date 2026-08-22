"use client";

import { Fragment, useCallback, useEffect, useMemo, useState, type ReactNode } from "react";

type Row = Record<string, unknown>;
type FunnelItem = { key: string; label: string; value: number };
type TeamRow = Row & { corretor_id?: string; nome?: string };
type AlertAction = { alerta_chave: string; responsavel?: string | null; prazo?: string | null; visto?: boolean; resolvido?: boolean };
type AdsSource = { status?: string; motivo?: string | null; anuncios?: Row[] };
type CentralData = {
  generated_at?: string;
  summary?: Row;
  finance?: Row;
  funnel?: { flow?: FunnelItem[]; stock?: FunnelItem[] };
  team?: TeamRow[];
  trend?: Row[];
  measurement?: Row;
};
type Payload = {
  central?: CentralData;
  tracking?: Row & { attribution?: Row };
  media?: { ok?: boolean; meta?: AdsSource; google?: AdsSource };
  ga4?: Row | null;
  ga4_configurado?: boolean;
  alert_actions?: AlertAction[];
  generated_at?: string;
  error?: string;
};
type Tab = "resumo" | "marketing" | "tracking" | "crm" | "equipe" | "site" | "financeiro";
type Alert = {
  key: string;
  title: string;
  what: string;
  impact: string;
  next: string;
  level: "critical" | "attention" | "info";
  weight: number;
  action?: AlertAction;
};

const TABS: Array<[Tab, string]> = [
  ["resumo", "Visão CEO"], ["marketing", "Marketing"], ["tracking", "Tracking"],
  ["crm", "CRM e funil"], ["equipe", "Equipe"], ["site", "Site"], ["financeiro", "Financeiro"],
];
const EMPTY_ROW: Row = {};
const EMPTY_CENTRAL: CentralData = {};
const EMPTY_AD_SOURCE: AdsSource = {};

function num(value: unknown) { const parsed = Number(value); return Number.isFinite(parsed) ? parsed : 0; }
function fmt(value: unknown, digits = 0) { return new Intl.NumberFormat("pt-BR", { maximumFractionDigits: digits }).format(num(value)); }
function money(value: unknown, compact = false) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", notation: compact ? "compact" : "standard", maximumFractionDigits: compact ? 1 : 0 }).format(num(value));
}
function pct(value: unknown) { return `${fmt(value, 1)}%`; }
function change(current: unknown, previous: unknown) {
  const a = num(current); const b = num(previous);
  return b ? ((a - b) / Math.abs(b)) * 100 : a ? 100 : 0;
}
function comparison(current: unknown, previous: unknown) {
  const delta = change(current, previous);
  return `${delta >= 0 ? "+" : ""}${fmt(delta, 1)}% vs. período anterior`;
}
function dateTime(value: unknown) {
  if (!value) return "Ainda não medido";
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(new Date(String(value)));
}
function statusLabel(value: unknown) {
  const status = String(value ?? "indisponivel");
  return status === "conectado" ? "Conectado" : status === "nao_configurado" ? "Não configurado" : status === "sem_permissao" ? "Sem permissão" : status === "sem_conta" ? "Sem conta" : "Indisponível";
}
function toneFor(value: number, goal: number, inverse = false) {
  const ok = inverse ? value <= goal : value >= goal;
  return ok ? "good" : "warn";
}

function Kpi({ label, value, comparisonText, meta, tone = "plain", help }: { label: string; value: string; comparisonText?: string; meta?: string; tone?: "plain" | "brand" | "purple" | "good" | "warn"; help?: string }) {
  return <article className={`cc-kpi ${tone}`}>
    <div><span>{label}</span>{help && <button type="button" className="cc-info" title={help} aria-label={`Explicação: ${help}`}>i</button>}</div>
    <strong>{value}</strong>
    {comparisonText && <small>{comparisonText}</small>}
    {meta && <em>{meta}</em>}
  </article>;
}

function Bar({ label, value, max, purple = false, note }: { label: string; value: number; max: number; purple?: boolean; note?: string }) {
  return <div className="cc-bar">
    <div><span>{label}</span><strong>{fmt(value)}</strong></div>
    <i><b className={purple ? "purple" : ""} style={{ width: `${max > 0 ? Math.max(value ? 2 : 0, value / max * 100) : 0}%` }} /></i>
    {note && <small>{note}</small>}
  </div>;
}

function Empty({ title, detail }: { title: string; detail: string }) {
  return <div className="cc-empty"><strong>{title}</strong><span>{detail}</span></div>;
}

function Panel({ eyebrow, title, aside, children, wide = false }: { eyebrow: string; title: string; aside?: ReactNode; children: ReactNode; wide?: boolean }) {
  return <article className={`cc-panel ${wide ? "wide" : ""}`}><header><div><p>{eyebrow}</p><h2>{title}</h2></div>{aside}</header>{children}</article>;
}

function Trend({ rows }: { rows: Row[] }) {
  const shown = rows.slice(-14);
  const max = Math.max(1, ...shown.map((row) => num(row.leads)));
  return <div className="cc-trend" role="img" aria-label="Leads, visitas e vendas nos últimos dias">
    {shown.map((row) => <div key={String(row.day)} title={`${String(row.day).slice(0, 10)}: ${fmt(row.leads)} leads, ${fmt(row.visits)} visitas, ${fmt(row.sales)} vendas`}>
      <i style={{ height: `${Math.max(3, num(row.leads) / max * 100)}%` }} />
      {num(row.visits) > 0 && <b style={{ bottom: `${Math.min(94, num(row.visits) / max * 100)}%` }} />}
      {num(row.sales) > 0 && <em>◆</em>}
      <span>{new Date(String(row.day)).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })}</span>
    </div>)}
  </div>;
}

export function CentralComandoWorkspace({ accessToken }: { accessToken: string }) {
  const [days, setDays] = useState(30);
  const [tab, setTab] = useState<Tab>("resumo");
  const [partner, setPartner] = useState(false);
  const [partnerDetails, setPartnerDetails] = useState(false);
  const [data, setData] = useState<Payload | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [expandedAd, setExpandedAd] = useState("");
  const [alertOpen, setAlertOpen] = useState<Alert | null>(null);
  const [owner, setOwner] = useState("");
  const [deadline, setDeadline] = useState("");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async (quiet = false) => {
    if (quiet) setRefreshing(true); else setLoading(true);
    try {
      const response = await fetch(`/api/central-comando?days=${days}`, { headers: { Authorization: `Bearer ${accessToken}` }, cache: "no-store" });
      const body = await response.json() as Payload;
      if (!response.ok) throw new Error(body.error || "Não foi possível carregar a Central de Comando.");
      setData(body); setError("");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Falha ao carregar os dados."); }
    finally { setLoading(false); setRefreshing(false); }
  }, [accessToken, days]);

  useEffect(() => {
    const stored = window.localStorage.getItem("apecerto-central-view");
    const viewTimer = stored === "socio" ? window.setTimeout(() => setPartner(true), 0) : 0;
    const timer = window.setTimeout(() => void load(), 0);
    const interval = window.setInterval(() => void load(true), 60_000);
    return () => { if (viewTimer) window.clearTimeout(viewTimer); window.clearTimeout(timer); window.clearInterval(interval); };
  }, [load]);

  const central = data?.central ?? EMPTY_CENTRAL;
  const summary = central.summary ?? EMPTY_ROW;
  const finance = central.finance ?? EMPTY_ROW;
  const tracking = data?.tracking ?? EMPTY_ROW;
  const attribution = (tracking.attribution as Row | undefined) ?? EMPTY_ROW;
  const site = (tracking.site as Row | undefined) ?? EMPTY_ROW;
  const metaDelivery = (tracking.meta as Row | undefined) ?? EMPTY_ROW;
  const adsMeta = data?.media?.meta ?? EMPTY_AD_SOURCE;
  const adsGoogle = data?.media?.google ?? EMPTY_AD_SOURCE;
  const ads = useMemo(() => [...(adsMeta.anuncios ?? []), ...(adsGoogle.anuncios ?? [])], [adsMeta.anuncios, adsGoogle.anuncios]);
  const spend = ads.reduce((total, row) => total + num(row.investimento), 0);
  const platformLeads = ads.reduce((total, row) => total + num(row.leads_plataforma), 0);
  const actions = useMemo(() => new Map((data?.alert_actions ?? []).map((item) => [item.alerta_chave, item])), [data?.alert_actions]);

  const alerts = useMemo<Alert[]>(() => {
    const rows: Alert[] = [];
    const add = (alert: Omit<Alert, "action">) => rows.push({ ...alert, action: actions.get(alert.key) });
    if (num(summary.clientes_criticos) > 0) add({ key: "crm:primeira-resposta", title: "Clientes aguardando resposta", what: `${fmt(summary.clientes_criticos)} clientes estão esperando há mais de 30 minutos.`, impact: "A demora reduz a chance de contato e de visita.", next: "Redistribuir ou responder os atendimentos mais antigos agora.", level: "critical", weight: 100 });
    if (num(summary.acoes_vencidas) > 0) add({ key: "crm:acoes-vencidas", title: "Próximas ações vencidas", what: `${fmt(summary.acoes_vencidas)} atendimentos passaram do prazo definido pela IA.`, impact: "Oportunidades podem esfriar sem nova abordagem.", next: "Revisar a fila Meu Dia e concluir ou reagendar cada ação.", level: "attention", weight: 85 });
    if (num(summary.visitas_sem_feedback) > 0) add({ key: "crm:visitas-sem-feedback", title: "Visitas sem retorno", what: `${fmt(summary.visitas_sem_feedback)} visitas realizadas estão sem feedback há mais de 48 horas.`, impact: "A gestão perde visibilidade sobre proposta e objeções.", next: "Cobrar o feedback do corretor e registrar o próximo passo.", level: "attention", weight: 82 });
    if (num(metaDelivery.errors) > 0) add({ key: "tracking:meta-erros", title: "Eventos não entregues à Meta", what: `${fmt(metaDelivery.errors)} eventos do CRM terminaram com erro.`, impact: "O algoritmo recebe menos sinais reais de qualidade.", next: "Abrir Tracking e corrigir a causa antes de escalar mídia.", level: "critical", weight: 92 });
    const waste = ads.filter((row) => num(row.investimento) > 0 && num(row.leads_plataforma) === 0);
    if (waste.length > 0) add({ key: "marketing:sem-lead", title: "Investimento sem lead medido", what: `${waste.length} anúncios consumiram verba sem registrar lead no período.`, impact: `${money(waste.reduce((sum, row) => sum + num(row.investimento), 0))} precisam ser revistos.`, next: "Comparar criativo, público e página antes de manter a veiculação.", level: "attention", weight: 88 });
    if (adsGoogle.status !== "conectado") add({ key: "integration:google-ads", title: "Google Ads sem leitura completa", what: adsGoogle.motivo || "A integração não devolveu métricas.", impact: "O investimento total e o custo por venda podem ficar incompletos.", next: "Concluir ou renovar a autorização da conta Google Ads.", level: "info", weight: 55 });
    if (!data?.ga4_configurado || !data?.ga4) add({ key: "integration:ga4", title: "Google Analytics indisponível", what: "A leitura direta do Analytics não está disponível nesta atualização.", impact: "Comportamento detalhado do site fica limitado aos eventos próprios do Tracking 360.", next: "Verificar a credencial de leitura do GA4.", level: "info", weight: 45 });
    return rows.filter((row) => !row.action?.resolvido).sort((a, b) => b.weight - a.weight);
  }, [actions, ads, adsGoogle, data?.ga4, data?.ga4_configurado, metaDelivery.errors, summary]);

  const healthText = alerts.some((item) => item.level === "critical")
    ? `A operação tem ${alerts.filter((item) => item.level === "critical").length} ponto${alerts.filter((item) => item.level === "critical").length === 1 ? "" : "s"} crítico${alerts.filter((item) => item.level === "critical").length === 1 ? "" : "s"} que precisam de ação hoje.`
    : alerts.length ? `A operação está saudável, mas existem ${alerts.length} pontos que precisam de atenção.` : "A operação está saudável e não há alertas abertos agora.";

  const saveAlert = async (action: "assign" | "seen" | "resolve" | "reopen") => {
    if (!alertOpen) return;
    setSaving(true);
    try {
      const response = await fetch("/api/central-comando", { method: "POST", headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" }, body: JSON.stringify({ key: alertOpen.key, action, responsavel: owner, prazo: deadline }) });
      const body = await response.json() as { error?: string };
      if (!response.ok) throw new Error(body.error || "Não foi possível salvar.");
      await load(true); setAlertOpen(null);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Não foi possível salvar o alerta."); }
    finally { setSaving(false); }
  };

  const openAlert = (alert: Alert) => {
    setAlertOpen(alert); setOwner(alert.action?.responsavel ?? ""); setDeadline(alert.action?.prazo ?? "");
  };

  const exportCsv = () => {
    const rows = tab === "equipe" ? (central.team ?? []) : tab === "marketing" ? ads : tab === "crm" ? (central.funnel?.flow ?? []) : tab === "site" ? ((tracking.top_pages as Row[] | undefined) ?? []) : tab === "financeiro" ? [finance] : [summary];
    if (!rows.length) return;
    const keys = Array.from(new Set(rows.flatMap((row) => Object.keys(row))));
    const quote = (value: unknown) => `"${String(value ?? "").replaceAll('"', '""')}"`;
    const csv = [keys.map(quote).join(";"), ...rows.map((row) => keys.map((key) => quote(row[key as keyof typeof row])).join(";"))].join("\n");
    const link = document.createElement("a"); link.href = URL.createObjectURL(new Blob([`\ufeff${csv}`], { type: "text/csv;charset=utf-8" })); link.download = `central-${tab}-${days}d.csv`; link.click(); URL.revokeObjectURL(link.href);
  };

  if (loading && !data) return <section className="cc-shell"><div className="cc-loading"><i /><strong>Conectando CRM, mídia, site, equipe e financeiro…</strong><span>Nenhum número fictício será exibido.</span></div></section>;
  if (error && !data) return <section className="cc-shell"><div className="cc-error" role="alert"><strong>Não foi possível abrir a Central de Comando.</strong><span>{error}</span><button type="button" onClick={() => void load()}>Tentar novamente</button></div></section>;

  const flow = central.funnel?.flow ?? [];
  const maxFlow = Math.max(1, ...flow.map((item) => num(item.value)));
  const team = central.team ?? [];
  const topTeam = team.slice(0, 8);
  const topPages = ((tracking.top_pages as Row[] | undefined) ?? []);
  const metaEvents = ((tracking.meta_events as Row[] | undefined) ?? []);

  return <section className="cc-shell">
    <header className="cc-head">
      <div><p>CENTRAL DE COMANDO</p><h1>{partner ? "Resumo da operação" : "Inteligência da operação"}</h1><span>{partner ? "O que importa para decidir em menos de 30 segundos." : "Marketing, tracking, CRM, equipe e resultado financeiro na mesma leitura."}</span></div>
      <div className="cc-actions">
        <label className="cc-view"><span>Experiência</span><select value={partner ? "socio" : "completa"} onChange={(event) => { const next = event.target.value === "socio"; setPartner(next); setTab("resumo"); setPartnerDetails(false); window.localStorage.setItem("apecerto-central-view", next ? "socio" : "completa"); }}><option value="completa">CEO / administrador</option><option value="socio">Sócio — resumo simples</option></select></label>
        <span className="cc-updated"><i /> Dados reais · {dateTime(data?.generated_at)}</span>
        <button type="button" onClick={() => void load(true)} disabled={refreshing}>{refreshing ? "Atualizando…" : "↻ Atualizar"}</button>
      </div>
    </header>

    <div className="cc-restricted" role="note"><strong>Acesso restrito à gestão.</strong><span>Os indicadores são consolidados e não expõem mensagens ou dados pessoais de clientes.</span></div>

    {partner ? <>
      <div className={`cc-health-sentence ${alerts.some((item) => item.level === "critical") ? "critical" : alerts.length ? "attention" : "healthy"}`}><i /><strong>{healthText}</strong><span>Período: últimos {days} dias</span></div>
      <div className="cc-partner-controls"><div>{[7, 30, 90].map((value) => <button type="button" className={days === value ? "active" : ""} key={value} onClick={() => setDays(value)}>{value} dias</button>)}</div></div>
      <div className="cc-kpis partner">
        <Kpi label="Vendas" value={fmt(finance.vendas)} comparisonText={comparison(finance.vendas, finance.vendas_anterior)} meta={num(finance.vendas) > 0 ? "com vendas no período" : "nenhuma venda no período"} tone="purple" help="Negócios marcados como concluídos ou pagos neste período." />
        <Kpi label="Valor vendido" value={money(finance.vgv, true)} comparisonText={comparison(finance.vgv, finance.vgv_anterior)} meta="soma do valor dos imóveis vendidos" tone="brand" help="Valor geral das vendas concluídas no período." />
        <Kpi label="Comissão" value={money(finance.comissao_recebida, true)} comparisonText={`Prevista: ${money(finance.comissao_prevista, true)}`} meta="recebida no período" tone="purple" help="Quanto entrou e quanto está previsto de comissão." />
        <Kpi label="Investimento em mídia" value={money(spend, true)} meta={ads.length ? `${ads.length} anúncios ativos com dados` : "integração sem anúncios disponíveis"} tone="brand" help="Soma do investimento devolvido pelas contas de Meta e Google Ads." />
        <Kpi label="Pessoas interessadas" value={fmt(summary.leads_validos)} comparisonText={comparison(summary.leads_validos, summary.leads_validos_anterior)} meta="entraram no atendimento" help="Leads que ingressaram no novo funil comercial no período." />
        <Kpi label="Visitas realizadas" value={fmt(summary.visitas_realizadas)} comparisonText={comparison(summary.visitas_realizadas, summary.visitas_realizadas_anterior)} meta="encontros confirmados" tone="good" help="Visitas registradas como realizadas pela equipe." />
      </div>
      <div className="cc-grid partner-grid">
        <Panel eyebrow="CAMINHO COMERCIAL" title="Pessoas interessadas → visitas → vendas">
          <div className="cc-partner-funnel">
            <div><span>Pessoas interessadas</span><strong>{fmt(summary.leads_validos)}</strong></div><b>→</b>
            <div><span>Visitas realizadas</span><strong>{fmt(summary.visitas_realizadas)}</strong><small>{summary.leads_validos ? `${fmt(num(summary.visitas_realizadas) / num(summary.leads_validos) * 100, 1)} de cada 100` : "sem base"}</small></div><b>→</b>
            <div className="purple"><span>Vendas fechadas</span><strong>{fmt(finance.vendas)}</strong><small>{summary.leads_validos ? `${fmt(num(finance.vendas) / num(summary.leads_validos) * 100, 1)} de cada 100` : "sem base"}</small></div>
          </div>
        </Panel>
        <Panel eyebrow="PRIORIDADES" title="Os três pontos de maior impacto">
          <div className="cc-alert-list compact">{alerts.slice(0, 3).length ? alerts.slice(0, 3).map((alert) => <button type="button" key={alert.key} className={alert.level} onClick={() => openAlert(alert)}><i /><span><strong>{alert.title}</strong><small>{alert.what}</small><em>{alert.action?.responsavel ? `${alert.action.responsavel}${alert.action.prazo ? ` · até ${new Date(`${alert.action.prazo}T12:00:00`).toLocaleDateString("pt-BR")}` : ""}` : "Ainda sem responsável"}</em></span><b>›</b></button>) : <Empty title="Nenhum alerta aberto" detail="A operação não apresenta exceções relevantes agora." />}</div>
        </Panel>
      </div>
      <button className="cc-details-toggle" type="button" onClick={() => setPartnerDetails((value) => !value)}>{partnerDetails ? "Ocultar detalhes da operação" : "Ver detalhes da operação"} <span>{partnerDetails ? "↑" : "↓"}</span></button>
      {partnerDetails && <div className="cc-partner-details"><div className="cc-kpis"><Kpi label="Custo por pessoa interessada" value={platformLeads ? money(spend / platformLeads) : "Sem base"} meta="também chamado de custo por lead" /><Kpi label="Tempo para primeira resposta" value={`${fmt(summary.primeira_resposta_mediana_min, 1)} min`} meta="mediana da equipe" tone={toneFor(num(summary.primeira_resposta_mediana_min), 30, true)} /><Kpi label="Nota da IA" value={`${fmt(summary.nota_ia, 1)}/10`} meta="qualidade dos atendimentos avaliados" tone="purple" /><Kpi label="Leads acompanhados" value={fmt(summary.carteira_ativa)} meta="carteira comercial ativa" /></div><div className="cc-alert-list">{alerts.slice(3).map((alert) => <button type="button" key={alert.key} className={alert.level} onClick={() => openAlert(alert)}><i /><span><strong>{alert.title}</strong><small>{alert.what}</small></span><b>›</b></button>)}</div></div>}
    </> : <>
      <div className="cc-toolbar"><nav>{TABS.map(([key, label]) => <button type="button" key={key} className={tab === key ? "active" : ""} onClick={() => setTab(key)}>{label}</button>)}</nav><div>{[7, 30, 90].map((value) => <button type="button" className={days === value ? "active" : ""} key={value} onClick={() => setDays(value)}>{value}d</button>)}<button type="button" onClick={exportCsv}>Exportar CSV</button></div></div>

      {tab === "resumo" && <div className="cc-stack">
        <div className={`cc-health-sentence ${alerts.some((item) => item.level === "critical") ? "critical" : alerts.length ? "attention" : "healthy"}`}><i /><strong>{healthText}</strong><span>{fmt(summary.no_escritorio_agora)} de {fmt(summary.corretores_ativos)} corretores no escritório agora</span></div>
        <div className="cc-kpis"><Kpi label="Vendas" value={fmt(finance.vendas)} comparisonText={comparison(finance.vendas, finance.vendas_anterior)} tone="purple" /><Kpi label="VGV" value={money(finance.vgv, true)} comparisonText={comparison(finance.vgv, finance.vgv_anterior)} tone="purple" /><Kpi label="Leads válidos" value={fmt(summary.leads_validos)} comparisonText={comparison(summary.leads_validos, summary.leads_validos_anterior)} tone="brand" /><Kpi label="Visitas realizadas" value={fmt(summary.visitas_realizadas)} comparisonText={comparison(summary.visitas_realizadas, summary.visitas_realizadas_anterior)} tone="good" /><Kpi label="Primeira resposta" value={`${fmt(summary.primeira_resposta_mediana_min, 1)} min`} comparisonText={comparison(summary.primeira_resposta_mediana_anterior_min, summary.primeira_resposta_mediana_min)} tone={toneFor(num(summary.primeira_resposta_mediana_min), 30, true)} /><Kpi label="Nota da IA" value={`${fmt(summary.nota_ia, 1)}/10`} meta={`${fmt(summary.carteira_ativa)} leads em carteira`} /></div>
        <div className="cc-grid"><Panel eyebrow="MOVIMENTO" title="Leads, visitas e vendas" aside={<span className="cc-legend"><i /> Leads <b /> Visitas <em>◆</em> Vendas</span>}><Trend rows={central.trend ?? []} /></Panel><Panel eyebrow="ALERTAS EXECUTIVOS" title="O que precisa de decisão" aside={<span>{alerts.length} abertos</span>}><div className="cc-alert-list compact">{alerts.slice(0, 5).map((alert) => <button type="button" key={alert.key} className={alert.level} onClick={() => openAlert(alert)}><i /><span><strong>{alert.title}</strong><small>{alert.what}</small><em>{alert.action?.responsavel || "Definir responsável"}</em></span><b>›</b></button>)}</div></Panel></div>
        <Panel eyebrow="FUNIL REAL" title="Da entrada no novo funil até a venda" wide><div className="cc-funnel">{flow.map((item, index) => <div key={item.key} className={item.key === "sales" ? "purple" : ""}><span>{item.label}</span><strong>{fmt(item.value)}</strong><i style={{ width: `${Math.max(item.value ? 3 : 0, item.value / maxFlow * 100)}%` }} /><small>{index ? `${pct(item.value / Math.max(1, flow[index - 1].value) * 100)} da etapa anterior` : `${days} dias`}</small></div>)}</div></Panel>
      </div>}

      {tab === "marketing" && <div className="cc-stack"><div className="cc-kpis"><Kpi label="Investimento" value={money(spend)} tone="brand" /><Kpi label="Leads nas plataformas" value={fmt(platformLeads)} /><Kpi label="Custo médio por lead" value={platformLeads ? money(spend / platformLeads) : "Sem base"} /><Kpi label="Impressões" value={fmt(ads.reduce((sum, row) => sum + num(row.impressoes), 0))} /><Kpi label="Cliques" value={fmt(ads.reduce((sum, row) => sum + num(row.cliques), 0))} /><Kpi label="Cobertura de atribuição" value={pct(attribution.coverage_percent)} tone="good" /></div><div className="cc-integration-row"><span className={adsMeta.status === "conectado" ? "ok" : "warn"}>Meta Ads · {statusLabel(adsMeta.status)}</span><span className={adsGoogle.status === "conectado" ? "ok" : "warn"}>Google Ads · {statusLabel(adsGoogle.status)}</span></div><Panel eyebrow="CAMPANHAS ATIVAS" title="Desempenho por anúncio" aside={<span>{ads.length} anúncios com leitura</span>} wide>{ads.length ? <div className="cc-table-wrap"><table className="cc-table ads"><thead><tr><th>Plataforma / campanha</th><th>Investimento</th><th>Alcance</th><th>Cliques</th><th>Taxa de clique</th><th>Leads</th><th>Custo por lead</th></tr></thead><tbody>{ads.map((row, index) => { const key = `${row.plataforma}-${row.anuncio_id}-${index}`; return <Fragment key={key}><tr className="clickable" onClick={() => setExpandedAd(expandedAd === key ? "" : key)}><td><strong>{String(row.campanha ?? "Campanha sem nome")}</strong><small>{String(row.anuncio ?? "Anúncio sem nome")} · {String(row.conjunto ?? "Conjunto não informado")}</small></td><td>{money(row.investimento)}</td><td>{fmt(row.alcance ?? row.impressoes)}</td><td>{fmt(row.cliques)}</td><td>{pct(row.ctr)}</td><td>{fmt(row.leads_plataforma)}</td><td>{row.cpl_plataforma ? money(row.cpl_plataforma) : "—"}</td></tr>{expandedAd === key && <tr className="cc-ad-detail"><td colSpan={7}><div><strong>Detalhe do anúncio</strong><span>Objetivo: {String(row.objetivo ?? "não informado")}</span><span>Conjunto: {String(row.conjunto ?? "não informado")}</span><span>CPC: {money(row.cpc)}</span><em>Os ativos individuais do criativo dinâmico aparecem somente quando a API da plataforma os disponibiliza; o painel nunca inventa uma variação vencedora.</em></div></td></tr>}</Fragment>; })}</tbody></table></div> : <Empty title="Nenhum anúncio disponível" detail={`${adsMeta.motivo ?? ""} ${adsGoogle.motivo ?? ""}`.trim() || "As plataformas não devolveram anúncios ativos no período."} />}</Panel></div>}

      {tab === "tracking" && <div className="cc-stack"><div className="cc-kpis"><Kpi label="Saúde da coleta" value={`${fmt(num(metaDelivery.errors) === 0 && num(attribution.coverage_percent) >= 95 ? 100 : Math.max(0, 100 - num(metaDelivery.errors) * 5 - Math.max(0, 95 - num(attribution.coverage_percent))))}/100`} tone={num(metaDelivery.errors) ? "warn" : "good"} /><Kpi label="Eventos CRM entregues" value={fmt(metaDelivery.delivered)} /><Kpi label="Erros de entrega" value={fmt(metaDelivery.errors)} tone={num(metaDelivery.errors) ? "warn" : "good"} /><Kpi label="Leads Meta atribuídos" value={`${fmt(attribution.attributed)}/${fmt(attribution.eligible)}`} tone="brand" /><Kpi label="Eventos do pixel" value={fmt(metaDelivery.total)} /><Kpi label="Última entrega" value={dateTime(metaDelivery.last_delivery_at)} /></div><div className="cc-grid"><Panel eyebrow="EVENTOS DO CRM" title="O que voltou para a Meta">{metaEvents.length ? metaEvents.map((row) => <Bar key={String(row.event_type)} label={String(row.event_type).replaceAll("_", " ")} value={num(row.delivered)} max={Math.max(1, ...metaEvents.map((item) => num(item.delivered)))} note={`${fmt(row.errors)} erros`} />) : <Empty title="Sem eventos no período" detail="A fonte real não devolveu eventos para esta janela." />}</Panel><Panel eyebrow="DIAGNÓSTICO" title="Separação das causas"><div className="cc-diagnostics"><div className="privacy"><strong>Privacidade</strong><span>{fmt((data?.tracking?.consent as Row | undefined)?.marketing)} sessões autorizaram marketing.</span></div><div className={num(metaDelivery.errors) ? "bad" : "good"}><strong>Falha técnica</strong><span>{num(metaDelivery.errors) ? `${fmt(metaDelivery.errors)} entregas falharam.` : "Nenhum erro de entrega detectado."}</span></div><div className="brand"><strong>Conversão comercial</strong><span>{fmt(finance.vendas)} vendas e {fmt(summary.visitas_realizadas)} visitas no período.</span></div></div></Panel></div></div>}

      {tab === "crm" && <div className="cc-stack"><div className="cc-kpis"><Kpi label="Leads no período" value={fmt(summary.leads_validos)} tone="brand" /><Kpi label="Carteira ativa" value={fmt(summary.carteira_ativa)} /><Kpi label="Ações vencidas" value={fmt(summary.acoes_vencidas)} tone={num(summary.acoes_vencidas) ? "warn" : "good"} /><Kpi label="Clientes aguardando" value={fmt(summary.clientes_aguardando)} /><Kpi label="Críticos +30 min" value={fmt(summary.clientes_criticos)} tone={num(summary.clientes_criticos) ? "warn" : "good"} /><Kpi label="Visitas sem feedback" value={fmt(summary.visitas_sem_feedback)} tone={num(summary.visitas_sem_feedback) ? "warn" : "good"} /></div><div className="cc-grid"><Panel eyebrow="FUNIL DE FLUXO" title="Coorte de leads que entrou no período">{flow.map((item) => <Bar key={item.key} label={item.label} value={item.value} max={maxFlow} purple={item.key === "sales"} />)}</Panel><Panel eyebrow="CARTEIRA ATUAL" title="Onde estão os atendimentos">{(central.funnel?.stock ?? []).map((item) => <Bar key={item.key} label={item.label} value={item.value} max={Math.max(1, ...(central.funnel?.stock ?? []).map((row) => row.value))} />)}</Panel></div></div>}

      {tab === "equipe" && <div className="cc-stack"><div className="cc-kpis"><Kpi label="Corretores ativos" value={fmt(summary.corretores_ativos)} /><Kpi label="No escritório agora" value={fmt(summary.no_escritorio_agora)} tone="good" /><Kpi label="Mensagens enviadas" value={fmt(team.reduce((sum, row) => sum + num(row.mensagens_enviadas), 0))} /><Kpi label="Movimentações" value={fmt(team.reduce((sum, row) => sum + num(row.movimentacoes), 0))} /><Kpi label="Visitas realizadas" value={fmt(summary.visitas_realizadas)} /><Kpi label="Nota média IA" value={`${fmt(summary.nota_ia, 1)}/10`} tone="purple" /></div><Panel eyebrow="GESTÃO DA EQUIPE" title="Atividade, qualidade e resultado por corretor" aside={<span>Horas passam a contar após esta implantação</span>} wide>{topTeam.length ? <div className="cc-table-wrap"><table className="cc-table team"><thead><tr><th>Corretor</th><th>Carteira</th><th>1ª resposta</th><th>Nota IA</th><th>Visitas</th><th>Vendas</th><th>VGV</th><th>Horas ativas</th></tr></thead><tbody>{topTeam.map((row) => <tr key={String(row.corretor_id)}><td><strong>{String(row.nome ?? "Corretor")}</strong><small>{row.online ? "Online" : row.no_escritorio ? "No escritório" : `Última atividade: ${dateTime(row.ultima_atividade_em)}`}</small></td><td>{fmt(row.carteira_ativa)}<small>{fmt(row.acoes_vencidas)} ações vencidas</small></td><td>{row.primeira_resposta_mediana_min == null ? "—" : `${fmt(row.primeira_resposta_mediana_min, 1)} min`}</td><td>{row.nota_media == null ? "—" : `${fmt(row.nota_media, 1)}/10`}<small>{fmt(row.avaliacoes)} avaliações</small></td><td>{fmt(row.visitas_realizadas)}<small>{fmt(row.visitas_canceladas)} canceladas</small></td><td>{fmt(row.vendas)}</td><td>{money(row.vgv, true)}</td><td>{row.horas_ativas == null ? "Começando agora" : `${fmt(row.horas_ativas, 1)} h`}<small>{row.horas_logado == null ? "sem histórico anterior" : `${fmt(row.horas_logado, 1)} h logado`}</small></td></tr>)}</tbody></table></div> : <Empty title="Equipe sem dados no período" detail="Nenhum corretor ativo foi devolvido pela fonte operacional." />}</Panel><div className="cc-measure-note"><strong>Como as horas são medidas</strong><span>{String(central.measurement?.activity_definition ?? "Logado = ERP respondendo. Ativo = aba visível com interação recente.")}</span><small>Início da medição: {dateTime(central.measurement?.activity_started_at)}. Não existe reconstrução retroativa.</small></div></div>}

      {tab === "site" && <div className="cc-stack"><div className="cc-kpis"><Kpi label="Páginas vistas" value={fmt(site.page_views)} /><Kpi label="Sessões" value={fmt(site.sessions)} /><Kpi label="Imóveis vistos" value={fmt(site.property_views)} tone="brand" /><Kpi label="Interações em galeria" value={fmt(site.gallery_interactions)} /><Kpi label="Cliques no WhatsApp" value={fmt(site.whatsapp_clicks)} tone="good" /><Kpi label="Leads enviados" value={fmt(site.site_leads)} tone="purple" /></div><div className="cc-grid"><Panel eyebrow="INTENÇÃO" title="Da navegação ao contato"><Bar label="Páginas vistas" value={num(site.page_views)} max={Math.max(1, num(site.page_views))} /><Bar label="Imóveis vistos" value={num(site.property_views)} max={Math.max(1, num(site.page_views))} /><Bar label="WhatsApp" value={num(site.whatsapp_clicks)} max={Math.max(1, num(site.page_views))} /><Bar label="Formulários iniciados" value={num(site.form_starts)} max={Math.max(1, num(site.page_views))} /><Bar label="Leads enviados" value={num(site.site_leads)} max={Math.max(1, num(site.page_views))} purple /></Panel><Panel eyebrow="PÁGINAS MAIS ACESSADAS" title="Onde a atenção está">{topPages.length ? <div className="cc-page-list">{topPages.slice(0, 12).map((row) => <div key={String(row.path)}><span title={String(row.path)}>{String(row.path)}</span><strong>{fmt(row.views)}</strong></div>)}</div> : <Empty title="Sem páginas no período" detail="O Tracking 360 não devolveu páginas para esta janela." />}</Panel></div></div>}

      {tab === "financeiro" && <div className="cc-stack"><div className="cc-kpis"><Kpi label="Vendas" value={fmt(finance.vendas)} comparisonText={comparison(finance.vendas, finance.vendas_anterior)} tone="purple" /><Kpi label="VGV" value={money(finance.vgv)} comparisonText={comparison(finance.vgv, finance.vgv_anterior)} tone="purple" /><Kpi label="Comissão prevista" value={money(finance.comissao_prevista)} comparisonText={comparison(finance.comissao_prevista, finance.comissao_prevista_anterior)} tone="brand" /><Kpi label="Comissão recebida" value={money(finance.comissao_recebida)} tone="good" /><Kpi label="Investimento em mídia" value={money(spend)} /><Kpi label="Custo de mídia por venda" value={num(finance.vendas) ? money(spend / num(finance.vendas)) : "Sem base"} /></div><div className="cc-grid"><Panel eyebrow="RECEITA" title="Vendido, previsto e recebido"><div className="cc-money-bars"><div><span>VGV</span><i><b style={{ height: "100%" }} /></i><strong>{money(finance.vgv, true)}</strong></div><div><span>Comissão prevista</span><i><b className="orange" style={{ height: `${num(finance.vgv) ? Math.max(4, num(finance.comissao_prevista) / num(finance.vgv) * 100) : 0}%` }} /></i><strong>{money(finance.comissao_prevista, true)}</strong></div><div><span>Comissão recebida</span><i><b className="green" style={{ height: `${num(finance.comissao_prevista) ? Math.min(100, num(finance.comissao_recebida) / num(finance.comissao_prevista) * 100) : 0}%` }} /></i><strong>{money(finance.comissao_recebida, true)}</strong></div></div></Panel><Panel eyebrow="LEITURA EXECUTIVA" title="Eficiência financeira"><div className="cc-diagnostics"><div className="brand"><strong>Conversão</strong><span>{fmt(finance.vendas)} vendas para {fmt(summary.leads_validos)} leads válidos.</span></div><div className="privacy"><strong>Comissão recebida</strong><span>{num(finance.comissao_prevista) ? pct(num(finance.comissao_recebida) / num(finance.comissao_prevista) * 100) : "Sem base"} do previsto no período.</span></div><div className="good"><strong>Mídia</strong><span>{money(spend)} investidos; {num(finance.vendas) ? `${money(spend / num(finance.vendas))} por venda` : "ainda sem venda no período"}.</span></div></div></Panel></div></div>}
    </>}

    {error && data && <button className="cc-inline-error" type="button" onClick={() => setError("")}>{error} · fechar</button>}

    {alertOpen && <div className="cc-drawer-layer" role="presentation" onClick={() => setAlertOpen(null)}><aside className="cc-drawer" role="dialog" aria-modal="true" aria-label={`Alerta: ${alertOpen.title}`} onClick={(event) => event.stopPropagation()}><header><div><p>ALERTA EXECUTIVO</p><h2>{alertOpen.title}</h2></div><button type="button" onClick={() => setAlertOpen(null)} aria-label="Fechar">×</button></header><section><div className={`cc-alert-detail ${alertOpen.level}`}><strong>O que aconteceu</strong><span>{alertOpen.what}</span></div><div><strong>Impacto</strong><p>{alertOpen.impact}</p></div><div><strong>Próxima ação</strong><p>{alertOpen.next}</p></div><label><span>Quem está cuidando</span><select value={owner} onChange={(event) => setOwner(event.target.value)}><option value="">Escolha o responsável</option><option>Samuel</option><option>Sócio / direção</option><option>Gestor comercial</option><option>Gestor de tráfego</option><option>Equipe de corretores</option><option>TI / integrações</option></select></label><label><span>Prazo</span><input type="date" value={deadline} onChange={(event) => setDeadline(event.target.value)} /></label></section><footer><button type="button" className="secondary" disabled={saving} onClick={() => void saveAlert("seen")}>Marcar como visto</button><button type="button" className="secondary" disabled={saving || !owner} onClick={() => void saveAlert("assign")}>Salvar responsável</button><button type="button" className="primary" disabled={saving} onClick={() => void saveAlert("resolve")}>Marcar resolvido</button></footer></aside></div>}
  </section>;
}
