"use client";
/* eslint-disable @next/next/no-img-element */

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { getBrowserSupabaseClient } from "../../lib/supabase/browser";
import {
  STUDIO_TIMEZONE,
  type StudioCampaign,
  type StudioData,
  type StudioFormat,
  type StudioPiece,
  type StudioPieceVersion,
  type StudioTab,
} from "./domain";

type ApiResult = { ok?: boolean; error?: string; code?: string; result?: { campaign_id?: string }; details?: unknown; authorization_url?: string };
type IconName = "sparkles" | "grid" | "campaign" | "calendar" | "settings" | "plus" | "home" | "image" | "layers" | "video" | "check" | "clock" | "send" | "refresh" | "warning" | "chevron" | "close" | "upload";

function Icon({ name, size = 18 }: { name: IconName; size?: number }) {
  const paths: Record<IconName, ReactNode> = {
    sparkles: <><path d="m12 3-1.3 5.2L6 10l4.7 1.8L12 17l1.3-5.2L18 10l-4.7-1.8Z"/><path d="m19 16-.6 2.4L16 19l2.4.6L19 22l.6-2.4L22 19l-2.4-.6Z"/></>,
    grid: <><rect x="3" y="3" width="7" height="7" rx="2"/><rect x="14" y="3" width="7" height="7" rx="2"/><rect x="3" y="14" width="7" height="7" rx="2"/><rect x="14" y="14" width="7" height="7" rx="2"/></>,
    campaign: <><path d="m3 11 18-8-8 18-2-7Z"/><path d="m11 14 10-11"/></>,
    calendar: <><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M7 3v4M17 3v4M3 10h18"/></>,
    settings: <><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1-2.8 2.8-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.6v.2h-4V21a1.7 1.7 0 0 0-1-1.6 1.7 1.7 0 0 0-1.9.3l-.1.1L4.2 17l.1-.1a1.7 1.7 0 0 0 .3-1.9A1.7 1.7 0 0 0 3 14H2.8v-4H3a1.7 1.7 0 0 0 1.6-1 1.7 1.7 0 0 0-.3-1.9L4.2 7 7 4.2l.1.1A1.7 1.7 0 0 0 9 4.6 1.7 1.7 0 0 0 10 3V2.8h4V3a1.7 1.7 0 0 0 1 1.6 1.7 1.7 0 0 0 1.9-.3l.1-.1L19.8 7l-.1.1a1.7 1.7 0 0 0-.3 1.9 1.7 1.7 0 0 0 1.6 1h.2v4H21a1.7 1.7 0 0 0-1.6 1Z"/></>,
    plus: <path d="M12 5v14M5 12h14"/>, home: <path d="m3 11 9-8 9 8v10h-6v-6H9v6H3Z"/>,
    image: <><rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="8.5" cy="9" r="1.5"/><path d="m21 15-5-5L5 20"/></>,
    layers: <><path d="m12 2 9 5-9 5-9-5Z"/><path d="m3 12 9 5 9-5M3 17l9 5 9-5"/></>,
    video: <><rect x="3" y="5" width="15" height="14" rx="2"/><path d="m18 10 4-2v8l-4-2Z"/></>,
    check: <path d="m5 12 4 4L19 6"/>, clock: <><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></>,
    send: <><path d="m22 2-7 20-4-9-9-4Z"/><path d="m22 2-11 11"/></>, refresh: <><path d="M20 11a8 8 0 1 0-2.3 5.7"/><path d="M20 4v7h-7"/></>,
    warning: <><path d="M10.3 3.7 2.2 18a2 2 0 0 0 1.8 3h16a2 2 0 0 0 1.8-3L13.7 3.7a2 2 0 0 0-3.4 0Z"/><path d="M12 9v4M12 17h.01"/></>,
    chevron: <path d="m9 18 6-6-6-6"/>, close: <path d="M6 6l12 12M18 6 6 18"/>, upload: <><path d="M12 16V4m0 0L7 9m5-5 5 5"/><path d="M4 15v5h16v-5"/></>,
  };
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name]}</svg>;
}

const FORMAT_META: Record<StudioFormat, { label: string; icon: IconName; ratio: string }> = {
  feed: { label: "Feed", icon: "image", ratio: "4 / 5" },
  carousel: { label: "Carrossel", icon: "layers", ratio: "4 / 5" },
  story: { label: "Stories", icon: "campaign", ratio: "9 / 16" },
  reel: { label: "Reel", icon: "video", ratio: "9 / 16" },
};
const statusLabel: Record<string, string> = {
  rascunho: "Rascunho", em_producao: "Em produção", em_revisao: "Em revisão", ajuste_solicitado: "Ajuste solicitado",
  aprovada: "Aprovada", agendada: "Agendada", em_envio: "Em envio", publicada: "Publicada", falhou: "Falhou",
  concluida: "Concluída", arquivada: "Arquivada", cancelada: "Cancelada", aguardando_configuracao: "Aguardando configuração",
};
const shortDate = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short", timeZone: STUDIO_TIMEZONE });
const fullDate = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "long", year: "numeric", timeZone: STUDIO_TIMEZONE });

async function authedFetch(token: string, body?: Record<string, unknown>) {
  const make = (fresh: string) => fetch("/api/studio", {
    method: body ? "POST" : "GET",
    headers: { Authorization: `Bearer ${fresh}`, ...(body ? { "Content-Type": "application/json" } : {}) },
    body: body ? JSON.stringify(body) : undefined,
    cache: "no-store",
  });
  let response = await make(token);
  if (response.status === 401) {
    const { data } = await getBrowserSupabaseClient().auth.refreshSession();
    if (data.session) response = await make(data.session.access_token);
  }
  return response;
}

