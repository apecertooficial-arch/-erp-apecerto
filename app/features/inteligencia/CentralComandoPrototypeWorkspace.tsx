"use client";

import Image from "next/image";
import { Fragment, useCallback, useEffect, useMemo, useState, type ReactNode } from "react";

type Row = Record<string, unknown>;
type FunnelItem = { key: string; label: string; value: number };
type AlertAction = { alerta_chave: string; responsavel?: string | null; prazo?: string | null; resolvido?: boolean };
type AdsSource = { status?: string; motivo?: string | null; anuncios?: Row[] };
type Payload = {
  central?: { generated_at?: string; summary?: Row; finance?: Row; funnel?: { flow?: FunnelItem[]; stock?: FunnelItem[] }; team?: Row[]; trend?: Row[]; measurement?: Row };
  tracking?: Row & { attribution?: Row };
  media?: { meta?: AdsSource; google?: AdsSource };
  ga4?: Row | null;
  ga4_configurado?: boolean;
  alert_actions?: AlertAction[];
  generated_at?: string;
  error?: string;
};
type Page = "ceo" | "marketing" | "tracking" | "crm" | "equipe" | "site" | "financeiro";
type Profile = "ceo" | "socio" | "trafego" | "comercial";
type Tone = "plain" | "orange" | "purple" | "success" | "danger";
type Alert = { key: string; title: string; what: string; impact: string; next: string; level: "critical" | "attention" | "info"; weight: number; action?: AlertAction };

const EMPTY: Row = {};
const NAV: Array<[Page, string, string]> = [
  ["ceo", "Visão CEO", "⌂"], ["marketing", "Marketing", "◇"], ["tracking", "Tracking", "⌁"],
  ["crm", "CRM e funil", "▽"], ["equipe", "Equipe e corretores", "♙"], ["site", "Site e imóveis", "▥"], ["financeiro", "Financeiro", "▣"],
];
const PAGE_COPY: Record<Page, [string, string]> = {
  ceo: ["Visão CEO", "Saúde da operação · decisões prioritárias"],
  marketing: ["Marketing", "Meta Ads e Google Ads · da mídia até a comissão"],
  tracking: ["Tracking", "Percurso do clique ao corretor · integridade dos dados"],
  crm: ["CRM e funil", "Atendimento, SLA, envelhecimento e coortes"],
  equipe: ["Equipe e corretores", "Execução e resultado dos corretores"],
  site: ["Site e imóveis", "Comportamento no site e desempenho por imóvel"],
  financeiro: ["Financeiro", "VGV, comissões, custo de aquisição e previsão"],
};

