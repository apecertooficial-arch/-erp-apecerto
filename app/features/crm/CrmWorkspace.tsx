"use client";
/* eslint-disable react-hooks/purity, react-hooks/set-state-in-effect */

import { useEffect, useMemo, useRef, useState, type CSSProperties, type DragEvent } from "react";
import { getBrowserSupabaseClient } from "../../lib/supabase/browser";
import { MessageMedia, ProductSendModal, QuickActionModal, type ChatData, type QuickAction } from "../chat/LiveChatWorkspace";

type Pipeline = { id: number; nome: string; grupo: string | null; ordem: number };
type Stage = { id: number; pipeline_id: number; nome: string; rotulo: string | null; ordem: number; cor: string | null; tipo: string; grupo: number | null; chave: string | null };
type Lead = { id: number; nome: string | null; telefone: string | null; email: string | null; instagram: string | null; corretor_id: number | null; pipeline_id: number | null; status: string; origem: string | null; tags: unknown; extras: unknown; criado_em: string; atualizado_em: string | null; disparo_optout: boolean };
type Deal = { id: number; lead_id: number; corretor_id: number | null; pipeline_id: number; stage_id: number | null; empreendimento_id: string | null; valor: number | null; status: string; motivo_perda: string | null; criado_em: string; ultima_movimentacao: string | null; estagio_desde: string | null; tentativa: number | null; max_tentativas: number | null };
type Broker = { id: number; nome: string; email: string | null; telefone: string | null; ativo: boolean; online: boolean; usuario_id: string | null };
type Activity = { id: number; lead_id: number | null; negocio_id: number | null; corretor_id: number | null; tipo: string; texto: string | null; criado_em: string };
type Task = { id: number; lead_id: number | null; negocio_id: number | null; corretor_id: number | null; titulo: string; descricao: string | null; vencimento: string | null; concluida: boolean; prioridade: string; criado_em: string };
type Product = { id: string; nome: string; bairro: string | null; cidade: string | null; status: string; preco: number | null; origem: string; rascunho: boolean };
type ProductLink = { lead_id: number; empreendimento_id: string; created_at: string; empreendimentos: Pick<Product, "id" | "nome" | "bairro" | "cidade" | "status" | "preco"> | null };
type Visit = { id: string; lead_id: number | null; negocio_id: number | null; corretor_id: number | null; cliente_nome: string | null; empreendimento_id: string | null; produto: string | null; unidade: string | null; data: string; hora_inicio: string | null; hora_fim: string | null; local: string | null; observacoes: string | null; participantes: string | null; lembrete: boolean; com_gerente: boolean; status: string; criado_em: string };
type SlaInfo = { negocio_id: number | null; lead_id: number | null; stage_id: number | null; sla_situacao: string | null; aguardando_humano: boolean | null; min_aguardando: number | null; min_no_estagio: number | null; min_sem_interacao: number | null; min_ativo_int: number | null; cor_ativa: string | null; alarme_ativo: boolean | null; ultima_interacao: string | null; cliente_ultima: string | null; humano_ultima: string | null };
type LeadAlert = { id: number; negocio_id: number; corretor_id: number | null; criado_em: string; reconhecido_em: string | null; reconhecido_por: string | null };
type ChatInstance = { key: string; sendBig: number | null; nome: string; conectada: boolean | null; corretor: string; conversaIds: string[]; msgs: number; ultima: string };
type ChatMessage = { id: string; wa_message_id: string | null; conversa_id?: string; direcao: string; tipo: string; conteudo: string | null; media_url: string | null; criado_em: string | null };
type CrmData = { pipelines: Pipeline[]; stages: Stage[]; leads: Lead[]; deals: Deal[]; brokers: Broker[]; activities: Activity[]; tasks: Task[]; productLinks: ProductLink[]; visits: Visit[]; products: Product[]; sla: SlaInfo[]; alerts: LeadAlert[] };
type ViewName = "pipeline" | "leads" | "sales" | "analytics" | "agenda" | "atividades";

const money = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
const dateTime = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
const shortDate = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short" });
const groupNames: Record<number, string> = { 1: "Entrada", 2: "Atendimento", 3: "Follow-up", 4: "Fechamento" };
const viewHeadings: Record<ViewName, { title: string; subtitle: string }> = {
  pipeline: { title: "CRM · Funil de vendas", subtitle: "Acompanhe cada lead da entrada ao fechamento" },
  leads: { title: "CRM · Leads", subtitle: "Consulte, filtre e atualize os leads da operação" },
  sales: { title: "CRM · Vendas em processo", subtitle: "Vendas na esteira de contrato e documentação" },
  analytics: { title: "CRM · Analítico de funil", subtitle: "Conversão, tempo por etapa, motivos de perda e distribuição" },
  agenda: { title: "CRM · Agenda", subtitle: "Visitas, tarefas e próximos compromissos dos leads" },
  atividades: { title: "CRM · Atividades", subtitle: "Histórico comercial e movimentações da equipe" },
};
const discardReasons = ["Contato inválido", "Sem interesse", "Sem capacidade financeira", "Fora da região", "Já comprou", "Duplicado", "Pediu para não receber contato", "Produto incompatível"];

function tagList(tags: unknown) {
  if (Array.isArray(tags)) return tags.map(String).filter(Boolean);
  if (tags && typeof tags === "object") return Object.entries(tags as Record<string, unknown>).filter(([, value]) => Boolean(value)).map(([key]) => key);
  return [];
}

function initials(name: string | null) {
  return (name || "Lead").split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase();
}

function isOverdue(task: Task, now: number) {
  return !task.concluida && Boolean(task.vencimento) && new Date(task.vencimento!).getTime() < now;
}

function formatElapsed(minutes: number | null | undefined) {
  if (minutes === null || minutes === undefined || !Number.isFinite(Number(minutes))) return "agora";
  const value = Math.max(0, Math.round(Number(minutes)));
  const mins = value % 60;
  const hours = Math.floor((value % 1440) / 60);
  if (value < 60) return `${mins} min`;
  if (value < 1440) return `${hours}h ${String(mins).padStart(2, "0")}m`;
  const days = Math.floor(value / 1440);
  if (days < 7) return `${days}d ${hours}h`;
  const weeks = Math.floor(days / 7);
  if (days < 30) return `${weeks} sem ${days % 7}d`;
  if (days < 365) { const months = Math.floor(days / 30); return `${months} ${months === 1 ? "mês" : "meses"} ${Math.floor((days % 30) / 7)} sem`; }
  const years = Math.floor(days / 365);
  return `${years} ${years === 1 ? "ano" : "anos"} ${Math.floor((days % 365) / 30)} m`;
}