export function StudioModule({ accessToken, initialData, mutationHandler }: {
  accessToken: string;
  initialData?: StudioData;
  mutationHandler?: (body: Record<string, unknown>) => Promise<ApiResult>;
}) {
  const [data, setData] = useState<StudioData | null>(initialData ?? null);
  const [tab, setTab] = useState<StudioTab>("visao");
  const [campaignId, setCampaignId] = useState<string | null>(null);
  const [pieceId, setPieceId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (initialData) {
      setData(initialData);
      setCampaignId((current) => current && initialData.campaigns.some((campaign) => campaign.id === current) ? current : initialData.campaigns[0]?.id ?? null);
      return;
    }
    const response = await authedFetch(accessToken);
    const result = await response.json() as StudioData & ApiResult;
    if (!response.ok) throw new Error(result.error || "Não foi possível carregar o Studio.");
    setData(result);
    setCampaignId((current) => current && result.campaigns.some((campaign) => campaign.id === current) ? current : result.campaigns[0]?.id ?? null);
  }, [accessToken, initialData]);

  useEffect(() => { const timer = window.setTimeout(() => void load().catch((reason) => setError(reason instanceof Error ? reason.message : "Falha ao carregar.")), 0); return () => window.clearTimeout(timer); }, [load]);
  useEffect(() => {
    const timer = window.setTimeout(() => {
      const params = new URLSearchParams(window.location.search);
      const requestedTab = params.get("tab") as StudioTab | null;
      if (requestedTab && ["visao", "campanhas", "workspace", "calendario", "configuracoes"].includes(requestedTab)) setTab(requestedTab);
      const requestedCampaign = params.get("campaign");
      if (requestedCampaign && data?.campaigns.some((item) => item.id === requestedCampaign)) setCampaignId(requestedCampaign);
      const requestedPiece = params.get("piece");
      if (requestedPiece && data?.pieces.some((item) => item.id === requestedPiece)) setPieceId(requestedPiece);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [data]);
  useEffect(() => {
    if (!data?.jobs.some((job) => ["pendente", "processando"].includes(job.status))) return;
    const timer = window.setInterval(() => void load().catch(() => undefined), 4_000);
    return () => window.clearInterval(timer);
  }, [data?.jobs, load]);

  const mutate = async (body: Record<string, unknown>, success?: string) => {
    setBusy(true); setError(null); setNotice(null);
    try {
      if (mutationHandler) {
        const result = await mutationHandler(body);
        if (success) setNotice(success);
        return result;
      }
      const response = await authedFetch(accessToken, body);
      const result = await response.json() as ApiResult;
      if (!response.ok) throw new Error(result.error || "Não foi possível concluir a ação.");
      if (success) setNotice(success);
      await load();
      return result;
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Falha ao salvar."); throw reason; }
    finally { setBusy(false); }
  };

  const campaign = data?.campaigns.find((item) => item.id === campaignId) ?? null;
  const pieces = data?.pieces.filter((item) => item.campaign_id === campaignId) ?? [];
  const piece = pieces.find((item) => item.id === pieceId) ?? pieces[0] ?? null;
  const version = piece?.current_version_id ? data?.versions.find((item) => item.id === piece.current_version_id) ?? null : null;
  const snapshot = campaign?.snapshot_atual_id ? data?.snapshots.find((item) => item.id === campaign.snapshot_atual_id) ?? null : null;

  if (!data && !error) return <StudioLoading />;
  if (!data) return <StudioFatal message={error ?? "Studio indisponível."} onRetry={() => { setError(null); void load().catch((reason) => setError(reason instanceof Error ? reason.message : "Falha ao carregar.")); }} />;

  return <div className="studio-shell">
    <header className="studio-head">
      <div><span className="studio-eyebrow">Marketing · Conteúdo</span><h1>apêcerto Studio</h1><p>Do código do imóvel ao conteúdo aprovado e programado, em um só fluxo.</p></div>
      <button className="studio-primary" type="button" onClick={() => setCreating(true)}><Icon name="plus"/> Nova campanha</button>
    </header>
    <nav className="studio-tabs" aria-label="Áreas do Studio">
      {([
        ["visao", "Visão geral", "home"], ["campanhas", "Campanhas", "campaign"], ["workspace", "Construtor", "grid"],
        ["calendario", "Calendário", "calendar"], ["configuracoes", "Configurações", "settings"],
      ] as Array<[StudioTab, string, IconName]>).map(([id, label, icon]) => <button key={id} type="button" aria-label={label} className={tab === id ? "active" : ""} onClick={() => { setTab(id); window.history.replaceState(null, "", `/studio?tab=${id}${campaignId ? `&campaign=${campaignId}` : ""}${pieceId ? `&piece=${pieceId}` : ""}`); }}><Icon name={icon}/><span>{label}</span></button>)}
    </nav>
    {error && <div className="studio-alert error" role="alert"><Icon name="warning"/><span>{error}</span><button type="button" onClick={() => setError(null)} aria-label="Fechar"><Icon name="close"/></button></div>}
    {notice && <div className="studio-alert success" role="status"><Icon name="check"/><span>{notice}</span><button type="button" onClick={() => setNotice(null)} aria-label="Fechar"><Icon name="close"/></button></div>}
    {tab === "visao" && <Overview data={data} onCreate={() => setCreating(true)} onOpen={(id) => { setCampaignId(id); setTab("workspace"); }} />}
    {tab === "campanhas" && <Campaigns data={data} selected={campaignId} onSelect={setCampaignId} onOpen={(id) => { setCampaignId(id); setTab("workspace"); }} onCreate={() => setCreating(true)} />}
    {tab === "workspace" && <Builder data={data} campaign={campaign} campaignId={campaignId} piece={piece} version={version} snapshot={snapshot} pieces={pieces} onCampaign={(id) => { setCampaignId(id); window.history.replaceState(null, "", `/studio?tab=workspace&campaign=${id}`); }} onPiece={(id) => { setPieceId(id); window.history.replaceState(null, "", `/studio?tab=workspace&campaign=${campaignId ?? ""}&piece=${id}`); }} busy={busy} mutate={mutate} />}
    {tab === "calendario" && <CalendarView data={data} busy={busy} mutate={mutate} />}
    {tab === "configuracoes" && <Settings data={data} busy={busy} mutate={mutate} />}
    {creating && <CampaignForm busy={busy} onClose={() => setCreating(false)} onSave={async (payload) => { const result = await mutate({ action: "createCampaign", ...payload }, "Campanha criada com snapshot factual e quatro formatos."); setCreating(false); const created = (result.result as { campaign_id?: string } | undefined)?.campaign_id; if (created) { setCampaignId(created); setTab("workspace"); } }} />}
  </div>;
}

function StudioLoading() {
  return <div className="studio-loading"><span/><strong>Preparando o Studio…</strong><small>Carregando campanhas, versões e agenda.</small></div>;
}

function StudioFatal({ message, onRetry }: { message: string; onRetry: () => void }) {
  return <div className="studio-fatal"><span><Icon name="warning" size={24}/></span><h1>O Studio ainda não pode abrir</h1><p>{message}</p><button type="button" onClick={onRetry}><Icon name="refresh"/> Tentar novamente</button></div>;
}

function Overview({ data, onCreate, onOpen }: { data: StudioData; onCreate: () => void; onOpen: (id: string) => void }) {
  const ready = data.pieces.filter((piece) => piece.status === "aprovada").length;
  const scheduled = data.schedules.filter((schedule) => schedule.status === "agendado").length;
  const failures = data.jobs.filter((job) => job.status === "falhou").length;
  return <main className="studio-content studio-overview">
    <section className="studio-hero">
      <div><span className="studio-eyebrow">Produção mensal</span><h2>Transforme produto real em um mês de conteúdo.</h2><p>Escolha o código. O Studio preserva os fatos, organiza as mídias e prepara Feed, Carrossel, Stories e Reel para revisão humana.</p><button className="studio-primary" type="button" onClick={onCreate}><Icon name="sparkles"/> Começar por um produto</button></div>
      <div className="studio-hero-flow" aria-label="Fluxo operacional"><FlowStep icon="campaign" label="Produto" done/><FlowStep icon="sparkles" label="Criação"/><FlowStep icon="check" label="Aprovação"/><FlowStep icon="calendar" label="Agenda"/><FlowStep icon="send" label="Publicação"/></div>
    </section>
    <section className="studio-kpis"><Kpi label="Campanhas" value={data.campaigns.length}/><Kpi label="Peças aprovadas" value={ready} tone="purple"/><Kpi label="Programadas" value={scheduled} tone="success"/><Kpi label="Falhas abertas" value={failures} tone={failures ? "danger" : undefined}/></section>
    <section className="studio-section studio-manager-board"><header><div><span className="studio-eyebrow">Visão do gestor</span><h2>Board operacional e métricas</h2><p>Filtros por campanha, formato e período; dados Meta aparecem somente quando houver conexão.</p></div></header><div className="studio-manager-grid"><article><strong>Gargalos</strong><span>{data.pieces.filter((item) => ["em_revisao", "rascunho"].includes(item.status)).length} peças aguardando revisão</span><span>{(data.tasks ?? []).filter((item) => item.status === "bloqueada").length} bloqueios registrados</span></article><article><strong>Métricas do período</strong>{(data.metrics ?? []).length ? <span>{(data.metrics ?? []).length} snapshots disponíveis</span> : <span className="studio-safe-note">Meta não conectada · sem métricas inventadas</span>}<span>Alcance, cliques e salvamentos por campanha/formato</span></article><article><strong>Filtros rápidos</strong><span>Campanha · formato · template · período</span><span>Calendário semanal, mensal ou lista no módulo Agenda</span></article></div></section>
    <section className="studio-section"><header><div><span className="studio-eyebrow">Em andamento</span><h2>Campanhas recentes</h2></div></header>
      {data.campaigns.length ? <div className="studio-campaign-grid">{data.campaigns.slice(0, 6).map((campaign) => <CampaignCard key={campaign.id} campaign={campaign} pieces={data.pieces.filter((piece) => piece.campaign_id === campaign.id)} onOpen={() => onOpen(campaign.id)}/>)}</div> : <EmptyState icon="campaign" title="Nenhuma campanha ainda" text="Crie a primeira usando o código de um produto do ERP." action="Criar campanha" onAction={onCreate}/>}</section>
  </main>;
}

function FlowStep({ icon, label, done }: { icon: IconName; label: string; done?: boolean }) { return <div className={done ? "done" : ""}><span><Icon name={icon}/></span><small>{label}</small></div>; }
function Kpi({ label, value, tone }: { label: string; value: number; tone?: string }) { return <article className={`studio-kpi ${tone ?? ""}`}><span>{label}</span><strong>{value}</strong></article>; }

function CampaignCard({ campaign, pieces, onOpen }: { campaign: StudioCampaign; pieces: StudioPiece[]; onOpen: () => void }) {
  const finished = pieces.filter((piece) => ["aprovada", "agendada", "publicada"].includes(piece.status)).length;
  return <button type="button" className="studio-campaign-card" onClick={onOpen}><header><span className={`studio-status ${campaign.status}`}>{statusLabel[campaign.status] ?? campaign.status}</span><small>{campaign.produto_codigo ?? "Materiais próprios"}</small></header><h3>{campaign.nome}</h3><p>{campaign.objetivo}</p><div className="studio-progress"><span style={{ width: `${pieces.length ? finished / pieces.length * 100 : 0}%` }}/></div><footer><span>{finished}/{pieces.length} formatos prontos</span><b><Icon name="chevron"/></b></footer></button>;
}

function Campaigns({ data, selected, onSelect, onOpen, onCreate }: { data: StudioData; selected: string | null; onSelect: (id: string) => void; onOpen: (id: string) => void; onCreate: () => void }) {
  return <main className="studio-content"><section className="studio-section"><header><div><span className="studio-eyebrow">Biblioteca</span><h2>Todas as campanhas</h2><p>Histórico completo, sem apagar peças anteriores.</p></div><button className="studio-secondary" type="button" onClick={onCreate}><Icon name="plus"/> Nova campanha</button></header>
    {data.campaigns.length ? <div className="studio-campaign-table">{data.campaigns.map((campaign) => <button type="button" className={campaign.id === selected ? "selected" : ""} key={campaign.id} onClick={() => onSelect(campaign.id)} onDoubleClick={() => onOpen(campaign.id)}><span className="studio-campaign-symbol"><Icon name="campaign"/></span><span><strong>{campaign.nome}</strong><small>{campaign.produto_codigo} · {fullDate.format(new Date(`${campaign.periodo_inicio}T12:00:00Z`))}</small></span><span className={`studio-status ${campaign.status}`}>{statusLabel[campaign.status] ?? campaign.status}</span><span>{shortDate.format(new Date(`${campaign.periodo_inicio}T12:00:00Z`))} — {shortDate.format(new Date(`${campaign.periodo_fim}T12:00:00Z`))}</span><b onClick={(event) => { event.stopPropagation(); onOpen(campaign.id); }}><Icon name="chevron"/></b></button>)}</div> : <EmptyState icon="campaign" title="Sua biblioteca está vazia" text="Uma campanha começa pelo código real do produto." action="Criar campanha" onAction={onCreate}/>}</section></main>;
}

function Builder({ data, campaign, campaignId, piece, version, snapshot, pieces, onCampaign, onPiece, busy, mutate }: {
  data: StudioData; campaign: StudioCampaign | null; campaignId: string | null; piece: StudioPiece | null; version: StudioPieceVersion | null;
  snapshot: StudioData["snapshots"][number] | null; pieces: StudioPiece[]; onCampaign: (id: string) => void; onPiece: (id: string) => void; busy: boolean;
  mutate: (body: Record<string, unknown>, success?: string) => Promise<ApiResult>;
}) {
  const [scheduledAt, setScheduledAt] = useState("");
  const [comment, setComment] = useState("");
  const [sandboxGenerated, setSandboxGenerated] = useState(false);
  const [command, setCommand] = useState("");
  const [variant, setVariant] = useState(0);
  const [template, setTemplate] = useState("Editorial premium");
  const [mediaIndex, setMediaIndex] = useState(0);
  const [compareVersionId, setCompareVersionId] = useState<string | null>(null);
  const renderJob = piece ? data.jobs.find((job) => job.piece_id === piece.id && job.tipo === "render") : null;
  const renderActive = Boolean(renderJob && ["pendente", "processando"].includes(renderJob.status));
  if (!campaignId || !campaign) return <main className="studio-content"><EmptyState icon="grid" title="Escolha uma campanha" text="O construtor mostra as peças e versões de uma campanha."/></main>;
  const demo = piece ? demoContent(piece.formato, snapshot, variant) : null;
  const brief = data.briefs.find((item) => item.campaign_id === campaign.id) ?? null;
  const realGenerationBlocked = data.integrations.find((item) => item.provider === "openai")?.status !== "configurada" || Number(data.budgets.find((item) => item.provider === "openai")?.limite_usd ?? 0) <= 0;
  const applyCommand = () => { if (!command.trim()) return; const next = demoContent(piece?.formato ?? "feed", snapshot, variant + 1); setVariant((current) => current + 1); setSandboxGenerated(true); if (piece) void mutate({ action: "createVariant", pieceId: piece.id, conteudo: next, changeScope: piece.formato === "carousel" ? "cena" : piece.formato === "reel" ? "cena" : "copy" }, "Variação persistida no histórico da peça.").catch(() => undefined); setCommand(""); };
  return <main className="studio-builder">
    <aside className="studio-builder-left">
      <label className="studio-field"><span>Campanha</span><select value={campaignId} onChange={(event) => onCampaign(event.target.value)}>{data.campaigns.map((item) => <option value={item.id} key={item.id}>{item.nome}</option>)}</select></label>
      <div className="studio-product-summary"><span className="studio-product-cover"><Icon name="home" size={22}/></span><div><small>{snapshot?.produto_codigo ?? campaign.produto_codigo}</small><strong>{String(snapshot?.fatos.nome ?? "Produto do ERP")}</strong><p>{String(snapshot?.fatos.bairro ?? "Localização não informada")}</p></div></div>
      <div className="studio-builder-label">Formatos <small>{pieces.filter((item) => item.current_version_id).length}/{pieces.length} gerados</small></div>
      <div className="studio-piece-list">{pieces.map((item) => <button type="button" key={item.id} className={item.id === piece?.id ? "active" : ""} onClick={() => onPiece(item.id)}><span><Icon name={FORMAT_META[item.formato].icon}/></span><div><strong>{FORMAT_META[item.formato].label}</strong><small>{statusLabel[item.status] ?? item.status}</small></div>{item.current_version_id && <b><Icon name="check"/></b>}</button>)}</div>
      <TemplateLibrary templates={data.templates.filter((item) => item.formato === piece?.formato)} selected={template} onSelect={setTemplate}/>
      <button className="studio-generate" type="button" disabled={busy} onClick={() => { if (realGenerationBlocked) { setSandboxGenerated(true); return; } void mutate({ action: "generatePackage", campaignId }, "Pacote gerado e enviado para revisão."); }}><Icon name="sparkles"/>{busy ? "Gerando…" : realGenerationBlocked ? "Gerar demonstração sem custo" : version ? "Regenerar pacote" : "Gerar pacote com IA"}</button>
      <p className="studio-safe-note">{realGenerationBlocked ? "Sandbox ativo: conteúdo determinístico, sem chamada paga e sem publicação." : "IA governada ativa · orçamento aprovado."}</p>
      <div className="studio-generator-catalog"><strong>Geradores</strong><span>Feed · 5 modelos</span><span>Carrossel · 5, 7 ou 10 páginas</span><span>Stories · 3 a 7 telas</span><span>Reel · roteiro e cenas</span></div>
    </aside>
    <section className="studio-canvas-area">
      <header><div><span className="studio-eyebrow">Construtor</span><h2>{piece?.titulo ?? "Selecione uma peça"}</h2></div>{piece && <span className={`studio-status ${piece.status}`}>{statusLabel[piece.status] ?? piece.status}</span>}</header>
      {campaign.produto_alterado_em && <div className="studio-product-changed" role="alert"><Icon name="warning"/><div><strong>O produto mudou no ERP</strong><span>Atualize o snapshot antes de aprovar ou programar. As aprovações atuais estão bloqueadas.</span></div><button type="button" disabled={busy} onClick={() => void mutate({ action: "refreshSnapshot", campaignId }, "Novo snapshot factual criado. Regenere apenas as peças afetadas.")}><Icon name="refresh"/> Atualizar snapshot</button></div>}
      <div className="studio-brief-strip"><span><strong>Estratégia</strong> {String(snapshot?.fatos.bairro ?? "bairro")}, foco em visita qualificada</span><span><strong>Pilares</strong> localização · diferenciais · estilo de vida</span><span><strong>Status</strong> {sandboxGenerated ? "Demonstração pronta para revisão" : "Aguardando geração"}</span></div>
      <BriefingEditor campaignId={campaign.id} brief={brief} busy={busy} mutate={mutate}/>
      {piece ? <div className={`studio-canvas-frame ${piece.formato}`}><PiecePreview piece={piece} version={version} snapshot={snapshot} mediaIndex={mediaIndex} demoContent={sandboxGenerated ? demo : null}/><AssetStrip snapshot={snapshot} selected={mediaIndex} onSelect={setMediaIndex} onPersist={version ? () => void mutate({ action: "createVariant", pieceId: piece.id, conteudo: { ...version.conteudo, media_index: mediaIndex }, changeScope: "midia" }, "Mídia do ERP salva como nova versão.") : undefined}/></div> : <EmptyState icon="grid" title="Nenhuma peça" text="Esta campanha ainda não tem formatos."/>}
      <div className="studio-ai-command"><div><strong>StudioCopilot contextual</strong><small>Campanha · {piece?.titulo ?? "peça"} · snapshot factual protegido · preview antes de persistir.</small></div><textarea value={command} onChange={(event) => setCommand(event.target.value)} placeholder="Ex.: revise a headline do slide 2 para famílias, sem alterar preço ou metragem"/><div className="studio-command-actions"><button type="button" className="studio-secondary" onClick={() => { setCommand("Crie uma versão mais premium sem alterar os fatos"); setSandboxGenerated(true); setVariant((current) => current + 1); }}>Mais premium</button><button type="button" className="studio-secondary" onClick={() => { setCommand("Transforme em conteúdo educativo"); setSandboxGenerated(true); setVariant((current) => current + 1); }}>Educativo</button><button type="button" className="studio-primary" disabled={!command.trim()} onClick={applyCommand}><Icon name="sparkles"/> Gerar variação · preview/diff</button></div>{sandboxGenerated && <small className="studio-safe-note">SANDBOX determinístico: a alteração só entra no histórico ao salvar. Números do ERP permanecem bloqueados.</small>}</div>
      {piece && version && snapshot && <div className="studio-render-actions">
        <button type="button" className="studio-primary" disabled={busy || renderActive || !snapshot.midias.length} onClick={() => void mutate(
          { action: "enqueueRender", versionId: version.id },
          piece.formato === "reel" ? "Reel MP4 enviado ao renderer seguro." : "Arquivos JPEG enviados ao renderer seguro.",
        )}><Icon name={piece.formato === "reel" ? "video" : "image"}/>{renderActive ? "Renderizando no servidor…" : piece.formato === "reel" ? "Gerar Reel MP4 final" : "Gerar JPEG finais"}</button>
        {renderJob?.status === "falhou" && <div className="studio-inline-status error" role="alert"><Icon name="warning"/><span>{renderJob.erro_mensagem ?? "O renderer falhou. Use a tentativa novamente após corrigir a causa."}</span></div>}
        {renderJob?.status === "aguardando_configuracao" && <div className="studio-inline-status"><Icon name="warning"/><span>O job está preservado, mas o worker de renderização ainda não foi ativado neste ambiente.</span></div>}
        <FinalFiles version={version}/>
      </div>}
      <footer className="studio-canvas-footer"><span><Icon name="clock"/> Snapshot v{snapshot?.versao ?? 0} · {snapshot?.checksum.slice(0, 8) ?? "sem hash"}</span><span>{version ? `Versão ${version.versao} · ${version.checksum.slice(0, 8)}` : "Ainda sem versão gerada"}</span></footer>
    </section>
    <aside className="studio-inspector">
      <div className="studio-inspector-head"><div><span className="studio-eyebrow">Revisão</span><h3>Conteúdo da peça</h3></div></div>
      {sandboxGenerated ? <DemoInspector piece={piece} demo={demo} variant={variant} onVariant={() => setVariant((current) => current + 1)} mutate={mutate} /> : version ? <>
        <VersionEditor key={version.id} version={version} busy={busy} mutate={mutate}/>
        <VersionHistory versions={data.versions.filter((item) => item.piece_id === piece.id)} current={version} compareVersionId={compareVersionId} onCompare={setCompareVersionId} busy={busy} mutate={mutate}/>
        <CollaborationPanel piece={piece} version={version} tasks={data.tasks ?? []} comments={data.comments ?? []} busy={busy} mutate={mutate}/>
        <label className="studio-field"><span>Comentário da revisão</span><textarea value={comment} onChange={(event) => setComment(event.target.value)} placeholder="Explique o ajuste ou registre a decisão."/></label>
        <div className="studio-review-actions"><button type="button" className="studio-secondary" disabled={busy} onClick={() => void mutate({ action: "requestChanges", versionId: version.id, comment }, "Ajuste solicitado sem perder a versão anterior.")}><Icon name="refresh"/> Solicitar ajuste</button><button type="button" className="studio-primary" disabled={busy} onClick={() => void mutate({ action: "approve", versionId: version.id, comment }, "Versão aprovada com checksum registrado.")}><Icon name="check"/> Aprovar versão</button></div>
        <button type="button" className="studio-bulk-approve" disabled={busy || pieces.some((item) => !item.current_version_id)} onClick={() => void mutate({ action: "bulkApprove", versionIds: pieces.map((item) => item.current_version_id).filter(Boolean), comment: "Pacote mensal aprovado em lote no Studio." }, "Todas as versões atuais do pacote foram aprovadas.")}><Icon name="check"/> Aprovar pacote completo</button>
        <div className="studio-schedule-box"><h4>Programar</h4><p>Horário interpretado em {STUDIO_TIMEZONE}.</p><input type="datetime-local" value={scheduledAt} onChange={(event) => setScheduledAt(event.target.value)}/><button type="button" disabled={busy || !scheduledAt} onClick={() => void mutate({ action: "schedule", versionId: version.id, scheduledAt, idempotencyKey: `ui|${version.id}|${scheduledAt}` }, "Peça adicionada ao calendário.")}><Icon name="calendar"/> Programar publicação</button></div>
      </> : <EmptyState icon="sparkles" title="Aguardando geração" text={realGenerationBlocked ? "A IA paga está bloqueada. Use a demonstração sem custo para validar o fluxo." : "Gere o pacote para abrir os campos, versões e aprovação."} action="Gerar demonstração" onAction={() => setSandboxGenerated(true)}/>}
    </aside>
  </main>;
}

function FinalFiles({ version }: { version: StudioPieceVersion }) {
  const files = Array.isArray(version.output_manifest?.files) ? version.output_manifest.files.filter((item) => item && typeof item === "object") as Array<Record<string, unknown>> : [];
  if (!files.length) return <small className="studio-no-final">Ainda não há arquivo final para esta versão.</small>;
  return <div className="studio-final-files"><strong>Arquivos finais</strong>{files.map((file, index) => <button type="button" key={String(file.checksum ?? index)} onClick={() => {
    const path = typeof file.storage_path === "string" ? file.storage_path : "";
    if (!path) return;
    void getBrowserSupabaseClient().storage.from("social-studio").createSignedUrl(path, 60).then(({ data, error }) => {
      if (error || !data.signedUrl) throw error ?? new Error("Arquivo indisponível.");
      window.open(data.signedUrl, "_blank", "noopener,noreferrer");
    }).catch(() => window.alert("Não foi possível abrir o arquivo final."));
  }}><Icon name={file.mime_type === "video/mp4" ? "video" : "image"}/> {String(file.role ?? "arquivo")} {Number(file.index ?? index) + 1} · {String(file.width ?? "—")}×{String(file.height ?? "—")}</button>)}</div>;
}

function publicMediaUrl(path: unknown) {
  if (typeof path !== "string" || !process.env.NEXT_PUBLIC_SUPABASE_URL) return null;
  return `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/empreendimentos/${path.split("/").map(encodeURIComponent).join("/")}`;
}

function demoContent(format: StudioFormat, snapshot: StudioData["snapshots"][number] | null, variant: number) {
  const nome = String(snapshot?.fatos.nome ?? "Seu próximo imóvel");
  const bairro = String(snapshot?.fatos.bairro ?? "São Paulo");
  const suffix = variant ? ` · opção ${variant + 1}` : "";
  const base = { headline: format === "carousel" ? `Por que escolher ${nome}${suffix}` : format === "reel" ? `${nome} em 30 segundos${suffix}` : format === "story" ? `Conheça ${nome}${suffix}` : `${nome}: espaço para viver bem${suffix}`, cta: "Agende sua visita", legenda: `${nome}, em ${bairro}. Conteúdo demonstrativo sem custo, baseado no snapshot factual do ERP.` };
  return format === "carousel" ? { ...base, slides: ["Capa: o imóvel em um olhar", "Localização que facilita sua rotina", "Ambientes pensados para viver", "Diferenciais que fazem diferença", "Agende sua visita"] } : format === "story" ? { ...base, stories: ["Tour rápido", "Diferenciais", "Enquete: quer conhecer?", "Chame no direct"] } : format === "reel" ? { ...base, cenas: ["Gancho · 0–3s", "Tour · 3–18s", "Diferencial · 18–26s", "CTA · 26–30s"] } : base;
}

function TemplateLibrary({ templates, selected, onSelect }: { templates: StudioData["templates"]; selected: string; onSelect: (value: string) => void }) {
  return <section className="studio-template-library"><div className="studio-builder-label">Biblioteca visual <small>{templates.length} templates publicados · 5 modelos editoriais por formato</small></div>{templates.length ? <div className="studio-template-grid">{templates.map((item) => <button type="button" key={item.id} className={selected === item.nome ? "selected" : ""} onClick={() => onSelect(item.nome)}><span className="studio-template-thumb" aria-hidden="true"><i/><b/><em/></span><strong>{item.nome.replace(/^.*· /, "")}</strong><small>v{item.versao_publicada ?? 1} · {item.origem === "figma" ? "Figma" : "Design System"}</small></button>)}</div> : <div className="studio-template-empty">Nenhum template publicado para este formato. Importe um manifesto na área Configurações.</div>}</section>;
}

function BriefingEditor({ campaignId, brief, busy, mutate }: { campaignId: string; brief: StudioData["briefs"][number] | null; busy: boolean; mutate: (body: Record<string, unknown>, success?: string) => Promise<ApiResult> }) {
  const [audience, setAudience] = useState(String(brief?.publico?.segmento ?? "Compradores de imóveis"));
  const [tone, setTone] = useState(brief?.tom ?? "Jovial, direto, otimista e confiável");
  const [angle, setAngle] = useState(String(brief?.conteudo?.angulo_editorial ?? "Vida urbana com praticidade"));
  const [pillars, setPillars] = useState(String(Array.isArray(brief?.conteudo?.pilares) ? brief?.conteudo?.pilares.join(" · ") : "localização · diferenciais · estilo de vida"));
  return <details className="studio-brief-editor"><summary><strong>Briefing e estratégia</strong><span>{brief ? `versão ${brief.versao}` : "não salvo"}</span></summary><div className="studio-brief-form"><label className="studio-field"><span>Público</span><input value={audience} onChange={(event) => setAudience(event.target.value)}/></label><label className="studio-field"><span>Tom de voz</span><input value={tone} onChange={(event) => setTone(event.target.value)}/></label><label className="studio-field"><span>Ângulo editorial</span><input value={angle} onChange={(event) => setAngle(event.target.value)}/></label><label className="studio-field"><span>Pilares</span><input value={pillars} onChange={(event) => setPillars(event.target.value)}/></label><button type="button" className="studio-primary" disabled={busy} onClick={() => void mutate({ action: "saveBrief", campaignId, publico: { segmento: audience }, tom: tone, canais: ["instagram"], restricoesFactuais: [], conteudo: { angulo_editorial: angle, pilares: pillars.split("·").map((item) => item.trim()).filter(Boolean) } }, "Briefing e estratégia salvos como nova versão.")}><Icon name="check"/> Salvar briefing</button></div></details>;
}

function DemoInspector({ piece, demo, variant, onVariant, mutate }: { piece: StudioPiece | null; demo: Record<string, unknown> | null; variant: number; onVariant: () => void; mutate: (body: Record<string, unknown>, success?: string) => Promise<ApiResult> }) {
  if (!piece || !demo) return null;
  const rows = Array.isArray(demo.slides) ? demo.slides : Array.isArray(demo.stories) ? demo.stories : Array.isArray(demo.cenas) ? demo.cenas : [];
  return <div className="studio-demo-inspector"><div className="studio-demo-badge">SANDBOX · SEM CUSTO · NÃO PUBLICÁVEL</div><label className="studio-field"><span>Headline</span><textarea value={String(demo.headline)} readOnly/></label><label className="studio-field"><span>Legenda</span><textarea value={String(demo.legenda)} readOnly/></label><label className="studio-field"><span>CTA</span><input value={String(demo.cta)} readOnly/></label><div className="studio-variant-list"><strong>Variação {variant + 1}</strong>{rows.map((row, index) => <span key={`${String(row)}-${index}`}>{String(row)}</span>)}</div><div className="studio-command-actions"><button type="button" className="studio-secondary" onClick={onVariant}><Icon name="refresh"/> Gerar outra variação</button><button type="button" className="studio-primary" onClick={() => void mutate({ action: "createVariant", pieceId: piece.id, conteudo: demo, changeScope: piece.formato === "carousel" || piece.formato === "reel" ? "cena" : "copy" }, "Variação persistida no histórico da peça.")}><Icon name="check"/> Salvar no histórico</button></div><small>Sandbox sem custo. A versão persistida permanece em revisão e não é publicada automaticamente.</small></div>;
}

function AssetStrip({ snapshot, selected, onSelect, onPersist }: { snapshot: StudioData["snapshots"][number] | null; selected: number; onSelect: (index: number) => void; onPersist?: () => void }) {
  const media = snapshot?.midias ?? [];
  if (!media.length) return null;
  return <div className="studio-asset-strip"><strong>Mídias do ERP</strong>{media.slice(0, 12).map((item, index) => <button type="button" key={`${String(item.storage_path)}-${index}`} className={selected === index ? "selected" : ""} onClick={() => onSelect(index)}><img src={publicMediaUrl(item.storage_path) ?? ""} alt={`Mídia ${index + 1}`} /><span>{index + 1}</span></button>)}{onPersist && <button type="button" className="studio-secondary studio-asset-save" onClick={onPersist}>Salvar mídia nesta versão</button>}</div>;
}

function PiecePreview({ piece, version, snapshot, mediaIndex = 0, demoContent }: { piece: StudioPiece; version: StudioPieceVersion | null; snapshot: StudioData["snapshots"][number] | null; mediaIndex?: number; demoContent?: Record<string, unknown> | null }) {
  const content = version?.conteudo ?? demoContent ?? {};
  const media = snapshot?.midias[mediaIndex] ?? snapshot?.midias.find((item) => item.is_capa === true) ?? snapshot?.midias[0];
  const url = publicMediaUrl(media?.storage_path);
  return <article className={`studio-piece-preview ${piece.formato}`} style={{ aspectRatio: FORMAT_META[piece.formato].ratio }}>
    {url ? <img src={url} alt="Foto do imóvel usada na peça"/> : <div className="studio-preview-empty"><Icon name={piece.formato === "reel" ? "video" : "image"} size={28}/><span>Produto sem prévia de mídia</span></div>}
    <div className="studio-preview-shade"/>
    <img className="studio-preview-logo" src="/brand/logo-apecerto-branco.png" alt="apêcerto"/>
    <div className="studio-preview-copy"><span>{String(snapshot?.fatos.bairro ?? "apê pronto pra morar")}</span><h3>{String(content.headline ?? (version ? piece.titulo : "Sua próxima campanha começa aqui"))}</h3><p>{String(content.cta ?? "Agende sua visita")}</p></div>
    <span className="studio-preview-version">{version ? `v${version.versao}` : "rascunho"}</span>
  </article>;
}

function VersionEditor({ version, busy, mutate }: { version: StudioPieceVersion; busy: boolean; mutate: (body: Record<string, unknown>, success?: string) => Promise<ApiResult> }) {
  const initialStructure = JSON.stringify({ ...(Array.isArray(version.conteudo.slides) ? { slides: version.conteudo.slides } : {}), ...(Array.isArray(version.conteudo.stories) ? { stories: version.conteudo.stories } : {}), ...(Array.isArray(version.conteudo.cenas) ? { cenas: version.conteudo.cenas } : {}) }, null, 2);
  const [fields, setFields] = useState({
    headline: String(version.conteudo.headline ?? ""),
    legenda: String(version.conteudo.legenda ?? ""),
    cta: String(version.conteudo.cta ?? ""),
    estrutura: initialStructure,
  });
  const changed = fields.headline !== String(version.conteudo.headline ?? "") || fields.legenda !== String(version.conteudo.legenda ?? "") || fields.cta !== String(version.conteudo.cta ?? "") || fields.estrutura !== initialStructure;
  return <div className="studio-version-editor">
    <label className="studio-field"><span>Headline</span><textarea value={fields.headline} maxLength={120} onChange={(event) => setFields({ ...fields, headline: event.target.value })}/><small>{fields.headline.length}/120</small></label>
    <label className="studio-field"><span>Legenda</span><textarea value={fields.legenda} maxLength={2200} onChange={(event) => setFields({ ...fields, legenda: event.target.value })}/><small>{fields.legenda.length}/2200</small></label>
    <label className="studio-field"><span>Chamada</span><input value={fields.cta} maxLength={80} onChange={(event) => setFields({ ...fields, cta: event.target.value })}/><small>{fields.cta.length}/80</small></label>
    <label className="studio-field"><span>Slides / cenas (JSON editável)</span><textarea value={fields.estrutura} onChange={(event) => setFields({ ...fields, estrutura: event.target.value })}/><small>Edite slides, stories ou cenas sem perder a versão anterior.</small></label>
    <button type="button" className="studio-save-version" disabled={busy || !changed || !fields.headline.trim() || !fields.legenda.trim() || !fields.cta.trim()} onClick={() => { let estrutura: Record<string, unknown> = {}; try { estrutura = JSON.parse(fields.estrutura) as Record<string, unknown>; } catch { window.alert("Estrutura inválida. Use JSON válido."); return; } void mutate({ action: "createVersion", versionId: version.id, fields: { ...fields, estrutura } }, "Nova versão criada. A aprovação anterior não vale para este conteúdo."); }}><Icon name="check"/> Salvar como nova versão</button>
  </div>;
}

function VersionHistory({ versions, current, compareVersionId, onCompare, busy, mutate }: { versions: StudioPieceVersion[]; current: StudioPieceVersion; compareVersionId: string | null; onCompare: (id: string | null) => void; busy: boolean; mutate: (body: Record<string, unknown>, success?: string) => Promise<ApiResult> }) {
  const compare = versions.find((item) => item.id === compareVersionId) ?? null;
  const ordered = [...versions].sort((a, b) => b.versao - a.versao);
  return <section className="studio-version-history"><div className="studio-builder-label">Histórico visual <small>{versions.length} versões persistidas · desfazer cria uma nova versão</small></div><div className="studio-history-list">{ordered.slice(0, 8).map((item) => <article key={item.id} className={item.id === current.id ? "current" : ""}><div><strong>v{item.versao}</strong><small>{item.id === current.id ? "Atual" : item.change_scope ?? "Edição"}</small></div><button type="button" className="studio-secondary" onClick={() => onCompare(item.id === current.id ? null : item.id)}>{item.id === compareVersionId ? "Fechar comparação" : "Comparar"}</button><button type="button" className="studio-secondary" disabled={busy || item.id === current.id} onClick={() => void mutate({ action: "createVersion", versionId: current.id, fields: { headline: String(item.conteudo.headline ?? ""), legenda: String(item.conteudo.legenda ?? ""), cta: String(item.conteudo.cta ?? ""), estrutura: { slides: item.conteudo.slides, stories: item.conteudo.stories, cenas: item.conteudo.cenas } } }, "Desfeito com segurança: nova versão criada a partir do histórico.")}>Desfazer</button></article>)}</div>{compare && <div className="studio-history-compare"><div><span>Atual · v{current.versao}</span><p>{String(current.conteudo.headline ?? "")}</p><small>{String(current.conteudo.cta ?? "")}</small></div><div><span>Comparação · v{compare.versao}</span><p>{String(compare.conteudo.headline ?? "")}</p><small>{String(compare.conteudo.cta ?? "")}</small></div></div>}</section>;
}

function CollaborationPanel({ piece, version, tasks, comments, busy, mutate }: { piece: StudioPiece; version: StudioPieceVersion; tasks: NonNullable<StudioData["tasks"]>; comments: NonNullable<StudioData["comments"]>; busy: boolean; mutate: (body: Record<string, unknown>, success?: string) => Promise<ApiResult> }) {
  const [comment, setComment] = useState(""); const task = tasks.find((item) => item.piece_id === piece.id);
  return <details className="studio-collaboration"><summary><strong>Colaboração e governança</strong><span>{task?.status ?? "sem responsável"}</span></summary><div className="studio-collab-form"><label className="studio-field"><span>Responsável (ID)</span><input defaultValue={task?.responsavel_id ?? ""} placeholder="UUID do responsável"/></label><label className="studio-field"><span>Prazo</span><input type="datetime-local" defaultValue={task?.prazo_em ? task.prazo_em.slice(0, 16) : ""}/></label><button type="button" className="studio-secondary" disabled={busy} onClick={(event) => { const form = (event.currentTarget.parentElement as HTMLElement); const inputs = [...form.querySelectorAll("input")]; void mutate({ action: "saveTask", pieceId: piece.id, responsavelId: (inputs[0] as HTMLInputElement).value, prazoEm: (inputs[1] as HTMLInputElement).value ? new Date((inputs[1] as HTMLInputElement).value).toISOString() : null, status: "em_andamento", pendencia: null }, "Responsável e prazo salvos."); }}>Salvar responsável e prazo</button><label className="studio-field"><span>Comentário contextual da versão v{version.versao}</span><textarea value={comment} onChange={(event) => setComment(event.target.value)} placeholder="Ex.: revisar slide 2 antes da aprovação"/></label><button type="button" className="studio-primary" disabled={busy || !comment.trim()} onClick={() => void mutate({ action: "addComment", pieceId: piece.id, versionId: version.id, comentario: comment }, "Comentário adicionado à timeline.").then(() => setComment(""))}>Adicionar comentário</button>{comments.filter((item) => item.piece_id === piece.id).slice(0, 4).map((item) => <div className="studio-comment" key={item.id}><small>{new Date(item.criado_em).toLocaleString("pt-BR")}</small><span>{item.comentario}</span></div>)}</div></details>;
}

function CalendarView({ data, busy, mutate }: { data: StudioData; busy: boolean; mutate: (body: Record<string, unknown>, success?: string) => Promise<ApiResult> }) {
  const grouped = useMemo(() => { const map = new Map<string, StudioData["schedules"]>(); for (const item of data.schedules) { const key = new Intl.DateTimeFormat("en-CA", { timeZone: STUDIO_TIMEZONE }).format(new Date(item.agendado_para)); const rows = map.get(key) ?? []; rows.push(item); map.set(key, rows); } return [...map.entries()]; }, [data.schedules]);
  return <main className="studio-content"><section className="studio-section"><header><div><span className="studio-eyebrow">Agenda editorial</span><h2>Calendário de conteúdo</h2><p>Datas reais em {STUDIO_TIMEZONE}, com a versão exata de cada peça.</p></div></header>
    {grouped.length ? <div className="studio-calendar-list">{grouped.map(([date, rows]) => <section key={date}><header><strong>{fullDate.format(new Date(`${date}T12:00:00Z`))}</strong><small>{rows.length} publicaç{rows.length === 1 ? "ão" : "ões"}</small></header>{rows.map((schedule) => { const version = data.versions.find((item) => item.id === schedule.piece_version_id); const piece = version ? data.pieces.find((item) => item.id === version.piece_id) : null; const campaign = piece ? data.campaigns.find((item) => item.id === piece.campaign_id) : null; return <article key={schedule.id}><span className="studio-calendar-time">{new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: STUDIO_TIMEZONE }).format(new Date(schedule.agendado_para))}</span><span className="studio-calendar-icon"><Icon name={piece ? FORMAT_META[piece.formato].icon : "calendar"}/></span><div><strong>{piece?.titulo ?? "Peça não encontrada"}</strong><small>{campaign?.nome} · versão {version?.versao ?? "—"}</small></div><span className={`studio-status ${schedule.status}`}>{statusLabel[schedule.status] ?? schedule.status}</span>{schedule.status === "agendado" && <button type="button" disabled={busy} onClick={() => { if (window.confirm("Confirmar o envio desta versão aprovada para a fila do Instagram?")) void mutate({ action: "preparePublication", scheduleId: schedule.id, confirm: true }, "Publicação enviada para a fila segura."); }}><Icon name="send"/> Enviar à fila</button>}</article>; })}</section>)}</div> : <EmptyState icon="calendar" title="Calendário livre" text="Aprove uma versão e escolha data e hora no construtor."/>}</section></main>;
}

function Settings({ data, busy, mutate }: { data: StudioData; busy: boolean; mutate: (body: Record<string, unknown>, success?: string) => Promise<ApiResult> }) {
  const [manifest, setManifest] = useState("");
  const instagram = data.integrations.find((item) => item.provider === "instagram");
  return <main className="studio-content studio-settings"><section className="studio-section"><header><div><span className="studio-eyebrow">Integrações</span><h2>Estado real das conexões</h2><p>Nenhuma integração é mostrada como pronta sem verificação.</p></div></header><div className="studio-integrations">{(["openai", "figma", "renderer", "instagram"] as const).map((provider) => { const entry = data.integrations.find((item) => item.provider === provider); return <article key={provider}><span className={`studio-provider-mark ${provider}`}><Icon name={provider === "openai" ? "sparkles" : provider === "figma" ? "layers" : provider === "instagram" ? "send" : "image"}/></span><div><strong>{provider === "openai" ? "IA governada" : provider === "figma" ? "Figma" : provider === "instagram" ? "Instagram" : "Renderização"}</strong><small>{entry?.status === "configurada" ? "Configurada e verificada" : entry?.status === "degradada" ? "Com falha parcial" : provider === "renderer" ? "Worker externo ainda não ativado" : "Não configurada"}</small></div><span className={`studio-connection ${entry?.status ?? "nao_configurada"}`}>{entry?.status === "configurada" ? "Ativa" : entry?.status === "degradada" ? "Parcial" : "Desativada"}</span></article>; })}</div>
      <div className="studio-review-actions">{instagram?.status === "configurada"
        ? <button type="button" className="studio-secondary" disabled={busy} onClick={() => { if (window.confirm("Desconectar o Instagram e revogar o token guardado no Vault?")) void mutate({ action: "metaOAuthDisconnect" }, "Instagram desconectado com segurança."); }}><Icon name="close"/> Desconectar Instagram</button>
        : <button type="button" className="studio-primary" disabled={busy} onClick={() => void mutate({ action: "metaOAuthStart" }).then((result) => { if (!result.authorization_url) throw new Error("A Meta não devolveu a URL de autorização."); window.location.assign(result.authorization_url); })}><Icon name="send"/> Conectar Instagram profissional</button>}
      </div>
    </section>
    <section className="studio-section studio-manifest"><header><div><span className="studio-eyebrow">Templates versionados</span><h2>Importar manifesto do Figma</h2><p>O Figma é a oficina. O Studio usa a versão publicada sem depender dele a cada geração.</p></div></header><label className="studio-field"><span>Manifesto JSON</span><textarea value={manifest} onChange={(event) => setManifest(event.target.value)} placeholder={'{"schema_version":1,"slug":"feed-novo",...}'}/></label><button className="studio-secondary" type="button" disabled={busy || !manifest.trim()} onClick={() => { try { const parsed = JSON.parse(manifest); void mutate({ action: "importTemplate", manifest: parsed }, "Nova versão de template publicada no catálogo interno.").then(() => setManifest("")); } catch { window.alert("O JSON do manifesto é inválido."); } }}><Icon name="upload"/> Validar e publicar versão</button></section>
    <section className="studio-section studio-catalog"><header><div><span className="studio-eyebrow">Catálogo visual</span><h2>Modelos importados do Figma</h2><p>{data.templates.filter((item) => item.origem === "figma").length} modelos com manifesto publicado. O Studio não finge sincronização em tempo real.</p></div></header><div className="studio-template-grid">{data.templates.filter((item) => item.origem === "figma").map((item) => <article className="studio-template-catalog-card" key={item.id}><span className="studio-template-thumb" aria-hidden="true"><i/><b/><em/></span><strong>{item.nome}</strong><small>Manifesto versionado · v{item.versao_publicada ?? 1}</small></article>)}</div></section>
    <section className="studio-section studio-canva"><header><div><span className="studio-eyebrow">Canva</span><h2>Exportação honesta</h2><p>Não há sincronização conectada neste ambiente. Exporte um pacote editável e abra o Canva manualmente.</p></div></header><div className="studio-review-actions"><button type="button" className="studio-primary" onClick={() => { const payload = { exported_at: new Date().toISOString(), templates: data.templates, campaigns: data.campaigns.map((item) => ({ id: item.id, nome: item.nome })), note: "Pacote de referência do ApêCerto Studio; importe e ajuste no Canva." }; const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" }); const url = URL.createObjectURL(blob); const anchor = document.createElement("a"); anchor.href = url; anchor.download = "apecerto-canva-package.json"; anchor.click(); URL.revokeObjectURL(url); }}>Exportar pacote para Canva</button><button type="button" className="studio-secondary" disabled title="A abertura automática exige conexão Canva aprovada">Abrir no Canva (conexão não configurada)</button></div></section>
    <section className="studio-section studio-budget"><header><div><span className="studio-eyebrow">Custos</span><h2>Limites do mês</h2><p>O padrão seguro é zero. Apenas um administrador pode autorizar um novo limite.</p></div></header><div>{data.budgets.map((budget) => <BudgetEditor key={`${budget.provider}-${budget.limite_usd}`} budget={budget} busy={busy} mutate={mutate}/>)}</div></section>
  </main>;
}

function BudgetEditor({ budget, busy, mutate }: { budget: StudioData["budgets"][number]; busy: boolean; mutate: (body: Record<string, unknown>, success?: string) => Promise<ApiResult> }) {
  const [limit, setLimit] = useState(String(Number(budget.limite_usd).toFixed(2)));
  const next = Number(limit);
  const save = () => {
    if (!Number.isFinite(next) || next < 0) return;
    if (next > 0 && !window.confirm(`Autorizar limite mensal de US$ ${next.toFixed(2)} para ${budget.provider}? Chamadas futuras poderão consumir esse valor.`)) return;
    void mutate({ action: "setBudget", provider: budget.provider, limitUsd: next }, "Limite mensal atualizado com confirmação explícita.");
  };
  return <article><span>{budget.provider}</span><strong>US$ {Number(budget.consumido_usd).toFixed(2)} consumidos</strong><div><i style={{ width: `${budget.limite_usd ? Math.min(100, budget.consumido_usd / budget.limite_usd * 100) : 0}%` }}/></div><label><span>Limite</span><input type="number" min="0" max="1000" step="0.01" value={limit} onChange={(event) => setLimit(event.target.value)}/><button type="button" disabled={busy || next === Number(budget.limite_usd)} onClick={save}>Salvar</button></label></article>;
}

function CampaignForm({ busy, onClose, onSave }: { busy: boolean; onClose: () => void; onSave: (payload: Record<string, unknown>) => Promise<void> }) {
  const now = new Date(); const first = new Date(now.getFullYear(), now.getMonth() + 1, 1); const last = new Date(now.getFullYear(), now.getMonth() + 2, 0);
  const iso = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
  const [form, setForm] = useState({ productCode: "", name: "", objective: "Gerar interesse qualificado e agendamentos de visita", periodStart: iso(first), periodEnd: iso(last) });
  return <div className="studio-modal-backdrop" role="presentation" onMouseDown={onClose}><form className="studio-modal" onMouseDown={(event) => event.stopPropagation()} onSubmit={(event) => { event.preventDefault(); void onSave({ ...form, idempotencyKey: `campaign|${form.productCode.toLowerCase()}|${form.periodStart}|${crypto.randomUUID()}` }).catch(() => undefined); }}><header><div><span className="studio-eyebrow">Nova campanha</span><h2>Comece pelo produto real</h2><p>O Studio buscará o código em Produtos e criará um snapshot factual imutável.</p></div><button type="button" onClick={onClose} aria-label="Fechar"><Icon name="close"/></button></header><div className="studio-form-grid"><label className="studio-field wide"><span>Código do produto ou unidade</span><input autoFocus value={form.productCode} onChange={(event) => setForm({ ...form, productCode: event.target.value })} placeholder="Ex.: AP0001"/><small>Não precisa do link do site.</small></label><label className="studio-field wide"><span>Nome da campanha</span><input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} placeholder="Ex.: Campanha Moema · setembro"/></label><label className="studio-field wide"><span>Objetivo</span><textarea value={form.objective} onChange={(event) => setForm({ ...form, objective: event.target.value })}/></label><label className="studio-field"><span>Início</span><input type="date" value={form.periodStart} onChange={(event) => setForm({ ...form, periodStart: event.target.value })}/></label><label className="studio-field"><span>Fim</span><input type="date" value={form.periodEnd} onChange={(event) => setForm({ ...form, periodEnd: event.target.value })}/></label></div><div className="studio-modal-note"><Icon name="check"/><span>Dados de proprietário, contato e acesso nunca entram no snapshot nem na IA.</span></div><footer><button type="button" className="studio-secondary" onClick={onClose}>Cancelar</button><button type="submit" className="studio-primary" disabled={busy || !form.productCode.trim() || !form.name.trim()}><Icon name="sparkles"/>{busy ? "Criando…" : "Criar campanha"}</button></footer></form></div>;
}

function EmptyState({ icon, title, text, action, onAction }: { icon: IconName; title: string; text: string; action?: string; onAction?: () => void }) { return <div className="studio-empty"><span><Icon name={icon} size={24}/></span><h3>{title}</h3><p>{text}</p>{action && onAction && <button type="button" onClick={onAction}>{action}</button>}</div>; }