function n(value: unknown) { const parsed = Number(value); return Number.isFinite(parsed) ? parsed : 0; }
function integer(value: unknown) { return new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 0 }).format(n(value)); }
function decimal(value: unknown, digits = 1) { return new Intl.NumberFormat("pt-BR", { minimumFractionDigits: digits, maximumFractionDigits: digits }).format(n(value)); }
function brl(value: unknown, compact = false) { return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", notation: compact ? "compact" : "standard", maximumFractionDigits: compact ? 1 : 0 }).format(n(value)); }
function percent(value: unknown) { return `${decimal(value)}%`; }
function delta(current: unknown, previous: unknown) {
  const a = n(current); const b = n(previous);
  if (!b) return a ? "Sem base anterior" : "Sem variação";
  const d = ((a - b) / Math.abs(b)) * 100;
  return `${d >= 0 ? "+" : ""}${decimal(d)}% vs anterior`;
}
function dateTime(value: unknown) {
  if (!value) return "agora";
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(new Date(String(value)));
}
function sourceLabel(source: AdsSource) {
  return source.status === "conectado" ? "conectado" : source.status === "sem_permissao" ? "sem permissão" : source.status === "nao_configurado" ? "não configurado" : "indisponível";
}

function Info({ text }: { text: string }) { return <span className="cc-i" title={text} aria-label={text}>i</span>; }
function Kpi({ label, value, change, context, tone = "plain", help }: { label: string; value: string; change?: string; context?: string; tone?: Tone; help?: string }) {
  return <div className={`ape-kpi${tone === "plain" ? "" : ` ape-kpi--${tone}`}`}>
    <div><span className="ape-kpi-label">{label}</span>{help && <Info text={help} />}</div>
    <span className="ape-kpi-value">{value}</span>
    <div className="ape-toolbar">{change && <span className="ape-kpi-delta">{change}</span>}<span className="spacer" />{context && <span className="ape-kpi-meta">{context}</span>}</div>
  </div>;
}
function Card({ children, className = "" }: { children: ReactNode; className?: string }) { return <section className={`cc-card ${className}`}>{children}</section>; }
function Empty({ title, detail }: { title: string; detail: string }) { return <div className="cc-empty-prototype"><strong>{title}</strong><span>{detail}</span></div>; }
function Bar({ label, value, max, purple = false }: { label: string; value: number; max: number; purple?: boolean }) {
  return <div className="cc-bar-prototype"><span>{label}</span><i><b className={purple ? "purple" : ""} style={{ width: `${max ? Math.max(value ? 2 : 0, value / max * 100) : 0}%` }} /></i><strong>{integer(value)}</strong></div>;
}

type MediaLine = Row & {
  _key: string;
  _level: "canal" | "campanha" | "conjunto" | "anúncio";
  _name: string;
  _sub?: string;
  _ancestors: string[];
  _hasChildren?: boolean;
};
function marketingLines(ads: Row[]) {
  const lines: MediaLine[] = [];
  const platforms = new Map<string, Row[]>();
  for (const row of ads) { const key = String(row.plataforma ?? "Plataforma"); platforms.set(key, [...(platforms.get(key) ?? []), row]); }
  const sum = (rows: Row[], key: string) => rows.reduce((total, row) => total + n(row[key]), 0);
  const aggregate = (rows: Row[]) => ({
    investimento: sum(rows, "investimento"), impressoes: sum(rows, "impressoes"), alcance: sum(rows, "alcance"),
    cliques: sum(rows, "cliques"), lpv: sum(rows, "lpv"), leads_plataforma: sum(rows, "leads_plataforma"),
    leads_crm: sum(rows, "leads_crm"), leads_validos: sum(rows, "leads_validos"), qualificados: sum(rows, "qualificados"),
    visitas: sum(rows, "visitas"), vendas: sum(rows, "vendas"), comissao_atribuida: sum(rows, "comissao_atribuida"),
  });
  for (const [platform, rows] of platforms) {
    const platformKey = `p-${platform}`;
    lines.push({ _key: platformKey, _level: "canal", _name: platform, _ancestors: [], _hasChildren: true, ...aggregate(rows) });
    const campaigns = new Map<string, Row[]>();
    for (const row of rows) { const key = String(row.campanha ?? "Campanha sem nome"); campaigns.set(key, [...(campaigns.get(key) ?? []), row]); }
    for (const [campaign, campaignRows] of campaigns) {
      const campaignKey = `c-${platform}-${campaign}`;
      lines.push({ _key: campaignKey, _level: "campanha", _name: campaign, _sub: String(campaignRows[0]?.objetivo ?? "campanha"), _ancestors: [platformKey], _hasChildren: true, ...aggregate(campaignRows) });
      const adSets = new Map<string, Row[]>();
      for (const row of campaignRows) { const key = String(row.conjunto ?? "Conjunto não informado"); adSets.set(key, [...(adSets.get(key) ?? []), row]); }
      for (const [adSet, adRows] of adSets) {
        const adSetKey = `s-${platform}-${campaign}-${adSet}`;
        lines.push({ _key: adSetKey, _level: "conjunto", _name: adSet, _sub: `${adRows.length} anúncio${adRows.length === 1 ? "" : "s"}`, _ancestors: [platformKey, campaignKey], _hasChildren: true, ...aggregate(adRows) });
        adRows.forEach((row, index) => lines.push({ ...row, _key: `a-${platform}-${campaign}-${adSet}-${String(row.anuncio_id ?? index)}`, _level: "anúncio", _name: String(row.anuncio ?? "Anúncio sem nome"), _sub: String(row.objetivo ?? "anúncio"), _ancestors: [platformKey, campaignKey, adSetKey] }));
      }
    }
  }
  return lines;
}

export function CentralComandoPrototypeWorkspace({ accessToken }: { accessToken: string }) {
  const [data, setData] = useState<Payload | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [page, setPage] = useState<Page>("ceo");
  const [profile, setProfile] = useState<Profile>("ceo");
  const [days, setDays] = useState(30);
  const [marketingMode, setMarketingMode] = useState<"media" | "business">("media");
  const [marketingSearch, setMarketingSearch] = useState("");
  const [expandedMedia, setExpandedMedia] = useState<string[]>(["*"]);
  const [selectedMediaKey, setSelectedMediaKey] = useState("");
  const [flowMode, setFlowMode] = useState<"flow" | "stock">("flow");
  const [teamMode, setTeamMode] = useState<"execution" | "result" | "ia">("execution");
  const [partnerDetails, setPartnerDetails] = useState(false);
  const [alertOpen, setAlertOpen] = useState<Alert | null>(null);
  const [owner, setOwner] = useState("");
  const [deadline, setDeadline] = useState("");
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState("");

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

  useEffect(() => { const timer = window.setTimeout(() => void load(), 0); const interval = window.setInterval(() => void load(true), 60_000); return () => { window.clearTimeout(timer); window.clearInterval(interval); }; }, [load]);

  const central = data?.central ?? {};
  const summary = central.summary ?? EMPTY;
  const finance = central.finance ?? EMPTY;
  const tracking = data?.tracking ?? EMPTY;
  const attribution = (tracking.attribution as Row | undefined) ?? EMPTY;
  const site = (tracking.site as Row | undefined) ?? EMPTY;
  const metaDelivery = (tracking.meta as Row | undefined) ?? EMPTY;
  const meta = data?.media?.meta ?? {};
  const google = data?.media?.google ?? {};
  const ads = useMemo(() => [...(meta.anuncios ?? []), ...(google.anuncios ?? [])], [meta.anuncios, google.anuncios]);
  const mediaRows = useMemo(() => marketingLines(ads), [ads]);
  const expandedSet = useMemo(() => new Set(expandedMedia), [expandedMedia]);
  const filteredMedia = mediaRows.filter(row => {
    const matches = `${row._name} ${row._sub ?? ""}`.toLowerCase().includes(marketingSearch.toLowerCase());
    if (marketingSearch) return matches;
    return expandedSet.has("*") || row._ancestors.every(key => expandedSet.has(key));
  });
  const selectedMedia = mediaRows.find(row => row._key === selectedMediaKey);
  const mediaAvailable = meta.status === "conectado" || google.status === "conectado";
  const spend = ads.reduce((sum, row) => sum + n(row.investimento), 0);
  const mediaLeads = ads.reduce((sum, row) => sum + n(row.leads_plataforma), 0);
  const validLeads = ads.reduce((sum, row) => sum + n(row.leads_validos ?? row.leads_crm ?? row.leads_plataforma), 0);
  const qualified = ads.reduce((sum, row) => sum + n(row.qualificados), 0);
  const attributedVisits = ads.reduce((sum, row) => sum + n(row.visitas), 0);
  const attributedSales = ads.reduce((sum, row) => sum + n(row.vendas), 0);
  const actions = new Map((data?.alert_actions ?? []).map(item => [item.alerta_chave, item]));
  const alerts = useMemo<Alert[]>(() => {
    const result: Alert[] = [];
    const add = (a: Omit<Alert, "action">) => result.push({ ...a, action: actions.get(a.key) });
    if (n(summary.clientes_criticos)) add({ key: "crm:primeira-resposta", title: "Clientes aguardando resposta", what: `${integer(summary.clientes_criticos)} clientes estão esperando há mais de 30 minutos.`, impact: "A demora reduz a chance de contato e visita.", next: "Responder ou redistribuir os atendimentos mais antigos.", level: "critical", weight: 100 });
    if (n(summary.acoes_vencidas)) add({ key: "crm:acoes-vencidas", title: "Próximas ações vencidas", what: `${integer(summary.acoes_vencidas)} atendimentos passaram do prazo definido pela IA.`, impact: "Oportunidades podem esfriar sem nova abordagem.", next: "Revisar Meu Dia e concluir ou reagendar cada ação.", level: "attention", weight: 90 });
    if (n(summary.visitas_sem_feedback)) add({ key: "crm:visitas-sem-feedback", title: "Visitas sem retorno", what: `${integer(summary.visitas_sem_feedback)} visitas estão sem feedback há mais de 48 horas.`, impact: "A gestão perde visibilidade sobre proposta e objeções.", next: "Cobrar o feedback e registrar o próximo passo.", level: "attention", weight: 85 });
    if (n(metaDelivery.errors)) add({ key: "tracking:meta-erros", title: "Falha na entrega de eventos", what: `${integer(metaDelivery.errors)} eventos terminaram com erro.`, impact: "As plataformas recebem menos sinais reais de qualidade.", next: "Corrigir a causa e reprocessar os eventos.", level: "critical", weight: 95 });
    if (google.status !== "conectado") add({ key: "integration:google-ads", title: "Google Ads sem leitura completa", what: String(google.motivo ?? "A integração não devolveu métricas."), impact: "Custos e atribuição podem ficar incompletos.", next: "Autorizar a conta do Google Ads.", level: "info", weight: 55 });
    return result.filter(a => !a.action?.resolvido).sort((a, b) => b.weight - a.weight);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data?.alert_actions, google.motivo, google.status, metaDelivery.errors, summary.acoes_vencidas, summary.clientes_criticos, summary.visitas_sem_feedback]);

  const critical = alerts.filter(a => a.level === "critical").length;
  const flow = flowMode === "flow" ? (central.funnel?.flow ?? []) : (central.funnel?.stock ?? []);
  const maxFlow = Math.max(1, ...flow.map(item => item.value));
  const team = central.team ?? [];
  const topPages = (tracking.top_pages as Row[] | undefined) ?? [];
  const metaEvents = (tracking.meta_events as Row[] | undefined) ?? [];
  const partner = profile === "socio";
  const allowed = partner ? NAV.filter(([key]) => key === "ceo" || key === "financeiro") : profile === "trafego" ? NAV.filter(([key]) => ["ceo", "marketing", "tracking", "site"].includes(key)) : profile === "comercial" ? NAV.filter(([key]) => ["ceo", "crm", "equipe", "financeiro"].includes(key)) : NAV;
  const title = partner && page === "ceo" ? "Resumo da operação" : PAGE_COPY[page][0];
  const subtitle = partner && page === "ceo" ? "Como a apêcerto está indo neste período" : PAGE_COPY[page][1];

  const openAlert = (alert: Alert) => {
    setAlertOpen(alert);
    setOwner(alert.action?.responsavel ?? "");
    setDeadline(alert.action?.prazo ?? "");
  };

  const saveAlert = async (action: "assign" | "seen") => {
    if (!alertOpen) return;
    setSaving(true);
    try {
      const response = await fetch("/api/central-comando", {
        method: "POST",
        headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
        body: JSON.stringify({ key: alertOpen.key, action, responsavel: owner, prazo: deadline }),
      });
      const body = await response.json() as { error?: string };
      if (!response.ok) throw new Error(body.error || "Não foi possível salvar o alerta.");
      await load(true);
      setAlertOpen(null);
      setNotice(action === "assign" ? "Responsável e prazo salvos." : "Alerta marcado como visto.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível salvar o alerta.");
    } finally {
      setSaving(false);
    }
  };

  const toggleMedia = (row: MediaLine) => {
    setSelectedMediaKey(row._key);
    if (!row._hasChildren) return;
    setExpandedMedia(current => {
      const allParents = mediaRows.filter(item => item._hasChildren).map(item => item._key);
      const next = new Set(current.includes("*") ? allParents : current);
      if (next.has(row._key)) next.delete(row._key); else next.add(row._key);
      return [...next];
    });
  };

  const exportCsv = (forcedRows?: Row[], suffix?: string) => {
    const rows = (forcedRows ?? (page === "equipe" ? team : page === "marketing" ? ads : page === "crm" ? (central.funnel?.flow ?? []) : page === "site" ? topPages : page === "tracking" ? metaEvents : page === "financeiro" ? [finance] : [summary])) as Row[];
    if (!rows.length) { setNotice("Não há linhas reais para exportar nesta visão."); return; }
    const keys = Array.from(new Set(rows.flatMap(row => Object.keys(row).filter(key => !key.startsWith("_")))));
    const quote = (value: unknown) => `"${String(value ?? "").replaceAll('"', '""')}"`;
    const csv = [keys.map(quote).join(";"), ...rows.map(row => keys.map(key => quote(row[key])).join(";"))].join("\n");
    const url = URL.createObjectURL(new Blob([`\ufeff${csv}`], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `central-${suffix ?? page}-${days}d.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1_000);
    setNotice(`Exportação preparada: central-${suffix ?? page}-${days}d.csv`);
  };

  if (loading && !data) return <section className="cc-prototype"><div className="cc-loading"><strong>Conectando CRM, mídia, site, equipe e financeiro…</strong><span>Nenhum número fictício será exibido.</span></div></section>;
  if (error && !data) return <section className="cc-prototype"><div className="cc-loading"><strong>Não foi possível abrir a Central de Comando.</strong><span>{error}</span><button className="ape-btn" type="button" onClick={() => void load()}>Tentar novamente</button></div></section>;

  const filterHeader = !partner || page === "financeiro";
  const header = <header className="cc-prototype-header"><div className="ape-page-header">
    <div className="ape-toolbar"><div><h1 className="ape-page-title">{title}</h1><span style={{ color: "var(--fg-3)", fontSize: 12 }}>{subtitle}</span></div><span className="spacer" /><span className="ape-badge ape-badge--success">● Sincronizado · {dateTime(data?.generated_at)}</span><button className="ape-btn ape-btn--secondary" type="button" onClick={() => exportCsv()}>⇩ Exportar</button><button className="ape-btn" type="button" onClick={() => void load(true)} disabled={refreshing}>{refreshing ? "Atualizando…" : "Atualizar dados"}</button></div>
    {filterHeader && <div className="ape-toolbar" style={{ marginTop: 10 }}><button className="ape-chip" type="button" onClick={() => setDays(days === 30 ? 7 : 30)}>Período <strong>Últimos {days} dias</strong></button><span className="ape-chip">Comparação <strong>Período anterior</strong></span><span className="ape-chip">Canal <strong>todos</strong></span><span className="ape-chip">Equipe ou corretor <strong>todos</strong></span><span className="ape-chip">☷ Mais filtros <strong>nenhum</strong></span><button className="ape-btn ape-btn--ghost" type="button" onClick={() => { setDays(30); setMarketingSearch(""); }}>Limpar</button><button className="ape-btn ape-btn--ghost" type="button" onClick={() => { window.localStorage.setItem("apecerto-central-comando-view", JSON.stringify({ page, days, profile })); setNotice("Visualização atual salva neste navegador."); }}>Salvar visualização</button><span className="spacer" /><small style={{ color: "var(--fg-muted)" }}>Recorte: últimos {days} dias · vs período anterior</small></div>}
  </div></header>;

  const alertList = (limit = 5) => <div className="cc-alerts-prototype">{alerts.slice(0, limit).map(alert => <button className={`cc-alert-prototype ${alert.level}`} type="button" key={alert.key} onClick={() => openAlert(alert)}><i>!</i><span><strong>{alert.title}</strong><small>{alert.what}</small><em>Impacto: {alert.impact}</em><b>{alert.action?.responsavel || "Definir responsável"} · {alert.next} →</b></span></button>)}{!alerts.length && <Empty title="Nenhum alerta aberto" detail="A operação não apresenta exceções relevantes agora." />}</div>;

  const pageCeo = partner ? <div>
    <div className="cc-natural-health"><strong>{critical ? `A operação tem ${critical} ponto${critical === 1 ? "" : "s"} crítico${critical === 1 ? "" : "s"} que precisa${critical === 1 ? "" : "m"} de ação hoje.` : alerts.length ? `A operação está saudável, mas existem ${alerts.length} pontos que precisam de atenção.` : "A operação está saudável e sem alertas abertos."}</strong><p>{integer(finance.vendas)} vendas somaram {brl(finance.vgv, true)} no período. Os três pontos de maior impacto aparecem abaixo.</p></div>
    <div className="cc-kpigrid partner-kpis"><Kpi label="Vendas fechadas" value={integer(finance.vendas)} change={delta(finance.vendas, finance.vendas_anterior)} context="contratos concluídos" tone="purple" help="Negócios concluídos no período." /><Kpi label="Valor vendido" value={brl(finance.vgv, true)} change={delta(finance.vgv, finance.vgv_anterior)} context="valor geral das vendas" tone="orange" help="Soma dos valores dos imóveis vendidos." /><Kpi label="Comissão recebida" value={brl(finance.comissao_recebida, true)} context={`de ${brl(finance.comissao_prevista, true)} previstos`} tone="purple" help="Quanto entrou e quanto está previsto." /><Kpi label="Investimento em anúncios" value={mediaAvailable ? brl(spend, true) : "Indisponível"} context={mediaAvailable ? "Meta + Google" : "autorizar contas"} tone="orange" help="O painel não apresenta zero quando a fonte não pode ser lida." /><Kpi label="Pessoas interessadas" value={integer(summary.leads_validos)} context="dados do CRM" help="Leads novos válidos no período." /><Kpi label="Visitas realizadas" value={integer(summary.visitas_realizadas)} change={delta(summary.visitas_realizadas, summary.visitas_realizadas_anterior)} context="confirmadas" tone="success" help="Visitas registradas como realizadas." /></div>
    <Card><p className="eyebrow">CAMINHO COMERCIAL</p><h2 className="ape-section-title">Pessoas interessadas → visitas → vendas</h2><div className="cc-partner-funnel"><div><span>Pessoas interessadas</span><strong>{integer(summary.leads_validos)}</strong></div><b>→</b><div><span>Com visita realizada</span><strong>{integer((central.funnel?.flow ?? []).find(x => x.key === "visit_done")?.value)}</strong></div><b>→</b><div><span>Com venda concluída</span><strong>{integer((central.funnel?.flow ?? []).find(x => x.key === "sales")?.value)}</strong></div></div></Card>
    <Card><p className="eyebrow">O QUE PRECISA DA SUA ATENÇÃO</p><h2 className="ape-section-title">Os três pontos de maior impacto no resultado</h2>{alertList(3)}</Card>
    <button className="ape-btn ape-btn--secondary" style={{ justifySelf: "center" }} type="button" onClick={() => setPartnerDetails(v => !v)}>{partnerDetails ? "Ocultar detalhes da operação ↑" : "Ver detalhes da operação ↓"}</button>
    {partnerDetails && <><div className="cc-kpigrid"><Kpi label="Custo por pessoa interessada" value={mediaAvailable && mediaLeads ? brl(spend / mediaLeads) : "Sem base"} context="também chamado de custo por lead" /><Kpi label="Tempo para primeira resposta" value={`${decimal(summary.primeira_resposta_mediana_min)} min`} context="mediana da equipe" /><Kpi label="Nota da IA" value={`${decimal(summary.nota_ia)}/10`} context="qualidade dos atendimentos" tone="purple" /><Kpi label="Leads acompanhados" value={integer(summary.carteira_ativa)} context="carteira ativa" /></div>{alertList(8)}</>}
  </div> : <div>
    <div className="cc-kpigrid ceo"><Kpi label="Leads válidos" value={integer(summary.leads_validos)} change={delta(summary.leads_validos, summary.leads_validos_anterior)} context="CRM" tone="orange" help="Leads novos válidos sem a carga histórica." /><Kpi label="Investimento em mídia" value={mediaAvailable ? brl(spend) : "Indisponível"} context={mediaAvailable ? "Meta + Google" : "leitura não autorizada"} /><Kpi label="CPL válido" value={mediaAvailable && validLeads ? brl(spend / validLeads) : "Indisponível"} context="investimento ÷ leads válidos" tone="orange" /><Kpi label="Visitas realizadas" value={integer(summary.visitas_realizadas)} change={delta(summary.visitas_realizadas, summary.visitas_realizadas_anterior)} /><Kpi label="Vendas" value={integer(finance.vendas)} change={delta(finance.vendas, finance.vendas_anterior)} tone="success" /><Kpi label="VGV" value={brl(finance.vgv, true)} change={delta(finance.vgv, finance.vgv_anterior)} tone="purple" /><Kpi label="Comissão prevista" value={brl(finance.comissao_prevista, true)} change={delta(finance.comissao_prevista, finance.comissao_prevista_anterior)} tone="purple" /><Kpi label="CAC por venda" value={mediaAvailable && n(finance.vendas) ? brl(spend / n(finance.vendas)) : "Indisponível"} context="mídia ÷ vendas" /></div>
    <div className="cc-2col"><Card><div className="ape-toolbar"><div><p className="eyebrow">FUNIL COMERCIAL</p><h2 className="ape-section-title">Fluxo e estoque do funil</h2></div><span className="spacer" /><div className="ape-tabs ape-tabs--pill"><button className={`ape-tab${flowMode === "flow" ? " is-active" : ""}`} type="button" onClick={() => setFlowMode("flow")}>Fluxo do período</button><button className={`ape-tab${flowMode === "stock" ? " is-active" : ""}`} type="button" onClick={() => setFlowMode("stock")}>Estoque atual</button></div></div><div className="cc-flow-row cc-flow-head"><span>Etapa</span><span>Leads</span><span>Qtd.</span><span>Conversão</span><span>Perda</span><span>Tempo</span></div>{flow.map((item, index) => { const previous = index ? flow[index - 1].value : 0; const conv = index && previous ? item.value / previous * 100 : 0; return <div className={`cc-flow-row${item.key === "sales" ? " purple" : ""}`} key={item.key}><span>{item.label}</span><i><b style={{ width: `${item.value / maxFlow * 100}%` }} /></i><strong>{integer(item.value)}</strong><span>{index ? percent(conv) : "—"}</span><span>{index ? percent(100 - conv) : "—"}</span><span>—</span></div>; })}</Card><Card><div className="ape-toolbar"><div><p className="eyebrow">ONDE AGIR AGORA</p><h2 className="ape-section-title">{critical} críticos · {Math.max(0, alerts.length - critical)} em atenção</h2></div><span className="spacer" /><span className="ape-badge">{alerts.length} alertas</span></div><div className="ape-toolbar" style={{ margin: "10px 0" }}><button className="ape-chip is-active" type="button">Todas {alerts.length}</button><button className="ape-chip" type="button">Crítico {critical}</button><button className="ape-chip" type="button">Atenção {alerts.length - critical}</button></div>{alertList()}</Card></div>
    <Card><div className="ape-toolbar"><div><p className="eyebrow">TENDÊNCIA</p><h2 className="ape-section-title">Leads válidos, visitas e vendas por dia</h2></div><span className="spacer" /><span className="ape-badge">dados reais do período</span></div><div style={{ display: "grid", gridTemplateColumns: `repeat(${Math.max(1, (central.trend ?? []).length)}, minmax(8px,1fr))`, alignItems: "end", gap: 6, minHeight: 180, paddingTop: 20 }}>{(central.trend ?? []).map((row, index) => <div key={String(row.day ?? index)} title={`${integer(row.leads)} leads`} style={{ height: `${Math.max(4, n(row.leads) / Math.max(1, ...(central.trend ?? []).map(r => n(r.leads))) * 160)}px`, borderRadius: "5px 5px 0 0", background: "var(--ape-orange)" }} />)}</div></Card>
  </div>;

  const pageMarketing = <div>
    <div className="cc-kpigrid"><Kpi label="Investimento" value={mediaAvailable ? brl(spend) : "Indisponível"} context={mediaAvailable ? "Meta + Google" : "autorizar contas"} /><Kpi label="CPL válido" value={mediaAvailable && validLeads ? brl(spend / validLeads) : "Indisponível"} context="mídia + CRM" tone="orange" /><Kpi label="Custo/qualificado" value={mediaAvailable && qualified ? brl(spend / qualified) : "Sem base"} context={`${integer(qualified)} qualificados`} /><Kpi label="Custo/visita" value={mediaAvailable && attributedVisits ? brl(spend / attributedVisits) : "Sem base"} context={`${integer(attributedVisits)} visitas`} /><Kpi label="CAC" value={mediaAvailable && attributedSales ? brl(spend / attributedSales) : "Sem base"} context={`${integer(attributedSales)} vendas atribuídas`} /><Kpi label="ROAS de comissão" value={mediaAvailable && spend ? `${decimal(n(finance.comissao_prevista) / spend)}x` : "Sem base"} context="comissão ÷ investimento" tone="success" /></div>
    <Card>
      <div className="ape-toolbar"><h2 className="ape-section-title">Canal → campanha → conjunto → anúncio</h2><div className="ape-tabs ape-tabs--pill"><button className={`ape-tab${marketingMode === "media" ? " is-active" : ""}`} type="button" onClick={() => setMarketingMode("media")}>Performance de mídia</button><button className={`ape-tab${marketingMode === "business" ? " is-active" : ""}`} type="button" onClick={() => setMarketingMode("business")}>Resultado do negócio</button></div><span className="spacer" /><div className="ape-search"><span style={{ position: "absolute", left: 11, top: 9 }}>⌕</span><input className="ape-input" aria-label="Buscar na tabela de marketing" placeholder="Buscar campanha, conjunto ou anúncio" value={marketingSearch} onChange={e => setMarketingSearch(e.target.value)} /></div><button className="ape-chip" type="button" onClick={() => setExpandedMedia(expandedMedia.includes("*") ? [] : ["*"])}>{expandedMedia.includes("*") ? "Recolher tudo" : "Expandir tudo"}</button><span className="ape-chip">Colunas <strong>{marketingMode === "media" ? "13/13" : "10/10"}</strong></span><span className="ape-chip">Comparar: período anterior</span><button className="ape-btn ape-btn--secondary" type="button" onClick={() => exportCsv(ads, "marketing")}>Exportar CSV</button></div>
      <div className={`cc-tablewrap cc-scroll${filteredMedia.length ? "" : " empty"}`}>
        <table className="ape-table cc-sticky1"><thead><tr><th>Nível</th>{marketingMode === "media" ? <><th>Investimento</th><th>Impressões</th><th>Alcance</th><th>Freq.</th><th>CPM</th><th>Cliques link</th><th>CTR link</th><th>CPC link</th><th>LPV</th><th>Leads plataforma</th><th>Leads CRM</th><th>Leads válidos</th><th>CPL</th></> : <><th>Leads válidos</th><th>Qualificados</th><th>Tx. qualificação</th><th>Custo/qualificado</th><th>Visitas</th><th>Custo/visita</th><th>Vendas</th><th>CAC</th><th>Comissão atribuída</th><th>ROAS comissão</th></>}</tr></thead>
          <tbody>{filteredMedia.map(row => { const impressions = n(row.impressoes), reach = n(row.alcance), clicks = n(row.cliques), investment = n(row.investimento), leads = n(row.leads_validos ?? row.leads_crm ?? row.leads_plataforma), rowQualified = n(row.qualificados), visits = n(row.visitas), sales = n(row.vendas), commission = n(row.comissao_atribuida); const open = expandedSet.has("*") || expandedSet.has(row._key); const indent = row._level === "canal" ? 0 : row._level === "campanha" ? 18 : row._level === "conjunto" ? 36 : 54; return <tr key={row._key} className={selectedMediaKey === row._key ? "is-selected" : ""} onClick={() => toggleMedia(row)}><td><strong style={{ paddingLeft: indent }}>{row._hasChildren ? open ? "▾" : "▸" : "·"} {row._name}</strong><small>{row._level}{row._sub ? ` · ${row._sub}` : ""}</small></td>{marketingMode === "media" ? <><td>{brl(investment)}</td><td>{integer(impressions)}</td><td>{integer(reach)}</td><td>{reach ? decimal(impressions / reach, 2) : "—"}</td><td>{impressions ? brl(investment / impressions * 1000) : "—"}</td><td>{integer(clicks)}</td><td>{impressions ? percent(clicks / impressions * 100) : "—"}</td><td>{clicks ? brl(investment / clicks) : "—"}</td><td>{row.lpv == null ? "—" : integer(row.lpv)}</td><td>{integer(row.leads_plataforma)}</td><td>{row.leads_crm == null ? "—" : integer(row.leads_crm)}</td><td><strong>{row.leads_validos == null ? "—" : integer(row.leads_validos)}</strong></td><td><strong>{leads ? brl(investment / leads) : "—"}</strong></td></> : <><td>{row.leads_validos == null ? "—" : integer(row.leads_validos)}</td><td>{row.qualificados == null ? "—" : integer(row.qualificados)}</td><td>{leads && row.qualificados != null ? percent(rowQualified / leads * 100) : "—"}</td><td>{rowQualified ? brl(investment / rowQualified) : "—"}</td><td>{row.visitas == null ? "—" : integer(row.visitas)}</td><td>{visits ? brl(investment / visits) : "—"}</td><td>{row.vendas == null ? "—" : integer(row.vendas)}</td><td>{sales ? brl(investment / sales) : "—"}</td><td>{row.comissao_atribuida == null ? "—" : brl(commission)}</td><td>{investment && row.comissao_atribuida != null ? `${decimal(commission / investment)}x` : "—"}</td></>}</tr>; })}</tbody>
        </table>
        {!filteredMedia.length && <Empty title="Nenhum anúncio disponível" detail={`${meta.motivo ?? ""} ${google.motivo ?? ""}`.trim() || "As plataformas ainda não devolveram anúncios para o período."} />}
      </div>
      <div className="cc-summary-note"><span>Totais do recorte: {mediaAvailable ? `${brl(spend)} investidos · ${integer(validLeads)} leads válidos` : "leitura de mídia indisponível"}</span><span>Meta Ads: {sourceLabel(meta)} · Google Ads: {sourceLabel(google)}</span></div>
    </Card>
    <Card><div className="ape-toolbar"><div><p className="eyebrow">ANÚNCIO SELECIONADO</p><h2 className="ape-section-title">Criativo, público e resultado comercial</h2></div><span className="spacer" /><Info text="Ativos individuais só aparecem quando a API da plataforma os disponibiliza." /></div>{selectedMedia ? <div className="cc-selected-ad"><div><span className="ape-badge">{selectedMedia._level}</span><h3>{selectedMedia._name}</h3><p>{selectedMedia._sub || "Sem descrição recebida da plataforma."}</p><div className="cc-source-pills"><span>Investimento · {brl(selectedMedia.investimento)}</span><span>CTR · {n(selectedMedia.impressoes) ? percent(n(selectedMedia.cliques) / n(selectedMedia.impressoes) * 100) : "—"}</span><span>Leads válidos · {selectedMedia.leads_validos == null ? "—" : integer(selectedMedia.leads_validos)}</span></div></div><div><h3>Criativo dinâmico</h3><Empty title="Ativos individuais ainda indisponíveis" detail="A leitura real atual entrega campanha, conjunto e anúncio. Nenhuma variação vencedora será inventada até a API disponibilizar os ativos." /></div></div> : <Empty title="Selecione uma linha da tabela" detail="Abra campanha, conjunto ou anúncio para comparar criativo e resultado do negócio." />}</Card>
  </div>;

  const pageTracking = <div><div className="cc-kpigrid"><Kpi label="Saúde da coleta" value={`${integer(n(metaDelivery.errors) ? Math.max(0, 100 - n(metaDelivery.errors) * 5) : 100)}/100`} tone={n(metaDelivery.errors) ? "danger" : "success"} /><Kpi label="Eventos CRM entregues" value={integer(metaDelivery.delivered)} /><Kpi label="Erros de entrega" value={integer(metaDelivery.errors)} tone={n(metaDelivery.errors) ? "danger" : "success"} /><Kpi label="Leads atribuídos" value={`${integer(attribution.attributed)}/${integer(attribution.eligible)}`} tone="orange" /><Kpi label="Eventos do pixel" value={integer(metaDelivery.total)} /><Kpi label="Última entrega" value={dateTime(metaDelivery.last_delivery_at)} /></div><div className="cc-source-pills"><span>Meta Pixel · {sourceLabel(meta)}</span><span>Conversions API · {n(metaDelivery.errors) ? "com falhas" : "sem falhas"}</span><span>GA4 · {data?.ga4_configurado ? "configurado" : "indisponível"}</span><span>CRM · conectado</span></div><div className="cc-3col"><Card><p className="eyebrow">CAMINHO DO DADO</p><h2 className="ape-section-title">Clique → sessão → lead → corretor</h2><Bar label="Eventos recebidos" value={n(metaDelivery.total)} max={Math.max(1, n(metaDelivery.total))} /><Bar label="Entregues" value={n(metaDelivery.delivered)} max={Math.max(1, n(metaDelivery.total))} /><Bar label="Atribuídos" value={n(attribution.attributed)} max={Math.max(1, n(metaDelivery.total))} purple /></Card><Card><p className="eyebrow">PRIVACIDADE</p><h2 className="ape-section-title">Consentimento e correspondência</h2><Bar label="Marketing autorizado" value={n((tracking.consent as Row | undefined)?.marketing)} max={Math.max(1, n((tracking.consent as Row | undefined)?.total))} purple /><Bar label="Cobertura de atribuição" value={n(attribution.coverage_percent)} max={100} /></Card><Card><p className="eyebrow">FALHA TÉCNICA</p><h2 className="ape-section-title">Erros separados da conversão</h2><Bar label="Entregas com erro" value={n(metaDelivery.errors)} max={Math.max(1, n(metaDelivery.total))} /><Bar label="Vendas comerciais" value={n(finance.vendas)} max={Math.max(1, n(summary.leads_validos))} purple /></Card></div><Card><div className="ape-toolbar"><h2 className="ape-section-title">Eventos do CRM devolvidos às plataformas</h2><span className="spacer" /><button className="ape-chip" type="button">Todas as categorias</button><button className="ape-btn ape-btn--secondary" type="button">Exportar registros</button></div>{metaEvents.length ? <div className="cc-tablewrap"><table className="ape-table"><thead><tr><th>Evento</th><th>Entregues</th><th>Erros</th><th>Taxa de sucesso</th></tr></thead><tbody>{metaEvents.map(row => <tr key={String(row.event_type)}><td><strong>{String(row.event_type).replaceAll("_", " ")}</strong></td><td>{integer(row.delivered)}</td><td>{integer(row.errors)}</td><td>{percent(n(row.delivered) / Math.max(1, n(row.delivered) + n(row.errors)) * 100)}</td></tr>)}</tbody></table></div> : <Empty title="Sem eventos no período" detail="A fonte real não devolveu eventos para esta janela." />}</Card></div>;

  const pageCrm = <div><div className="cc-kpigrid"><Kpi label="Leads no período" value={integer(summary.leads_validos)} tone="orange" /><Kpi label="Carteira ativa" value={integer(summary.carteira_ativa)} /><Kpi label="Ações vencidas" value={integer(summary.acoes_vencidas)} tone={n(summary.acoes_vencidas) ? "danger" : "success"} /><Kpi label="Clientes aguardando" value={integer(summary.clientes_aguardando)} /><Kpi label="Críticos +30 min" value={integer(summary.clientes_criticos)} tone={n(summary.clientes_criticos) ? "danger" : "success"} /><Kpi label="Visitas sem feedback" value={integer(summary.visitas_sem_feedback)} tone={n(summary.visitas_sem_feedback) ? "orange" : "success"} /></div><div className="cc-2col"><Card><div className="ape-toolbar"><h2 className="ape-section-title">Fluxo e estoque comercial</h2><span className="spacer" /><div className="ape-tabs ape-tabs--pill"><button className={`ape-tab${flowMode === "flow" ? " is-active" : ""}`} onClick={() => setFlowMode("flow")} type="button">Fluxo</button><button className={`ape-tab${flowMode === "stock" ? " is-active" : ""}`} onClick={() => setFlowMode("stock")} type="button">Estoque</button></div></div>{flow.map(item => <Bar key={item.key} label={item.label} value={item.value} max={maxFlow} purple={item.key === "sales"} />)}</Card><Card><p className="eyebrow">SLA E ENVELHECIMENTO</p><h2 className="ape-section-title">Onde o atendimento está parado</h2><Bar label="Aguardando resposta" value={n(summary.clientes_aguardando)} max={Math.max(1, n(summary.carteira_ativa))} /><Bar label="Mais de 30 min" value={n(summary.clientes_criticos)} max={Math.max(1, n(summary.carteira_ativa))} /><Bar label="Ações vencidas" value={n(summary.acoes_vencidas)} max={Math.max(1, n(summary.carteira_ativa))} /><Bar label="Visitas sem retorno" value={n(summary.visitas_sem_feedback)} max={Math.max(1, n(summary.carteira_ativa))} purple /></Card></div><Card><div className="ape-toolbar"><div><p className="eyebrow">COORTE DO PERÍODO</p><h2 className="ape-section-title">Conversão dos leads que realmente entraram</h2></div><span className="spacer" /><span className="ape-badge">sem carga histórica importada</span></div><div className="cc-flow-row cc-flow-head"><span>Etapa</span><span>Leads</span><span>Qtd.</span><span>Conversão</span><span>Perda</span><span>Tempo</span></div>{(central.funnel?.flow ?? []).map((item, index, rows) => { const previous = index ? rows[index - 1].value : 0; return <div className="cc-flow-row" key={item.key}><span>{item.label}</span><i><b style={{ width: `${item.value / Math.max(1, rows[0]?.value) * 100}%` }} /></i><strong>{integer(item.value)}</strong><span>{index && previous ? percent(item.value / previous * 100) : "—"}</span><span>{index && previous ? percent(100 - item.value / previous * 100) : "—"}</span><span>—</span></div>; })}</Card></div>;

  const pageTeam = <div><div className="cc-kpigrid"><Kpi label="Corretores ativos" value={integer(summary.corretores_ativos)} /><Kpi label="No escritório agora" value={integer(summary.no_escritorio_agora)} tone="success" /><Kpi label="Mensagens enviadas" value={integer(team.reduce((s, r) => s + n(r.mensagens_enviadas), 0))} /><Kpi label="Movimentações" value={integer(team.reduce((s, r) => s + n(r.movimentacoes), 0))} /><Kpi label="Visitas realizadas" value={integer(summary.visitas_realizadas)} /><Kpi label="Nota média IA" value={`${decimal(summary.nota_ia)}/10`} tone="purple" /></div><Card><div className="ape-toolbar"><h2 className="ape-section-title">Atividade, qualidade e resultado por corretor</h2><div className="ape-tabs ape-tabs--pill"><button type="button" className={`ape-tab${teamMode === "execution" ? " is-active" : ""}`} onClick={() => setTeamMode("execution")}>Execução</button><button type="button" className={`ape-tab${teamMode === "result" ? " is-active" : ""}`} onClick={() => setTeamMode("result")}>Resultado</button><button type="button" className={`ape-tab${teamMode === "ia" ? " is-active" : ""}`} onClick={() => setTeamMode("ia")}>Avaliação da IA</button></div><span className="spacer" /><button className="ape-chip" type="button">Equipe todos</button><button className="ape-btn ape-btn--secondary" type="button">Exportar CSV</button></div>{team.length ? <div className="cc-tablewrap"><table className="ape-table"><thead><tr><th>Corretor</th><th>Carteira</th><th>1ª resposta</th><th>Nota IA</th><th>Mensagens</th><th>Movimentações</th><th>Visitas</th><th>Canceladas</th><th>Vendas</th><th>VGV</th><th>Horas ativas</th></tr></thead><tbody>{team.map((row, index) => <tr key={String(row.corretor_id ?? index)}><td><strong>{String(row.nome ?? "Corretor")}</strong><small>{row.online ? "online agora" : row.no_escritorio ? "no escritório" : `última atividade ${dateTime(row.ultima_atividade_em)}`}</small></td><td>{integer(row.carteira_ativa)}<small>{integer(row.acoes_vencidas)} vencidas</small></td><td>{row.primeira_resposta_mediana_min == null ? "—" : `${decimal(row.primeira_resposta_mediana_min)} min`}</td><td>{row.nota_media == null ? "—" : `${decimal(row.nota_media)}/10`}</td><td>{integer(row.mensagens_enviadas)}</td><td>{integer(row.movimentacoes)}</td><td>{integer(row.visitas_realizadas)}</td><td>{integer(row.visitas_canceladas)}</td><td><strong>{integer(row.vendas)}</strong></td><td><strong>{brl(row.vgv, true)}</strong></td><td>{row.horas_ativas == null ? "Começando agora" : `${decimal(row.horas_ativas)} h`}</td></tr>)}</tbody></table></div> : <Empty title="Equipe sem dados no período" detail="A fonte operacional não devolveu corretores ativos." />}</Card><Card><p className="eyebrow">CRITÉRIOS DA IA</p><h2 className="ape-section-title">Qualidade do atendimento</h2><div className="cc-3col"><Bar label="Nota média" value={n(summary.nota_ia)} max={10} purple /><Bar label="Primeira resposta" value={Math.max(0, 60 - n(summary.primeira_resposta_mediana_min))} max={60} /><Bar label="Feedback no prazo" value={Math.max(0, n(summary.visitas_realizadas) - n(summary.visitas_sem_feedback))} max={Math.max(1, n(summary.visitas_realizadas))} /></div></Card></div>;

  const pageSite = <div><div className="cc-kpigrid"><Kpi label="Páginas vistas" value={integer(site.page_views)} /><Kpi label="Sessões" value={integer(site.sessions)} /><Kpi label="Imóveis vistos" value={integer(site.property_views)} tone="orange" /><Kpi label="Interações na galeria" value={integer(site.gallery_interactions)} /><Kpi label="Cliques no WhatsApp" value={integer(site.whatsapp_clicks)} tone="success" /><Kpi label="Leads enviados" value={integer(site.site_leads)} tone="purple" /></div><div className="cc-2col"><Card><p className="eyebrow">JORNADA NO SITE</p><h2 className="ape-section-title">Da navegação ao contato</h2><Bar label="Páginas vistas" value={n(site.page_views)} max={Math.max(1, n(site.page_views))} /><Bar label="Imóveis vistos" value={n(site.property_views)} max={Math.max(1, n(site.page_views))} /><Bar label="Galeria" value={n(site.gallery_interactions)} max={Math.max(1, n(site.page_views))} /><Bar label="WhatsApp" value={n(site.whatsapp_clicks)} max={Math.max(1, n(site.page_views))} /><Bar label="Leads enviados" value={n(site.site_leads)} max={Math.max(1, n(site.page_views))} purple /></Card><Card><p className="eyebrow">ORIGEM DA LEITURA</p><h2 className="ape-section-title">GA4 e Tracking 360</h2><div className="cc-source-pills"><span>GA4 · {data?.ga4_configurado ? "configurado" : "indisponível"}</span><span>Tracking 360 · conectado</span></div><p style={{ color: "var(--fg-3)", fontSize: 12, lineHeight: 1.6 }}>Quando o GA4 não autoriza a leitura, o painel preserva a estrutura e identifica claramente a fonte indisponível. Eventos próprios continuam aparecendo sem virar zero falso.</p></Card></div><Card><div className="ape-toolbar"><h2 className="ape-section-title">Páginas e imóveis mais acessados</h2><span className="spacer" /><div className="ape-search"><input className="ape-input" placeholder="Buscar página ou imóvel" /></div><button className="ape-chip" type="button">Ordenar por visualizações</button><button className="ape-btn ape-btn--secondary" type="button">Exportar CSV</button></div>{topPages.length ? <div className="cc-tablewrap"><table className="ape-table"><thead><tr><th>Página / imóvel</th><th>Visualizações</th><th>Sessões</th><th>WhatsApp</th><th>Formulários</th><th>Leads</th><th>Conversão</th></tr></thead><tbody>{topPages.map((row, index) => <tr key={String(row.path ?? index)}><td><strong>{String(row.title ?? row.path ?? "Página")}</strong><small>{String(row.path ?? "")}</small></td><td>{integer(row.views)}</td><td>{integer(row.sessions)}</td><td>{integer(row.whatsapp_clicks)}</td><td>{integer(row.form_starts)}</td><td>{integer(row.leads)}</td><td>{n(row.views) ? percent(n(row.leads) / n(row.views) * 100) : "—"}</td></tr>)}</tbody></table></div> : <Empty title="Sem páginas no período" detail="O Tracking 360 não devolveu páginas para esta janela." />}</Card></div>;

  const pageFinance = <div><div className="cc-kpigrid"><Kpi label="Vendas" value={integer(finance.vendas)} change={delta(finance.vendas, finance.vendas_anterior)} tone="purple" /><Kpi label="VGV" value={brl(finance.vgv, true)} change={delta(finance.vgv, finance.vgv_anterior)} tone="purple" /><Kpi label="Comissão prevista" value={brl(finance.comissao_prevista, true)} change={delta(finance.comissao_prevista, finance.comissao_prevista_anterior)} tone="orange" /><Kpi label="Comissão recebida" value={brl(finance.comissao_recebida, true)} tone="success" /><Kpi label="Investimento em mídia" value={mediaAvailable ? brl(spend) : "Indisponível"} /><Kpi label="CAC por venda" value={mediaAvailable && n(finance.vendas) ? brl(spend / n(finance.vendas)) : "Indisponível"} /></div><div className="cc-2col"><Card><p className="eyebrow">RECEITA</p><h2 className="ape-section-title">Vendido, previsto e recebido</h2><Bar label="VGV" value={n(finance.vgv)} max={Math.max(1, n(finance.vgv))} purple /><Bar label="Comissão prevista" value={n(finance.comissao_prevista)} max={Math.max(1, n(finance.vgv))} /><Bar label="Comissão recebida" value={n(finance.comissao_recebida)} max={Math.max(1, n(finance.comissao_prevista))} purple /></Card><Card><p className="eyebrow">EFICIÊNCIA</p><h2 className="ape-section-title">Custo de aquisição e retorno</h2><Bar label="Comissão recebida" value={n(finance.comissao_recebida)} max={Math.max(1, n(finance.comissao_prevista))} purple /><Bar label="Investimento em mídia" value={spend} max={Math.max(1, n(finance.comissao_prevista))} /><Bar label="Vendas" value={n(finance.vendas)} max={Math.max(1, n(summary.leads_validos))} purple /></Card></div><Card><div className="ape-toolbar"><h2 className="ape-section-title">Leitura executiva do período</h2><span className="spacer" /><button className="ape-chip" type="button">Comparar período anterior</button><button className="ape-btn ape-btn--secondary" type="button">Exportar financeiro</button></div><div className="cc-3col"><Kpi label="Conversão lead → venda" value={n(summary.leads_validos) ? percent(n(finance.vendas) / n(summary.leads_validos) * 100) : "Sem base"} context={`${integer(finance.vendas)} vendas`} /><Kpi label="Recebido do previsto" value={n(finance.comissao_prevista) ? percent(n(finance.comissao_recebida) / n(finance.comissao_prevista) * 100) : "Sem base"} context="comissão" tone="success" /><Kpi label="ROAS de comissão" value={mediaAvailable && spend ? `${decimal(n(finance.comissao_prevista) / spend)}x` : "Indisponível"} context="comissão ÷ mídia" tone="purple" /></div></Card></div>;

  const content: Record<Page, ReactNode> = { ceo: pageCeo, marketing: pageMarketing, tracking: pageTracking, crm: pageCrm, equipe: pageTeam, site: pageSite, financeiro: pageFinance };

  return <section className="cc-prototype">
    <nav className="ape-nav cc-nav" aria-label="Navegação principal"><div className="ape-nav-logo"><Image src="/brand/logo-cores.png" alt="apêcerto" width={132} height={28} priority /></div><div className="ape-nav-group cc-navlabel">CENTRAL DE COMANDO</div>{allowed.map(([key, label, icon]) => <button className={`ape-nav-item cc-tip${page === key ? " is-active" : ""}`} data-tip={label} aria-current={page === key ? "page" : undefined} type="button" key={key} onClick={() => setPage(key)}><span className="ape-nav-icon">{icon}</span><span className="cc-navlabel">{partner && key === "ceo" ? "Resumo da operação" : label}</span>{key === "ceo" && alerts.length > 0 && <span className="ape-count">{alerts.length}</span>}</button>)}{!partner && <><div className="ape-divider" /><div className="ape-nav-group cc-navlabel">OPERAÇÃO</div><a className="ape-nav-item cc-tip" data-tip="Meu dia" href="/crm"><span className="ape-nav-icon">□</span><span className="cc-navlabel">Meu dia</span><span className="ape-count">{integer(summary.acoes_vencidas)}</span></a></>}<div className="spacer" /><label className="cc-navmeta ape-toolbar"><span className="ape-avatar ape-avatar--orange">{profile === "socio" ? "SÓ" : "CE"}</span><span className="cc-usermeta"><strong>Samuel</strong><select className="ape-input" value={profile} aria-label="Perfil da Central de Comando" onChange={event => { const next = event.target.value as Profile; setProfile(next); setPage(next === "socio" || next === "comercial" ? "ceo" : next === "trafego" ? "marketing" : "ceo"); setPartnerDetails(false); }}><option value="ceo">CEO / admin</option><option value="socio">Sócio</option><option value="trafego">Gestor de tráfego</option><option value="comercial">Gestor comercial</option></select></span></label></nav>
    <div className="cc-prototype-stage">{header}<main className="cc-prototype-main cc-scroll"><div><div className="cc-restricted-prototype" role="note"><strong>Acesso restrito à gestão.</strong> Indicadores consolidados; mensagens e dados pessoais de clientes não são exibidos.</div>{content[page]}</div></main></div>
    {(error && data || notice) && <button type="button" className="ape-toast" onClick={() => { setError(""); setNotice(""); }}>{error || notice}</button>}
    {alertOpen && <div className="cc-drawer-layer" onClick={() => setAlertOpen(null)}><aside className="cc-drawer" role="dialog" aria-modal="true" aria-label={`Alerta: ${alertOpen.title}`} onClick={event => event.stopPropagation()}><header><div><p className="eyebrow">ALERTA EXECUTIVO</p><h2 className="ape-page-title">{alertOpen.title}</h2></div><button className="ape-btn ape-btn--ghost" type="button" onClick={() => setAlertOpen(null)}>×</button></header><section><div><strong>O que aconteceu</strong><p>{alertOpen.what}</p></div><div><strong>Impacto</strong><p>{alertOpen.impact}</p></div><div><strong>O que precisa ser feito</strong><p>{alertOpen.next}</p></div><label>Quem está cuidando<select className="ape-input" value={owner} onChange={e => setOwner(e.target.value)}><option value="">Escolha o responsável</option><option>Samuel</option><option>Gestor comercial</option><option>Gestor de tráfego</option><option>Equipe de corretores</option><option>TI / integrações</option></select></label><label>Prazo<input className="ape-input" type="date" value={deadline} onChange={e => setDeadline(e.target.value)} /></label></section><footer><button className="ape-btn ape-btn--secondary" type="button" disabled={saving} onClick={() => void saveAlert("seen")}>Marcar como visto</button><button className="ape-btn" type="button" disabled={!owner || saving} onClick={() => void saveAlert("assign")}>{saving ? "Salvando…" : "Salvar responsável"}</button></footer></aside></div>}
  </section>;
}