export function CrmWorkspace({ accessToken, initialDealId = null, onInitialDealHandled, sessionRole = "corretor" }: { accessToken: string; initialDealId?: number | null; onInitialDealHandled?: () => void; sessionRole?: "admin" | "gestor" | "corretor" }) {
  const [now, setNow] = useState(() => Date.now());
  const [data, setData] = useState<CrmData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<ViewName>("pipeline");
  const [query, setQuery] = useState("");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [pipelineId, setPipelineId] = useState<number | null>(null);
  const [stageId, setStageId] = useState<number | null>(null);
  const [brokerId, setBrokerId] = useState<number | null>(null);
  const [origin, setOrigin] = useState("");
  const [tag, setTag] = useState("");
  const [group, setGroup] = useState<number | null>(null);
  const [overdueOnly, setOverdueOnly] = useState(false);
  const [selectedDealId, setSelectedDealId] = useState<number | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [draggingDealId, setDraggingDealId] = useState<number | null>(null);
  const [bulkMoveOpen, setBulkMoveOpen] = useState(false);
  const [chatDealId, setChatDealId] = useState<number | null>(null);

  async function load({ quiet = false }: { quiet?: boolean } = {}) {
    if (!quiet) setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/crm", { headers: { Authorization: `Bearer ${accessToken}` } });
      const result = await response.json() as CrmData & { error?: string };
      if (!response.ok) throw new Error(result.error || "Não foi possível consultar o CRM.");
      setData(result);
      setPipelineId((current) => current ?? result.pipelines[0]?.id ?? null);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Erro ao carregar o CRM.");
    } finally {
      if (!quiet) setLoading(false);
    }
  }

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { void load(); }, [accessToken]);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 30000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    const supabase = getBrowserSupabaseClient();
    const channel = supabase.channel("crm-live-updates")
      .on("postgres_changes", { event: "*", schema: "public", table: "negocios" }, () => { void load({ quiet: true }); })
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "wa_mensagens" }, () => { void load({ quiet: true }); })
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accessToken]);

  async function mutate(body: Record<string, unknown>) {
    const response = await fetch("/api/crm", { method: "PATCH", headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const result = await response.json() as { error?: string };
    if (!response.ok) throw new Error(result.error || "Não foi possível salvar.");
    await load({ quiet: true });
  }

  const leadById = useMemo(() => new Map((data?.leads ?? []).map((lead) => [lead.id, lead])), [data]);
  const brokerById = useMemo(() => new Map((data?.brokers ?? []).map((broker) => [broker.id, broker])), [data]);
  const activeStages = useMemo(() => (data?.stages ?? []).filter((stage) => stage.pipeline_id === pipelineId), [data, pipelineId]);
  const allTags = useMemo(() => [...new Set((data?.leads ?? []).flatMap((lead) => tagList(lead.tags)))].sort(), [data]);
  const origins = useMemo(() => [...new Set((data?.leads ?? []).map((lead) => lead.origem).filter((item): item is string => Boolean(item)))].sort(), [data]);
  const activeFilterCount = [stageId, brokerId, origin, tag, group].filter(Boolean).length;
  const slaByDeal = useMemo(() => new Map((data?.sla ?? []).filter((item) => item.negocio_id).map((item) => [item.negocio_id!, item])), [data]);
  const filteredDeals = useMemo(() => (data?.deals ?? []).filter((deal) => {
    const lead = leadById.get(deal.lead_id);
    const stage = activeStages.find((item) => item.id === deal.stage_id);
    if (!lead || deal.pipeline_id !== pipelineId) return false;
    const sla = slaByDeal.get(deal.id);
    const overdue = Boolean(sla && (sla.alarme_ativo || sla.cor_ativa === "vermelho"));
    const haystack = `${lead.nome ?? ""} ${lead.telefone ?? ""} ${lead.email ?? ""}`.toLowerCase();
    return (!query || haystack.includes(query.toLowerCase())) && (!stageId || deal.stage_id === stageId)
      && (!brokerId || (deal.corretor_id ?? lead.corretor_id) === brokerId) && (!origin || lead.origem === origin)
      && (!tag || tagList(lead.tags).includes(tag)) && (!group || stage?.grupo === group) && (!overdueOnly || overdue);
  }), [data, leadById, activeStages, pipelineId, query, stageId, brokerId, origin, tag, group, overdueOnly, slaByDeal]);
  const overdueCount = useMemo(() => (data?.deals ?? []).filter((deal) => { const sla = slaByDeal.get(deal.id); return deal.pipeline_id === pipelineId && Boolean(sla && (sla.alarme_ativo || sla.cor_ativa === "vermelho")); }).length, [data, pipelineId, slaByDeal]);
  const visibleStages = useMemo(() => activeStages.filter((stage) => !group || stage.grupo === group), [activeStages, group]);
  const selectedDeal = data?.deals.find((deal) => deal.id === selectedDealId) ?? null;
  const selectedLead = selectedDeal ? leadById.get(selectedDeal.lead_id) ?? null : null;
  const pendingAlerts = data?.alerts ?? [];
  const viewHeading = viewHeadings[view];
  const metrics = useMemo(() => ({
    leads: new Set(filteredDeals.map((deal) => deal.lead_id)).size,
    open: filteredDeals.filter((deal) => deal.status === "aberto").length,
    value: filteredDeals.reduce((sum, deal) => sum + (deal.valor ?? 0), 0),
    overdue: (data?.tasks ?? []).filter((task) => isOverdue(task, now)).length,
    visits: (data?.visits ?? []).filter((visit) => visit.status === "agendada" && new Date(`${visit.data}T${visit.hora_inicio || "00:00"}`).getTime() >= now).length,
  }), [data, filteredDeals, now]);

  useEffect(() => {
    if (!initialDealId || !data) return;
    const deal = data.deals.find((item) => item.id === initialDealId);
    if (!deal) return;
    setView("pipeline"); setPipelineId(deal.pipeline_id); setSelectedDealId(deal.id); onInitialDealHandled?.();
  }, [initialDealId, data, onInitialDealHandled]);

  function openDeal(dealId: number) {
    setSelectedDealId(dealId);
    if (pendingAlerts.some((alert) => alert.negocio_id === dealId)) void mutate({ action: "acknowledgeLead", dealId }).catch(() => undefined);
  }

  function openChat(dealId: number) {
    setChatDealId(dealId);
    if (pendingAlerts.some((alert) => alert.negocio_id === dealId)) void mutate({ action: "acknowledgeLead", dealId }).catch(() => undefined);
  }

  async function dropDeal(event: DragEvent, targetStageId: number) {
    event.preventDefault();
    const dealId = Number(event.dataTransfer.getData("text/deal-id") || draggingDealId);
    if (!dealId) return;
    const deal = data?.deals.find((item) => item.id === dealId);
    if (!deal || deal.stage_id === targetStageId) return setDraggingDealId(null);
    setMessage(null);
    try { await mutate({ action: "moveDeal", dealId, stageId: targetStageId }); setMessage("Lead movido para a nova etapa."); }
    catch (reason) { setMessage(reason instanceof Error ? reason.message : "Não foi possível mover o lead."); }
    finally { setDraggingDealId(null); }
  }

  return <div className="crm-v2">
    <header className="crm-v2-header">
      <div><span className="crm-eyebrow">GESTÃO COMERCIAL</span><h1>{viewHeading.title}</h1><p>{viewHeading.subtitle}</p></div>
      <div className="crm-header-actions"><label className="crm-search-v2"><span>⌕</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar nome, telefone ou e-mail" /></label><button className="crm-primary" type="button" onClick={() => { setMessage(null); setCreateOpen(true); }}>＋ Novo lead</button></div>
    </header>

    <section className="crm-command-bar">
      <nav aria-label="Visões do CRM">
        <button className={view === "pipeline" ? "active" : ""} onClick={() => setView("pipeline")} type="button"><span>▦</span> Funil</button>
        <button className={view === "leads" ? "active" : ""} onClick={() => setView("leads")} type="button"><span>☷</span> Leads</button>
        <button className={view === "sales" ? "active" : ""} onClick={() => setView("sales")} type="button"><span>◆</span> Vendas em processo</button>
        <button className={view === "analytics" ? "active" : ""} onClick={() => setView("analytics")} type="button"><span>↗</span> Analítico</button>
        <button className={view === "agenda" ? "active" : ""} onClick={() => setView("agenda")} type="button"><span>□</span> Agenda</button>
        <button className={view === "atividades" ? "active" : ""} onClick={() => setView("atividades")} type="button"><span>↻</span> Atividades</button>
      </nav>
      <span className="crm-live">● Supabase conectado</span>
    </section>

    <section className="crm-metrics">
      <article><span className="metric-icon purple">◎</span><div><strong>{metrics.leads}</strong><small>Leads no recorte</small></div></article>
      <article><span className="metric-icon orange">↗</span><div><strong>{metrics.open}</strong><small>Negócios abertos</small></div></article>
      <article><span className="metric-icon green">R$</span><div><strong>{money.format(metrics.value)}</strong><small>Valor em negociação</small></div></article>
      <article><span className="metric-icon red">!</span><div><strong>{metrics.overdue}</strong><small>Tarefas vencidas</small></div></article>
      <article><span className="metric-icon blue">◇</span><div><strong>{metrics.visits}</strong><small>Próximas visitas</small></div></article>
    </section>

    <section className="crm-toolbar-v2">
      <select aria-label="Funil" value={pipelineId ?? ""} onChange={(event) => { setPipelineId(Number(event.target.value)); setStageId(null); setGroup(null); }}>{(data?.pipelines ?? []).map((pipeline) => <option value={pipeline.id} key={pipeline.id}>{pipeline.nome}</option>)}</select>
      {view === "pipeline" && <div className="stage-groups"><button className={group === null ? "active" : ""} type="button" onClick={() => setGroup(null)}>Todas</button>{[1, 2, 3, 4].map((item) => <button className={group === item ? "active" : ""} type="button" onClick={() => setGroup(item)} key={item}>{groupNames[item]} <span>{activeStages.filter((stage) => stage.grupo === item).reduce((sum, stage) => sum + filteredDeals.filter((deal) => deal.stage_id === stage.id).length, 0)}</span></button>)}</div>}
      <button className={filtersOpen ? "crm-filter-trigger active" : "crm-filter-trigger"} type="button" onClick={() => setFiltersOpen(!filtersOpen)}>▽ Filtros {activeFilterCount > 0 && <b>{activeFilterCount}</b>}</button>
      <button className={overdueOnly ? "crm-overdue-trigger active" : "crm-overdue-trigger"} type="button" onClick={() => setOverdueOnly((v) => !v)} title="Mostrar apenas leads que estouraram o SLA">⏰ Leads Atrasados {overdueCount > 0 && <b>{overdueCount}</b>}</button>
      {view === "pipeline" && <button className="crm-bulk-trigger" type="button" onClick={() => setBulkMoveOpen(true)}>⇄ Mover etapa inteira</button>}
      <span className="crm-result-count">{filteredDeals.length} negócios</span>
    </section>
    {filtersOpen && <section className="crm-filter-sheet"><label>Etapa<select value={stageId ?? ""} onChange={(event) => setStageId(event.target.value ? Number(event.target.value) : null)}><option value="">Todas</option>{activeStages.map((stage) => <option value={stage.id} key={stage.id}>{stage.rotulo || stage.nome}</option>)}</select></label><label>Responsável<select value={brokerId ?? ""} onChange={(event) => setBrokerId(event.target.value ? Number(event.target.value) : null)}><option value="">Todos</option>{(data?.brokers ?? []).map((broker) => <option value={broker.id} key={broker.id}>{broker.nome}</option>)}</select></label><label>Origem<select value={origin} onChange={(event) => setOrigin(event.target.value)}><option value="">Todas</option>{origins.map((item) => <option key={item}>{item}</option>)}</select></label><label>Tag<select value={tag} onChange={(event) => setTag(event.target.value)}><option value="">Todas</option>{allTags.map((item) => <option key={item}>{item}</option>)}</select></label><button type="button" onClick={() => { setStageId(null); setBrokerId(null); setOrigin(""); setTag(""); setGroup(null); }}>Limpar</button></section>}
    {message && <div className="crm-toast" onClick={() => setMessage(null)}>{message}<button type="button">×</button></div>}
    {loading && <div className="crm-loading"><span /><strong>Montando seu CRM com os dados reais…</strong></div>}
    {error && <div className="crm-error">{error}<button type="button" onClick={() => void load()}>Tentar novamente</button></div>}
    {!loading && !error && data && view === "pipeline" && <PipelineViewEnhanced stages={visibleStages} allStages={activeStages} deals={filteredDeals} leadById={leadById} brokerById={brokerById} brokers={data.brokers} slaByDeal={slaByDeal} onOpen={openDeal} onChat={openChat} onMutate={mutate} setMessage={setMessage} draggingId={draggingDealId} onDrag={setDraggingDealId} onDrop={dropDeal} />}
    {!loading && !error && data && view === "leads" && <LeadsViewEnhanced deals={filteredDeals} leadById={leadById} stages={activeStages} brokerById={brokerById} brokers={data.brokers} slaByDeal={slaByDeal} onOpen={openDeal} onChat={openChat} onMutate={mutate} setMessage={setMessage} />}
    {!loading && !error && data && view === "agenda" && <AgendaView data={data} leadById={leadById} onMutate={mutate} setMessage={setMessage} />}
    {!loading && !error && data && view === "atividades" && <ActivitiesView data={data} leadById={leadById} brokerById={brokerById} onOpen={(leadId) => setSelectedDealId(data.deals.find((deal) => deal.lead_id === leadId)?.id ?? null)} />}
    {!loading && !error && data && view === "sales" && <SalesProcessView accessToken={accessToken} />}
    {!loading && !error && data && view === "analytics" && <AnalyticsView data={data} />}
    {selectedDeal && selectedLead && data && <LeadDrawer key={selectedDeal.id} accessToken={accessToken} lead={selectedLead} deal={selectedDeal} data={data} onClose={() => { setSelectedDealId(null); setMessage(null); }} onMutate={mutate} onReload={() => load({ quiet: true })} setMessage={setMessage} />}
    {chatDealId && data && leadById.get(data.deals.find((deal) => deal.id === chatDealId)?.lead_id ?? -1) && <LeadChatDrawer accessToken={accessToken} lead={leadById.get(data.deals.find((deal) => deal.id === chatDealId)!.lead_id)!} deal={data.deals.find((deal) => deal.id === chatDealId)!} onClose={() => setChatDealId(null)} onResponse={async () => { await mutate({ action: "acknowledgeResponse", dealId: chatDealId }); setMessage("Resposta registrada e alerta encerrado."); }} />}
    {bulkMoveOpen && data && pipelineId && <BulkMoveModal pipelineId={pipelineId} stages={activeStages} deals={data.deals.filter((deal) => deal.pipeline_id === pipelineId)} onClose={() => setBulkMoveOpen(false)} onMove={async (fromStageId, toStageId) => { await mutate({ action: "bulkMoveStage", pipelineId, fromStageId, toStageId }); setBulkMoveOpen(false); setMessage("Todos os negócios da etapa foram movidos."); }} />}
    {createOpen && data && <CreateLeadModal pipelines={data.pipelines} brokers={data.brokers} initialPipelineId={pipelineId} sessionRole={sessionRole} onClose={() => { setCreateOpen(false); setMessage(null); }} onCreate={async (payload) => { await mutate({ action: "createLead", ...payload }); setCreateOpen(false); setMessage("Novo lead criado e inserido na primeira etapa."); }} />}
  </div>;
}

type SalesData = {
  sales: Array<{ id: string; created_at: string; data_venda: string; empreendimento_id: string | null; empreendimento_nome: string | null; vgv: number; forma_pgto: string | null; status: string; obs: string | null }>;
  processes: Array<{ id: string; venda_id: string; negocio_id: number | null; etapa: string; tipo_venda: string; responsavel_usuario_id: string | null; prazo_em: string | null; atualizado_em: string }>;
  deals: Array<{ id: number; venda_id: string | null; lead_id: number; corretor_id: number | null; empreendimento_id: string | null; valor: number | null; status: string }>;
  leads: Array<{ id: number; nome: string | null; telefone: string | null; email: string | null; corretor_id: number | null }>;
  products: Array<{ id: string; nome: string; origem: string; bairro: string | null; cidade: string | null }>;
  brokers: Array<{ id: number; nome: string; usuario_id: string | null; online: boolean }>;
};

const saleStages = [
  { id: "inicio", name: "Pedido aprovado", color: "#ff7000", role: "Corretor", days: 1 },
  { id: "doc_comp", name: "Documentação do comprador", color: "#e66200", role: "Corretor", days: 3 },
  { id: "doc_vend", name: "Documentação do vendedor", color: "#f2a82c", role: "Gerente", days: 3, resale: true },
  { id: "contrato", name: "Contrato em geração", color: "#8b00cc", role: "Jurídico", days: 2 },
  { id: "minuta_cnd", name: "Minuta + CNDs em análise", color: "#7a1fa2", role: "Jurídico", days: 4 },
  { id: "minuta_env", name: "Contrato enviado p/ assinatura", color: "#2f6fed", role: "Jurídico", days: 3 },
  { id: "pagamento", name: "Aguardando pagamento", color: "#c79a00", role: "Financeiro", days: 5 },
  { id: "registrada", name: "Venda registrada", color: "#1fa85a", role: "Administrador", days: 0 },
];

function SalesProcessView({ accessToken }: { accessToken: string }) {
  const [data, setData] = useState<SalesData | null>(null); const [error, setError] = useState<string | null>(null); const [filter, setFilter] = useState("all"); const [creating, setCreating] = useState(false); const [busy, setBusy] = useState(false);
  const load = async () => { const response = await fetch("/api/crm/sales", { headers: { Authorization: `Bearer ${accessToken}` } }); const result = await response.json() as SalesData & { error?: string }; if (!response.ok) throw new Error(result.error || "Não foi possível carregar as vendas."); setData(result); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { void load().catch((reason) => setError(reason instanceof Error ? reason.message : "Erro ao carregar vendas.")); }, [accessToken]);
  const saleById = new Map((data?.sales ?? []).map((sale) => [sale.id, sale])); const dealBySale = new Map((data?.deals ?? []).filter((deal) => deal.venda_id).map((deal) => [deal.venda_id!, deal])); const leadById = new Map((data?.leads ?? []).map((lead) => [lead.id, lead]));
  const visible = (data?.processes ?? []).filter((item) => filter === "all" || item.tipo_venda === filter); const overdue = visible.filter((item) => item.etapa !== "registrada" && Date.now() - new Date(item.atualizado_em).getTime() > ((saleStages.find((stage) => stage.id === item.etapa)?.days || 99) * 86400000));
  const move = async (processId: string, stage: string) => { setBusy(true); setError(null); try { const response = await fetch("/api/crm/sales", { method: "PATCH", headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" }, body: JSON.stringify({ action: "move", processId, stage }) }); const result = await response.json() as { error?: string }; if (!response.ok) throw new Error(result.error || "Não foi possível mover a venda."); await load(); } catch (reason) { setError(reason instanceof Error ? reason.message : "Não foi possível mover a venda."); } finally { setBusy(false); } };
  if (!data) return <div className="crm-loading"><span /><strong>Conectando a esteira de vendas…</strong></div>;
  return <section className="sales-process"><header><div><span>PÓS-FECHAMENTO</span><h2>Esteira de contrato & documentação</h2><p>Todas as vendas reais ligadas ao negócio, produto, cliente e responsável.</p></div><button className="crm-primary" type="button" onClick={() => setCreating(true)}>＋ Nova venda</button></header>{error && <div className="crm-error">{error}</div>}<div className="sales-kpis"><article><strong>{visible.length}</strong><span>em processo</span></article><article className="danger"><strong>{overdue.length}</strong><span>vendas atrasadas</span></article><article><strong>{visible.filter((item) => item.etapa === "minuta_env").length}</strong><span>aguardando assinatura</span></article><article><strong>{visible.filter((item) => ["doc_comp", "doc_vend"].includes(item.etapa)).length}</strong><span>documentos pendentes</span></article><article><strong>{visible.filter((item) => item.etapa === "pagamento").length}</strong><span>aguardando pagamento</span></article></div><div className="sales-filter"><b>Tipo de venda</b>{[["all", "Todas"], ["revenda", "Revenda"], ["construtora", "Construtora"]].map(([id, label]) => <button className={filter === id ? "active" : ""} type="button" onClick={() => setFilter(id)} key={id}>{label}</button>)}<span>Corretor · Gerente · Jurídico · Financeiro</span></div><div className="sales-kanban">{saleStages.map((stage) => { const items = visible.filter((item) => item.etapa === stage.id && (!stage.resale || item.tipo_venda === "revenda")); return <article className="sales-stage" style={{ "--sale-stage": stage.color } as CSSProperties} onDragOver={(event) => event.preventDefault()} onDrop={(event) => { const id = event.dataTransfer.getData("text/process-id"); if (id && !busy) void move(id, stage.id); }} key={stage.id}><header><i /><strong>{stage.name}</strong><span>{items.length}</span></header><small>{stage.role} · SLA {stage.days ? `${stage.days}d` : "concluído"}</small><div>{items.map((item) => { const sale = saleById.get(item.venda_id); const deal = dealBySale.get(item.venda_id); const lead = deal ? leadById.get(deal.lead_id) : null; const late = overdue.some((entry) => entry.id === item.id); return <article className={late ? "sale-card late" : "sale-card"} draggable onDragStart={(event) => event.dataTransfer.setData("text/process-id", item.id)} key={item.id}><b>{lead?.nome || sale?.empreendimento_nome || "Venda"}</b><span>{sale?.empreendimento_nome || "Produto não informado"}</span><strong>{money.format(sale?.vgv || 0)}</strong><small>{item.tipo_venda === "revenda" ? "Revenda" : "Construtora"}{late ? " · em atraso" : ""}</small><select disabled={busy} value={item.etapa} onChange={(event) => void move(item.id, event.target.value)}>{saleStages.filter((target) => !target.resale || item.tipo_venda === "revenda").map((target) => <option value={target.id} key={target.id}>{target.name}</option>)}</select></article>; })}{items.length === 0 && <div className="sales-drop">Solte uma venda aqui</div>}</div></article>; })}</div>{creating && <CreateSaleModal data={data} accessToken={accessToken} onClose={() => setCreating(false)} onDone={async () => { setCreating(false); await load(); }} />}</section>;
}

function CreateSaleModal({ data, accessToken, initialDealId = "", onClose, onDone }: { data: SalesData; accessToken: string; initialDealId?: string | number; onClose: () => void; onDone: () => Promise<void> }) {
  const [dealId, setDealId] = useState(String(initialDealId)); const [productId, setProductId] = useState(""); const [vgv, setVgv] = useState(""); const [busy, setBusy] = useState(false); const [error, setError] = useState<string | null>(null); const leadById = new Map(data.leads.map((lead) => [lead.id, lead]));
  return <div className="crm-center-modal"><form onSubmit={(event) => { event.preventDefault(); setBusy(true); void fetch("/api/crm/sales", { method: "PATCH", headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" }, body: JSON.stringify({ action: "create", dealId: Number(dealId), productId, vgv: Number(vgv) }) }).then(async (response) => { const result = await response.json() as { error?: string }; if (!response.ok) throw new Error(result.error); await onDone(); }).catch((reason) => setError(reason instanceof Error ? reason.message : "Não foi possível criar a venda.")).finally(() => setBusy(false)); }}><header><div><span>NOVA VENDA</span><h2>Conectar venda ao CRM</h2><p>O registro entra no financeiro e na esteira de documentação.</p></div><button type="button" onClick={onClose}>×</button></header>{error && <div className="modal-error">{error}</div>}<label>Negócio / cliente<select required value={dealId} onChange={(event) => setDealId(event.target.value)}><option value="">Selecione</option>{data.deals.filter((deal) => !deal.venda_id).map((deal) => <option value={deal.id} key={deal.id}>{leadById.get(deal.lead_id)?.nome || `Negócio #${deal.id}`}</option>)}</select></label><label>Produto<select required value={productId} onChange={(event) => setProductId(event.target.value)}><option value="">Selecione</option>{data.products.map((product) => <option value={product.id} key={product.id}>{product.nome}</option>)}</select></label><label>Valor da venda<input required min="1" type="number" value={vgv} onChange={(event) => setVgv(event.target.value)} /></label><footer><button type="button" onClick={onClose}>Cancelar</button><button className="crm-primary" disabled={busy} type="submit">{busy ? "Salvando…" : "Criar venda"}</button></footer></form></div>;
}

function AnalyticsView({ data }: { data: CrmData }) {
  const activeDeals = data.deals.filter((deal) => deal.status !== "perdido"); const lost = data.deals.filter((deal) => deal.status === "perdido"); const stageStats = data.stages.filter((stage) => stage.tipo !== "perdido").map((stage) => { const deals = activeDeals.filter((deal) => deal.stage_id === stage.id); const sla = data.sla.filter((entry) => entry.stage_id === stage.id); return { stage, count: deals.length, avg: sla.length ? Math.round(sla.reduce((sum, entry) => sum + Number(entry.min_no_estagio || 0), 0) / sla.length) : 0 }; }); const bottleneck = [...stageStats].sort((a, b) => b.avg - a.avg)[0]; const won = data.deals.filter((deal) => deal.status === "ganho" || data.stages.find((stage) => stage.id === deal.stage_id)?.tipo === "ganho").length; const conversion = data.deals.length ? Math.round((won / data.deals.length) * 100) : 0; const maxCount = Math.max(1, ...stageStats.map((entry) => entry.count)); const maxAvg = Math.max(1, ...stageStats.map((entry) => entry.avg)); const reasonCounts = [...new Set(lost.map((deal) => deal.motivo_perda || "Sem motivo"))].map((reason) => ({ reason, count: lost.filter((deal) => (deal.motivo_perda || "Sem motivo") === reason).length })); const brokerStats = data.brokers.map((broker) => ({ broker, count: data.deals.filter((deal) => deal.corretor_id === broker.id).length })).sort((a, b) => b.count - a.count); const maxBroker = Math.max(1, ...brokerStats.map((entry) => entry.count)); const pending = data.sla.filter((entry) => entry.aguardando_humano && Number(entry.min_aguardando || 0) >= 60).length;
  return <section className="crm-analytics"><header><span>VISÃO GERENCIAL</span><h2>Analítico de funil</h2><p>Conversão, tempo por etapa, perdas e distribuição — calculados com os dados atuais.</p></header><div className="analytics-kpis"><article><b>{activeDeals.length}</b><span>Leads no funil</span></article><article><b>{conversion}%</b><span>Conversão geral</span></article><article><b>{bottleneck?.stage.rotulo || bottleneck?.stage.nome || "—"}</b><span>Gargalo</span></article><article><b>{lost.length}</b><span>Leads perdidos</span></article><article><b>{pending}</b><span>1º contato pendente</span></article></div><div className="analytics-grid"><article><h3>Conversão do funil</h3>{stageStats.map((entry) => <div className="funnel-row" key={entry.stage.id}><span><b>{entry.stage.rotulo || entry.stage.nome}</b><em>{entry.count}</em></span><i><u style={{ width: `${Math.max(2, (entry.count / maxCount) * 100)}%`, background: entry.stage.cor || "#ff7000" }} /></i></div>)}</article><article><h3>Tempo médio por etapa</h3>{stageStats.map((entry) => <div className={entry.stage.id === bottleneck?.stage.id ? "time-row bottleneck" : "time-row"} key={entry.stage.id}><b>{entry.stage.rotulo || entry.stage.nome}</b><i><u style={{ width: `${Math.max(2, (entry.avg / maxAvg) * 100)}%` }} /></i><span>{formatElapsed(entry.avg)}</span></div>)}</article><article><h3>Motivos de perda</h3>{reasonCounts.length ? reasonCounts.map((entry) => <div className="loss-row" key={entry.reason}><span>{entry.reason}</span><b>{entry.count}</b></div>) : <div className="crm-empty-view compact">Nenhuma perda registrada.</div>}</article><article><h3>Auditoria da distribuição</h3>{brokerStats.map((entry) => <div className="broker-row" key={entry.broker.id}><span>{initials(entry.broker.nome)}</span><div><b>{entry.broker.nome}</b><i><u style={{ width: `${(entry.count / maxBroker) * 100}%` }} /></i></div><em>{entry.count} · {entry.broker.online ? "online" : "offline"}</em></div>)}</article></div></section>;
}

function PipelineViewEnhanced({ stages, allStages, deals, leadById, brokerById, brokers, slaByDeal, onOpen, onChat, onMutate, setMessage, draggingId, onDrag, onDrop }: { stages: Stage[]; allStages: Stage[]; deals: Deal[]; leadById: Map<number, Lead>; brokerById: Map<number, Broker>; brokers: Broker[]; slaByDeal: Map<number, SlaInfo>; onOpen: (id: number) => void; onChat: (id: number) => void; onMutate: (body: Record<string, unknown>) => Promise<void>; setMessage: (value: string | null) => void; draggingId: number | null; onDrag: (id: number | null) => void; onDrop: (event: DragEvent, stageId: number) => Promise<void> }) {
  const [busyId, setBusyId] = useState<number | null>(null);
  const change = async (body: Record<string, unknown>, success: string, dealId: number) => { setBusyId(dealId); try { await onMutate(body); setMessage(success); } catch (reason) { setMessage(reason instanceof Error ? reason.message : "Não foi possível salvar."); } finally { setBusyId(null); } };
  return <section className="crm-kanban-v2">{stages.map((stage) => { const items = deals.filter((deal) => deal.stage_id === stage.id); return <article className="crm-stage" style={{ "--stage": stage.cor || "#8d2bd1" } as CSSProperties} key={stage.id} onDragOver={(event) => event.preventDefault()} onDrop={(event) => void onDrop(event, stage.id)}><header><div><i /><strong>{stage.rotulo || stage.nome}</strong></div><span>{items.length}</span></header><div className="crm-stage-body">{items.map((deal) => { const lead = leadById.get(deal.lead_id)!; const broker = brokerById.get(deal.corretor_id ?? lead.corretor_id ?? -1); const tags = tagList(lead.tags); const sla = slaByDeal.get(deal.id); const color = sla?.cor_ativa || "verde"; const waiting = sla?.aguardando_humano; return <article draggable className={`crm-lead-card-v3 sla-${color} ${draggingId === deal.id ? "dragging" : ""}`} onDragStart={(event) => { if ((event.target as HTMLElement).closest(".card-controls-v3")) return event.preventDefault(); event.dataTransfer.setData("text/deal-id", String(deal.id)); onDrag(deal.id); }} onDragEnd={() => onDrag(null)} key={deal.id}><div className={`sla-top-band ${color}`} /><button className="card-open-v3" type="button" onClick={() => onOpen(deal.id)}><div className="card-person"><span>{initials(lead.nome)}</span><div><strong>{lead.nome || "Lead sem nome"}</strong><small>{lead.telefone || "Sem telefone"}</small></div><em>›</em></div><div className="sla-clock-v3"><b>{formatElapsed(waiting ? sla?.min_aguardando : sla?.min_sem_interacao)}</b><span>{waiting ? "cliente aguardando resposta" : "sem interação com o lead"}</span></div><div className="card-context"><span>{lead.origem || "Sem origem"}</span>{deal.valor ? <b>{money.format(deal.valor)}</b> : <small>Valor a definir</small>}</div>{tags.length > 0 && <div className="card-tags">{tags.slice(0, 3).map((item) => <span key={item}>{item}</span>)}</div>}</button><div className="card-controls-v3" onClick={(event) => event.stopPropagation()}><label><span>Etapa</span><select aria-label={`Alterar etapa de ${lead.nome || "lead"}`} disabled={busyId === deal.id} value={deal.stage_id ?? ""} onChange={(event) => void change({ action: "moveDeal", dealId: deal.id, stageId: Number(event.target.value) }, "Etapa atualizada.", deal.id)}>{allStages.map((item) => <option value={item.id} key={item.id}>{item.rotulo || item.nome}</option>)}</select></label><label><span>Corretor</span><select aria-label={`Alterar corretor de ${lead.nome || "lead"}`} disabled={busyId === deal.id} value={deal.corretor_id ?? lead.corretor_id ?? ""} onChange={(event) => void change({ action: "transferDeal", dealId: deal.id, brokerId: Number(event.target.value) }, "Corretor atualizado.", deal.id)}><option value="">Sem responsável</option>{brokers.map((item) => <option value={item.id} key={item.id}>{item.nome}</option>)}</select></label><button type="button" onClick={() => onChat(deal.id)}>◉ Chat</button></div><footer><span className={`presence ${broker?.online ? "online" : ""}`} /><strong>{broker?.nome || "Sem responsável"}</strong><time>{sla?.min_no_estagio !== null && sla?.min_no_estagio !== undefined ? `${formatElapsed(sla.min_no_estagio)} na etapa` : shortDate.format(new Date(deal.ultima_movimentacao || deal.criado_em))}</time></footer></article>; })}{items.length === 0 && <div className="crm-empty-stage">Arraste um lead para esta etapa</div>}</div></article>; })}</section>;
}

function LeadsViewEnhanced({ deals, leadById, stages, brokerById, brokers, slaByDeal, onOpen, onChat, onMutate, setMessage }: { deals: Deal[]; leadById: Map<number, Lead>; stages: Stage[]; brokerById: Map<number, Broker>; brokers: Broker[]; slaByDeal: Map<number, SlaInfo>; onOpen: (id: number) => void; onChat: (id: number) => void; onMutate: (body: Record<string, unknown>) => Promise<void>; setMessage: (value: string | null) => void }) {
  const [busyId, setBusyId] = useState<number | null>(null);
  const change = async (body: Record<string, unknown>, success: string, dealId: number) => { setBusyId(dealId); try { await onMutate(body); setMessage(success); } catch (reason) { setMessage(reason instanceof Error ? reason.message : "Não foi possível salvar."); } finally { setBusyId(null); } };
  return <section className="crm-table-wrap"><table className="crm-leads-table crm-leads-table-v3"><thead><tr><th>Lead</th><th>Tempo sem interação</th><th>Etapa</th><th>Corretor</th><th>Origem</th><th>Valor</th><th>Ações</th></tr></thead><tbody>{deals.map((deal) => { const lead = leadById.get(deal.lead_id)!; const sla = slaByDeal.get(deal.id); const broker = brokerById.get(deal.corretor_id ?? lead.corretor_id ?? -1); return <tr className={`sla-row-${sla?.cor_ativa || "verde"}`} key={deal.id}><td onClick={() => onOpen(deal.id)}><div className="table-person"><span>{initials(lead.nome)}</span><div><strong>{lead.nome || "Lead sem nome"}</strong><small>{lead.telefone || `#${lead.id}`}</small></div></div></td><td><strong>{formatElapsed(sla?.aguardando_humano ? sla.min_aguardando : sla?.min_sem_interacao)}</strong><small>{sla?.aguardando_humano ? "aguardando resposta" : "sem interação"}</small></td><td><select disabled={busyId === deal.id} value={deal.stage_id ?? ""} onChange={(event) => void change({ action: "moveDeal", dealId: deal.id, stageId: Number(event.target.value) }, "Etapa atualizada.", deal.id)}>{stages.map((stage) => <option value={stage.id} key={stage.id}>{stage.rotulo || stage.nome}</option>)}</select></td><td><select disabled={busyId === deal.id} value={deal.corretor_id ?? lead.corretor_id ?? ""} onChange={(event) => void change({ action: "transferDeal", dealId: deal.id, brokerId: Number(event.target.value) }, "Corretor atualizado.", deal.id)}><option value="">Sem responsável</option>{brokers.map((item) => <option value={item.id} key={item.id}>{item.nome}</option>)}</select><small>{broker?.online ? "● online" : "offline"}</small></td><td>{lead.origem || "—"}</td><td>{deal.valor ? money.format(deal.valor) : "—"}</td><td><div className="table-actions-v3"><button type="button" onClick={() => onChat(deal.id)}>Chat</button><button type="button" onClick={() => onOpen(deal.id)}>Abrir</button></div></td></tr>; })}</tbody></table>{deals.length === 0 && <div className="crm-empty-view">Nenhum lead encontrado com esses filtros.</div>}</section>;
}

function BulkMoveModal({ pipelineId, stages, deals, onClose, onMove }: { pipelineId: number; stages: Stage[]; deals: Deal[]; onClose: () => void; onMove: (fromStageId: number, toStageId: number) => Promise<void> }) {
  const [fromStageId, setFromStageId] = useState(""); const [toStageId, setToStageId] = useState(""); const [busy, setBusy] = useState(false); const [error, setError] = useState<string | null>(null);
  const count = deals.filter((deal) => deal.stage_id === Number(fromStageId) && deal.status !== "perdido").length;
  return <div className="crm-center-modal"><form onSubmit={(event) => { event.preventDefault(); setBusy(true); setError(null); void onMove(Number(fromStageId), Number(toStageId)).catch((reason) => setError(reason instanceof Error ? reason.message : "Não foi possível mover a etapa.")).finally(() => setBusy(false)); }}><header><div><span>AÇÃO EM MASSA</span><h2>Mover uma etapa inteira</h2><p>Todos os negócios da etapa escolhida serão enviados para o novo destino.</p></div><button type="button" onClick={onClose}>×</button></header>{error && <div className="modal-error">{error}</div>}<div className="bulk-move-grid"><label>Etapa de origem<select required value={fromStageId} onChange={(event) => setFromStageId(event.target.value)}><option value="">Selecione</option>{stages.map((stage) => <option value={stage.id} key={stage.id}>{stage.rotulo || stage.nome}</option>)}</select></label><div className="bulk-arrow">→</div><label>Etapa de destino<select required value={toStageId} onChange={(event) => setToStageId(event.target.value)}><option value="">Selecione</option>{stages.filter((stage) => String(stage.id) !== fromStageId).map((stage) => <option value={stage.id} key={stage.id}>{stage.rotulo || stage.nome}</option>)}</select></label></div><div className="bulk-warning"><strong>{count} negócio{count === 1 ? "" : "s"}</strong><span>serão movidos dentro do funil #{pipelineId}</span></div><footer><button type="button" onClick={onClose}>Cancelar</button><button className="crm-primary" disabled={busy || !fromStageId || !toStageId || count === 0} type="submit">{busy ? "Movendo..." : `Mover ${count} negócios`}</button></footer></form></div>;
}

function LeadChatDrawer({ accessToken, lead, deal, onClose, onResponse }: { accessToken: string; lead: Lead; deal: Deal; onClose: () => void; onResponse: () => Promise<void> }) {
  const [instances, setInstances] = useState<ChatInstance[]>([]); const [selectedKey, setSelectedKey] = useState(""); const [messages, setMessages] = useState<ChatMessage[]>([]); const [draft, setDraft] = useState(""); const [loading, setLoading] = useState(true); const [sending, setSending] = useState(false); const [error, setError] = useState<string | null>(null); const [recording, setRecording] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null); const recorder = useRef<MediaRecorder | null>(null); const chunks = useRef<Blob[]>([]);
  async function request(body: Record<string, unknown>) { const response = await fetch("/api/crm/chat", { method: "POST", headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" }, body: JSON.stringify(body) }); const result = await response.json() as Record<string, unknown>; if (!response.ok) throw new Error(typeof result.error === "string" ? result.error : "Não foi possível abrir a conversa."); return result; }
  async function loadInstances() { setLoading(true); setError(null); try { const result = await request({ action: "list", telefone: lead.telefone }); const list = Array.isArray(result.instancias) ? result.instancias as ChatInstance[] : []; setInstances(list); setSelectedKey((current) => current || list[0]?.key || ""); } catch (reason) { setError(reason instanceof Error ? reason.message : "Não foi possível abrir a conversa."); } finally { setLoading(false); } }
  async function loadMessages(instance: ChatInstance) { setLoading(true); setError(null); try { const result = instance.conversaIds.length ? await request({ action: "messages", conversaIds: instance.conversaIds, limit: 300 }) : await request({ action: "dapi-hist", telefone: lead.telefone, instancia_id: instance.sendBig, page: 1, limit: 300 }); const list = Array.isArray(result.mensagens) ? result.mensagens as ChatMessage[] : []; setMessages([...list].sort((a, b) => String(a.criado_em || "").localeCompare(String(b.criado_em || "")))); } catch (reason) { setError(reason instanceof Error ? reason.message : "Não foi possível carregar as mensagens."); } finally { setLoading(false); } }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { const timer = window.setTimeout(() => { void loadInstances(); }, 0); return () => window.clearTimeout(timer); }, [lead.id]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { const instance = instances.find((item) => item.key === selectedKey); if (!instance) return; const timer = window.setTimeout(() => { void loadMessages(instance); }, 0); return () => window.clearTimeout(timer); }, [selectedKey, instances]);
  const selected = instances.find((item) => item.key === selectedKey) ?? null;
  useEffect(() => {
    if (!selected) return;
    const supabase = getBrowserSupabaseClient();
    const channel = supabase.channel(`lead-chat-${deal.id}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "wa_mensagens" }, () => { void loadMessages(selected); })
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedKey, deal.id]);
  async function send() { if (!selected?.sendBig || !draft.trim()) return; const chosen = selected; const text = draft; const tempId = `temp-${Date.now()}`; setDraft(""); setError(null); setMessages((prev) => [...prev, { id: tempId, wa_message_id: null, direcao: "enviada", tipo: "texto", conteudo: text, media_url: null, criado_em: new Date().toISOString() }]); void (async () => { try { await request({ action: "send", telefone: lead.telefone, instanciaId: chosen.sendBig, texto: text }); await onResponse(); await loadMessages(chosen); } catch (reason) { setError(reason instanceof Error ? reason.message : "Não foi possível enviar."); setMessages((prev) => prev.map((m) => m.id === tempId ? { ...m, conteudo: `${m.conteudo || ""} ⚠️ (falha)` } : m)); } })(); }
  async function liveAction(body: Record<string, unknown>) { const response = await fetch("/api/live-chat", { method: "POST", headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" }, body: JSON.stringify(body) }); const result = await response.json() as Record<string, unknown>; if (!response.ok) throw new Error(typeof result.error === "string" ? result.error : "Não foi possível concluir."); return result; }
  async function upload(file?: File) { if (!file || !selected?.sendBig || !lead.telefone) return; setSending(true); setError(null); try { const form = new FormData(); form.set("file", file); form.set("phone", lead.telefone); form.set("instanceId", String(selected.sendBig)); form.set("content", draft); const response = await fetch("/api/live-chat", { method: "POST", headers: { Authorization: `Bearer ${accessToken}` }, body: form }); const result = await response.json() as { error?: string }; if (!response.ok) throw new Error(result.error || "Não foi possível enviar a mídia."); setDraft(""); await onResponse(); await loadMessages(selected); } catch (reason) { setError(reason instanceof Error ? reason.message : "Não foi possível enviar a mídia."); } finally { setSending(false); if (fileInput.current) fileInput.current.value = ""; } }
  async function toggleRecording() { if (recording) { recorder.current?.stop(); setRecording(false); return; } try { const stream = await navigator.mediaDevices.getUserMedia({ audio: true }); chunks.current = []; const mediaRecorder = new MediaRecorder(stream); recorder.current = mediaRecorder; mediaRecorder.ondataavailable = (event) => { if (event.data.size) chunks.current.push(event.data); }; mediaRecorder.onstop = () => { const blob = new Blob(chunks.current, { type: mediaRecorder.mimeType || "audio/webm" }); stream.getTracks().forEach((track) => track.stop()); void upload(new File([blob], `audio-${Date.now()}.webm`, { type: blob.type })); }; mediaRecorder.start(); setRecording(true); } catch { setError("Autorize o microfone para gravar o áudio."); } }
  async function scheduleMessage() { if (!selected?.sendBig || !lead.telefone) return; const content = window.prompt("Mensagem que será agendada:", draft); if (!content) return; const date = window.prompt("Data e hora:", new Date(Date.now() + 3_600_000).toISOString().slice(0, 16)); if (!date) return; setSending(true); setError(null); try { await liveAction({ action: "schedule", phone: lead.telefone, instanceId: selected.sendBig, leadId: lead.id, content, when: date }); setDraft(""); } catch (reason) { setError(reason instanceof Error ? reason.message : "Não foi possível agendar."); } finally { setSending(false); } }
  async function sendApproach() { if (!selected?.sendBig || !lead.telefone) return; setSending(true); setError(null); try { const response = await fetch("/api/approaches", { headers: { Authorization: `Bearer ${accessToken}` } }); const result = await response.json() as { approaches?: Array<{ id: number; nome: string; ativo: boolean }>; error?: string }; if (!response.ok) throw new Error(result.error || "Não foi possível carregar as abordagens."); const active = (result.approaches ?? []).filter((item) => item.ativo); const choice = window.prompt(`Digite o ID da abordagem:\n${active.map((item) => `${item.id} — ${item.nome}`).join("\n")}`); if (!choice) return; await liveAction({ action: "sendApproach", approachId: Number(choice), phone: lead.telefone, instanceId: selected.sendBig, leadId: lead.id, leadName: lead.nome }); } catch (reason) { setError(reason instanceof Error ? reason.message : "Não foi possível enviar a abordagem."); } finally { setSending(false); } }
  return <div className="crm-drawer-layer chat-layer" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}><aside className="lead-chat-drawer"><header><div><span>{initials(lead.nome)}</span><div><small>CONVERSA DO LEAD #{lead.id}</small><h2>{lead.nome || "Lead sem nome"}</h2><p>{lead.telefone || "Telefone não informado"}</p></div></div><button type="button" onClick={onClose}>×</button></header><section className="chat-instance-bar"><label>Instância do histórico<select value={selectedKey} onChange={(event) => setSelectedKey(event.target.value)}><option value="">Selecione</option>{instances.map((item) => <option value={item.key} key={item.key}>{item.nome} · {item.corretor || "sem corretor"} · {item.msgs} msgs</option>)}</select></label><span className={selected?.conectada ? "connected" : ""}>{selected?.conectada ? "● conectada" : "○ sem conexão confirmada"}</span></section>{error && <div className="chat-error">{error}</div>}<section className="chat-messages">{loading && <div className="chat-loading">Carregando conversa real…</div>}{!loading && messages.map((item) => <article className={item.direcao === "enviada" ? "sent" : "received"} key={item.id}><small>{item.tipo}</small><MessageMedia message={item} />{item.conteudo && <p>{item.conteudo}</p>}<time>{item.criado_em ? dateTime.format(new Date(item.criado_em)) : ""}</time></article>)}{!loading && messages.length === 0 && <div className="crm-empty-view">Nenhuma mensagem encontrada nesta instância.</div>}</section><section className="mini-chat-tools"><button className={recording ? "recording" : ""} type="button" onClick={() => void toggleRecording()} title="Gravar áudio">{recording ? "■ Parar e enviar" : "🎤 Áudio"}</button><button type="button" onClick={() => fileInput.current?.click()} title="Anexar mídia">📎 Documento / mídia</button><button type="button" onClick={() => void scheduleMessage()} title="Agendar mensagem">🕓 Agendar</button><button type="button" onClick={() => void sendApproach()} title="Enviar abordagem">🏡 Abordagem</button><input ref={fileInput} hidden type="file" accept="image/*,video/*,audio/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx" onChange={(event) => void upload(event.target.files?.[0])} /></section><footer><textarea value={draft} onChange={(event) => setDraft(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); void send(); } }} placeholder={selected?.sendBig ? "Escreva uma mensagem..." : "Selecione uma instância habilitada para envio"} disabled={!selected?.sendBig || sending} /><button type="button" disabled={!selected?.sendBig || !draft.trim() || sending} onClick={() => void send()}>{sending ? "…" : "➤"}</button></footer><div className="chat-deal-status">Negócio #{deal.id} · Histórico, anexos e agendamentos usam a instância escolhida.</div></aside></div>;
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function PipelineView({ stages, deals, leadById, brokerById, onOpen, draggingId, onDrag, onDrop }: { stages: Stage[]; deals: Deal[]; leadById: Map<number, Lead>; brokerById: Map<number, Broker>; onOpen: (id: number) => void; draggingId: number | null; onDrag: (id: number | null) => void; onDrop: (event: DragEvent, stageId: number) => Promise<void> }) {
  return <section className="crm-kanban-v2">{stages.map((stage) => { const items = deals.filter((deal) => deal.stage_id === stage.id); return <article className="crm-stage" style={{ "--stage": stage.cor || "#8d2bd1" } as CSSProperties} key={stage.id} onDragOver={(event) => event.preventDefault()} onDrop={(event) => void onDrop(event, stage.id)}><header><div><i /><strong>{stage.rotulo || stage.nome}</strong></div><span>{items.length}</span></header><div className="crm-stage-body">{items.map((deal) => { const lead = leadById.get(deal.lead_id)!; const broker = brokerById.get(deal.corretor_id ?? lead.corretor_id ?? -1); const tags = tagList(lead.tags); return <button draggable type="button" className={`crm-lead-card ${draggingId === deal.id ? "dragging" : ""}`} onDragStart={(event) => { event.dataTransfer.setData("text/deal-id", String(deal.id)); onDrag(deal.id); }} onDragEnd={() => onDrag(null)} onClick={() => onOpen(deal.id)} key={deal.id}><div className="card-person"><span>{initials(lead.nome)}</span><div><strong>{lead.nome || "Lead sem nome"}</strong><small>{lead.telefone || "Sem telefone"}</small></div><em>⋮</em></div><div className="card-context"><span>{lead.origem || "Sem origem"}</span>{deal.valor ? <b>{money.format(deal.valor)}</b> : <small>Valor a definir</small>}</div>{tags.length > 0 && <div className="card-tags">{tags.slice(0, 3).map((item) => <span key={item}>{item}</span>)}</div>}<footer><span className={`presence ${broker?.online ? "online" : ""}`} /> <strong>{broker?.nome || "Sem responsável"}</strong><time>{shortDate.format(new Date(deal.ultima_movimentacao || deal.criado_em))}</time></footer></button>; })}{items.length === 0 && <div className="crm-empty-stage">Arraste um lead para esta etapa</div>}</div></article>; })}</section>;
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function LeadsView({ deals, leadById, stageById, brokerById, onOpen }: { deals: Deal[]; leadById: Map<number, Lead>; stageById: Map<number, Stage>; brokerById: Map<number, Broker>; onOpen: (id: number) => void }) {
  return <section className="crm-table-wrap"><table className="crm-leads-table"><thead><tr><th>Lead</th><th>Contato</th><th>Etapa</th><th>Responsável</th><th>Origem</th><th>Valor</th><th>Atualização</th><th /></tr></thead><tbody>{deals.map((deal) => { const lead = leadById.get(deal.lead_id)!; const stage = stageById.get(deal.stage_id ?? -1); const broker = brokerById.get(deal.corretor_id ?? lead.corretor_id ?? -1); return <tr key={deal.id} onClick={() => onOpen(deal.id)}><td><div className="table-person"><span>{initials(lead.nome)}</span><div><strong>{lead.nome || "Lead sem nome"}</strong><small>#{lead.id}</small></div></div></td><td><strong>{lead.telefone || "—"}</strong><small>{lead.email || "E-mail não informado"}</small></td><td><span className="stage-pill" style={{ "--stage": stage?.cor || "#888" } as CSSProperties}>{stage?.rotulo || stage?.nome || "Sem etapa"}</span></td><td>{broker?.nome || "Sem responsável"}</td><td>{lead.origem || "—"}</td><td>{deal.valor ? money.format(deal.valor) : "—"}</td><td>{shortDate.format(new Date(deal.ultima_movimentacao || deal.criado_em))}</td><td><button type="button">›</button></td></tr>; })}</tbody></table>{deals.length === 0 && <div className="crm-empty-view">Nenhum lead encontrado com esses filtros.</div>}</section>;
}

function AgendaView({ data, leadById, onMutate, setMessage }: { data: CrmData; leadById: Map<number, Lead>; onMutate: (body: Record<string, unknown>) => Promise<void>; setMessage: (value: string | null) => void }) {
  const [now] = useState(() => Date.now());
  const [busy, setBusy] = useState<string | number | null>(null);
  const run = async (body: Record<string, unknown>, success: string, key: string | number) => { setBusy(key); try { await onMutate(body); setMessage(success); } catch (reason) { setMessage(reason instanceof Error ? reason.message : "Não foi possível salvar."); } finally { setBusy(null); } };
  const tasks = [...data.tasks].sort((a, b) => (a.vencimento || "9999").localeCompare(b.vencimento || "9999"));
  const visits = [...data.visits].sort((a, b) => `${a.data}${a.hora_inicio}`.localeCompare(`${b.data}${b.hora_inicio}`));
  return <section className="crm-agenda-grid"><article className="agenda-panel"><header><div><span>✓</span><div><h2>Tarefas</h2><p>Acompanhamentos e retornos programados</p></div></div><b>{tasks.filter((item) => !item.concluida).length} pendentes</b></header><div>{tasks.map((task) => <article className={`agenda-item ${task.concluida ? "done" : ""} ${isOverdue(task, now) ? "overdue" : ""}`} key={task.id}><button disabled={busy === task.id} type="button" onClick={() => void run({ action: "toggleTask", taskId: task.id, completed: !task.concluida }, task.concluida ? "Tarefa reaberta." : "Tarefa concluída.", task.id)}>{task.concluida ? "✓" : ""}</button><div><strong>{task.titulo}</strong><span>{task.lead_id ? leadById.get(task.lead_id)?.nome || "Lead" : "Tarefa geral"}</span></div><time>{task.vencimento ? dateTime.format(new Date(task.vencimento)) : "Sem prazo"}</time></article>)}{tasks.length === 0 && <div className="crm-empty-view compact">Nenhuma tarefa cadastrada.</div>}</div></article><article className="agenda-panel visits"><header><div><span>◇</span><div><h2>Visitas</h2><p>Agenda comercial dos imóveis</p></div></div><b>{visits.filter((item) => item.status === "agendada").length} agendadas</b></header><div>{visits.map((visit) => <article className={`visit-item ${visit.status}`} key={visit.id}><div className="visit-date"><strong>{new Date(`${visit.data}T12:00:00`).getDate()}</strong><span>{new Intl.DateTimeFormat("pt-BR", { month: "short" }).format(new Date(`${visit.data}T12:00:00`))}</span></div><div><strong>{visit.cliente_nome || "Cliente"}</strong><span>{visit.produto || visit.local || "Local a confirmar"}</span><small>{visit.hora_inicio?.slice(0, 5) || "Horário a confirmar"} · {visit.status}</small></div>{visit.status === "agendada" && <button disabled={busy === visit.id} type="button" onClick={() => void run({ action: "updateVisitStatus", visitId: visit.id, status: "realizada" }, "Visita marcada como realizada.", visit.id)}>Concluir</button>}</article>)}{visits.length === 0 && <div className="crm-empty-view compact">Nenhuma visita agendada.</div>}</div></article></section>;
}

function ActivitiesView({ data, leadById, brokerById, onOpen }: { data: CrmData; leadById: Map<number, Lead>; brokerById: Map<number, Broker>; onOpen: (leadId: number) => void }) {
  return <section className="crm-activity-view"><header><div><h2>Histórico da operação</h2><p>Observações, movimentações e registros do atendimento.</p></div><span>{data.activities.length} registros</span></header><div className="activity-feed">{data.activities.map((activity) => { const lead = activity.lead_id ? leadById.get(activity.lead_id) : null; const broker = activity.corretor_id ? brokerById.get(activity.corretor_id) : null; return <button type="button" onClick={() => activity.lead_id && onOpen(activity.lead_id)} key={activity.id}><span className={`activity-symbol ${activity.tipo}`}>{activity.tipo === "observacao" ? "✎" : activity.tipo === "descarte" ? "×" : "↻"}</span><div><strong>{activity.tipo.replaceAll("_", " ")}</strong><p>{activity.texto || "Atividade registrada"}</p><small>{lead?.nome || "Operação geral"}{broker ? ` · ${broker.nome}` : ""}</small></div><time>{dateTime.format(new Date(activity.criado_em))}</time></button>; })}{data.activities.length === 0 && <div className="crm-empty-view">Nenhuma atividade registrada ainda.</div>}</div></section>;
}

type LeadActionIconName = "task" | "visit" | "product" | "proposal" | "financing" | "transfer" | "call" | "note" | "ai";

function LeadActionIcon({ name }: { name: LeadActionIconName }) {
  const common = { fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  return <svg aria-hidden="true" viewBox="0 0 24 24" {...common}>
    {name === "task" && <><circle cx="12" cy="12" r="8" /><path d="m8.5 12 2.2 2.2 4.8-5" /></>}
    {name === "visit" && <><rect x="4" y="6" width="16" height="14" rx="2" /><path d="M8 3v5M16 3v5M4 10h16" /></>}
    {name === "product" && <><path d="M5 21h14M7 21V6h10v15M10 9h1M13 9h1M10 13h1M13 13h1M10 17h1M13 17h1" /></>}
    {name === "proposal" && <><path d="m5 19 3.8-1 9.5-9.5-2.8-2.8L6 15.2 5 19Z" /><path d="m13.8 7.4 2.8 2.8M4 21h16" /></>}
    {name === "financing" && <><rect x="6" y="3" width="12" height="18" rx="2" /><path d="M9 7h6M9 11h1M14 11h1M9 15h1M14 15h1M9 18h1M14 18h1" /></>}
    {name === "transfer" && <><circle cx="8" cy="8" r="3" /><circle cx="17" cy="9" r="2" /><path d="M3 20c.6-4 2.3-6 5-6s4.4 2 5 6M14 15c2.8-.5 5.2 1.1 6 4M15 4l2-2 2 2" /></>}
    {name === "call" && <path d="M7.2 3.8 10 7.3 8.2 9.8c1.3 2.7 3.3 4.7 6 6l2.5-1.8 3.5 2.8-.7 3c-.2.8-1 1.3-1.8 1.2C9.8 19.8 4.2 14.2 3 6.3c-.1-.8.4-1.6 1.2-1.8l3-.7Z" />}
    {name === "note" && <><path d="M5 18.5 3.5 21l3.8-.8A8.5 8.5 0 1 0 5 18.5Z" /><path d="M8 11h8M8 14h5" /></>}
    {name === "ai" && <><path d="m12 3 1.5 4.2L18 9l-4.5 1.8L12 15l-1.5-4.2L6 9l4.5-1.8L12 3Z" /><path d="m18 15 .8 2.2L21 18l-2.2.8L18 21l-.8-2.2L15 18l2.2-.8L18 15Z" /></>}
  </svg>;
}

function LeadDrawer({ accessToken, lead, deal, data, onClose, onMutate, onReload, setMessage }: { accessToken: string; lead: Lead; deal: Deal; data: CrmData; onClose: () => void; onMutate: (body: Record<string, unknown>) => Promise<void>; onReload: () => Promise<void>; setMessage: (value: string | null) => void }) {
  const [tab, setTab] = useState<"resumo" | "historico" | "agenda" | "produtos">("resumo");
  const [form, setForm] = useState({ nome: lead.nome || "", telefone: lead.telefone || "", email: lead.email || "", instagram: lead.instagram || "", origem: lead.origem || "", status: lead.status, corretor_id: lead.corretor_id ? String(lead.corretor_id) : "", tags: tagList(lead.tags).join(", "), valor: deal.valor ? String(deal.valor) : "" });
  const [note, setNote] = useState(""); const [task, setTask] = useState(""); const [due, setDue] = useState(""); const [productId, setProductId] = useState("");
  const [action, setAction] = useState<"visit" | "transfer" | "discard" | null>(null); const [busy, setBusy] = useState(false);
  const [quickAction, setQuickAction] = useState<QuickAction | null>(null); const [productOpen, setProductOpen] = useState(false); const [saleOpen, setSaleOpen] = useState(false); const [chatData, setChatData] = useState<ChatData | null>(null);
  const [visit, setVisit] = useState({ date: "", startTime: "", endTime: "", productId: "", local: "", observations: "", reminder: true, withManager: false });
  const [transferBroker, setTransferBroker] = useState(""); const [discard, setDiscard] = useState({ reason: "", observation: "" });
  const stages = data.stages.filter((stage) => stage.pipeline_id === deal.pipeline_id); const activities = data.activities.filter((item) => item.lead_id === lead.id); const tasks = data.tasks.filter((item) => item.lead_id === lead.id); const visits = data.visits.filter((item) => item.lead_id === lead.id || item.negocio_id === deal.id); const links = data.productLinks.filter((item) => item.lead_id === lead.id); const linkedIds = new Set(links.map((item) => item.empreendimento_id));
  const run = async (body: Record<string, unknown>, success: string) => {
    setBusy(true);
    try {
      await onMutate(body);
      setMessage(success);
      return true;
    } catch (reason) {
      setMessage(reason instanceof Error ? reason.message : "Não foi possível salvar.");
      return false;
    } finally {
      setBusy(false);
    }
  };
  const callExternal = async (body: Record<string, unknown>, endpoint = "/api/live-chat") => {
    const response = await fetch(endpoint, { method: endpoint === "/api/crm" ? "PATCH" : "POST", headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const result = await response.json() as { error?: string };
    if (!response.ok) throw new Error(result.error || "Não foi possível concluir.");
    setMessage("Ação concluída e salva no Supabase."); await onReload();
  };
  const openProduct = async () => {
    try { const response = await fetch("/api/live-chat", { headers: { Authorization: `Bearer ${accessToken}` } }); const result = await response.json() as ChatData & { error?: string }; if (!response.ok) throw new Error(result.error); setChatData(result); setProductOpen(true); }
    catch (reason) { setMessage(reason instanceof Error ? reason.message : "Não foi possível carregar os produtos."); }
  };
  const normalizePhone = (value?: string | null) => (value || "").replace(/\D/g, "").slice(-11);
  const contact = chatData?.contacts.find((item) => item.lead_id === lead.id || normalizePhone(item.telefone) === normalizePhone(lead.telefone));
  const conversation = contact && chatData?.conversations.find((item) => item.contato_id === contact.id);
  const waInstance = conversation && chatData?.instances.find((item) => item.id === conversation.instancia_id);
  const dapi = chatData?.dapi.find((item) => item.instancia_dapi === waInstance?.session_id) || chatData?.dapi.find((item) => item.conectada);
  const currentProduct = data.products.find((item) => item.id === deal.empreendimento_id);
  const responsible = data.brokers.find((broker) => broker.id === (deal.corretor_id ?? lead.corretor_id));
  const stageIndex = Math.max(0, stages.findIndex((stage) => stage.id === deal.stage_id));
  return <div className="crm-drawer-layer" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}><aside className="crm-drawer-v2">
    <header className="drawer-hero-v2 lead-classic-hero">
      <button className="drawer-close-v2" type="button" onClick={onClose}>×</button>
      <div className="drawer-identity"><span>{initials(lead.nome)}</span><div><small>LEAD #{lead.id}</small><h2>{lead.nome || "Lead sem nome"}</h2><p>☎ {lead.telefone || "Telefone não informado"}{lead.email ? ` · ${lead.email}` : ""}</p></div></div>
      <div className="lead-contact-actions"><button type="button" onClick={() => setQuickAction("visit")}><LeadActionIcon name="visit" /> Agendar visita</button></div>
    </header>
    <section className="lead-classic-panel">
      <button className="lead-sale-action" type="button" onClick={() => setSaleOpen(true)}>▤ <span>Enviar para processo de venda</span></button>
      <article className="lead-next-action"><header><span>✦</span><b>PRÓXIMA MELHOR AÇÃO</b></header><h3>Fazer follow-up com {lead.nome?.split(/\s+/)[0] || "o lead"}</h3><p>Sem interação recente — um retorno curto mantém o lead ativo.</p><button type="button" disabled title="Em breve">ϟ Executar ação</button></article>
      <h4>AÇÕES RÁPIDAS</h4>
      <div className="lead-action-grid">
        <button type="button" onClick={() => setQuickAction("task")}><LeadActionIcon name="task" /><span>Tarefas</span></button>
        <button type="button" onClick={() => setQuickAction("visit")}><LeadActionIcon name="visit" /><span>Agendar visita</span></button>
        <button type="button" onClick={() => void openProduct()}><LeadActionIcon name="product" /><span>Enviar produto</span></button>
        <button type="button" onClick={() => setQuickAction("proposal")}><LeadActionIcon name="proposal" /><span>Gerar proposta</span></button>
        <button type="button" onClick={() => setQuickAction("financing")}><LeadActionIcon name="financing" /><span>Financiamento</span></button>
        <button type="button" onClick={() => setQuickAction("transfer")}><LeadActionIcon name="transfer" /><span>Transferir</span></button>
        <button type="button" onClick={() => setQuickAction("callReminder")}><LeadActionIcon name="call" /><span>Lembrete de ligação</span></button>
        <button type="button" onClick={() => setQuickAction("note")}><LeadActionIcon name="note" /><span>Observação</span></button>
        <button type="button" onClick={() => { setTask(`Fazer follow-up com ${lead.nome || "o lead"}`); setTab("agenda"); setMessage("Sugestão da IA preparada como próxima tarefa."); }}><LeadActionIcon name="ai" /><span>Pedir à IA</span></button>
      </div>
      <article className="lead-context-card"><div><small>ORIGEM</small><strong><span>⌘</span>{lead.origem || "Não informada"}</strong></div><div><small>PRODUTO DE INTERESSE</small><strong><span>▥</span>{currentProduct?.nome || "—"}</strong></div><p>ⓘ Origem e interesse são distintos — alimentam o BI de campanhas.</p><footer><small>Corretor responsável</small><strong><span>♧</span>{responsible?.nome || "Não definido"}</strong></footer></article>
      <article className="lead-funnel-status"><h4>ETAPA DO FUNIL</h4><div className="lead-stage-track">{stages.map((stage, index) => <i className={index <= stageIndex ? "active" : ""} style={{ "--lead-stage-color": stage.cor || "#8b00cc" } as CSSProperties} key={stage.id} />)}</div><select value={deal.stage_id ?? ""} disabled={busy} onChange={(event) => void run({ action: "moveDeal", dealId: deal.id, stageId: Number(event.target.value) }, "Etapa atualizada.")}>{stages.map((stage) => <option value={stage.id} key={stage.id}>{stage.rotulo || stage.nome}</option>)}</select><button type="button" onClick={() => setAction("discard")}>Descartar lead</button></article>
    </section>
    <nav className="drawer-tabs-v2">{[["resumo", "Resumo"], ["historico", "Histórico"], ["agenda", "Tarefas e visitas"], ["produtos", `Produtos (${links.length})`]].map(([key, label]) => <button className={tab === key ? "active" : ""} type="button" onClick={() => setTab(key as typeof tab)} key={key}>{label}</button>)}</nav><div className="drawer-content-v2">
        {tab === "resumo" && <><section className="drawer-overview"><article><span>Valor do negócio</span><strong>{deal.valor ? money.format(deal.valor) : "A definir"}</strong></article><article><span>Responsável</span><strong>{data.brokers.find((broker) => broker.id === (deal.corretor_id ?? lead.corretor_id))?.nome || "Não definido"}</strong></article><article><span>Origem</span><strong>{lead.origem || "Não informada"}</strong></article></section><section className="drawer-card-v2"><div className="drawer-section-title"><div><h3>Dados do lead</h3><p>Informações de contato e qualificação.</p></div><span>Salvo no Supabase</span></div><div className="drawer-form-v2"><label>Nome<input value={form.nome} onChange={(event) => setForm({ ...form, nome: event.target.value })} /></label><label>Telefone<input value={form.telefone} onChange={(event) => setForm({ ...form, telefone: event.target.value })} /></label><label>E-mail<input type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} /></label><label>Instagram<input value={form.instagram} onChange={(event) => setForm({ ...form, instagram: event.target.value })} /></label><label>Origem<input value={form.origem} onChange={(event) => setForm({ ...form, origem: event.target.value })} /></label><label>Status<input value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value })} /></label><label>Responsável<select value={form.corretor_id} onChange={(event) => setForm({ ...form, corretor_id: event.target.value })}><option value="">Sem responsável</option>{data.brokers.map((broker) => <option value={broker.id} key={broker.id}>{broker.nome}</option>)}</select></label><label>Valor do negócio<input inputMode="numeric" value={form.valor} onChange={(event) => setForm({ ...form, valor: event.target.value })} /></label><label className="wide">Tags<input value={form.tags} onChange={(event) => setForm({ ...form, tags: event.target.value })} placeholder="investidor, moema, retorno" /></label></div><button className="crm-primary small" disabled={busy} type="button" onClick={() => void Promise.all([run({ action: "updateLead", leadId: lead.id, lead: { ...form, corretor_id: form.corretor_id || null, tags: form.tags.split(",").map((item) => item.trim()).filter(Boolean) } }, "Dados do lead salvos."), run({ action: "updateDeal", dealId: deal.id, valor: form.valor }, "Dados do negócio salvos.")])}>Salvar alterações</button></section></>}
        {tab === "historico" && <section className="drawer-card-v2"><div className="drawer-section-title"><div><h3>Histórico do atendimento</h3><p>Tudo o que foi registrado com este lead.</p></div></div><div className="drawer-note-create"><textarea className="drawer-note" value={note} onChange={(event) => setNote(event.target.value)} placeholder="Escreva uma observação importante..." /><button disabled={busy || !note.trim()} type="button" onClick={() => void run({ action: "addNote", leadId: lead.id, dealId: deal.id, texto: note }, "Observação registrada.").then((saved) => { if (saved) setNote(""); })}>Registrar</button></div><div className="drawer-timeline-v2">{activities.map((item) => <article key={item.id}><span>{item.tipo === "observacao" ? "✎" : "↻"}</span><div><strong>{item.tipo.replaceAll("_", " ")}</strong><p>{item.texto || "Atividade registrada"}</p><time>{dateTime.format(new Date(item.criado_em))}</time></div></article>)}{activities.length === 0 && <div className="crm-empty-view compact">Ainda não há registros neste histórico.</div>}</div></section>}
        {tab === "agenda" && <><section className="drawer-card-v2"><div className="drawer-section-title"><div><h3>Nova tarefa</h3><p>Crie um próximo passo para o atendimento.</p></div></div><div className="drawer-task-create"><input className="drawer-task-title" value={task} onChange={(event) => setTask(event.target.value)} placeholder="Ex.: Retornar contato" /><input type="datetime-local" value={due} onChange={(event) => setDue(event.target.value)} /><button disabled={busy || !task.trim()} type="button" onClick={() => void run({ action: "createTask", leadId: lead.id, dealId: deal.id, titulo: task, vencimento: due, prioridade: "normal" }, "Tarefa criada.").then(() => { setTask(""); setDue(""); })}>Criar tarefa</button></div><div className="drawer-list-v2">{tasks.map((item) => <article className={item.concluida ? "done" : ""} key={item.id}><button disabled={busy} type="button" onClick={() => void run({ action: "toggleTask", taskId: item.id, completed: !item.concluida }, item.concluida ? "Tarefa reaberta." : "Tarefa concluída.")}>{item.concluida ? "✓" : ""}</button><div><strong>{item.titulo}</strong><small>{item.vencimento ? dateTime.format(new Date(item.vencimento)) : "Sem vencimento"}</small></div></article>)}</div></section><section className="drawer-card-v2"><div className="drawer-section-title"><div><h3>Visitas</h3><p>Visitas vinculadas a este negócio.</p></div><button type="button" onClick={() => setAction("visit")}>＋ Agendar</button></div><div className="drawer-visits-v2">{visits.map((item) => <article key={item.id}><div><strong>{shortDate.format(new Date(`${item.data}T12:00:00`))}</strong><span>{item.hora_inicio?.slice(0, 5) || "—"}</span></div><div><strong>{item.produto || "Produto não definido"}</strong><small>{item.local || item.status}</small></div></article>)}{visits.length === 0 && <div className="crm-empty-view compact">Nenhuma visita vinculada.</div>}</div></section></>}
        {tab === "produtos" && <section className="drawer-card-v2"><div className="drawer-section-title"><div><h3>Produtos de interesse</h3><p>Associe imóveis ao atendimento deste lead.</p></div></div><div className="drawer-product-link"><select value={productId} onChange={(event) => setProductId(event.target.value)}><option value="">Selecione um produto</option>{data.products.filter((item) => !linkedIds.has(item.id)).map((item) => <option value={item.id} key={item.id}>{item.nome} · {item.bairro || "sem bairro"}</option>)}</select><button disabled={busy || !productId} type="button" onClick={() => void run({ action: "linkProduct", leadId: lead.id, productId }, "Produto vinculado.").then((saved) => { if (saved) setProductId(""); })}>Vincular</button></div><div className="drawer-products-v2">{links.map((link) => <article key={link.empreendimento_id}><div><span>⌂</span><div><strong>{link.empreendimentos?.nome || "Produto"}</strong><small>{[link.empreendimentos?.bairro, link.empreendimentos?.cidade].filter(Boolean).join(" · ") || "Localização não informada"}</small></div></div><strong>{link.empreendimentos?.preco ? money.format(link.empreendimentos.preco) : "Sob consulta"}</strong><button disabled={busy} type="button" onClick={() => void run({ action: "unlinkProduct", leadId: lead.id, productId: link.empreendimento_id }, "Produto desvinculado.")}>×</button></article>)}{links.length === 0 && <div className="crm-empty-view compact">Nenhum produto vinculado.</div>}</div></section>}
      </div>
      {quickAction && <QuickActionModal action={quickAction} lead={lead} deal={deal} brokers={data.brokers} products={data.products} onClose={() => setQuickAction(null)} onSave={async (payload, endpoint) => { await callExternal(payload, endpoint); setQuickAction(null); }} />}
      {productOpen && chatData && <ProductSendModal data={chatData} canSend={Boolean(contact && dapi)} onClose={() => setProductOpen(false)} onSend={async (content, mediaId) => { if (!contact || !dapi) throw new Error("Este lead precisa de uma conversa e uma instância conectada."); await callExternal({ action: "send", leadId: lead.id, dealId: deal.id, phone: contact.telefone, instanceId: dapi.id, content, mediaId }); setProductOpen(false); }} />}
      {saleOpen && <LeadSaleModal accessToken={accessToken} deal={deal} products={data.products} onClose={() => setSaleOpen(false)} onDone={async () => { setSaleOpen(false); await onReload(); setMessage("Venda criada e enviada para o processo."); }} />}
      {action && <div className="drawer-action-modal"><form onSubmit={(event) => { event.preventDefault(); if (action === "visit") void run({ action: "createVisit", leadId: lead.id, dealId: deal.id, ...visit }, "Visita agendada.").then(() => setAction(null)); if (action === "transfer") void run({ action: "transferDeal", dealId: deal.id, brokerId: Number(transferBroker) }, "Negócio transferido.").then(() => setAction(null)); if (action === "discard") void run({ action: "discardDeal", dealId: deal.id, ...discard }, "Negócio descartado.").then(() => { setAction(null); onClose(); }); }}><header><div><h3>{action === "visit" ? "Agendar visita" : action === "transfer" ? "Transferir atendimento" : "Descartar negócio"}</h3><p>{action === "visit" ? "A visita ficará ligada a este lead e ao produto." : action === "transfer" ? "Escolha quem assumirá este atendimento." : "O negócio será movido para a etapa de descarte."}</p></div><button type="button" onClick={() => setAction(null)}>×</button></header>{action === "visit" && <div className="action-form-grid"><label>Data<input required type="date" value={visit.date} onChange={(event) => setVisit({ ...visit, date: event.target.value })} /></label><label>Início<input required type="time" value={visit.startTime} onChange={(event) => setVisit({ ...visit, startTime: event.target.value })} /></label><label>Fim<input type="time" value={visit.endTime} onChange={(event) => setVisit({ ...visit, endTime: event.target.value })} /></label><label>Produto<select value={visit.productId} onChange={(event) => setVisit({ ...visit, productId: event.target.value })}><option value="">Selecionar depois</option>{data.products.map((item) => <option value={item.id} key={item.id}>{item.nome}</option>)}</select></label><label className="wide">Local<input value={visit.local} onChange={(event) => setVisit({ ...visit, local: event.target.value })} placeholder="Preenchido pelo endereço do produto" /></label><label className="wide">Observações<textarea value={visit.observations} onChange={(event) => setVisit({ ...visit, observations: event.target.value })} /></label><label className="check"><input type="checkbox" checked={visit.reminder} onChange={(event) => setVisit({ ...visit, reminder: event.target.checked })} /> Criar lembrete</label><label className="check"><input type="checkbox" checked={visit.withManager} onChange={(event) => setVisit({ ...visit, withManager: event.target.checked })} /> Com gerente</label></div>}{action === "transfer" && <label>Corretor responsável<select required value={transferBroker} onChange={(event) => setTransferBroker(event.target.value)}><option value="">Selecione</option>{data.brokers.filter((broker) => broker.id !== deal.corretor_id).map((broker) => <option value={broker.id} key={broker.id}>{broker.nome}{broker.online ? " · online" : ""}</option>)}</select></label>}{action === "discard" && <><label>Motivo<select required value={discard.reason} onChange={(event) => setDiscard({ ...discard, reason: event.target.value })}><option value="">Selecione</option>{discardReasons.map((item) => <option key={item}>{item}</option>)}</select></label><label>Observação<textarea value={discard.observation} onChange={(event) => setDiscard({ ...discard, observation: event.target.value })} /></label></>}<footer><button type="button" onClick={() => setAction(null)}>Cancelar</button><button className={action === "discard" ? "danger" : ""} disabled={busy} type="submit">Confirmar</button></footer></form></div>}
    </aside></div>;
}

function LeadSaleModal({ accessToken, deal, products, onClose, onDone }: { accessToken: string; deal: Deal; products: Product[]; onClose: () => void; onDone: () => Promise<void> }) {
  const [productId, setProductId] = useState(deal.empreendimento_id || ""); const [value, setValue] = useState(String(deal.valor || "")); const [busy, setBusy] = useState(false); const [error, setError] = useState("");
  return <div className="crm-center-modal"><form onSubmit={(event) => { event.preventDefault(); setBusy(true); setError(""); void fetch("/api/crm/sales", { method: "PATCH", headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" }, body: JSON.stringify({ action: "create", dealId: deal.id, productId, vgv: Number(value) }) }).then(async (response) => { const result = await response.json() as { error?: string }; if (!response.ok) throw new Error(result.error); await onDone(); }).catch((reason) => setError(reason instanceof Error ? reason.message : "Não foi possível criar a venda.")).finally(() => setBusy(false)); }}><header><div><span>PROCESSO DE VENDA</span><h2>Enviar para processo de venda</h2><p>A venda entrará na esteira de contrato e documentação.</p></div><button type="button" onClick={onClose}>×</button></header>{error && <div className="modal-error">{error}</div>}<label>Produto<select required value={productId} onChange={(event) => setProductId(event.target.value)}><option value="">Selecione</option>{products.map((product) => <option value={product.id} key={product.id}>{product.nome}</option>)}</select></label><label>Valor da venda<input required min="1" type="number" value={value} onChange={(event) => setValue(event.target.value)} /></label><footer><button type="button" onClick={onClose}>Cancelar</button><button className="crm-primary" disabled={busy || !productId || !(Number(value) > 0)} type="submit">{busy ? "Salvando…" : "Criar venda"}</button></footer></form></div>;
}

function CreateLeadModal({ pipelines, brokers, initialPipelineId, sessionRole = "corretor", onClose, onCreate }: { pipelines: Pipeline[]; brokers: Broker[]; initialPipelineId: number | null; sessionRole?: "admin" | "gestor" | "corretor"; onClose: () => void; onCreate: (payload: Record<string, unknown>) => Promise<void> }) {
  const [form, setForm] = useState({ nome: "", telefone: "", email: "", origem: "manual", pipelineId: String(initialPipelineId ?? pipelines[0]?.id ?? ""), corretorId: "" }); const [busy, setBusy] = useState(false); const [error, setError] = useState<string | null>(null);
  return <div className="crm-center-modal"><form onSubmit={(event) => { event.preventDefault(); setBusy(true); setError(null); void onCreate({ ...form, pipelineId: Number(form.pipelineId), corretorId: form.corretorId || null }).catch((reason) => setError(reason instanceof Error ? reason.message : "Não foi possível criar o lead.")).finally(() => setBusy(false)); }}><header><div><span>NOVO ATENDIMENTO</span><h2>Cadastrar lead</h2><p>O negócio será criado automaticamente na primeira etapa.</p></div><button type="button" onClick={onClose}>×</button></header>{error && <div className="modal-error">{error}</div>}<div className="create-grid"><label>Nome<input required autoFocus value={form.nome} onChange={(event) => setForm({ ...form, nome: event.target.value })} placeholder="Nome do cliente" /></label><label>Telefone<input required value={form.telefone} onChange={(event) => setForm({ ...form, telefone: event.target.value })} placeholder="(11) 99999-9999" /></label><label>E-mail<input type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} /></label><label>Origem<input value={form.origem} onChange={(event) => setForm({ ...form, origem: event.target.value })} /></label><label>Funil<select required value={form.pipelineId} onChange={(event) => setForm({ ...form, pipelineId: event.target.value })}>{pipelines.map((pipeline) => <option value={pipeline.id} key={pipeline.id}>{pipeline.nome}</option>)}</select></label>{sessionRole !== "corretor" && <label>Responsável<select value={form.corretorId} onChange={(event) => setForm({ ...form, corretorId: event.target.value })}><option value="">Distribuição automática</option>{brokers.map((broker) => <option value={broker.id} key={broker.id}>{broker.nome}</option>)}</select></label>}</div>{sessionRole === "corretor" && <p className="quick-action-hint">Este lead será atribuído automaticamente a você.</p>}<footer><button type="button" onClick={onClose}>Cancelar</button><button className="crm-primary" disabled={busy} type="submit">{busy ? "Criando..." : "Criar lead"}</button></footer></form></div>;
}
