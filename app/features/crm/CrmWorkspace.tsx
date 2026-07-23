"use client";
/* eslint-disable react-hooks/purity, react-hooks/set-state-in-effect */

import { useEffect, useMemo, useRef, useState, type CSSProperties, type DragEvent, type MouseEvent as ReactMouseEvent } from "react";
import { getBrowserSupabaseClient } from "../../lib/supabase/browser";
import { MessageMedia, ProductSendModal, QuickActionModal, ScheduleModal, type ChatData, type QuickAction } from "../chat/LiveChatWorkspace";
import { ackState, StatusTick } from "../chat/statusTick";

// Fetch autenticado resiliente: usa o token fresco da sessão do Supabase e,
// se ainda vier 401, faz refresh e tenta 1x. Evita "Sessão inválida ou expirada".
async function authedFetch(input: RequestInfo | URL, init: RequestInit = {}): Promise<Response> {
  const supa = getBrowserSupabaseClient();
  const withTok = (t: string): RequestInit => ({ ...init, headers: { ...(init.headers as Record<string, string> | undefined), Authorization: `Bearer ${t}` } });
  let fresh: string | null = null;
  try { const { data } = await supa.auth.getSession(); fresh = data.session?.access_token ?? null; } catch { /* usa o header original */ }
  let response = await fetch(input, fresh ? withTok(fresh) : init);
  if (response.status === 401) {
    try { const { data } = await supa.auth.refreshSession(); if (data.session?.access_token) response = await fetch(input, withTok(data.session.access_token)); } catch { /* segue com 401 */ }
  }
  return response;
}

type Pipeline = { id: number; nome: string; grupo: string | null; ordem: number };
type Stage = { id: number; pipeline_id: number; nome: string; rotulo: string | null; ordem: number; cor: string | null; tipo: string; grupo: number | null; chave: string | null };
type Lead = { id: number; nome: string | null; telefone: string | null; email: string | null; instagram: string | null; corretor_id: number | null; pipeline_id: number | null; status: string; origem: string | null; tags: unknown; extras: unknown; criado_em: string; atualizado_em: string | null; disparo_optout: boolean };
type Deal = { id: number; lead_id: number; corretor_id: number | null; pipeline_id: number; stage_id: number | null; empreendimento_id: string | null; valor: number | null; status: string; motivo_perda: string | null; criado_em: string; ultima_movimentacao: string | null; estagio_desde: string | null; tentativa: number | null; max_tentativas: number | null };
type Broker = { id: number; nome: string; email: string | null; telefone: string | null; ativo: boolean; online: boolean; usuario_id: string | null };
type Activity = { id: number; lead_id: number | null; negocio_id: number | null; corretor_id: number | null; tipo: string; texto: string | null; criado_em: string };
type Task = { id: number; lead_id: number | null; negocio_id: number | null; corretor_id: number | null; titulo: string; descricao: string | null; vencimento: string | null; concluida: boolean; prioridade: string; criado_em: string };
type Product = { id: string; nome: string; bairro: string | null; cidade: string | null; status: string; preco: number | null; origem: string; rascunho: boolean };
type ProductLink = { lead_id: number; empreendimento_id: string; created_at: string; empreendimentos: Pick<Product, "id" | "nome" | "bairro" | "cidade" | "status" | "preco"> | null };
type Visit = { id: string; lead_id: number | null; negocio_id: number | null; corretor_id: number | null; cliente_nome: string | null; empreendimento_id: string | null; produto: string | null; unidade: string | null; data: string; hora_inicio: string | null; hora_fim: string | null; local: string | null; observacoes: string | null; participantes: string | null; lembrete: boolean; com_gerente: boolean; gerente_id: number | null; status: string; criado_em: string };
type Gerente = { id: number; nome: string; geral: boolean; corretor_id: number | null };
type SlaInfo = { negocio_id: number | null; lead_id: number | null; stage_id: number | null; sla_situacao: string | null; aguardando_humano: boolean | null; min_aguardando: number | null; min_no_estagio: number | null; min_sem_interacao: number | null; min_ativo_int: number | null; cor_ativa: string | null; alarme_ativo: boolean | null; ultima_interacao: string | null; cliente_ultima: string | null; humano_ultima: string | null };
type LeadAlert = { id: number; negocio_id: number; corretor_id: number | null; criado_em: string; reconhecido_em: string | null; reconhecido_por: string | null };
type ChatInstance = { key: string; sendBig: number | null; nome: string; conectada: boolean | null; corretor: string; numero?: string | null; conversaIds: string[]; msgs: number; ultima: string; dIn?: number; dTot?: number };
const last4 = (n?: string | null) => { const d = String(n || "").replace(/\D/g, ""); return d.length >= 4 ? d.slice(-4) : ""; };
type ChatMessage = { id: string; wa_message_id: string | null; conversa_id?: string; direcao: string; tipo: string; conteudo: string | null; media_url: string | null; criado_em: string | null; status?: string | number | null; status_detalhe?: string | null };

// Converte códigos técnicos de erro de envio em explicação clara para o corretor.
function friendlyChatError(raw: string): string {
  const s = (raw || "").toLowerCase();
  // O backend (dapi-enviar) já devolve motivos claros e específicos — repassamos.
  // Aqui só normalizamos TOKENS crus de erro; não reclassificamos por palavras soltas
  // como "instância"/"session" (isso fazia qualquer falha virar "reconecte o QR").
  if (s.includes("instancia_nao_resolvida")) return "Nenhuma instância de WhatsApp conectada para este corretor — conecte em Configurações → Conexões.";
  if (s.includes("telefone_invalido") || s === "invalid number") return "Número de telefone inválido.";
  if (s.includes("texto_vazio")) return "Escreva a mensagem antes de enviar.";
  if (s.includes("não foi encontrado no whatsapp") || s.includes("nao foi encontrado no whatsapp") || s.includes("not on whatsapp") || s.includes("not_registered") || s.includes("no account")) return "Este número não foi encontrado no WhatsApp (verifique o 9º dígito e o DDD).";
  if (s.includes("non-2xx") || s.includes("edge function returned") || s.includes("failed to send a request")) return "Não foi possível enviar agora — tente novamente em instantes.";
  return raw || "Não foi possível enviar a mensagem.";
}
type Historico = { id: number | string; lead_id: number | null; negocio_id: number | null; corretor_id: number | null; tipo: string; canal?: string | null; texto: string | null; resultado?: string | null; criado_em: string };
type CrmData = { pipelines: Pipeline[]; stages: Stage[]; leads: Lead[]; deals: Deal[]; brokers: Broker[]; activities: Activity[]; historico?: Historico[]; tasks: Task[]; productLinks: ProductLink[]; visits: Visit[]; products: Product[]; sla: SlaInfo[]; alerts: LeadAlert[]; gerentes?: Gerente[]; leituras?: Array<{ negocio_id: number; lido_em: string }> };
type ViewName = "pipeline" | "leads" | "sales" | "analytics" | "agenda" | "atividades";

const money = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
const dateTime = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
const shortDate = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short" });
const groupNames: Record<number, string> = { 1: "Entrada", 2: "Atendimento", 3: "Follow-up", 4: "Fechamento" };
const viewHeadings: Record<ViewName, { title: string; subtitle: string }> = {
  pipeline: { title: "CRM · Funil de vendas", subtitle: "Acompanhe cada lead da entrada ao fechamento" },
  leads: { title: "CRM · Leads", subtitle: "Consulte, filtre e atualize os leads da operação" },
  sales: { title: "CRM · Esteira de vendas", subtitle: "Vendas na esteira de contrato e documentação" },
  analytics: { title: "CRM · Analítico de funil", subtitle: "Conversão, tempo por etapa, motivos de perda e distribuição" },
  agenda: { title: "CRM · Agenda", subtitle: "Visitas, tarefas e próximos compromissos dos leads" },
  atividades: { title: "CRM · Atividades", subtitle: "Histórico comercial e movimentações da equipe" },
};
const discardReasons = ["Contato inválido", "Sem interesse", "Sem capacidade financeira", "Fora da região", "Já comprou", "Duplicado", "Pediu para não receber contato", "Produto incompatível"];

function tagList(tags: unknown) {
  if (Array.isArray(tags)) return tags.map((t) => typeof t === "string" ? t : (t && typeof t === "object" ? String((t as Record<string, unknown>).name ?? (t as Record<string, unknown>).nome ?? "") : String(t ?? ""))).filter(Boolean);
  if (tags && typeof tags === "object") return Object.entries(tags as Record<string, unknown>).filter(([, value]) => Boolean(value)).map(([key]) => key);
  return [];
}

function initials(name: string | null) {
  return (name || "Lead").split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase();
}

function leadPhoto(extras: unknown) {
  if (!extras || typeof extras !== "object") return null;
  const sources = [extras, ...(Object.values(extras as Record<string, unknown>).filter((value) => value && typeof value === "object"))];
  const keys = ["foto", "foto_url", "foto_perfil", "avatar", "avatar_url", "profile_picture", "profile_pic_url", "profilePicture", "picture", "picture_url", "photo", "photo_url", "image", "image_url"];
  for (const source of sources) {
    const record = source as Record<string, unknown>;
    for (const key of keys) {
      const value = record[key];
      if (typeof value === "string" && (/^https?:\/\//i.test(value) || value.startsWith("data:image/"))) return value;
    }
  }
  return null;
}

function LeadAvatar({ lead }: { lead: { nome: string | null; extras?: unknown } }) {
  const [failed, setFailed] = useState(false);
  const photo = leadPhoto(lead.extras);
  // A URL vem do cadastro do contato e pode pertencer a qualquer provedor externo.
  // eslint-disable-next-line @next/next/no-img-element
  return <span className="lead-avatar">{photo && !failed ? <img src={photo} alt="" loading="lazy" referrerPolicy="no-referrer" onError={() => setFailed(true)} /> : initials(lead.nome)}</span>;
}

function isOverdue(task: Task, now: number) {
  return !task.concluida && Boolean(task.vencimento) && new Date(task.vencimento!).getTime() < now;
}

/* Cor de alerta por DIAS sem interação (igual à esteira de vendas):
   até 1 dia = verde · mais de 1 dia = amarelo · mais de 3 = vermelho · mais de 7 = preto. */
function alertColorByDays(minutes: number | null | undefined) {
  const dias = (Number(minutes) || 0) / 1440;
  if (dias <= 1) return "verde";
  if (dias <= 3) return "amarelo";
  if (dias <= 7) return "vermelho";
  return "preto";
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

export function CrmWorkspace({ accessToken, initialDealId = null, onInitialDealHandled, initialChatDealId = null, onInitialChatHandled, initialView, initialCreateSale = false, onInitialViewHandled, sessionRole = "corretor", canReassign = false, canAssign = false }: { accessToken: string; initialDealId?: number | null; onInitialDealHandled?: () => void; initialChatDealId?: number | null; onInitialChatHandled?: () => void; initialView?: ViewName | null; initialCreateSale?: boolean; onInitialViewHandled?: () => void; sessionRole?: "admin" | "gestor" | "corretor"; canReassign?: boolean; canAssign?: boolean }) {
  const [launchSaleOnReady] = useState(initialCreateSale);
  const [data, setData] = useState<CrmData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<ViewName>(initialView ?? "pipeline");
  const [query, setQuery] = useState("");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [railCollapsed, setRailCollapsed] = useState(false);
  const [pipelineId, setPipelineId] = useState<number | null>(null);
  const [stageConfigOpen, setStageConfigOpen] = useState(false);
  const [stageId, setStageId] = useState<number | null>(null);
  const [brokerId, setBrokerId] = useState<number | null>(null);
  const [origin, setOrigin] = useState("");
  const [dateFrom, setDateFrom] = useState(""); /* Doc: filtro por data de entrada */
  const [dateTo, setDateTo] = useState("");
  const [productFilter, setProductFilter] = useState("");
  const [tag, setTag] = useState("");
  const [group, setGroup] = useState<number | null>(null);
  const [overdueOnly, setOverdueOnly] = useState(false);
  const [selectedDealId, setSelectedDealId] = useState<number | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [draggingDealId, setDraggingDealId] = useState<number | null>(null);
  const [bulkMoveOpen, setBulkMoveOpen] = useState(false);
  const [bulkFromStage, setBulkFromStage] = useState<number | null>(null);
  const [chatDealId, setChatDealId] = useState<number | null>(null);
  const [brokerPickerDealId, setBrokerPickerDealId] = useState<number | null>(null);
  const [stagePickerDealId, setStagePickerDealId] = useState<number | null>(null);
  const [respToast, setRespToast] = useState<{ dealId: number; nome: string } | null>(null);
  const prevWaitingRef = useRef<Set<number>>(new Set());
  const waitingInitRef = useRef(false);

  async function load({ quiet = false }: { quiet?: boolean } = {}) {
    if (!quiet) setLoading(true);
    setError(null);
    try {
      const response = await authedFetch("/api/crm", { headers: { Authorization: `Bearer ${accessToken}` } });
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
    const supabase = getBrowserSupabaseClient();
    const channel = supabase.channel("crm-live-updates")
      .on("postgres_changes", { event: "*", schema: "public", table: "negocios" }, () => { void load({ quiet: true }); })
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "wa_mensagens" }, () => { void load({ quiet: true }); })
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accessToken]);

  // #8 — cliente respondeu: som agradável + pop-up no canto quando um lead passa a "aguardando você".
  function playChime() {
    try {
      const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const ctx = new Ctx();
      const now = ctx.currentTime;
      [880, 1174.66].forEach((freq, i) => {
        const osc = ctx.createOscillator(); const gain = ctx.createGain();
        osc.type = "sine"; osc.frequency.value = freq; osc.connect(gain); gain.connect(ctx.destination);
        const t = now + i * 0.13;
        gain.gain.setValueAtTime(0, t); gain.gain.linearRampToValueAtTime(0.16, t + 0.02); gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.35);
        osc.start(t); osc.stop(t + 0.4);
      });
      window.setTimeout(() => { void ctx.close().catch(() => {}); }, 1200);
    } catch { /* som é best-effort (browser pode bloquear sem interação) */ }
  }
  useEffect(() => {
    if (!data) return;
    const current = new Set<number>();
    for (const s of data.sla ?? []) { if (s.aguardando_humano && s.negocio_id) current.add(s.negocio_id); }
    if (waitingInitRef.current) {
      const novos = [...current].filter((id) => !prevWaitingRef.current.has(id));
      if (novos.length) {
        const dealId = novos[novos.length - 1];
        const deal = (data.deals ?? []).find((d) => d.id === dealId);
        const nome = deal ? (leadById.get(deal.lead_id)?.nome ?? "Cliente") : "Cliente";
        playChime();
        setRespToast({ dealId, nome });
        window.setTimeout(() => setRespToast((cur) => (cur && cur.dealId === dealId ? null : cur)), 15000);
      }
    }
    prevWaitingRef.current = current;
    waitingInitRef.current = true;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data]);

  async function mutate(body: Record<string, unknown>) {
    const response = await authedFetch("/api/crm", { method: "PATCH", headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const result = await response.json() as { error?: string };
    if (!response.ok) throw new Error(result.error || "Não foi possível salvar.");
    await load({ quiet: true });
  }

  const leadById = useMemo(() => new Map((data?.leads ?? []).map((lead) => [lead.id, lead])), [data]);
  const brokerById = useMemo(() => new Map((data?.brokers ?? []).map((broker) => [broker.id, broker])), [data]);
  const activeStages = useMemo(() => (data?.stages ?? []).filter((stage) => stage.pipeline_id === pipelineId), [data, pipelineId]);
  const allTags = useMemo(() => [...new Set((data?.leads ?? []).flatMap((lead) => tagList(lead.tags)))].sort(), [data]);
  const origins = useMemo(() => [...new Set((data?.leads ?? []).map((lead) => lead.origem).filter((item): item is string => Boolean(item)))].sort(), [data]);
  const activeFilterCount = [stageId, brokerId, origin, tag, group, dateFrom, dateTo, productFilter].filter(Boolean).length;
  const slaByDeal = useMemo(() => new Map((data?.sla ?? []).filter((item) => item.negocio_id).map((item) => [item.negocio_id!, item])), [data]);
  const readByDeal = useMemo(() => new Map((data?.leituras ?? []).map((item) => [item.negocio_id, item.lido_em])), [data]);
  const filteredDeals = useMemo(() => (data?.deals ?? []).filter((deal) => {
    const lead = leadById.get(deal.lead_id);
    const stage = activeStages.find((item) => item.id === deal.stage_id);
    if (!lead || deal.pipeline_id !== pipelineId) return false;
    if (deal.status === "ganho") return false; // virou venda → saiu do funil, está na Esteira de vendas
    const sla = slaByDeal.get(deal.id);
    const overdue = Boolean(sla && (sla.alarme_ativo || sla.cor_ativa === "vermelho"));
    const haystack = `${lead.nome ?? ""} ${lead.telefone ?? ""} ${lead.email ?? ""}`.toLowerCase();
    return (!query || haystack.includes(query.toLowerCase())) && (!stageId || deal.stage_id === stageId)
      && (!brokerId || (deal.corretor_id ?? lead.corretor_id) === brokerId) && (!origin || lead.origem === origin)
      && (!tag || tagList(lead.tags).includes(tag)) && (!group || stage?.grupo === group) && (!overdueOnly || overdue)
      && (!dateFrom || (lead.criado_em ?? "") >= dateFrom) && (!dateTo || (lead.criado_em ?? "") <= `${dateTo}T23:59:59`)
      && (!productFilter || deal.empreendimento_id === productFilter);
  }), [data, leadById, activeStages, pipelineId, query, stageId, brokerId, origin, tag, group, overdueOnly, slaByDeal, dateFrom, dateTo, productFilter]);
  const overdueCount = useMemo(() => (data?.deals ?? []).filter((deal) => { const sla = slaByDeal.get(deal.id); return deal.pipeline_id === pipelineId && Boolean(sla && (sla.alarme_ativo || sla.cor_ativa === "vermelho")); }).length, [data, pipelineId, slaByDeal]);
  const visibleStages = useMemo(() => activeStages.filter((stage) => !group || stage.grupo === group), [activeStages, group]);
  const selectedDeal = data?.deals.find((deal) => deal.id === selectedDealId) ?? null;
  const selectedLead = selectedDeal ? leadById.get(selectedDeal.lead_id) ?? null : null;
  const pendingAlerts = data?.alerts ?? [];
  const viewHeading = viewHeadings[view];
  useEffect(() => {
    if (!initialDealId || !data) return;
    const deal = data.deals.find((item) => item.id === initialDealId);
    if (!deal) return;
    setView("pipeline"); setPipelineId(deal.pipeline_id); setSelectedDealId(deal.id); onInitialDealHandled?.();
  }, [initialDealId, data, onInitialDealHandled]);

  // Abre direto o chatzinho do lead quando chamado pela Central de atenção ("Abrir e atender")
  useEffect(() => {
    if (!initialChatDealId || !data) return;
    const deal = data.deals.find((item) => item.id === initialChatDealId);
    if (!deal) { onInitialChatHandled?.(); return; }
    setPipelineId(deal.pipeline_id); openChat(deal.id); onInitialChatHandled?.();
  }, [initialChatDealId, data]);

  useEffect(() => {
    if (!initialView) return;
    setView(initialView);
    onInitialViewHandled?.();
  }, [initialView, onInitialViewHandled]);

  function openDeal(dealId: number) {
    setSelectedDealId(dealId);
    if (pendingAlerts.some((alert) => alert.negocio_id === dealId)) void mutate({ action: "acknowledgeLead", dealId }).catch(() => undefined);
  }

  function openChat(dealId: number) {
    setChatDealId(dealId);
    // Marca como lida (abriu a conversa) — o sino passa de vermelho (não lida) para amarelo (lida sem resposta).
    void mutate({ action: "markRead", dealId }).catch(() => undefined);
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

  const canManageStages = sessionRole !== "corretor";
  const canMoveDeals = true; /* corretor também move os próprios leads (o RLS garante que ele só enxerga/mexe nos dele) */
  async function reorderStage(stageId: number, direction: number) {
    const ordered = activeStages.slice().sort((a, b) => a.ordem - b.ordem);
    const idx = ordered.findIndex((s) => s.id === stageId);
    const target = idx + direction;
    if (idx < 0 || target < 0 || target >= ordered.length) return;
    const ids = ordered.map((s) => s.id);
    [ids[idx], ids[target]] = [ids[target], ids[idx]];
    setMessage(null);
    const { error: rpcError } = await getBrowserSupabaseClient().rpc("crm_etapa_reordenar", { p_pipeline_id: pipelineId, p_ids: ids });
    if (rpcError) setMessage(rpcError.message); else { await load({ quiet: true }); setMessage("Ordem das etapas atualizada."); }
  }
  async function recolorStage(stageId: number, color: string) {
    const st = activeStages.find((s) => s.id === stageId);
    setMessage(null);
    const { error: rpcError } = await getBrowserSupabaseClient().rpc("crm_etapa_salvar", { p_id: stageId, p_nome: st?.rotulo || st?.nome, p_cor: color });
    if (rpcError) setMessage(rpcError.message); else { await load({ quiet: true }); setMessage("Cor da etapa atualizada."); }
  }
  async function saveStage(stageId: number, nome: string, color: string) {
    setMessage(null);
    const { error: rpcError } = await getBrowserSupabaseClient().rpc("crm_etapa_salvar", { p_id: stageId, p_nome: nome, p_cor: color });
    if (rpcError) setMessage(rpcError.message); else { await load({ quiet: true }); setMessage("Etapa atualizada."); }
  }
  function openBulkFromStage(stageId: number) { setBulkFromStage(stageId); setBulkMoveOpen(true); }

  return <div className="crm-v2">
    <header className="crm-v2-header">
      <div><span className="crm-eyebrow">GESTÃO COMERCIAL</span><h1>{viewHeading.title}</h1><p>{viewHeading.subtitle}</p></div>
      <div className="crm-header-actions"><label className="crm-search-v2"><span>⌕</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar nome, telefone ou e-mail" /></label><button className="crm-primary" type="button" onClick={() => { setMessage(null); setCreateOpen(true); }}>＋ Novo lead</button></div>
    </header>

    <section className="crm-command-bar">
      <nav aria-label="Visões do CRM">
        <button className={view === "pipeline" ? "active" : ""} onClick={() => setView("pipeline")} type="button"><span>▦</span> Funil</button>
        <button className={view === "leads" ? "active" : ""} onClick={() => setView("leads")} type="button"><span>☷</span> Leads</button>
        <button className={view === "sales" ? "active" : ""} onClick={() => setView("sales")} type="button"><span>◆</span> Esteira de vendas</button>
        <button className={view === "analytics" ? "active" : ""} onClick={() => setView("analytics")} type="button"><span>↗</span> Analítico</button>
        <button className={view === "agenda" ? "active" : ""} onClick={() => setView("agenda")} type="button"><span>□</span> Agenda</button>
        <button className={view === "atividades" ? "active" : ""} onClick={() => setView("atividades")} type="button"><span>↻</span> Atividades</button>
      </nav>
      <span className="crm-live">● Supabase conectado</span>
    </section>

    {view !== "sales" && <section className="crm-toolbar-v2">
      {view !== "pipeline" && <select aria-label="Funil" value={pipelineId ?? ""} onChange={(event) => { setPipelineId(Number(event.target.value)); setStageId(null); setGroup(null); }}>{(data?.pipelines ?? []).map((pipeline) => <option value={pipeline.id} key={pipeline.id}>{pipeline.nome}</option>)}</select>}
      {sessionRole !== "corretor" && <button className="stage-config-trigger" type="button" onClick={() => setStageConfigOpen(true)} title="Configurar funis e etapas">⚙ Etapas</button>}
      <button className={filtersOpen ? "crm-filter-trigger active" : "crm-filter-trigger"} type="button" onClick={() => setFiltersOpen(!filtersOpen)}>▽ Filtros {activeFilterCount > 0 && <b>{activeFilterCount}</b>}</button>
      <button className={overdueOnly ? "crm-overdue-trigger active" : "crm-overdue-trigger"} type="button" onClick={() => setOverdueOnly((v) => !v)} title="Mostrar apenas leads que estouraram o SLA">⏰ Leads Atrasados {overdueCount > 0 && <b>{overdueCount}</b>}</button>
      {view === "pipeline" && sessionRole !== "corretor" && <button className="crm-bulk-trigger" type="button" onClick={() => setBulkMoveOpen(true)}>⇄ Mover etapa inteira</button>}
      <span className="crm-result-count">{filteredDeals.length} negócios</span>
    </section>}
    {filtersOpen && view !== "sales" && <section className="crm-filter-sheet"><label>Etapa<select value={stageId ?? ""} onChange={(event) => setStageId(event.target.value ? Number(event.target.value) : null)}><option value="">Todas</option>{activeStages.map((stage) => <option value={stage.id} key={stage.id}>{stage.rotulo || stage.nome}</option>)}</select></label><label>Responsável<select value={brokerId ?? ""} onChange={(event) => setBrokerId(event.target.value ? Number(event.target.value) : null)}><option value="">Todos</option>{(data?.brokers ?? []).map((broker) => <option value={broker.id} key={broker.id}>{broker.nome}</option>)}</select></label><label>Origem<select value={origin} onChange={(event) => setOrigin(event.target.value)}><option value="">Todas</option>{origins.map((item) => <option key={item}>{item}</option>)}</select></label><label>Tag<select value={tag} onChange={(event) => setTag(event.target.value)}><option value="">Todas</option>{allTags.map((item) => <option key={item}>{item}</option>)}</select></label><label>Entrada de<input type="date" value={dateFrom} onChange={(event) => setDateFrom(event.target.value)} /></label><label>Entrada até<input type="date" value={dateTo} onChange={(event) => setDateTo(event.target.value)} /></label><label>Produto<select value={productFilter} onChange={(event) => setProductFilter(event.target.value)}><option value="">Todos</option>{(data?.products ?? []).map((product) => <option value={product.id} key={product.id}>{product.nome}</option>)}</select></label><button type="button" onClick={() => { setStageId(null); setBrokerId(null); setOrigin(""); setTag(""); setGroup(null); setDateFrom(""); setDateTo(""); setProductFilter(""); }}>Limpar</button></section>}
    {message && <div className="crm-toast" onClick={() => setMessage(null)}>{message}<button type="button">×</button></div>}
    {respToast && <div className="resp-toast" role="alert"><span className="resp-toast-bell"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9M10 21h4" /></svg></span><div className="resp-toast-body"><strong>{respToast.nome} respondeu</strong><small>Cliente aguardando você</small></div><button type="button" className="resp-toast-open" onClick={() => { const d = respToast.dealId; setRespToast(null); openChat(d); }}>Ver conversa</button><button type="button" className="resp-toast-x" aria-label="Fechar" onClick={() => setRespToast(null)}>×</button></div>}
    {loading && <div className="crm-loading"><span /><strong>Montando seu CRM com os dados reais…</strong></div>}
    {error && <div className="crm-error">{error}<button type="button" onClick={() => void load()}>Tentar novamente</button></div>}
    {!loading && !error && data && view === "pipeline" && <div className={`crm-pipe-layout ${railCollapsed ? "rail-collapsed" : ""}`}>
      <aside className="crm-pipe-rail"><div className="crm-pipe-rail-head"><span className="crm-pipe-rail-title">FUNIS</span><button type="button" className="crm-pipe-rail-toggle" title={railCollapsed ? "Expandir funis" : "Recolher funis"} aria-label={railCollapsed ? "Expandir funis" : "Recolher funis"} onClick={() => setRailCollapsed((prev) => !prev)}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">{railCollapsed ? <path d="M9 6l6 6-6 6" /> : <path d="M15 6l-6 6 6 6" />}</svg></button></div>{(data.pipelines ?? []).map((pipeline) => { const count = (data.deals ?? []).filter((deal) => deal.pipeline_id === pipeline.id && !["ganho", "perdido", "descartado"].includes(deal.status)).length; return <button type="button" key={pipeline.id} className={`crm-pipe-item ${pipeline.id === pipelineId ? "active" : ""}`} title={pipeline.nome} onClick={() => { setPipelineId(pipeline.id); setStageId(null); setGroup(null); }}><span className="crm-pipe-dot" /><strong>{pipeline.nome}</strong><em>{count}</em></button>; })}</aside>
      <PipelineViewEnhanced stages={visibleStages} allStages={activeStages} deals={filteredDeals} leadById={leadById} brokerById={brokerById} slaByDeal={slaByDeal} canReassign={canReassign} onReassign={setBrokerPickerDealId} onOpen={openDeal} onChat={openChat} onMutate={mutate} setMessage={setMessage} draggingId={draggingDealId} onDrag={setDraggingDealId} onDrop={dropDeal} canManageStages={canManageStages} onReorderStage={reorderStage} onRecolorStage={recolorStage} onSaveStage={saveStage} onBulkFromStage={openBulkFromStage} stageCount={activeStages.length} canMoveDeals={canMoveDeals} onPickStage={setStagePickerDealId} readByDeal={readByDeal} />
    </div>}
    {!loading && !error && data && view === "leads" && <LeadsViewEnhanced deals={filteredDeals} leadById={leadById} stages={activeStages} brokerById={brokerById} slaByDeal={slaByDeal} canReassign={canReassign} onReassign={setBrokerPickerDealId} onOpen={openDeal} onChat={openChat} onMutate={mutate} setMessage={setMessage} canMoveDeals={canMoveDeals} onPickStage={setStagePickerDealId} />}
    {!loading && !error && data && view === "agenda" && <AgendaView data={data} leadById={leadById} onMutate={mutate} setMessage={setMessage} sessionRole={sessionRole} accessToken={accessToken} />}
    {!loading && !error && data && view === "atividades" && <ActivitiesView data={data} leadById={leadById} brokerById={brokerById} onOpen={(leadId) => setSelectedDealId(data.deals.find((deal) => deal.lead_id === leadId)?.id ?? null)} />}
    {!loading && !error && data && view === "sales" && <SalesProcessView accessToken={accessToken} initialCreate={launchSaleOnReady} sessionRole={sessionRole} />}
    {!loading && !error && data && view === "analytics" && <AnalyticsView data={data} onOpen={(dealId) => setSelectedDealId(dealId)} />}
    {selectedDeal && selectedLead && data && <LeadDrawer key={selectedDeal.id} accessToken={accessToken} lead={selectedLead} deal={selectedDeal} data={data} canReassign={canReassign} canMoveDeals={canMoveDeals} onClose={() => { setSelectedDealId(null); setMessage(null); }} onMutate={mutate} onReload={() => load({ quiet: true })} setMessage={setMessage} />}
    {chatDealId && data && leadById.get(data.deals.find((deal) => deal.id === chatDealId)?.lead_id ?? -1) && <LeadChatDrawer key={chatDealId} accessToken={accessToken} lead={leadById.get(data.deals.find((deal) => deal.id === chatDealId)!.lead_id)!} deal={data.deals.find((deal) => deal.id === chatDealId)!} corretorNome={data.brokers.find((b) => b.id === leadById.get(data.deals.find((deal) => deal.id === chatDealId)!.lead_id)?.corretor_id)?.nome} onClose={() => setChatDealId(null)} onResponse={async () => { await mutate({ action: "acknowledgeResponse", dealId: chatDealId }); setMessage("Resposta registrada e alerta encerrado."); }} />}
    {stageConfigOpen && data && <StageConfigModal pipelines={data.pipelines} stages={data.stages} deals={data.deals} leads={data.leads} products={data.products} initialPipelineId={pipelineId} onClose={() => setStageConfigOpen(false)} onChanged={async () => { await load({ quiet: true }); }} />}
    {bulkMoveOpen && data && pipelineId && <BulkMoveModal pipelineId={pipelineId} stages={activeStages} deals={data.deals.filter((deal) => deal.pipeline_id === pipelineId)} initialFromStageId={bulkFromStage} onClose={() => { setBulkMoveOpen(false); setBulkFromStage(null); }} onMove={async (fromStageId, toStageId) => { await mutate({ action: "bulkMoveStage", pipelineId, fromStageId, toStageId }); setBulkMoveOpen(false); setBulkFromStage(null); setMessage("Todos os negócios da etapa foram movidos."); }} />}
    {createOpen && data && <CreateLeadModal pipelines={data.pipelines} brokers={data.brokers} initialPipelineId={pipelineId} canAssign={canAssign} onClose={() => { setCreateOpen(false); setMessage(null); }} onCreate={async (payload) => { await mutate({ action: "createLead", ...payload }); setCreateOpen(false); setMessage("Novo lead criado e inserido na primeira etapa."); }} />}
    {brokerPickerDealId && data && <BrokerPickerModal deal={data.deals.find((deal) => deal.id === brokerPickerDealId)!} lead={leadById.get(data.deals.find((deal) => deal.id === brokerPickerDealId)?.lead_id ?? -1)!} brokers={data.brokers} onClose={() => setBrokerPickerDealId(null)} onSave={async (brokerId) => { await mutate({ action: "transferDeal", dealId: brokerPickerDealId, brokerId }); setBrokerPickerDealId(null); setMessage("Corretor responsável atualizado."); }} />}
    {stagePickerDealId && data && (() => { const deal = data.deals.find((d) => d.id === stagePickerDealId); if (!deal) return null; const lead = leadById.get(deal.lead_id); const dealStages = activeStages.filter((s) => s.pipeline_id === deal.pipeline_id); return <StagePickerModal deal={deal} leadNome={lead?.nome ?? null} stages={dealStages.length ? dealStages : activeStages} onClose={() => setStagePickerDealId(null)} onSave={async (stageId) => { await mutate({ action: "moveDeal", dealId: stagePickerDealId, stageId }); setStagePickerDealId(null); setMessage("Etapa atualizada."); }} />; })()}
  </div>;
}

type SalesData = {
  sales: Array<{ id: string; created_at: string; data_venda: string; empreendimento_id: string | null; empreendimento_nome: string | null; vgv: number; forma_pgto: string | null; status: string; obs: string | null }>;
  processes: Array<{ id: string; venda_id: string; negocio_id: number | null; etapa: string; tipo_venda: string; responsavel_usuario_id: string | null; prazo_em: string | null; observacoes?: string | null; criado_em?: string; atualizado_em: string; aprovacao_status?: string; aprovacao_motivo?: string | null; solicitado_por?: string | null }>;
  deals: Array<{ id: number; venda_id: string | null; lead_id: number; corretor_id: number | null; empreendimento_id: string | null; valor: number | null; status: string }>;
  leads: Array<{ id: number; nome: string | null; telefone: string | null; email: string | null; corretor_id: number | null; tags: unknown; extras: unknown }>;
  products: Array<{ id: string; nome: string; origem: string; bairro: string | null; cidade: string | null }>;
  brokers: Array<{ id: number; nome: string; usuario_id: string | null; online: boolean }>;
  stages?: Array<{ id: string; slug: string; nome: string; cor: string; ordem: number; papel: string; sla_dias: number; resale: boolean; exige_docs?: boolean }>;
  etapaDocs?: Array<{ id: string; etapa_slug: string; nome: string; obrigatorio: boolean; ordem: number }>;
  anexos?: Array<{ id: string; processo_ref: string; negocio_id: number | null; etapa_slug: string | null; doc_nome: string | null; nome: string; path: string; mime: string | null; tamanho: number | null; criado_em: string; grupo?: string | null; status?: string; status_motivo?: string | null; obrigatorio?: boolean; observacao?: string | null; enviado_por?: string | null; revisado_por?: string | null; revisado_em?: string | null }>;
  users?: Array<{ id: string; nome: string; role: string }>;
  history?: Array<{ processo_id: string; etapa_de: string | null; etapa_para: string; movido_por: string | null; movido_em: string }>;
  verificacoes?: Array<{ id: string; processo_ref: string; etapa_slug: string; verificado_por: string | null; verificado_em: string }>;
  solicitacoes?: Array<{ id: string; negocio_id: number | null; corretor_id: number | null; solicitado_por: string | null; produto_id: string | null; vgv: number | null; forma_pgto: string | null; obs: string | null; status: string; criado_em: string }>;
  docModelo?: Array<{ id: string; grupo: string; nome: string; obrigatorio: boolean; ordem: number }>;
  condicoes?: Array<{ processo_ref: string; comprador_tem_conjuge: boolean; vendedor_tem_conjuge: boolean; valor_total: number | null; valor_entrada: number | null; data_entrada: string | null; valor_financiado: number | null; valor_fgts: number | null; valor_recursos_proprios: number | null; valor_parcelas_interm: number | null; qtd_parcelas: number | null; valor_parcela: number | null; valor_assinatura: number | null; valor_chaves: number | null; data_assinatura: string | null; data_conclusao: string | null; origem_recursos: Array<{ tipo: string; valor: number | string }> }>;
  comissao?: Array<{ processo_ref: string; percentual_total: number | null; valor_total: number | null; imobiliaria: string | null; forma_pgto: string | null; participantes: Array<{ nome: string; papel: string; percentual: number | string; valor: number | string }> }>;
  comissaoParcelas?: Array<{ id: string; processo_ref: string; valor: number | null; gatilho: string | null; data_prevista: string | null; data_efetiva: string | null; responsavel: string | null; status: string; ordem: number }>;
  observacoes?: Array<{ id: string; processo_ref: string; texto: string; autor: string | null; autor_nome: string | null; criado_em: string }>;
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

function SalesProcessView({ accessToken, initialCreate = false, sessionRole = "corretor" }: { accessToken: string; initialCreate?: boolean; sessionRole?: string }) {
  const [data, setData] = useState<SalesData | null>(null); const [error, setError] = useState<string | null>(null); const [filter, setFilter] = useState("all"); const [creating, setCreating] = useState(initialCreate); const [busy, setBusy] = useState(false); const [chatItem, setChatItem] = useState<{ lead: Lead; deal: Deal; corretorNome?: string } | null>(null); const [detailItem, setDetailItem] = useState<SalesData["processes"][number] | null>(null); const [menuStage, setMenuStage] = useState<string | null>(null); const [bulkFrom, setBulkFrom] = useState<string | null>(null); const [addingStage, setAddingStage] = useState(false); const [newStageName, setNewStageName] = useState("");
  const canManageStages = sessionRole !== "corretor";
  const load = async () => { const response = await authedFetch("/api/crm/sales", { headers: { Authorization: `Bearer ${accessToken}` } }); const result = await response.json() as SalesData & { error?: string }; if (!response.ok) throw new Error(result.error || "Não foi possível carregar as vendas."); setData(result); };
  const decideSolic = async (id: string, aprovar: boolean, motivo?: string) => { setBusy(true); setError(null); try { const response = await authedFetch("/api/crm/sales", { method: "PATCH", headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" }, body: JSON.stringify(aprovar ? { action: "aprovarSolicitacao", id } : { action: "recusarSolicitacao", id, motivo: motivo || "" }) }); const result = await response.json() as { error?: string }; if (!response.ok) throw new Error(result.error || "Não foi possível decidir a solicitação."); await load(); } catch (reason) { setError(reason instanceof Error ? reason.message : "Erro ao decidir a solicitação."); } finally { setBusy(false); } };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { void load().catch((reason) => setError(reason instanceof Error ? reason.message : "Erro ao carregar vendas.")); }, [accessToken]);
  const stageList = (data?.stages && data.stages.length) ? data.stages.slice().sort((a, b) => a.ordem - b.ordem).map((s) => ({ id: s.slug, dbId: s.id, name: s.nome, color: s.cor, role: s.papel, days: s.sla_dias, resale: s.resale })) : saleStages.map((s) => ({ ...s, dbId: null as string | null, resale: (s as { resale?: boolean }).resale ?? false }));
  const saleById = new Map((data?.sales ?? []).map((sale) => [sale.id, sale])); const dealBySale = new Map((data?.deals ?? []).filter((deal) => deal.venda_id).map((deal) => [deal.venda_id!, deal])); const leadById = new Map((data?.leads ?? []).map((lead) => [lead.id, lead])); const brokerById = new Map((data?.brokers ?? []).map((broker) => [broker.id, broker]));
  const finalSlugs = new Set(stageList.filter((s) => s.days === 0).map((s) => s.id));
  const visible = (data?.processes ?? []).filter((item) => !["pendente", "devolvida", "recusada"].includes(item.aprovacao_status ?? "aprovada") && (filter === "all" || item.tipo_venda === filter)); const overdue = visible.filter((item) => !finalSlugs.has(item.etapa) && Date.now() - new Date(item.atualizado_em).getTime() > ((stageList.find((stage) => stage.id === item.etapa)?.days || 99) * 86400000));
  const move = async (processId: string, stage: string) => { setBusy(true); setError(null); try { const response = await authedFetch("/api/crm/sales", { method: "PATCH", headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" }, body: JSON.stringify({ action: "move", processId, stage }) }); const result = await response.json() as { error?: string }; if (!response.ok) throw new Error(result.error || "Não foi possível mover a venda."); await load(); } catch (reason) { setError(reason instanceof Error ? reason.message : "Não foi possível mover a venda."); } finally { setBusy(false); } };
  const mutateStages = async (payload: Record<string, unknown>, success?: string) => { setBusy(true); setError(null); try { const response = await authedFetch("/api/crm/sales", { method: "PATCH", headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" }, body: JSON.stringify(payload) }); const result = await response.json() as { error?: string }; if (!response.ok) throw new Error(result.error || "Não foi possível salvar a etapa."); await load(); if (success) setError(null); } catch (reason) { setError(reason instanceof Error ? reason.message : "Não foi possível salvar a etapa."); } finally { setBusy(false); } };
  const reorderStage = (index: number, direction: number) => { const ordered = stageList.filter((s) => s.dbId); const target = index + direction; if (target < 0 || target >= ordered.length) return; const ids = ordered.map((s) => s.dbId as string); [ids[index], ids[target]] = [ids[target], ids[index]]; void mutateStages({ action: "reorderStages", ids }); };
  if (!data) return <div className="crm-loading"><span /><strong>Conectando a esteira de vendas…</strong></div>;
  return <section className="sales-process">
    <header><div><span>PÓS-FECHAMENTO</span><h2>Esteira de contrato & documentação</h2><p>Todas as vendas reais ligadas ao negócio, produto, cliente e responsável.</p></div><div className="sales-head-actions">{canManageStages && <button className="crm-secondary" type="button" onClick={() => { setAddingStage(true); setNewStageName(""); }}>＋ Nova etapa</button>}<button className="crm-primary" type="button" onClick={() => setCreating(true)}>＋ Nova venda</button></div></header>
    {canManageStages && (data?.solicitacoes ?? []).length > 0 && <div className="sales-approvals">
      <div className="sales-approvals-head"><strong>⏳ Solicitações aguardando sua aprovação</strong><span>{(data?.solicitacoes ?? []).length}</span></div>
      {(data?.solicitacoes ?? []).map((s) => {
        const deal = (data?.deals ?? []).find((d) => d.id === s.negocio_id);
        const lead = deal ? leadById.get(deal.lead_id) : null;
        const broker = brokerById.get(deal?.corretor_id ?? s.corretor_id ?? -1);
        const prod = (data?.products ?? []).find((p) => p.id === s.produto_id);
        return <div className="sales-approval-row" key={s.id}>
          <div className="sales-approval-info"><strong>{lead?.nome || `Negócio #${s.negocio_id}`}</strong><small>{prod?.nome || "Produto"} · {money.format(s.vgv || 0)} · corretor: {broker?.nome || "—"}</small></div>
          <div className="sales-approval-actions"><button className="crm-primary small" type="button" disabled={busy} onClick={() => void decideSolic(s.id, true)}>Aprovar</button><button type="button" disabled={busy} onClick={() => { const m = window.prompt("Motivo da recusa (opcional):", ""); if (m !== null) void decideSolic(s.id, false, m); }}>Recusar</button></div>
        </div>;
      })}
    </div>}
    {error && <div className="crm-error">{error}</div>}
    {addingStage && <div className="sales-add-stage"><input autoFocus value={newStageName} onChange={(event) => setNewStageName(event.target.value)} placeholder="Nome da nova etapa (ex.: Vistoria)" onKeyDown={(event) => { if (event.key === "Enter" && newStageName.trim()) { void mutateStages({ action: "createStage", nome: newStageName.trim() }); setAddingStage(false); } }} /><button type="button" className="crm-primary small" disabled={busy || !newStageName.trim()} onClick={() => { void mutateStages({ action: "createStage", nome: newStageName.trim() }); setAddingStage(false); }}>Criar etapa</button><button type="button" onClick={() => setAddingStage(false)}>Cancelar</button></div>}
    <div className="sales-kpis"><article><strong>{visible.length}</strong><span>em processo</span></article><article className="danger"><strong>{overdue.length}</strong><span>vendas atrasadas</span></article><article><strong>{visible.filter((item) => item.etapa === "minuta_env").length}</strong><span>aguardando assinatura</span></article><article><strong>{visible.filter((item) => ["doc_comp", "doc_vend"].includes(item.etapa)).length}</strong><span>documentos pendentes</span></article><article><strong>{visible.filter((item) => item.etapa === "pagamento").length}</strong><span>aguardando pagamento</span></article></div>
    <div className="sales-filter"><b>Tipo de venda</b>{[["all", "Todas"], ["revenda", "Revenda"], ["construtora", "Construtora"]].map(([id, label]) => <button className={filter === id ? "active" : ""} type="button" onClick={() => setFilter(id)} key={id}>{label}</button>)}<span>Corretor · Gerente · Jurídico · Financeiro</span></div>
    <div className="sales-kanban">{stageList.map((stage, stageIndex) => {
      const items = visible.filter((item) => item.etapa === stage.id && (!stage.resale || item.tipo_venda === "revenda"));
      const configurable = canManageStages && Boolean(stage.dbId);
      const orderableIndex = stageList.filter((s) => s.dbId).findIndex((s) => s.dbId === stage.dbId);
      const orderableTotal = stageList.filter((s) => s.dbId).length;
      return <article className="sales-stage" style={{ "--sale-stage": stage.color } as CSSProperties} onDragOver={(event) => event.preventDefault()} onDrop={(event) => { const id = event.dataTransfer.getData("text/process-id"); if (id && !busy) void move(id, stage.id); }} key={stage.id}>
        <header><i /><strong>{stage.name}</strong><div className="crm-stage-head-right"><span>{items.length}</span>{configurable && <button type="button" className="crm-stage-cog" title="Opções da etapa" onClick={() => setMenuStage(menuStage === stage.id ? null : stage.id)}>⋯</button>}</div></header><small>{stage.role} · SLA {stage.days ? `${stage.days}d` : "concluído"}</small>
        {configurable && menuStage === stage.id && <div className="crm-stage-menu">
          <div className="crm-stage-menu-row"><label className="crm-stage-color">Cor da etapa<input type="color" value={stage.color} onChange={(event) => void mutateStages({ action: "updateStage", stageId: stage.dbId, cor: event.target.value })} /></label></div>
          <div className="crm-stage-menu-row crm-stage-reorder"><button type="button" disabled={busy || orderableIndex <= 0} onClick={() => reorderStage(orderableIndex, -1)}>◀ Trás</button><button type="button" disabled={busy || orderableIndex < 0 || orderableIndex >= orderableTotal - 1} onClick={() => reorderStage(orderableIndex, 1)}>Frente ▶</button></div>
          <button type="button" className="crm-stage-bulk" onClick={() => { setMenuStage(null); setBulkFrom(stage.id); }}>⇄ Mover todas as vendas desta etapa</button>
          <div className="crm-stage-menu-row crm-stage-reorder"><button type="button" disabled={busy} onClick={() => { const nome = window.prompt("Novo nome da etapa:", stage.name); if (nome && nome.trim() && nome.trim() !== stage.name) void mutateStages({ action: "updateStage", stageId: stage.dbId, nome: nome.trim() }); }}>✎ Renomear</button><button type="button" className="crm-stage-danger" disabled={busy || items.length > 0} title={items.length > 0 ? "Mova as vendas antes de excluir" : "Excluir etapa"} onClick={() => { if (window.confirm(`Excluir a etapa "${stage.name}"?`)) void mutateStages({ action: "deleteStage", stageId: stage.dbId }); }}>🗑 Excluir</button></div>
        </div>}
        <div>{items.map((item) => {
          const sale = saleById.get(item.venda_id);
          const deal = dealBySale.get(item.venda_id);
          const lead = deal ? leadById.get(deal.lead_id) : null;
          const broker = brokerById.get(deal?.corretor_id ?? lead?.corretor_id ?? -1);
          const tags = tagList(lead?.tags).slice(0, 2);
          const late = overdue.some((entry) => entry.id === item.id);
          const minutesInStage = Math.max(0, (Date.now() - new Date(item.atualizado_em).getTime()) / 60000);
          const fallbackLead = { nome: sale?.empreendimento_nome || "Venda", extras: null };
          return <article className={late ? "sale-card late" : "sale-card"} role="button" tabIndex={0} title="Ver andamento da venda" draggable onDragStart={(event) => event.dataTransfer.setData("text/process-id", item.id)} onClick={() => setDetailItem(item)} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); setDetailItem(item); } }} key={item.id}>
            <div className={`sla-top-band ${late ? "vermelho" : "verde"}`} />
            <div className="sale-card-content">
              <div className="card-person"><LeadAvatar lead={lead ?? fallbackLead} /><div><strong>{lead?.nome || sale?.empreendimento_nome || "Venda"}</strong><small>{lead?.telefone || "Sem telefone"}</small></div></div>
              <div className="sale-card-broker"><span className={`presence ${broker?.online ? "online" : ""}`} /><strong>{broker?.nome || "Sem responsável"}</strong></div>
              <div className="sla-clock-v3"><b>{formatElapsed(minutesInStage)}</b><span>{late ? "em atraso nesta etapa" : "nesta etapa"}</span></div>
              <div className="card-context"><span>{sale?.empreendimento_nome || "Produto não informado"}</span><b>{money.format(sale?.vgv || 0)}</b></div>
              {tags.length > 0 && <div className="card-tags" aria-label="Tags do lead">{tags.map((tagItem) => <span key={tagItem}>{tagItem}</span>)}</div>}
              <small className="sale-kind">{item.tipo_venda === "revenda" ? "Revenda" : "Construtora"}</small>
            </div>
            <div className="sale-card-controls" onClick={(event) => event.stopPropagation()}>{lead && deal && <button type="button" className="sale-card-chat" onClick={() => setChatItem({ lead: lead as unknown as Lead, deal: deal as unknown as Deal, corretorNome: broker?.nome })}>Chat</button>}<select aria-label={`Mover ${lead?.nome || "venda"} para outra etapa`} disabled={busy} value={item.etapa} onChange={(event) => void move(item.id, event.target.value)}>{stageList.filter((target) => !target.resale || item.tipo_venda === "revenda").map((target) => <option value={target.id} key={target.id}>{target.name}</option>)}</select></div>
          </article>;
        })}{items.length === 0 && <div className="sales-drop">Solte uma venda aqui</div>}</div>
      </article>;
    })}</div>
    {creating && <CreateSaleModal data={data} accessToken={accessToken} onClose={() => setCreating(false)} onDone={async () => { setCreating(false); await load(); }} />}
    {chatItem && <LeadChatDrawer key={chatItem.deal.id} accessToken={accessToken} lead={chatItem.lead} deal={chatItem.deal} corretorNome={chatItem.corretorNome} onClose={() => setChatItem(null)} onResponse={async () => {}} />}
    {detailItem && (() => { const sale = saleById.get(detailItem.venda_id); const deal = dealBySale.get(detailItem.venda_id); const lead = deal ? leadById.get(deal.lead_id) : null; const broker = brokerById.get(deal?.corretor_id ?? lead?.corretor_id ?? -1); return <SaleDetailDrawer accessToken={accessToken} canApprove={canManageStages} process={detailItem} sale={sale} lead={lead} broker={broker} stageList={stageList} docModelo={data.docModelo ?? []} anexos={(data.anexos ?? []).filter((a) => a.processo_ref === detailItem.id)} condicao={(data.condicoes ?? []).find((c) => c.processo_ref === detailItem.id)} comissao={(data.comissao ?? []).find((c) => c.processo_ref === detailItem.id)} comissaoParcelas={(data.comissaoParcelas ?? []).filter((p) => p.processo_ref === detailItem.id)} observacoes={(data.observacoes ?? []).filter((o) => o.processo_ref === detailItem.id)} users={data.users ?? []} history={(data.history ?? []).filter((h) => h.processo_id === detailItem.id)} busy={busy} onReload={load} onMove={async (stage) => { await move(detailItem.id, stage); setDetailItem((cur) => cur ? { ...cur, etapa: stage } : cur); }} onChat={lead && deal ? () => { setDetailItem(null); setChatItem({ lead: lead as unknown as Lead, deal: deal as unknown as Deal, corretorNome: broker?.nome }); } : undefined} onClose={() => setDetailItem(null)} />; })()}
    {bulkFrom && <div className="crm-center-modal"><form onSubmit={(event) => event.preventDefault()}><header><div><span>AÇÃO EM MASSA</span><h2>Mover uma etapa inteira</h2><p>Todas as vendas de <b>{stageList.find((s) => s.id === bulkFrom)?.name}</b> serão enviadas para o destino escolhido.</p></div><button type="button" onClick={() => setBulkFrom(null)}>×</button></header><div className="bulk-move-grid"><label>Etapa de destino<select id="bulk-to" defaultValue=""><option value="">Selecione</option>{stageList.filter((s) => s.id !== bulkFrom).map((s) => <option value={s.id} key={s.id}>{s.name}</option>)}</select></label></div><footer><button type="button" onClick={() => setBulkFrom(null)}>Cancelar</button><button className="crm-primary" type="button" disabled={busy} onClick={() => { const to = (document.getElementById("bulk-to") as HTMLSelectElement | null)?.value; if (!to) { setError("Selecione a etapa de destino."); return; } void mutateStages({ action: "bulkMoveStage", fromSlug: bulkFrom, toSlug: to }); setBulkFrom(null); }}>Mover vendas</button></footer></form></div>}
  </section>;
}

type SaleStageItem = { id: string; dbId: string | null; name: string; color: string; role: string; days: number; resale: boolean };
const DOC_GRUPOS = [
  { key: "comprador", label: "Documentação do comprador", conjugeFlag: "comprador_tem_conjuge" as const, conjugeGrupo: "conjuge_comprador" },
  { key: "vendedor", label: "Documentação do vendedor", conjugeFlag: "vendedor_tem_conjuge" as const, conjugeGrupo: "conjuge_vendedor" },
  { key: "imovel", label: "Documentação do imóvel", conjugeFlag: null, conjugeGrupo: null },
] as const;
const GRUPO_LABEL: Record<string, string> = { comprador: "comprador", conjuge_comprador: "cônjuge do comprador", vendedor: "vendedor", conjuge_vendedor: "cônjuge do vendedor", imovel: "imóvel" };
const DOC_STATUS_LABEL: Record<string, string> = { pendente: "Pendente", anexado: "Anexado", em_analise: "Em análise", aprovado: "Aprovado", recusado: "Recusado", correcao: "Necessita correção" };
const ORIGEM_OPCOES = ["Recursos próprios", "Financiamento bancário", "FGTS", "Consórcio ou carta de crédito", "Permuta", "Outro"];
const COMISSAO_GATILHOS = ["Na entrada", "Na primeira parcela", "Na segunda parcela", "Na assinatura", "Na liberação do financiamento", "Na entrega das chaves", "Outra condição"];
const PARCELA_STATUS = ["previsto", "recebido", "atrasado", "cancelado"];

function SaleDetailDrawer({ accessToken, canApprove, process, sale, lead, broker, stageList, docModelo, anexos, condicao, comissao, comissaoParcelas, observacoes, users, history = [], busy, onReload, onMove, onChat, onClose }: { accessToken: string; canApprove?: boolean; process: SalesData["processes"][number]; sale?: SalesData["sales"][number]; lead?: SalesData["leads"][number] | null; broker?: SalesData["brokers"][number]; stageList: SaleStageItem[]; docModelo: NonNullable<SalesData["docModelo"]>; anexos: NonNullable<SalesData["anexos"]>; condicao?: NonNullable<SalesData["condicoes"]>[number]; comissao?: NonNullable<SalesData["comissao"]>[number]; comissaoParcelas: NonNullable<SalesData["comissaoParcelas"]>; observacoes: NonNullable<SalesData["observacoes"]>; users: NonNullable<SalesData["users"]>; history?: NonNullable<SalesData["history"]>; busy?: boolean; onReload: () => Promise<void>; onMove: (stage: string) => Promise<void>; onChat?: () => void; onClose: () => void }) {
  const stageName = (slug: string) => stageList.find((s) => s.id === slug)?.name || slug;
  const enteredAt = (slug: string) => { const rows = history.filter((h) => h.etapa_para === slug); return rows.length ? rows[rows.length - 1].movido_em : null; };
  const currentIndex = stageList.findIndex((s) => s.id === process.etapa);
  const stage = currentIndex >= 0 ? stageList[currentIndex] : undefined;
  const total = stageList.length;
  const done = currentIndex < 0 ? 0 : currentIndex;
  const pct = total > 1 ? Math.round((done / (total - 1)) * 100) : 0;
  const minutesInStage = Math.max(0, (Date.now() - new Date(process.atualizado_em).getTime()) / 60000);
  const overdue = stage && stage.days > 0 && minutesInStage > stage.days * 1440;
  const fmtDate = (value?: string | null) => value ? shortDate.format(new Date(`${value.slice(0, 10)}T12:00:00`)) : "—";
  const isRevenda = process.tipo_venda === "revenda";
  const track = stageList.filter((s) => !s.resale || isRevenda);
  const trackCurrent = track.findIndex((s) => s.id === process.etapa);
  const userName = (id?: string | null) => users.find((u) => u.id === id)?.nome || "—";

  const [tab, setTab] = useState<"andamento" | "docs" | "condicoes" | "comissao" | "obs">("andamento");
  const [wBusy, setWBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [obsText, setObsText] = useState("");
  const [novoDoc, setNovoDoc] = useState<Record<string, { nome: string; obrig: boolean; obs: string }>>({});
  const [cond, setCond] = useState(() => ({
    comprador_tem_conjuge: condicao?.comprador_tem_conjuge ?? false, vendedor_tem_conjuge: condicao?.vendedor_tem_conjuge ?? false,
    valor_total: condicao?.valor_total ?? "", valor_entrada: condicao?.valor_entrada ?? "", data_entrada: (condicao?.data_entrada ?? "")?.toString().slice(0, 10),
    valor_financiado: condicao?.valor_financiado ?? "", valor_fgts: condicao?.valor_fgts ?? "", valor_recursos_proprios: condicao?.valor_recursos_proprios ?? "",
    valor_parcelas_interm: condicao?.valor_parcelas_interm ?? "", qtd_parcelas: condicao?.qtd_parcelas ?? "", valor_parcela: condicao?.valor_parcela ?? "",
    valor_assinatura: condicao?.valor_assinatura ?? "", valor_chaves: condicao?.valor_chaves ?? "",
    data_assinatura: (condicao?.data_assinatura ?? "")?.toString().slice(0, 10), data_conclusao: (condicao?.data_conclusao ?? "")?.toString().slice(0, 10),
    origem_recursos: (Array.isArray(condicao?.origem_recursos) ? condicao!.origem_recursos : []) as Array<{ tipo: string; valor: number | string }>,
  }));
  const [com, setCom] = useState(() => ({
    percentual_total: comissao?.percentual_total ?? "", valor_total: comissao?.valor_total ?? "", imobiliaria: comissao?.imobiliaria ?? "", forma_pgto: comissao?.forma_pgto ?? "",
    participantes: (Array.isArray(comissao?.participantes) ? comissao!.participantes : []) as Array<{ nome: string; papel: string; percentual: number | string; valor: number | string }>,
    parcelas: comissaoParcelas.map((p) => ({ valor: p.valor ?? "", gatilho: p.gatilho ?? "", data_prevista: (p.data_prevista ?? "")?.toString().slice(0, 10), data_efetiva: (p.data_efetiva ?? "")?.toString().slice(0, 10), responsavel: p.responsavel ?? "", status: p.status ?? "previsto" })),
  }));

  const api = async (payload: Record<string, unknown>) => {
    const r = await authedFetch("/api/crm/sales", { method: "PATCH", headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    const j = await r.json() as { error?: string }; if (!r.ok) throw new Error(j.error || "Falha.");
  };
  const run = async (fn: () => Promise<void>) => { setWBusy(true); setError(null); try { await fn(); await onReload(); } catch (reason) { setError(reason instanceof Error ? reason.message : "Falha."); } finally { setWBusy(false); } };
  const upload = (file: File, grupo: string, docNome: string | null, obrigatorio: boolean, observacao: string) => run(async () => {
    const supabase = getBrowserSupabaseClient();
    const safe = file.name.replace(/[^\w.\-]+/g, "_");
    const path = `esteira/${process.id}/${grupo}/${Date.now()}_${safe}`;
    const { error: upErr } = await supabase.storage.from("esteira-docs").upload(path, file, { upsert: false });
    if (upErr) throw new Error(upErr.message);
    await api({ action: "addAnexo", processId: process.id, negocioId: process.negocio_id, grupo, docNome, obrigatorio, observacao, nome: file.name, path, mime: file.type, tamanho: file.size });
  });
  const removeAnexo = (id: string) => run(() => api({ action: "removeAnexo", anexoId: id }));
  const setStatus = (a: NonNullable<SalesData["anexos"]>[number], status: string) => { let motivo = ""; if (status === "recusado" || status === "correcao") { motivo = window.prompt(`Motivo (${DOC_STATUS_LABEL[status]}):`, a.status_motivo || "") || ""; if (!motivo.trim()) return; } void run(() => api({ action: "docStatus", anexoId: a.id, status, motivo })); };
  const abrir = async (path: string) => { const { data } = await getBrowserSupabaseClient().storage.from("esteira-docs").createSignedUrl(path, 300); if (data?.signedUrl) window.open(data.signedUrl, "_blank"); };
  const baixar = async (path: string, nome: string) => { const { data } = await getBrowserSupabaseClient().storage.from("esteira-docs").createSignedUrl(path, 300, { download: nome }); if (data?.signedUrl) window.open(data.signedUrl, "_blank"); };
  const saveCondicoes = () => run(() => api({ action: "salvarCondicoes", processId: process.id, ...cond }));
  const saveComissao = () => run(() => api({ action: "salvarComissao", processId: process.id, ...com }));
  const addObs = () => { if (!obsText.trim()) return; void run(async () => { await api({ action: "addObs", processId: process.id, texto: obsText.trim() }); setObsText(""); }); };
  const devolverFunil = () => { const motivo = window.prompt("Devolver este cliente ao funil de atendimento (follow-up). Motivo (opcional):", ""); if (motivo === null) return; void run(async () => { await api({ action: "devolverFunil", processId: process.id, motivo }); onClose(); }); };
  const busyAll = busy || wBusy;

  // grupos ativos conforme cônjuge
  const gruposAtivos = ["comprador", "vendedor", "imovel", ...(cond.comprador_tem_conjuge ? ["conjuge_comprador"] : []), ...(cond.vendedor_tem_conjuge ? ["conjuge_vendedor"] : [])];
  const anexoDe = (grupo: string, nome: string) => anexos.find((a) => a.grupo === grupo && a.doc_nome === nome);
  const aprovadoDe = (grupo: string, nome: string) => { const a = anexoDe(grupo, nome); return a?.status === "aprovado"; };
  // motivos de bloqueio (espelha o servidor)
  const blockReasons: string[] = [];
  const faltaGrupo: Record<string, number> = {};
  gruposAtivos.forEach((g) => { docModelo.filter((d) => d.grupo === g && d.obrigatorio).forEach((d) => { if (!aprovadoDe(g, d.nome)) faltaGrupo[g] = (faltaGrupo[g] || 0) + 1; }); });
  const avulsosFalt = anexos.filter((a) => a.obrigatorio && a.status !== "aprovado").length;
  const partesFalta = Object.entries(faltaGrupo).map(([g, n]) => `${n} ${GRUPO_LABEL[g]}`);
  if (avulsosFalt) partesFalta.push(`${avulsosFalt} adicional(is)`);
  if (partesFalta.length) blockReasons.push(`Documentos obrigatórios pendentes de aprovação: ${partesFalta.join(", ")}`);
  if (cond.valor_total === "" || cond.valor_total == null) blockReasons.push("Condições comerciais (valor total) não preenchidas");
  const docsAnexados = anexos.length;
  const docsPendentes = Object.values(faltaGrupo).reduce((a, b) => a + b, 0) + avulsosFalt;

  const somaOrigem = cond.origem_recursos.reduce((sum, o) => sum + (Number(o.valor) || 0), 0);
  const totalCond = Number(cond.valor_total) || 0;
  const somaFecha = totalCond > 0 && Math.abs(somaOrigem - totalCond) < 0.01;

  const nextStage = trackCurrent >= 0 && trackCurrent < track.length - 1 ? track[trackCurrent + 1] : null;

  const DocRow = ({ grupo, nome, obrigatorio, modelo }: { grupo: string; nome: string; obrigatorio: boolean; modelo: boolean }) => {
    const a = anexoDe(grupo, nome);
    return <div className={`docx-row ${a ? `st-${a.status}` : "st-pendente"}`}>
      <div className="docx-main">
        <strong>{nome}</strong>
        <small>{obrigatorio ? "Obrigatório" : "Opcional"}{a ? ` · ${a.nome} · ${userName(a.enviado_por)} · ${dateTime.format(new Date(a.criado_em))}` : ""}</small>
        {a?.status_motivo && (a.status === "recusado" || a.status === "correcao") && <em className="docx-motivo">⚠ {a.status_motivo}</em>}
      </div>
      <span className={`docx-status st-${a?.status || "pendente"}`}>{a ? DOC_STATUS_LABEL[a.status || "anexado"] : "Pendente"}</span>
      <div className="docx-actions">
        {a ? <>
          <button type="button" title="Abrir" onClick={() => void abrir(a.path)}>👁</button>
          <button type="button" title="Baixar" onClick={() => void baixar(a.path, a.nome)}>⬇</button>
          <label title="Substituir" className="docx-replace">⟳<input type="file" hidden disabled={busyAll} onChange={(e) => { const f = e.target.files?.[0]; if (f) void run(async () => { await api({ action: "removeAnexo", anexoId: a.id }); const supabase = getBrowserSupabaseClient(); const safe = f.name.replace(/[^\w.\-]+/g, "_"); const path = `esteira/${process.id}/${grupo}/${Date.now()}_${safe}`; const { error: ue } = await supabase.storage.from("esteira-docs").upload(path, f); if (ue) throw new Error(ue.message); await api({ action: "addAnexo", processId: process.id, negocioId: process.negocio_id, grupo, docNome: nome, obrigatorio, nome: f.name, path, mime: f.type, tamanho: f.size }); }); e.target.value = ""; }} /></label>
          <button type="button" title="Excluir" className="docx-del" disabled={busyAll} onClick={() => removeAnexo(a.id)}>🗑</button>
          {canApprove && <select className="docx-statussel" value={a.status || "anexado"} disabled={busyAll} onChange={(e) => setStatus(a, e.target.value)} title="Alterar status">{["anexado", "em_analise", "aprovado", "recusado", "correcao"].map((s) => <option value={s} key={s}>{DOC_STATUS_LABEL[s]}</option>)}</select>}
        </> : <label className="docx-up">📎 Anexar<input type="file" hidden disabled={busyAll} onChange={(e) => { const f = e.target.files?.[0]; if (f) upload(f, grupo, modelo ? nome : null, obrigatorio, ""); e.target.value = ""; }} /></label>}
      </div>
    </div>;
  };

  return <div className="sale-full-layer">
    <div className="sale-full">
      <header className="sale-full-top">
        <div className="sale-full-title"><span className="sale-full-kicker">ESTEIRA DE VENDAS · NEGOCIAÇÃO</span><h2>{lead?.nome || sale?.empreendimento_nome || "Venda"}</h2><p>{sale?.empreendimento_nome || "Produto não informado"}{lead?.telefone ? ` · ☎ ${lead.telefone}` : ""}</p></div>
        <button className="sale-full-close" type="button" onClick={onClose} aria-label="Fechar">×</button>
      </header>

      <div className="sale-full-kpis">
        <div><small>ETAPA ATUAL</small><strong>{stage?.name || process.etapa}</strong><span>{stage?.role || "—"}</span></div>
        <div><small>TEMPO NA ETAPA</small><strong className={overdue ? "late" : ""}>{formatElapsed(minutesInStage)}</strong><span>{overdue ? "em atraso" : `SLA ${stage?.days ?? 0}d`}</span></div>
        <div><small>PRÓXIMA ETAPA</small><strong>{nextStage?.name || "—"}</strong><span>{nextStage?.role || "conclusão"}</span></div>
        <div><small>DOCUMENTOS</small><strong>{docsAnexados}</strong><span>{docsPendentes} obrigatórios pendentes</span></div>
        <div><small>VALOR (VGV)</small><strong>{money.format(totalCond || sale?.vgv || 0)}</strong><span>{cond.valor_total ? "condições" : "da venda"}</span></div>
        <div className={blockReasons.length ? "block on" : "block"}><small>AVANÇO</small><strong>{blockReasons.length ? "Bloqueado" : "Liberado"}</strong><span>{blockReasons.length ? "ver motivo abaixo" : "etapa concluída"}</span></div>
      </div>

      {blockReasons.length > 0 && <div className="sale-full-block">🔒 <b>Motivo do bloqueio:</b> {blockReasons.join("; ")}.</div>}
      {error && <div className="sale-full-error">{error}</div>}

      <nav className="sale-full-tabs">
        {([["andamento", "Andamento"], ["docs", "Documentação"], ["condicoes", "Condições comerciais"], ...(canApprove ? [["comissao", "Comissão"]] : []), ["obs", "Observações"]] as Array<[string, string]>).map(([k, l]) => <button key={k} type="button" className={tab === k ? "active" : ""} onClick={() => setTab(k as typeof tab)}>{l}</button>)}
      </nav>

      <div className="sale-full-body">
        {tab === "andamento" && <div className="sale-full-pane">
          <div className="sale-detail-grid">
            <div><small>FORMA DE PAGAMENTO</small><strong>{sale?.forma_pgto || "—"}</strong></div>
            <div><small>TIPO</small><strong>{isRevenda ? "Revenda" : "Construtora"}</strong></div>
            <div><small>DATA DA VENDA</small><strong>{fmtDate(sale?.data_venda)}</strong></div>
            <div><small>RESPONSÁVEL</small><strong>{broker?.nome || "Não definido"}</strong></div>
          </div>
          <div className="sale-detail-progress big"><i style={{ width: `${pct}%`, background: stage?.color || "#7c3aed" }} /></div>
          <ol className="sale-timeline">{track.map((s, i) => { const state = trackCurrent < 0 ? "todo" : i < trackCurrent ? "done" : i === trackCurrent ? "current" : "todo"; const ent = enteredAt(s.id); return <li className={`sale-tl ${state}`} style={{ "--tl": s.color } as CSSProperties} key={s.id}><i />{i < track.length - 1 && <u />}<div><strong>{s.name}</strong><small>{s.role}{s.days ? ` · SLA ${s.days}d` : " · conclusão"}{ent ? ` · ${state === "current" ? "desde" : "entrou"} ${shortDate.format(new Date(ent))}` : ""}</small></div>{i === trackCurrent && <em>Aqui</em>}{state === "done" && <b>✓</b>}</li>; })}</ol>
          {history.length > 0 && <><h4>HISTÓRICO DE MOVIMENTAÇÕES</h4><ul className="sale-moves">{history.slice().reverse().map((h, i) => <li key={i}><b>{dateTime.format(new Date(h.movido_em))}</b><span>{h.etapa_de ? `${stageName(h.etapa_de)} → ${stageName(h.etapa_para)}` : `Entrou em ${stageName(h.etapa_para)}`}{h.movido_por ? ` · ${userName(h.movido_por)}` : ""}</span></li>)}</ul></>}
        </div>}

        {tab === "docs" && <div className="sale-full-pane">
          {DOC_GRUPOS.map((g) => <section className="docx-group" key={g.key}>
            <header><h3>{g.label}</h3>{g.conjugeFlag && <div className="docx-conjuge"><span>Possui cônjuge?</span><button type="button" className={cond[g.conjugeFlag] ? "on" : ""} disabled={busyAll} onClick={() => { const v = { ...cond, [g.conjugeFlag]: true }; setCond(v); void run(() => api({ action: "salvarCondicoes", processId: process.id, ...v })); }}>Sim</button><button type="button" className={!cond[g.conjugeFlag] ? "on" : ""} disabled={busyAll} onClick={() => { const v = { ...cond, [g.conjugeFlag]: false }; setCond(v); void run(() => api({ action: "salvarCondicoes", processId: process.id, ...v })); }}>Não</button></div>}</header>
            {docModelo.filter((d) => d.grupo === g.key).map((d) => <DocRow key={d.id} grupo={g.key} nome={d.nome} obrigatorio={d.obrigatorio} modelo />)}
            {anexos.filter((a) => a.grupo === g.key && !docModelo.some((d) => d.grupo === g.key && d.nome === a.doc_nome)).map((a) => <DocRow key={a.id} grupo={g.key} nome={a.doc_nome || a.nome} obrigatorio={a.obrigatorio} modelo={false} />)}
            <DocAddRow busy={busyAll} value={novoDoc[g.key]} onChange={(v) => setNovoDoc((c) => ({ ...c, [g.key]: v }))} onUpload={(f, nome, obrig, obs) => { upload(f, g.key, nome, obrig, obs); setNovoDoc((c) => ({ ...c, [g.key]: { nome: "", obrig: true, obs: "" } })); }} />
            {g.conjugeGrupo && cond[g.conjugeFlag] && <div className="docx-conjuge-area">
              <h4>Documentos do {GRUPO_LABEL[g.conjugeGrupo]}</h4>
              {docModelo.filter((d) => d.grupo === g.conjugeGrupo).map((d) => <DocRow key={d.id} grupo={g.conjugeGrupo!} nome={d.nome} obrigatorio={d.obrigatorio} modelo />)}
              {anexos.filter((a) => a.grupo === g.conjugeGrupo && !docModelo.some((d) => d.grupo === g.conjugeGrupo && d.nome === a.doc_nome)).map((a) => <DocRow key={a.id} grupo={g.conjugeGrupo!} nome={a.doc_nome || a.nome} obrigatorio={a.obrigatorio} modelo={false} />)}
              <DocAddRow busy={busyAll} value={novoDoc[g.conjugeGrupo]} onChange={(v) => setNovoDoc((c) => ({ ...c, [g.conjugeGrupo!]: v }))} onUpload={(f, nome, obrig, obs) => { upload(f, g.conjugeGrupo!, nome, obrig, obs); setNovoDoc((c) => ({ ...c, [g.conjugeGrupo!]: { nome: "", obrig: true, obs: "" } })); }} />
            </div>}
          </section>)}
        </div>}

        {tab === "condicoes" && <div className="sale-full-pane">
          <section className="condx">
            <h3>Informações gerais</h3>
            <div className="condx-grid">
              {([["valor_total", "Valor total da venda"], ["valor_entrada", "Valor de entrada"], ["data_entrada", "Data da entrada", "date"], ["valor_financiado", "Valor financiado"], ["valor_fgts", "Valor de FGTS"], ["valor_recursos_proprios", "Recursos próprios"], ["valor_parcelas_interm", "Parcelas intermediárias"], ["qtd_parcelas", "Qtd. de parcelas"], ["valor_parcela", "Valor de cada parcela"], ["valor_assinatura", "Pago na assinatura"], ["valor_chaves", "Pago na entrega das chaves"], ["data_assinatura", "Data prevista assinatura", "date"], ["data_conclusao", "Data prevista conclusão", "date"]] as Array<[string, string, string?]>).map(([k, l, t]) => <label key={k}>{l}<input type={t || "number"} value={(cond as Record<string, unknown>)[k] as string ?? ""} onChange={(e) => setCond({ ...cond, [k]: e.target.value })} /></label>)}
            </div>
            <h3>Origem dos recursos</h3>
            <div className="condx-origem">{ORIGEM_OPCOES.map((op) => { const sel = cond.origem_recursos.find((o) => o.tipo === op); return <div className={`condx-origem-row ${sel ? "on" : ""}`} key={op}>
              <label><input type="checkbox" checked={!!sel} onChange={(e) => { const list = e.target.checked ? [...cond.origem_recursos, { tipo: op, valor: "" }] : cond.origem_recursos.filter((o) => o.tipo !== op); setCond({ ...cond, origem_recursos: list }); }} />{op}</label>
              {sel && <input type="number" placeholder="Valor" value={sel.valor} onChange={(e) => setCond({ ...cond, origem_recursos: cond.origem_recursos.map((o) => o.tipo === op ? { ...o, valor: e.target.value } : o) })} />}
            </div>; })}</div>
            {cond.origem_recursos.length > 0 && <div className={`condx-soma ${somaFecha ? "ok" : "warn"}`}>Soma das formas: <b>{money.format(somaOrigem)}</b> · Valor total: <b>{money.format(totalCond)}</b> — {totalCond <= 0 ? "informe o valor total" : somaFecha ? "✓ valores fecham" : `⚠ diferença de ${money.format(Math.abs(somaOrigem - totalCond))}`}</div>}
            <footer><button type="button" className="crm-primary" disabled={busyAll} onClick={saveCondicoes}>Salvar condições</button></footer>
          </section>
        </div>}

        {tab === "comissao" && canApprove && <div className="sale-full-pane">
          <section className="condx">
            <div className="condx-grid">
              <label>Percentual total (%)<input type="number" value={com.percentual_total as string} onChange={(e) => setCom({ ...com, percentual_total: e.target.value })} /></label>
              <label>Valor total da comissão<input type="number" value={com.valor_total as string} onChange={(e) => setCom({ ...com, valor_total: e.target.value })} /></label>
              <label>Imobiliária responsável<input value={com.imobiliaria as string} onChange={(e) => setCom({ ...com, imobiliaria: e.target.value })} /></label>
              <label>Forma de pagamento<input value={com.forma_pgto as string} onChange={(e) => setCom({ ...com, forma_pgto: e.target.value })} /></label>
            </div>
            <h3>Participantes</h3>
            {com.participantes.map((p, i) => <div className="condx-part" key={i}>
              <input placeholder="Nome" value={p.nome} onChange={(e) => setCom({ ...com, participantes: com.participantes.map((x, j) => j === i ? { ...x, nome: e.target.value } : x) })} />
              <input placeholder="Papel" value={p.papel} onChange={(e) => setCom({ ...com, participantes: com.participantes.map((x, j) => j === i ? { ...x, papel: e.target.value } : x) })} />
              <input type="number" placeholder="%" value={p.percentual} onChange={(e) => setCom({ ...com, participantes: com.participantes.map((x, j) => j === i ? { ...x, percentual: e.target.value } : x) })} />
              <input type="number" placeholder="Valor" value={p.valor} onChange={(e) => setCom({ ...com, participantes: com.participantes.map((x, j) => j === i ? { ...x, valor: e.target.value } : x) })} />
              <button type="button" onClick={() => setCom({ ...com, participantes: com.participantes.filter((_, j) => j !== i) })}>×</button>
            </div>)}
            <button type="button" className="condx-add" onClick={() => setCom({ ...com, participantes: [...com.participantes, { nome: "", papel: "", percentual: "", valor: "" }] })}>＋ Adicionar participante</button>
            <h3>Parcelas da comissão</h3>
            {com.parcelas.map((p, i) => <div className="condx-parc" key={i}>
              <input type="number" placeholder="Valor" value={p.valor} onChange={(e) => setCom({ ...com, parcelas: com.parcelas.map((x, j) => j === i ? { ...x, valor: e.target.value } : x) })} />
              <select value={p.gatilho} onChange={(e) => setCom({ ...com, parcelas: com.parcelas.map((x, j) => j === i ? { ...x, gatilho: e.target.value } : x) })}><option value="">Gatilho…</option>{COMISSAO_GATILHOS.map((g) => <option key={g}>{g}</option>)}</select>
              <input type="date" title="Prevista" value={p.data_prevista} onChange={(e) => setCom({ ...com, parcelas: com.parcelas.map((x, j) => j === i ? { ...x, data_prevista: e.target.value } : x) })} />
              <input type="date" title="Efetiva" value={p.data_efetiva} onChange={(e) => setCom({ ...com, parcelas: com.parcelas.map((x, j) => j === i ? { ...x, data_efetiva: e.target.value } : x) })} />
              <input placeholder="Responsável" value={p.responsavel} onChange={(e) => setCom({ ...com, parcelas: com.parcelas.map((x, j) => j === i ? { ...x, responsavel: e.target.value } : x) })} />
              <select value={p.status} onChange={(e) => setCom({ ...com, parcelas: com.parcelas.map((x, j) => j === i ? { ...x, status: e.target.value } : x) })}>{PARCELA_STATUS.map((s) => <option key={s} value={s}>{s}</option>)}</select>
              <button type="button" onClick={() => setCom({ ...com, parcelas: com.parcelas.filter((_, j) => j !== i) })}>×</button>
            </div>)}
            <button type="button" className="condx-add" onClick={() => setCom({ ...com, parcelas: [...com.parcelas, { valor: "", gatilho: "", data_prevista: "", data_efetiva: "", responsavel: "", status: "previsto" }] })}>＋ Adicionar parcela</button>
            <footer><button type="button" className="crm-primary" disabled={busyAll} onClick={saveComissao}>Salvar comissão</button></footer>
          </section>
        </div>}

        {tab === "obs" && <div className="sale-full-pane">
          <div className="obsx-add"><textarea rows={3} placeholder="Registre acordos, exceções, pendências, condições combinadas…" value={obsText} onChange={(e) => setObsText(e.target.value)} /><button type="button" className="crm-primary" disabled={busyAll || !obsText.trim()} onClick={addObs}>Adicionar observação</button></div>
          <div className="obsx-list">{observacoes.length === 0 && <p className="sale-esteira-empty">Nenhuma observação ainda.</p>}{observacoes.map((o) => <article key={o.id}><p>{o.texto}</p><small>{o.autor_nome || userName(o.autor)} · {dateTime.format(new Date(o.criado_em))}</small></article>)}</div>
        </div>}
      </div>

      <footer className="sale-full-foot">
        <div className="sale-full-foot-left">
          {onChat && <button type="button" className="crm-secondary" onClick={onChat}>Abrir chat do lead</button>}
          {canApprove && <button type="button" className="sale-full-devolver" disabled={busyAll} onClick={devolverFunil}>↩ Devolver ao atendimento (follow-up)</button>}
        </div>
        <div className="sale-full-foot-right">
          {blockReasons.length > 0 && <span className="sale-full-foot-block">🔒 avanço bloqueado</span>}
          {canApprove && <label className="sale-detail-move"><span>Mover etapa</span><select value={process.etapa} disabled={busyAll} onChange={(event) => void onMove(event.target.value)}>{track.map((s) => <option value={s.id} key={s.id}>{s.name}</option>)}</select></label>}
        </div>
      </footer>
    </div>
  </div>;
}

function DocAddRow({ busy, value, onChange, onUpload }: { busy?: boolean; value?: { nome: string; obrig: boolean; obs: string }; onChange: (v: { nome: string; obrig: boolean; obs: string }) => void; onUpload: (file: File, nome: string, obrig: boolean, obs: string) => void }) {
  const v = value ?? { nome: "", obrig: true, obs: "" };
  return <div className="docx-add">
    <input placeholder="Anexar outro documento (nome)" value={v.nome} onChange={(e) => onChange({ ...v, nome: e.target.value })} />
    <label className="docx-add-obrig"><input type="checkbox" checked={v.obrig} onChange={(e) => onChange({ ...v, obrig: e.target.checked })} />Obrigatório</label>
    <input placeholder="Observação" value={v.obs} onChange={(e) => onChange({ ...v, obs: e.target.value })} />
    <label className="docx-up"><input type="file" hidden disabled={busy || !v.nome.trim()} onChange={(e) => { const f = e.target.files?.[0]; if (f && v.nome.trim()) onUpload(f, v.nome.trim(), v.obrig, v.obs); e.target.value = ""; }} />＋ Anexar</label>
  </div>;
}
function CreateSaleModal({ data, accessToken, initialDealId = "", onClose, onDone }: { data: SalesData; accessToken: string; initialDealId?: string | number; onClose: () => void; onDone: () => Promise<void> }) {
  const [dealId, setDealId] = useState(String(initialDealId)); const [productId, setProductId] = useState(""); const [vgv, setVgv] = useState(""); const [busy, setBusy] = useState(false); const [error, setError] = useState<string | null>(null); const leadById = new Map(data.leads.map((lead) => [lead.id, lead]));
  return <div className="crm-center-modal"><form onSubmit={(event) => { event.preventDefault(); setBusy(true); void authedFetch("/api/crm/sales", { method: "PATCH", headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" }, body: JSON.stringify({ action: "create", dealId: Number(dealId), productId, vgv: Number(vgv) }) }).then(async (response) => { const result = await response.json() as { error?: string }; if (!response.ok) throw new Error(result.error); await onDone(); }).catch((reason) => setError(reason instanceof Error ? reason.message : "Não foi possível criar a venda.")).finally(() => setBusy(false)); }}><header><div><span>NOVA VENDA</span><h2>Conectar venda ao CRM</h2><p>O registro entra no financeiro e na esteira de documentação.</p></div><button type="button" onClick={onClose}>×</button></header>{error && <div className="modal-error">{error}</div>}<label>Negócio / cliente<select required value={dealId} onChange={(event) => setDealId(event.target.value)}><option value="">Selecione</option>{data.deals.filter((deal) => !deal.venda_id).map((deal) => <option value={deal.id} key={deal.id}>{leadById.get(deal.lead_id)?.nome || `Negócio #${deal.id}`}</option>)}</select></label><label>Produto<select required value={productId} onChange={(event) => setProductId(event.target.value)}><option value="">Selecione</option>{data.products.map((product) => <option value={product.id} key={product.id}>{product.nome}</option>)}</select></label><label>Valor da venda<input required min="1" type="number" value={vgv} onChange={(event) => setVgv(event.target.value)} /></label><footer><button type="button" onClick={onClose}>Cancelar</button><button className="crm-primary" disabled={busy} type="submit">{busy ? "Salvando…" : "Criar venda"}</button></footer></form></div>;
}

/* Doc §7 — Analítico do CRM: filtros, origem, produto, receita potencial, envelhecimento e drill-down até os leads. */
function AnalyticsView({ data, onOpen }: { data: CrmData; onOpen?: (dealId: number) => void }) {
  const [periodDays, setPeriodDays] = useState(0);
  const [brokerFilter, setBrokerFilter] = useState("");
  const [originFilter, setOriginFilter] = useState("");
  const [drill, setDrill] = useState<{ title: string; deals: Deal[] } | null>(null);
  const leadById = useMemo(() => new Map(data.leads.map((lead) => [lead.id, lead])), [data.leads]);
  const cutoff = periodDays > 0 ? Date.now() - periodDays * 86400000 : 0;
  const deals = data.deals.filter((deal) => {
    const lead = leadById.get(deal.lead_id);
    return (!cutoff || new Date(deal.criado_em).getTime() >= cutoff) &&
      (!brokerFilter || String(deal.corretor_id ?? lead?.corretor_id ?? "") === brokerFilter) &&
      (!originFilter || (lead?.origem || "Sem origem") === originFilter);
  });
  const activeDeals = deals.filter((deal) => deal.status !== "perdido");
  const lost = deals.filter((deal) => deal.status === "perdido");
  const stageStats = data.stages.filter((stage) => stage.tipo !== "perdido").map((stage) => { const stageDeals = activeDeals.filter((deal) => deal.stage_id === stage.id); const sla = data.sla.filter((entry) => entry.stage_id === stage.id); return { stage, deals: stageDeals, count: stageDeals.length, avg: sla.length ? Math.round(sla.reduce((sum, entry) => sum + Number(entry.min_no_estagio || 0), 0) / sla.length) : 0 }; });
  const bottleneck = [...stageStats].sort((a, b) => b.avg - a.avg)[0];
  const won = deals.filter((deal) => deal.status === "ganho" || data.stages.find((stage) => stage.id === deal.stage_id)?.tipo === "ganho").length;
  const conversion = deals.length ? Math.round((won / deals.length) * 100) : 0;
  const maxCount = Math.max(1, ...stageStats.map((entry) => entry.count));
  const maxAvg = Math.max(1, ...stageStats.map((entry) => entry.avg));
  const potential = activeDeals.reduce((sum, deal) => sum + Number(deal.valor || 0), 0);
  const reasonCounts = [...new Set(lost.map((deal) => deal.motivo_perda || "Sem motivo"))].map((reason) => ({ reason, deals: lost.filter((deal) => (deal.motivo_perda || "Sem motivo") === reason) })).sort((a, b) => b.deals.length - a.deals.length);
  const brokerStats = data.brokers.map((broker) => ({ broker, deals: deals.filter((deal) => (deal.corretor_id ?? leadById.get(deal.lead_id)?.corretor_id) === broker.id) })).sort((a, b) => b.deals.length - a.deals.length);
  const maxBroker = Math.max(1, ...brokerStats.map((entry) => entry.deals.length));
  const originStats = [...new Set(deals.map((deal) => leadById.get(deal.lead_id)?.origem || "Sem origem"))].map((origin) => ({ origin, deals: deals.filter((deal) => (leadById.get(deal.lead_id)?.origem || "Sem origem") === origin) })).sort((a, b) => b.deals.length - a.deals.length).slice(0, 8);
  const maxOrigin = Math.max(1, ...originStats.map((entry) => entry.deals.length));
  const productStats = [...new Set(activeDeals.map((deal) => deal.empreendimento_id).filter(Boolean))].map((id) => ({ product: data.products.find((product) => product.id === id), deals: activeDeals.filter((deal) => deal.empreendimento_id === id) })).filter((entry) => entry.product).sort((a, b) => b.deals.length - a.deals.length).slice(0, 8);
  const ageBuckets = [{ label: "Até 7 dias", min: 0, max: 7 }, { label: "7 a 30 dias", min: 7, max: 30 }, { label: "30 a 90 dias", min: 30, max: 90 }, { label: "Mais de 90 dias", min: 90, max: Infinity }].map((bucket) => ({ ...bucket, deals: activeDeals.filter((deal) => { const days = (Date.now() - new Date(deal.criado_em).getTime()) / 86400000; return days >= bucket.min && days < bucket.max; }) }));
  const maxAge = Math.max(1, ...ageBuckets.map((entry) => entry.deals.length));
  const origins = [...new Set(data.leads.map((lead) => lead.origem || "Sem origem"))].sort();
  const drillOpen = (title: string, list: Deal[]) => setDrill({ title, deals: list });
  return <section className="crm-analytics">
    <header><span>VISÃO GERENCIAL</span><h2>Analítico de funil</h2><p>Clique em qualquer barra para ver os leads por trás do número.</p></header>
    <div className="analytics-filters">
      {[[0, "Tudo"], [7, "7 dias"], [30, "30 dias"], [90, "90 dias"]].map(([days, label]) => <button className={periodDays === days ? "active" : ""} type="button" onClick={() => setPeriodDays(days as number)} key={String(days)}>{label}</button>)}
      <select value={brokerFilter} onChange={(event) => setBrokerFilter(event.target.value)} aria-label="Corretor"><option value="">Todos os corretores</option>{data.brokers.map((broker) => <option value={broker.id} key={broker.id}>{broker.nome}</option>)}</select>
      <select value={originFilter} onChange={(event) => setOriginFilter(event.target.value)} aria-label="Origem"><option value="">Todas as origens</option>{origins.map((origin) => <option key={origin}>{origin}</option>)}</select>
    </div>
    <div className="analytics-kpis">
      <article><i>↗</i><span>Conversão geral</span><b>{conversion}%</b><small>Leads que fecham</small></article>
      <article><i>◷</i><span>Ciclo médio</span><b>{formatElapsed(stageStats.length ? Math.round(stageStats.reduce((sum, entry) => sum + entry.avg, 0) / stageStats.length) : 0)}</b><small>Entrada ao fechamento</small></article>
      <article><i>◎</i><span>Negócios ativos</span><b>{activeDeals.length}</b><small>{money.format(potential)} em negociação</small></article>
      <article><i>△</i><span>Perdidos no período</span><b>{lost.length}</b><small>Oportunidades perdidas</small></article>
      <article><i>R$</i><span>Ticket médio</span><b>{money.format(activeDeals.length ? potential / activeDeals.length : 0)}</b><small>Por negócio</small></article>
    </div>
    <div className="analytics-grid">
      <article><h3>Conversão do funil</h3>{stageStats.map((entry) => <button className="funnel-row drillable" type="button" onClick={() => drillOpen(`Etapa: ${entry.stage.rotulo || entry.stage.nome}`, entry.deals)} key={entry.stage.id}><span><b>{entry.stage.rotulo || entry.stage.nome}</b><em>{entry.count}</em></span><i><u style={{ width: `${Math.max(2, (entry.count / maxCount) * 100)}%`, background: entry.stage.cor || "#ff7000" }} /></i></button>)}</article>
      <article><h3>Tempo médio por etapa</h3>{stageStats.map((entry) => <div className={entry.stage.id === bottleneck?.stage.id ? "time-row bottleneck" : "time-row"} key={entry.stage.id}><b>{entry.stage.rotulo || entry.stage.nome}</b><i><u style={{ width: `${Math.max(2, (entry.avg / maxAvg) * 100)}%` }} /></i><span>{formatElapsed(entry.avg)}</span></div>)}</article>
      <article><h3>Origem dos leads</h3>{originStats.map((entry) => <button className="funnel-row drillable" type="button" onClick={() => drillOpen(`Origem: ${entry.origin}`, entry.deals)} key={entry.origin}><span><b>{entry.origin}</b><em>{entry.deals.length}</em></span><i><u style={{ width: `${Math.max(2, (entry.deals.length / maxOrigin) * 100)}%`, background: "#8d2bd1" }} /></i></button>)}</article>
      <article><h3>Envelhecimento do funil</h3>{ageBuckets.map((entry) => <button className="funnel-row drillable" type="button" onClick={() => drillOpen(`Idade: ${entry.label}`, entry.deals)} key={entry.label}><span><b>{entry.label}</b><em>{entry.deals.length}</em></span><i><u style={{ width: `${Math.max(2, (entry.deals.length / maxAge) * 100)}%`, background: entry.min >= 30 ? "#d0463d" : "#19a25d" }} /></i></button>)}</article>
      <article><h3>Por produto</h3>{productStats.length ? productStats.map((entry) => <button className="loss-row drillable" type="button" onClick={() => drillOpen(`Produto: ${entry.product!.nome}`, entry.deals)} key={entry.product!.id}><span>{entry.product!.nome}</span><b>{entry.deals.length} · {money.format(entry.deals.reduce((sum, deal) => sum + Number(deal.valor || 0), 0))}</b></button>) : <div className="crm-empty-view compact">Nenhum negócio com produto vinculado.</div>}</article>
      <article><h3>Motivos de perda</h3>{reasonCounts.length ? reasonCounts.map((entry) => <button className="loss-row drillable" type="button" onClick={() => drillOpen(`Perda: ${entry.reason}`, entry.deals)} key={entry.reason}><span>{entry.reason}</span><b>{entry.deals.length}</b></button>) : <div className="crm-empty-view compact">Nenhuma perda registrada.</div>}</article>
      <article><h3>Distribuição por corretor</h3>{brokerStats.map((entry) => <button className="broker-row drillable" type="button" onClick={() => drillOpen(`Corretor: ${entry.broker.nome}`, entry.deals)} key={entry.broker.id}><span>{initials(entry.broker.nome)}</span><div><b>{entry.broker.nome}</b><i><u style={{ width: `${(entry.deals.length / maxBroker) * 100}%` }} /></i></div><em>{entry.deals.length} · {entry.broker.online ? "online" : "offline"}</em></button>)}</article>
    </div>
    {drill && <div className="crm-center-modal analytics-drill" onMouseDown={(event) => { if (event.target === event.currentTarget) setDrill(null); }}><div className="analytics-drill-card"><header><div><span>DRILL-DOWN</span><h2>{drill.title}</h2><p>{drill.deals.length} negócio{drill.deals.length === 1 ? "" : "s"} · clique para abrir o lead</p></div><button type="button" onClick={() => setDrill(null)}>×</button></header><div className="analytics-drill-list">{drill.deals.map((deal) => { const lead = leadById.get(deal.lead_id); const broker = data.brokers.find((item) => item.id === (deal.corretor_id ?? lead?.corretor_id)); return <button type="button" onClick={() => { setDrill(null); onOpen?.(deal.id); }} key={deal.id}><span>{initials(lead?.nome ?? null)}</span><div><strong>{lead?.nome || "Lead sem nome"}</strong><small>{lead?.telefone || "—"} · {broker?.nome || "sem responsável"}</small></div><em>{deal.valor ? money.format(deal.valor) : "—"}</em></button>; })}{drill.deals.length === 0 && <div className="crm-empty-view compact">Nenhum lead neste recorte.</div>}</div></div></div>}
  </section>;
}

function PipelineViewEnhanced({ stages, allStages, deals, leadById, brokerById, slaByDeal, canReassign, onReassign, onOpen, onChat, onMutate, setMessage, draggingId, onDrag, onDrop, canManageStages, onReorderStage, onRecolorStage, onSaveStage, onBulkFromStage, stageCount, canMoveDeals, onPickStage, readByDeal }: { stages: Stage[]; allStages: Stage[]; deals: Deal[]; leadById: Map<number, Lead>; brokerById: Map<number, Broker>; slaByDeal: Map<number, SlaInfo>; canReassign: boolean; onReassign: (dealId: number) => void; onOpen: (id: number) => void; onChat: (id: number) => void; onMutate: (body: Record<string, unknown>) => Promise<void>; setMessage: (value: string | null) => void; draggingId: number | null; onDrag: (id: number | null) => void; onDrop: (event: DragEvent, stageId: number) => Promise<void>; canManageStages?: boolean; onReorderStage?: (stageId: number, direction: number) => Promise<void>; onRecolorStage?: (stageId: number, color: string) => Promise<void>; onSaveStage?: (stageId: number, nome: string, color: string) => Promise<void>; onBulkFromStage?: (stageId: number) => void; stageCount?: number; canMoveDeals?: boolean; onPickStage?: (dealId: number) => void; readByDeal?: Map<number, string> }) {
  const [busyId, setBusyId] = useState<number | null>(null);
  const [menuStage, setMenuStage] = useState<number | null>(null);
  const [editName, setEditName] = useState("");
  const [editColor, setEditColor] = useState("#9638d8");
  const STAGE_PALETTE = ["#22a35a", "#2f9e8f", "#3b6fe0", "#7c3aed", "#d61f69", "#d13d3d", "#e8620e", "#e0a520", "#7cb518", "#5b6b7c", "#8a6a4a", "#3f3a36"];
  const change = async (body: Record<string, unknown>, success: string, dealId: number) => { setBusyId(dealId); try { await onMutate(body); setMessage(success); } catch (reason) { setMessage(reason instanceof Error ? reason.message : "Não foi possível salvar."); } finally { setBusyId(null); } };
  /* #5/#6 — arrastar o fundo do funil pra rolar lateral + roda do mouse na vertical vira scroll horizontal
     quando a coluna sob o cursor já chegou ao fim (ou o cursor está numa área vazia). Sem precisar descer. */
  const boardRef = useRef<HTMLElement | null>(null);
  const pan = useRef({ x: 0, left: 0, active: false });
  useEffect(() => {
    const board = boardRef.current;
    if (!board) return;
    const onWheel = (event: globalThis.WheelEvent) => {
      if (event.ctrlKey || Math.abs(event.deltaX) > Math.abs(event.deltaY) || event.deltaY === 0) return;
      const col = (event.target as HTMLElement).closest(".crm-stage-body") as HTMLElement | null;
      if (col) {
        const down = event.deltaY > 0 && col.scrollTop + col.clientHeight < col.scrollHeight - 1;
        const up = event.deltaY < 0 && col.scrollTop > 0;
        if (down || up) return; // deixa a própria coluna rolar por dentro
      }
      board.scrollLeft += event.deltaY;
      event.preventDefault();
    };
    const onMove = (event: globalThis.MouseEvent) => {
      if (!pan.current.active) return;
      board.scrollLeft = pan.current.left - (event.clientX - pan.current.x);
      event.preventDefault();
    };
    const onUp = () => { if (pan.current.active) { pan.current.active = false; board.classList.remove("panning"); } };
    board.addEventListener("wheel", onWheel, { passive: false });
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => { board.removeEventListener("wheel", onWheel); window.removeEventListener("mousemove", onMove); window.removeEventListener("mouseup", onUp); };
  }, []);
  const onBoardDown = (event: ReactMouseEvent) => {
    if (event.button !== 0) return;
    if ((event.target as HTMLElement).closest(".crm-lead-card-v3, .crm-stage-editor, button, select, input, textarea, a, [role='button']")) return;
    const board = boardRef.current;
    if (!board) return;
    pan.current = { x: event.clientX, left: board.scrollLeft, active: true };
    board.classList.add("panning");
  };
  return <section className="crm-kanban-v2" ref={boardRef} onMouseDown={onBoardDown}>{stages.map((stage, stageIndex) => {
    const items = deals.filter((deal) => deal.stage_id === stage.id);
    const stageColor = stage.cor || ["#9638d8", "#ff6500", "#386fe7", "#20aa64", "#f2a82c"][stageIndex % 5];
    const globalIndex = allStages.slice().sort((a, b) => a.ordem - b.ordem).findIndex((s) => s.id === stage.id);
    const total = stageCount ?? allStages.length;
    return <article className="crm-stage" style={{ "--stage": stageColor } as CSSProperties} key={stage.id} onDragOver={(event) => event.preventDefault()} onDrop={(event) => void onDrop(event, stage.id)}>
      <header><div><i /><strong>{stage.rotulo || stage.nome}</strong></div><div className="crm-stage-head-right"><span>{items.length}</span>{canManageStages && <button type="button" className="crm-stage-cog" title="Editar etapa" onClick={() => { if (menuStage === stage.id) { setMenuStage(null); } else { setMenuStage(stage.id); setEditName(stage.rotulo || stage.nome); setEditColor(stageColor); } }}>⋯</button>}</div></header>
      {canManageStages && menuStage === stage.id && <div className="crm-stage-editor" onClick={(event) => event.stopPropagation()}>
        <span className="cse-kicker">EDITAR ETAPA</span>
        <label className="cse-field"><span>Nome da etapa</span><input value={editName} onChange={(event) => setEditName(event.target.value)} autoFocus /></label>
        <div className="cse-field"><span>Cor da etapa</span><div className="cse-swatches">{STAGE_PALETTE.map((c) => <button type="button" key={c} className={`cse-swatch ${editColor.toLowerCase() === c.toLowerCase() ? "sel" : ""}`} style={{ background: c }} onClick={() => setEditColor(c)} aria-label={`Cor ${c}`}>{editColor.toLowerCase() === c.toLowerCase() ? "✓" : ""}</button>)}</div></div>
        <div className="cse-move"><button type="button" disabled={globalIndex <= 0} onClick={() => { void onReorderStage?.(stage.id, -1); }}>‹ Mover atrás</button><button type="button" disabled={globalIndex < 0 || globalIndex >= total - 1} onClick={() => { void onReorderStage?.(stage.id, 1); }}>Mover frente ›</button></div>
        <button type="button" className="cse-bulk" onClick={() => { setMenuStage(null); onBulkFromStage?.(stage.id); }}>⇄ Mover todos os leads desta etapa</button>
        <div className="cse-actions"><button type="button" className="cse-cancel" onClick={() => setMenuStage(null)}>Cancelar</button><button type="button" className="cse-save" onClick={() => { void onSaveStage?.(stage.id, editName.trim() || (stage.rotulo || stage.nome), editColor); setMenuStage(null); }}>Salvar</button></div>
      </div>}
      <div className="crm-stage-body">{items.map((deal) => {
        const lead = leadById.get(deal.lead_id)!;
        const broker = brokerById.get(deal.corretor_id ?? lead.corretor_id ?? -1);
        const tags = tagList(lead.tags);
        const sla = slaByDeal.get(deal.id);
        const waiting = sla?.aguardando_humano;
        // Cliente aguardando → cor pelo tempo de espera. Se o corretor já respondeu
        // (não está aguardando e há interação humana registrada) → verde. Lead nunca
        // tocado (sem interação humana) → segue sinalizando pelo tempo sem interação.
        const color = waiting ? alertColorByDays(sla?.min_aguardando) : (sla?.humano_ultima ? "verde" : alertColorByDays(sla?.min_sem_interacao));
        // Sino: só quando o cliente aguarda. Vermelho = ainda não lida (corretor não abriu
        // desde a última msg do cliente); Amarelo = já abriu (leu) mas não respondeu.
        const lidoEm = readByDeal?.get(deal.id);
        const unread = Boolean(waiting) && (!lidoEm || (sla?.cliente_ultima ? String(sla.cliente_ultima) > lidoEm : true));
        return <article draggable={canMoveDeals !== false} className={`crm-lead-card-v3 sla-${color} ${draggingId === deal.id ? "dragging" : ""}`} onDragStart={(event) => { if (canMoveDeals === false || (event.target as HTMLElement).closest(".card-controls-v3, .broker-trigger-v3")) return event.preventDefault(); event.dataTransfer.setData("text/deal-id", String(deal.id)); onDrag(deal.id); }} onDragEnd={() => onDrag(null)} key={deal.id}>
          {waiting && <span className={`card-resp-bell ${unread ? "urgente" : "lida"}`} title={unread ? "Cliente respondeu — não lida" : "Lida, mas você ainda não respondeu"}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9M10 21h4" /></svg></span>}
          <div className={`sla-top-band ${color}`} />
          <div className="card-open-v3" role="button" tabIndex={0} onClick={() => onOpen(deal.id)} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") onOpen(deal.id); }}>
            <div className="card-person"><LeadAvatar lead={lead} /><div><strong>{lead.nome || "Lead sem nome"}</strong><small>{lead.telefone || "Sem telefone"}</small></div><em>›</em></div>
            <div className="card-broker-inline-v3"><span className={`presence ${broker?.online ? "online" : ""}`} />{canReassign ? <button className="broker-trigger-v3" type="button" onClick={(event) => { event.stopPropagation(); onReassign(deal.id); }}>{broker?.nome || "Escolher corretor"}<span>⌄</span></button> : <strong>{broker?.nome || "Sem responsável"}</strong>}</div>
            <div className="sla-clock-v3"><b>{formatElapsed(waiting ? sla?.min_aguardando : sla?.min_sem_interacao)}</b><span>{waiting ? "cliente aguardando resposta" : "sem interação com o lead"}</span></div>
            <div className="card-context"><span>{lead.origem || "Sem origem"}</span>{deal.valor ? <b>{money.format(deal.valor)}</b> : <small>Valor a definir</small>}</div>
            {tags.length > 0 && <div className="card-tags" aria-label="Tags do lead">{tags.slice(0, 2).map((item) => <span key={item}>{item}</span>)}</div>}
          </div>
          <div className="card-controls-v3" onClick={(event) => event.stopPropagation()}>
            <button type="button" onClick={() => onChat(deal.id)}>Chat</button>
            {canMoveDeals !== false && (() => { const cur = allStages.find((s) => s.id === deal.stage_id); return <button type="button" className="stage-pick-btn" aria-label={`Mover ${lead.nome || "lead"} para outra etapa`} disabled={busyId === deal.id} onClick={() => onPickStage?.(deal.id)}><i className="stage-pick-dot" style={{ background: cur?.cor || "#9638d8" }} /><span>{cur?.rotulo || cur?.nome || "Etapa"}</span><em>⌄</em></button>; })()}
          </div>
          <footer><time>{sla?.min_no_estagio !== null && sla?.min_no_estagio !== undefined ? `${formatElapsed(sla.min_no_estagio)} na etapa` : shortDate.format(new Date(deal.ultima_movimentacao || deal.criado_em))}</time></footer>
        </article>;
      })}{items.length === 0 && <div className="crm-empty-stage">Arraste um lead para esta etapa</div>}</div>
    </article>;
  })}</section>;
}

function LeadsViewEnhanced({ deals, leadById, stages, brokerById, slaByDeal, canReassign, onReassign, onOpen, onChat, onMutate, setMessage, canMoveDeals, onPickStage }: { deals: Deal[]; leadById: Map<number, Lead>; stages: Stage[]; brokerById: Map<number, Broker>; slaByDeal: Map<number, SlaInfo>; canReassign: boolean; onReassign: (dealId: number) => void; onOpen: (id: number) => void; onChat: (id: number) => void; onMutate: (body: Record<string, unknown>) => Promise<void>; setMessage: (value: string | null) => void; canMoveDeals?: boolean; onPickStage?: (dealId: number) => void }) {
  const [busyId, setBusyId] = useState<number | null>(null);
  const change = async (body: Record<string, unknown>, success: string, dealId: number) => { setBusyId(dealId); try { await onMutate(body); setMessage(success); } catch (reason) { setMessage(reason instanceof Error ? reason.message : "Não foi possível salvar."); } finally { setBusyId(null); } };
  const visibleDeals = deals.slice(0, 15);
  return <section className="crm-table-wrap">
    <table className="crm-leads-table crm-leads-table-v3">
      <thead><tr><th>Lead</th><th>Tempo sem interação</th><th>Etapa</th><th>Corretor</th><th>Origem</th><th>Valor</th><th>Atualização</th><th>Ações</th></tr></thead>
      <tbody>{visibleDeals.map((deal, index) => {
        const lead = leadById.get(deal.lead_id)!;
        const sla = slaByDeal.get(deal.id);
        const broker = brokerById.get(deal.corretor_id ?? lead.corretor_id ?? -1);
        const tags = tagList(lead.tags).slice(0, 2);
        return <tr className={`lead-tone-${index % 5 + 1} sla-row-${sla?.cor_ativa || "verde"}`} key={deal.id}>
          <td onClick={() => onOpen(deal.id)}><div className="table-person"><LeadAvatar lead={lead} /><div><strong>{lead.nome || "Lead sem nome"}</strong><small>#{lead.id}</small>{tags.length > 0 && <div className="lead-table-tags" aria-label="Tags do lead">{tags.map((item) => <span key={item}>{item}</span>)}</div>}</div></div></td>
          <td><strong>{formatElapsed(sla?.aguardando_humano ? sla.min_aguardando : sla?.min_sem_interacao)}</strong><small>{sla?.aguardando_humano ? "aguardando resposta" : "sem interação"}</small></td>
          <td>{canMoveDeals !== false ? (() => { const cur = stages.find((s) => s.id === deal.stage_id); return <button type="button" className="stage-pick-btn table" disabled={busyId === deal.id} onClick={() => onPickStage?.(deal.id)}><i className="stage-pick-dot" style={{ background: cur?.cor || "#9638d8" }} /><span>{cur?.rotulo || cur?.nome || "Etapa"}</span><em>⌄</em></button>; })() : <span className="stage-pill-static">{stages.find((s) => s.id === deal.stage_id)?.rotulo || stages.find((s) => s.id === deal.stage_id)?.nome || "—"}</span>}</td>
          <td>{canReassign ? <button className="table-broker-trigger" type="button" onClick={() => onReassign(deal.id)}>{broker?.nome || "Escolher corretor"}<span>⌄</span></button> : <strong>{broker?.nome || "Sem responsável"}</strong>}<small>{broker?.online ? "● online" : "offline"}</small></td>
          <td>{lead.origem || "—"}</td><td>{deal.valor ? money.format(deal.valor) : "—"}</td><td>{shortDate.format(new Date(deal.ultima_movimentacao || deal.criado_em))}</td>
          <td><div className="table-actions-v3"><button type="button" onClick={() => onOpen(deal.id)}>Abrir</button><button type="button" onClick={() => onChat(deal.id)}>Chat</button></div></td>
        </tr>;
      })}</tbody>
    </table>
    {deals.length > 15 && <div className="crm-leads-limit">Mostrando os primeiros 15 de {deals.length} leads</div>}
    {deals.length === 0 && <div className="crm-empty-view">Nenhum lead encontrado com esses filtros.</div>}
  </section>;
}

function BrokerPickerModal({ deal, lead, brokers, onClose, onSave }: { deal: Deal; lead: Lead; brokers: Broker[]; onClose: () => void; onSave: (brokerId: number) => Promise<void> }) {
  const currentBrokerId = deal.corretor_id ?? lead.corretor_id;
  const [selectedBrokerId, setSelectedBrokerId] = useState<number | null>(currentBrokerId);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return <div className="broker-picker-layer" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !busy) onClose(); }}>
    <section className="broker-picker-modal" role="dialog" aria-modal="true" aria-labelledby="broker-picker-title">
      <header><div><h2 id="broker-picker-title">Trocar corretor do lead</h2><p>Escolha o corretor responsável por este lead.</p></div><button type="button" disabled={busy} onClick={onClose} aria-label="Fechar">×</button></header>
      <div className="broker-picker-list">{brokers.filter((broker) => broker.ativo).map((broker) => <button className={selectedBrokerId === broker.id ? "selected" : ""} type="button" onClick={() => setSelectedBrokerId(broker.id)} key={broker.id}><span>{initials(broker.nome)}</span><strong>{broker.nome}</strong>{broker.id === currentBrokerId && <small>atual</small>}</button>)}</div>
      {error && <p className="broker-picker-error">{error}</p>}
      <footer><button type="button" disabled={busy} onClick={onClose}>Cancelar</button><button className="save" type="button" disabled={busy || !selectedBrokerId || selectedBrokerId === currentBrokerId} onClick={() => { if (!selectedBrokerId) return; setBusy(true); setError(null); void onSave(selectedBrokerId).catch((reason) => setError(reason instanceof Error ? reason.message : "Não foi possível trocar o corretor.")).finally(() => setBusy(false)); }}>{busy ? "Salvando…" : "Salvar"}</button></footer>
    </section>
  </div>;
}

function StagePickerModal({ deal, leadNome, stages, onClose, onSave }: { deal: Deal; leadNome: string | null; stages: Stage[]; onClose: () => void; onSave: (stageId: number) => Promise<void> }) {
  const [selected, setSelected] = useState<number | null>(deal.stage_id ?? null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const ordered = stages.slice().sort((a, b) => a.ordem - b.ordem);
  return <div className="broker-picker-layer" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !busy) onClose(); }}>
    <section className="broker-picker-modal stage-picker-modal" role="dialog" aria-modal="true" aria-labelledby="stage-picker-title">
      <header><div><h2 id="stage-picker-title">Mover para outra etapa</h2><p>{leadNome || "Lead"} · escolha a nova etapa do funil.</p></div><button type="button" disabled={busy} onClick={onClose} aria-label="Fechar">×</button></header>
      <div className="stage-picker-list">{ordered.map((stage) => <button className={selected === stage.id ? "selected" : ""} type="button" onClick={() => setSelected(stage.id)} key={stage.id} style={{ "--sp": stage.cor || "#9638d8" } as CSSProperties}><i /><strong>{stage.rotulo || stage.nome}</strong>{stage.id === deal.stage_id && <small>atual</small>}</button>)}</div>
      {error && <p className="broker-picker-error">{error}</p>}
      <footer><button type="button" disabled={busy} onClick={onClose}>Cancelar</button><button className="save" type="button" disabled={busy || !selected || selected === deal.stage_id} onClick={() => { if (!selected) return; setBusy(true); setError(null); void onSave(selected).catch((reason) => setError(reason instanceof Error ? reason.message : "Não foi possível mover a etapa.")).finally(() => setBusy(false)); }}>{busy ? "Movendo…" : "Mover"}</button></footer>
    </section>
  </div>;
}

function RefinedSelect({ value, onChange, options, placeholder = "Selecione", disabled = false }: { value: string; onChange: (value: string) => void; options: Array<{ value: string; label: string }>; placeholder?: string; disabled?: boolean }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const selected = options.find((option) => option.value === value) ?? null;
  useEffect(() => {
    if (!open) return;
    const onDoc = (event: globalThis.MouseEvent) => { if (ref.current && !ref.current.contains(event.target as Node)) setOpen(false); };
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("mousedown", onDoc); document.removeEventListener("keydown", onKey); };
  }, [open]);
  return <div className={`rselect ${open ? "open" : ""} ${disabled ? "disabled" : ""}`} ref={ref}>
    <button type="button" className={`rselect-btn ${selected ? "" : "is-placeholder"}`} disabled={disabled} onClick={() => setOpen((prev) => !prev)} aria-haspopup="listbox" aria-expanded={open}>
      <span className="rselect-label">{selected ? selected.label : placeholder}</span>
      <svg className="rselect-caret" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 9l6 6 6-6" /></svg>
    </button>
    {open && <ul className="rselect-panel" role="listbox">
      {options.length === 0 && <li className="rselect-empty">Nenhuma etapa disponível</li>}
      {options.map((option) => <li key={option.value}><button type="button" role="option" aria-selected={option.value === value} className={`rselect-opt ${option.value === value ? "active" : ""}`} onClick={() => { onChange(option.value); setOpen(false); }}><span className="rselect-dot" /><span className="rselect-opt-text">{option.label}</span>{option.value === value && <svg className="rselect-check" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5" /></svg>}</button></li>)}
    </ul>}
  </div>;
}

function BulkMoveModal({ pipelineId, stages, deals, initialFromStageId, onClose, onMove }: { pipelineId: number; stages: Stage[]; deals: Deal[]; initialFromStageId?: number | null; onClose: () => void; onMove: (fromStageId: number, toStageId: number) => Promise<void> }) {
  const [fromStageId, setFromStageId] = useState(initialFromStageId ? String(initialFromStageId) : ""); const [toStageId, setToStageId] = useState(""); const [busy, setBusy] = useState(false); const [error, setError] = useState<string | null>(null);
  const count = deals.filter((deal) => deal.stage_id === Number(fromStageId) && deal.status !== "perdido").length;
  return <div className="crm-center-modal"><form onSubmit={(event) => { event.preventDefault(); setBusy(true); setError(null); void onMove(Number(fromStageId), Number(toStageId)).catch((reason) => setError(reason instanceof Error ? reason.message : "Não foi possível mover a etapa.")).finally(() => setBusy(false)); }}><header><div><span>AÇÃO EM MASSA</span><h2>Mover uma etapa inteira</h2><p>Todos os negócios da etapa escolhida serão enviados para o novo destino.</p></div><button type="button" onClick={onClose}>×</button></header>{error && <div className="modal-error">{error}</div>}<div className="bulk-move-grid"><label>Etapa de origem<RefinedSelect value={fromStageId} onChange={(value) => { setFromStageId(value); if (value === toStageId) setToStageId(""); }} options={stages.map((stage) => ({ value: String(stage.id), label: stage.rotulo || stage.nome }))} /></label><div className="bulk-arrow">→</div><label>Etapa de destino<RefinedSelect value={toStageId} onChange={setToStageId} disabled={!fromStageId} options={stages.filter((stage) => String(stage.id) !== fromStageId).map((stage) => ({ value: String(stage.id), label: stage.rotulo || stage.nome }))} /></label></div><div className="bulk-warning"><strong>{count} negócio{count === 1 ? "" : "s"}</strong><span>serão movidos dentro do funil #{pipelineId}</span></div><footer><button type="button" onClick={onClose}>Cancelar</button><button className="crm-primary" disabled={busy || !fromStageId || !toStageId || count === 0} type="submit">{busy ? "Movendo..." : `Mover ${count} negócios`}</button></footer></form></div>;
}

function LeadChatDrawer({ accessToken, lead, deal, corretorNome, onClose, onResponse }: { accessToken: string; lead: Lead; deal: Deal; corretorNome?: string; onClose: () => void; onResponse: () => Promise<void> }) {
  const [instances, setInstances] = useState<ChatInstance[]>([]); const [selectedKey, setSelectedKey] = useState(""); const [messages, setMessages] = useState<ChatMessage[]>([]); const [draft, setDraft] = useState(""); const [loading, setLoading] = useState(true); const [sending, setSending] = useState(false); const [error, setError] = useState<string | null>(null); const [recording, setRecording] = useState(false); const [collapsed, setCollapsed] = useState(false); const [suggestOpen, setSuggestOpen] = useState(false);
  const [recSeconds, setRecSeconds] = useState(0); const [recBars, setRecBars] = useState<number[]>([]);
  const [hiddenIds, setHiddenIds] = useState<Set<string>>(new Set());
  const [confirmDel, setConfirmDel] = useState<string | null>(null);
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const copiloto = useLeadCopiloto(accessToken, lead.nome || "");
  const fileInput = useRef<HTMLInputElement>(null); const recorder = useRef<MediaRecorder | null>(null); const chunks = useRef<Blob[]>([]);
  const recTimer = useRef<number | null>(null); const audioCtx = useRef<AudioContext | null>(null); const rafId = useRef<number | null>(null); const streamRef = useRef<MediaStream | null>(null); const canceledRef = useRef(false);
  const fmtRec = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
  const listRef = useRef<HTMLElement>(null);
  const seedRef = useRef<{ key: string; msgs: ChatMessage[]; hasMore: boolean; startPage: number } | null>(null);
  useEffect(() => {
    document.body.classList.add("lead-chat-open");
    const fab = document.querySelector<HTMLElement>(".ai-button");
    const prev = fab ? fab.style.display : "";
    if (fab) fab.style.display = "none";
    return () => { document.body.classList.remove("lead-chat-open"); if (fab) fab.style.display = prev; };
  }, []);
  useEffect(() => { if (loading) return; const el = listRef.current; if (!el) return; const toBottom = () => { el.scrollTop = el.scrollHeight; }; toBottom(); const t = window.setTimeout(toBottom, 80); return () => window.clearTimeout(t); }, [messages, loading]);
  async function request(body: Record<string, unknown>) { const response = await authedFetch("/api/crm/chat", { method: "POST", headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" }, body: JSON.stringify(body) }); const result = await response.json() as Record<string, unknown>; if (!response.ok) throw new Error(typeof result.error === "string" ? result.error : "Não foi possível abrir a conversa."); return result; }
  async function loadInstances() { setLoading(true); setError(null); try { const result = await request({ action: "list", telefone: lead.telefone, corretorId: lead.corretor_id }); const list = Array.isArray(result.instancias) ? result.instancias as ChatInstance[] : []; const primeira = Array.isArray(result.primeiraPagina) ? result.primeiraPagina as ChatMessage[] : []; const melhorKey = typeof result.melhorKey === "string" ? result.melhorKey : ""; const chosen = melhorKey || (() => { const first = (corretorNome || "").trim().split(/\s+/)[0].toLowerCase(); const owned = first ? list.filter((i) => String(i.corretor || "").trim().toLowerCase().startsWith(first)) : []; const pool = owned.length ? owned : list; const score = (i: ChatInstance) => (((i.dIn || 0) > 0 || (i.msgs || 0) > 0) ? 2 : 0) + ((i.sendBig && i.conectada) ? 1 : 0); const pick = pool.slice().sort((a, b) => (score(b) - score(a)) || ((b.dIn || 0) - (a.dIn || 0)) || ((b.dTot || 0) - (a.dTot || 0)) || (b.msgs - a.msgs) || String(b.ultima || "").localeCompare(String(a.ultima || "")))[0]; return pick?.key || list[0]?.key || ""; })(); const cached = Boolean(result.cached); if (primeira.length && chosen) seedRef.current = { key: chosen, msgs: primeira, hasMore: cached ? true : Boolean(result.primeiraHasMore), startPage: cached ? 1 : 2 }; setInstances(list); setSelectedKey((current) => current || chosen); } catch (reason) { setError(reason instanceof Error ? reason.message : "Não foi possível abrir a conversa."); setLoading(false); } }
  async function loadMessages(instance: ChatInstance, opts?: { seed?: ChatMessage[]; startPage?: number; hasMore?: boolean }) {
    const seed = opts?.seed ?? [];
    const startPage = opts?.startPage ?? 1;
    const seeded = seed.length > 0;
    setError(null);
    let acc: ChatMessage[] = seed.slice();
    const render = () => {
      // Dedup por wa_message_id. Mantém a versão da d-api (com ack/status), MAS completa
      // media_url/conteudo a partir do banco quando a d-api não trouxe (mídia antiga sem s3_url).
      const byKey = new Map<string, ChatMessage>();
      for (const m of acc) {
        const k = String(m.wa_message_id || m.id);
        const ex = byKey.get(k);
        if (!ex) { byKey.set(k, { ...m }); continue; }
        if ((!ex.media_url || ex.media_url === "") && m.media_url) ex.media_url = m.media_url;
        if ((!ex.conteudo || ex.conteudo === "") && m.conteudo) ex.conteudo = m.conteudo;
      }
      const unique = [...byKey.values()];
      setMessages(unique.sort((a, b) => String(a.criado_em || "").localeCompare(String(b.criado_em || ""))));
    };
    // Com a página inicial vinda do "list", pintamos NA HORA e carregamos o histórico antigo por trás.
    if (seeded) { render(); setLoading(false); } else setLoading(true);
    try {
      // Fonte primária: d-api (histórico COMPLETO), paginando até o fim — cada página aparece assim que chega.
      if (instance.sendBig && (opts?.hasMore ?? true)) {
        let page = startPage, more = true, guard = 0;
        while (more && guard < 60) {
          guard++;
          const result = await request({ action: "dapi-hist", telefone: lead.telefone, instancia_id: instance.sendBig, page, limit: 100 });
          const chunk = Array.isArray(result.mensagens) ? result.mensagens as ChatMessage[] : [];
          acc = acc.concat(chunk);
          render();
          more = Boolean(result.hasMore) && chunk.length > 0;
          page++;
        }
      }
      // Mescla o banco (traz as mensagens que FALHARAM — elas não existem na d-api). O dedup por wa_message_id mantém a versão da d-api (com ack) quando há duplicata.
      if (instance.conversaIds.length) {
        try { const dbRes = await request({ action: "messages", conversaIds: instance.conversaIds, limit: 500 }); const dbMsgs = Array.isArray(dbRes.mensagens) ? dbRes.mensagens as ChatMessage[] : []; if (dbMsgs.length) { acc = acc.concat(dbMsgs); render(); } } catch { /* silencioso */ }
      }
      // Reserva: inbox nativo, caso nada tenha vindo (sem chat / offline).
      if (!acc.length && instance.conversaIds.length) {
        const result = await request({ action: "messages", conversaIds: instance.conversaIds, limit: 500 });
        acc = Array.isArray(result.mensagens) ? result.mensagens as ChatMessage[] : [];
        render();
      }
      // Backfill de mídia: áudios/imagens (inclusive do cliente) que vieram sem s3_url ainda.
      // Rebusca o mapa message_id -> s3_url na d-api e preenche o que estiver faltando.
      if (instance.sendBig && acc.some((m) => !m.media_url && /audio|imagem|image|video|documento|figurinha/i.test(String(m.tipo)))) {
        try {
          const mediaRes = await request({ action: "media", telefone: lead.telefone, instancia_id: instance.sendBig });
          const map = (mediaRes && typeof mediaRes.map === "object" && mediaRes.map) ? mediaRes.map as Record<string, string> : {};
          if (Object.keys(map).length) {
            acc = acc.map((m) => { const url = !m.media_url ? map[String(m.wa_message_id || m.id)] : null; return url ? { ...m, media_url: url } : m; });
            render();
          }
        } catch { /* silencioso */ }
      }
    } catch (reason) {
      if (!seeded) setError(reason instanceof Error ? reason.message : "Não foi possível carregar as mensagens.");
    } finally { if (!seeded) setLoading(false); }
  }
  async function hideMessage(item: ChatMessage) {
    const key = String(item.wa_message_id || item.id);
    setHiddenIds((prev) => { const next = new Set(prev); next.add(key); return next; });
    setMessages((prev) => prev.filter((m) => String(m.wa_message_id || m.id) !== key));
    try { await request({ action: "hideMessage", messageId: key, leadId: lead.id }); } catch { /* mantém oculto localmente */ }
  }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { const timer = window.setTimeout(() => { void loadInstances(); void (async () => { try { const r = await request({ action: "hiddenMessages", leadId: lead.id }); setHiddenIds(new Set(Array.isArray(r.ids) ? r.ids as string[] : [])); } catch { /* ok */ } })(); }, 0); return () => window.clearTimeout(timer); }, [lead.id]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { const instance = instances.find((item) => item.key === selectedKey); if (!instance) return; const seed = seedRef.current && seedRef.current.key === instance.key ? seedRef.current : null; seedRef.current = null; const timer = window.setTimeout(() => { if (seed) void loadMessages(instance, { seed: seed.msgs, startPage: seed.startPage, hasMore: seed.hasMore }); else void loadMessages(instance); }, 0); return () => window.clearTimeout(timer); }, [selectedKey, instances]);
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
  async function send() { if (!draft.trim()) return; if (!selected?.sendBig) { setError(loading ? "Aguarde as instâncias carregarem…" : "Sua instância de WhatsApp não está habilitada para envio. Abra Configurações → Conexões e reconecte pelo QR — ou selecione outra instância acima."); return; } const chosen = selected; const text = draft; const tempId = `temp-${Date.now()}`; setDraft(""); setError(null); setMessages((prev) => [...prev, { id: tempId, wa_message_id: null, direcao: "enviada", tipo: "texto", conteudo: text, media_url: null, criado_em: new Date().toISOString(), status: "enviando" }]); void (async () => { try { await request({ action: "send", telefone: lead.telefone, instanciaId: chosen.sendBig, texto: text }); setMessages((prev) => prev.map((m) => m.id === tempId ? { ...m, status: "enviado" } : m)); await onResponse(); await loadMessages(chosen); } catch (reason) { const motivo = friendlyChatError(reason instanceof Error ? reason.message : ""); setError(motivo); setMessages((prev) => prev.map((m) => m.id === tempId ? { ...m, status: "erro", status_detalhe: motivo } : m)); } })(); }
  async function liveAction(body: Record<string, unknown>) { const response = await authedFetch("/api/live-chat", { method: "POST", headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" }, body: JSON.stringify(body) }); const result = await response.json() as Record<string, unknown>; if (!response.ok) throw new Error(typeof result.error === "string" ? result.error : "Não foi possível concluir."); return result; }
  async function sendSuggestion(text: string) {
    if (!text.trim()) return;
    if (!selected?.sendBig) { setError(loading ? "Aguarde as instâncias carregarem…" : "Sua instância de WhatsApp não está habilitada para envio. Abra Configurações → Conexões e reconecte pelo QR — ou selecione outra instância acima."); return; }
    if (!window.confirm(`Enviar esta mensagem para ${lead.nome || "o cliente"} agora?\n\n${text}`)) return;
    const chosen = selected; const tempId = `temp-${Date.now()}`; setError(null);
    setMessages((prev) => [...prev, { id: tempId, wa_message_id: null, direcao: "enviada", tipo: "texto", conteudo: text, media_url: null, criado_em: new Date().toISOString(), status: "enviando" }]);
    try { await request({ action: "send", telefone: lead.telefone, instanciaId: chosen.sendBig, texto: text }); setMessages((prev) => prev.map((m) => m.id === tempId ? { ...m, status: "enviado" } : m)); await onResponse(); await loadMessages(chosen); }
    catch (reason) { const motivo = friendlyChatError(reason instanceof Error ? reason.message : ""); setError(motivo); setMessages((prev) => prev.map((m) => m.id === tempId ? { ...m, status: "erro", status_detalhe: motivo } : m)); }
  }
  async function upload(file?: File, kind?: string) {
    if (!file || !selected?.sendBig || !lead.telefone) return;
    const isAudio = kind === "audio" || (file.type || "").includes("audio");
    const tempId = `temp-${Date.now()}`;
    if (isAudio) setMessages((prev) => [...prev, { id: tempId, wa_message_id: null, direcao: "enviada", tipo: "audio", conteudo: null, media_url: null, criado_em: new Date().toISOString(), status: "enviando" }]);
    setSending(true); setError(null);
    try {
      const form = new FormData(); form.set("file", file); form.set("phone", lead.telefone); form.set("instanceId", String(selected.sendBig)); form.set("content", draft);
      const response = await authedFetch("/api/live-chat", { method: "POST", headers: { Authorization: `Bearer ${accessToken}` }, body: form });
      const result = await response.json() as { error?: string };
      if (!response.ok) throw new Error(result.error || "Não foi possível enviar a mídia.");
      if (isAudio) setMessages((prev) => prev.map((m) => m.id === tempId ? { ...m, status: "enviado" } : m));
      setDraft(""); await onResponse(); await loadMessages(selected);
    } catch (reason) {
      const motivo = reason instanceof Error ? reason.message : "Não foi possível enviar a mídia.";
      if (isAudio) setMessages((prev) => prev.map((m) => m.id === tempId ? { ...m, status: "erro", status_detalhe: motivo } : m)); else setError(motivo);
    } finally { setSending(false); if (fileInput.current) fileInput.current.value = ""; }
  }
  function startRecording() {
    if (recording || sending) return;
    navigator.mediaDevices.getUserMedia({ audio: true }).then((stream) => {
      streamRef.current = stream; chunks.current = []; canceledRef.current = false;
      const mr = new MediaRecorder(stream); recorder.current = mr;
      mr.ondataavailable = (event) => { if (event.data.size) chunks.current.push(event.data); };
      mr.onstop = () => {
        stream.getTracks().forEach((track) => track.stop());
        if (audioCtx.current) { void audioCtx.current.close().catch(() => {}); audioCtx.current = null; }
        if (rafId.current) { cancelAnimationFrame(rafId.current); rafId.current = null; }
        if (recTimer.current) { window.clearInterval(recTimer.current); recTimer.current = null; }
        const wasCanceled = canceledRef.current;
        setRecording(false); setRecSeconds(0); setRecBars([]);
        if (wasCanceled) return;
        const blob = new Blob(chunks.current, { type: mr.mimeType || "audio/webm" });
        if (blob.size > 0) void upload(new File([blob], `audio-${Date.now()}.webm`, { type: blob.type }), "audio");
      };
      mr.start();
      setRecording(true); setRecSeconds(0); setRecBars([]);
      recTimer.current = window.setInterval(() => setRecSeconds((s) => s + 1), 1000);
      try {
        const ctx = new AudioContext(); audioCtx.current = ctx;
        const src = ctx.createMediaStreamSource(stream); const analyser = ctx.createAnalyser(); analyser.fftSize = 256; src.connect(analyser);
        const data = new Uint8Array(analyser.frequencyBinCount);
        const tick = () => { analyser.getByteFrequencyData(data); let sum = 0; for (let i = 0; i < data.length; i++) sum += data[i]; const level = Math.min(100, Math.max(8, Math.round((sum / data.length) / 1.4))); setRecBars((prev) => [...prev.slice(-30), level]); rafId.current = requestAnimationFrame(tick); };
        tick();
      } catch { /* waveform é opcional */ }
    }).catch(() => setError("Autorize o microfone para gravar o áudio."));
  }
  function stopRecording(sendIt: boolean) { canceledRef.current = !sendIt; try { recorder.current?.stop(); } catch { /* ignore */ } }
  async function scheduleMessage(content: string, when: string) { if (!selected?.sendBig || !lead.telefone) return; setSending(true); setError(null); try { await liveAction({ action: "schedule", phone: lead.telefone, instanceId: selected.sendBig, leadId: lead.id, content, when }); setDraft(""); setScheduleOpen(false); } catch (reason) { setError(reason instanceof Error ? reason.message : "Não foi possível agendar."); } finally { setSending(false); } }
  async function sendApproach() { if (!selected?.sendBig || !lead.telefone) return; setSending(true); setError(null); try { const response = await authedFetch("/api/approaches", { headers: { Authorization: `Bearer ${accessToken}` } }); const result = await response.json() as { approaches?: Array<{ id: number; nome: string; ativo: boolean }>; error?: string }; if (!response.ok) throw new Error(result.error || "Não foi possível carregar as abordagens."); const active = (result.approaches ?? []).filter((item) => item.ativo); const choice = window.prompt(`Digite o ID da abordagem:\n${active.map((item) => `${item.id} — ${item.nome}`).join("\n")}`); if (!choice) return; await liveAction({ action: "sendApproach", approachId: Number(choice), phone: lead.telefone, instanceId: selected.sendBig, leadId: lead.id, leadName: lead.nome }); } catch (reason) { setError(reason instanceof Error ? reason.message : "Não foi possível enviar a abordagem."); } finally { setSending(false); } }
  return <div className="crm-drawer-layer chat-layer" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}><aside className={`lead-chat-drawer ${collapsed ? "is-collapsed" : ""}`}><header><div><span>{initials(lead.nome)}</span><div><small>CONVERSA DO LEAD #{lead.id}</small><h2>{lead.nome || "Lead sem nome"}</h2><p>{lead.telefone || "Telefone não informado"}</p></div></div><div className="chat-head-actions"><button type="button" onClick={() => setCollapsed((v) => !v)} title={collapsed ? "Expandir" : "Minimizar"} aria-label="Minimizar">{collapsed ? "▢" : "—"}</button><button type="button" onClick={onClose} aria-label="Fechar">×</button></div></header><section className="chat-instance-bar"><label>Instância do histórico<select value={selectedKey} onChange={(event) => setSelectedKey(event.target.value)}><option value="">Selecione</option>{instances.map((item) => <option value={item.key} key={item.key}>{item.nome}{last4(item.numero) ? ` · final ${last4(item.numero)}` : ""} · {item.corretor || "sem corretor"} · {item.msgs} msgs{item.sendBig ? (item.conectada ? "" : " · desconectada") : " · só histórico"}</option>)}</select></label><span className={selected?.conectada ? "connected" : ""}>{selected?.conectada ? `● conectada${last4(selected?.numero) ? ` · final ${last4(selected?.numero)}` : ""}` : "○ sem conexão confirmada"}</span></section>{error && <div className="chat-error">{error}</div>}<section className="chat-messages" ref={listRef}>{loading && <div className="chat-loading">Carregando conversa real…</div>}{!loading && messages.filter((item) => !hiddenIds.has(String(item.wa_message_id || item.id))).map((item) => <article className={`${item.direcao === "enviada" ? "sent" : "received"} ${item.direcao === "enviada" && ackState(item.status) === "erro" ? "msg-failed" : ""}`} key={item.id}>{!String(item.id).startsWith("temp-") && (confirmDel === String(item.wa_message_id || item.id)
  ? <span className="msg-del-confirm"><span>Apagar?</span><button type="button" className="mdc-yes" onClick={() => { setConfirmDel(null); void hideMessage(item); }}>Apagar</button><button type="button" className="mdc-no" aria-label="Cancelar" onClick={() => setConfirmDel(null)}>Cancelar</button></span>
  : <button type="button" className="msg-del" title="Excluir da conversa" aria-label="Excluir mensagem" onClick={() => setConfirmDel(String(item.wa_message_id || item.id))}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14M10 11v6M14 11v6" /></svg></button>)}<small>{item.tipo}</small>{item.direcao === "enviada" && item.tipo === "audio" && (item.status === "enviando" || item.status === "erro") ? <span className={`audio-state ${item.status}`}>{item.status === "enviando" ? <><i className="audio-spin" />Enviando áudio…</> : <>⚠ Áudio não enviado</>}</span> : <MessageMedia message={item} />}{item.conteudo && <p>{item.conteudo}</p>}{item.direcao === "enviada" && ackState(item.status) === "erro" && <span className="msg-erro-motivo">⚠ {item.status_detalhe || "Não foi possível entregar esta mensagem."}</span>}<time>{item.criado_em ? dateTime.format(new Date(item.criado_em)) : ""}{item.direcao === "enviada" && <StatusTick status={item.status} detalhe={item.status_detalhe} />}</time></article>)}{!loading && messages.length === 0 && <div className="crm-empty-view">Nenhuma mensagem encontrada nesta instância.</div>}</section>{!recording && <section className="mini-chat-tools"><button type="button" disabled={sending} onClick={() => startRecording()} title="Gravar áudio" aria-label="Gravar áudio"><span className="mct-ico"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="2" width="6" height="12" rx="3" /><path d="M5 10a7 7 0 0 0 14 0" /><line x1="12" y1="17" x2="12" y2="21" /></svg></span><span className="mct-lbl">Áudio</span></button><button type="button" onClick={() => fileInput.current?.click()} title="Anexar mídia" aria-label="Anexar mídia"><span className="mct-ico"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="M21.4 11.05 12.2 20.2a5 5 0 0 1-7.1-7.1l9.2-9.2a3.3 3.3 0 0 1 4.7 4.7l-9.2 9.2a1.6 1.6 0 0 1-2.3-2.3l8.5-8.5" /></svg></span><span className="mct-lbl">Documento</span></button><button type="button" onClick={() => setScheduleOpen(true)} title="Agendar mensagem" aria-label="Agendar mensagem"><span className="mct-ico"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg></span><span className="mct-lbl">Agendar</span></button><button type="button" onClick={() => void sendApproach()} title="Enviar abordagem" aria-label="Enviar abordagem"><span className="mct-ico"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="M3 11.5 12 4l9 7.5" /><path d="M5 10v9a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-9" /></svg></span><span className="mct-lbl">Abordagem</span></button><input ref={fileInput} hidden type="file" accept="image/*,video/*,audio/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx" onChange={(event) => void upload(event.target.files?.[0])} /></section>}{copiloto.data?.mensagem_sugerida && suggestOpen && <div className="chat-suggestion"><button type="button" className="cs-close" aria-label="Fechar sugestão" title="Fechar sugestão" onClick={() => setSuggestOpen(false)}>×</button><div><b>✦ Sugestão da Sara</b><p>{copiloto.data.mensagem_sugerida}</p></div><div className="chat-suggestion-actions"><button type="button" className="cs-use" onClick={() => { setDraft(copiloto.data!.mensagem_sugerida!); setSuggestOpen(false); }}>Usar</button><button type="button" className="cs-send" disabled={sending} onClick={() => { void sendSuggestion(copiloto.data!.mensagem_sugerida!); setSuggestOpen(false); }}>➤ Enviar</button></div></div>}{recording ? <footer className="chat-rec-bar"><button type="button" className="rec-cancel" title="Cancelar gravação" aria-label="Cancelar" onClick={() => stopRecording(false)}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14" /></svg></button><div className="rec-wave">{recBars.length === 0 ? <span className="rec-idle">Ouvindo…</span> : recBars.map((h, i) => <i key={i} style={{ height: `${h}%` }} />)}</div><span className="rec-dot" /><span className="rec-time">{fmtRec(recSeconds)}</span><button type="button" className="rec-send" title="Enviar áudio" aria-label="Enviar áudio" onClick={() => stopRecording(true)}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M13 6l6 6-6 6" /></svg></button></footer> : <footer><button type="button" className={`chat-sara-toggle${copiloto.data?.mensagem_sugerida ? " ready" : ""}${suggestOpen ? " active" : ""}`} disabled={!copiloto.data?.mensagem_sugerida} title={copiloto.data?.mensagem_sugerida ? (suggestOpen ? "Ocultar sugestão da Sara" : "Ver sugestão da Sara") : (copiloto.loading ? "Sara analisando o atendimento…" : "Sem sugestão da Sara no momento")} aria-label="Sugestão da Sara" onClick={() => setSuggestOpen((value) => !value)}><svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2l1.9 5.1L19 9l-5.1 1.9L12 16l-1.9-5.1L5 9l5.1-1.9L12 2z" /><path d="M19 14l.7 1.9L21.6 17l-1.9.6L19 19.6l-.6-1.9L16.5 17l1.9-.5L19 14z" /></svg></button><textarea value={draft} onChange={(event) => setDraft(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); void send(); } }} placeholder={selected?.sendBig ? "Escreva uma mensagem..." : "Escreva aqui — vamos indicar se a instância precisar de conexão"} disabled={sending} /><button type="button" disabled={!draft.trim() || sending} onClick={() => void send()}>{sending ? "…" : "➤"}</button></footer>}<div className="chat-deal-status">Negócio #{deal.id} · Histórico, anexos e agendamentos usam a instância escolhida.</div>{scheduleOpen && <ScheduleModal initialText={draft} onClose={() => setScheduleOpen(false)} onSchedule={(content, when) => scheduleMessage(content, when)} />}</aside></div>;
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function PipelineView({ stages, deals, leadById, brokerById, onOpen, draggingId, onDrag, onDrop }: { stages: Stage[]; deals: Deal[]; leadById: Map<number, Lead>; brokerById: Map<number, Broker>; onOpen: (id: number) => void; draggingId: number | null; onDrag: (id: number | null) => void; onDrop: (event: DragEvent, stageId: number) => Promise<void> }) {
  return <section className="crm-kanban-v2">{stages.map((stage) => { const items = deals.filter((deal) => deal.stage_id === stage.id); return <article className="crm-stage" style={{ "--stage": stage.cor || "#8d2bd1" } as CSSProperties} key={stage.id} onDragOver={(event) => event.preventDefault()} onDrop={(event) => void onDrop(event, stage.id)}><header><div><i /><strong>{stage.rotulo || stage.nome}</strong></div><span>{items.length}</span></header><div className="crm-stage-body">{items.map((deal) => { const lead = leadById.get(deal.lead_id)!; const broker = brokerById.get(deal.corretor_id ?? lead.corretor_id ?? -1); const tags = tagList(lead.tags); return <button draggable type="button" className={`crm-lead-card ${draggingId === deal.id ? "dragging" : ""}`} onDragStart={(event) => { event.dataTransfer.setData("text/deal-id", String(deal.id)); onDrag(deal.id); }} onDragEnd={() => onDrag(null)} onClick={() => onOpen(deal.id)} key={deal.id}><div className="card-person"><span>{initials(lead.nome)}</span><div><strong>{lead.nome || "Lead sem nome"}</strong><small>{lead.telefone || "Sem telefone"}</small></div><em>⋮</em></div><div className="card-context"><span>{lead.origem || "Sem origem"}</span>{deal.valor ? <b>{money.format(deal.valor)}</b> : <small>Valor a definir</small>}</div>{tags.length > 0 && <div className="card-tags">{tags.slice(0, 3).map((item) => <span key={item}>{item}</span>)}</div>}<footer><span className={`presence ${broker?.online ? "online" : ""}`} /> <strong>{broker?.nome || "Sem responsável"}</strong><time>{shortDate.format(new Date(deal.ultima_movimentacao || deal.criado_em))}</time></footer></button>; })}{items.length === 0 && <div className="crm-empty-stage">Arraste um lead para esta etapa</div>}</div></article>; })}</section>;
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function LeadsView({ deals, leadById, stageById, brokerById, onOpen }: { deals: Deal[]; leadById: Map<number, Lead>; stageById: Map<number, Stage>; brokerById: Map<number, Broker>; onOpen: (id: number) => void }) {
  return <section className="crm-table-wrap"><table className="crm-leads-table"><thead><tr><th>Lead</th><th>Contato</th><th>Etapa</th><th>Responsável</th><th>Origem</th><th>Valor</th><th>Atualização</th><th /></tr></thead><tbody>{deals.map((deal) => { const lead = leadById.get(deal.lead_id)!; const stage = stageById.get(deal.stage_id ?? -1); const broker = brokerById.get(deal.corretor_id ?? lead.corretor_id ?? -1); return <tr key={deal.id} onClick={() => onOpen(deal.id)}><td><div className="table-person"><span>{initials(lead.nome)}</span><div><strong>{lead.nome || "Lead sem nome"}</strong><small>#{lead.id}</small></div></div></td><td><strong>{lead.telefone || "—"}</strong><small>{lead.email || "E-mail não informado"}</small></td><td><span className="stage-pill" style={{ "--stage": stage?.cor || "#888" } as CSSProperties}>{stage?.rotulo || stage?.nome || "Sem etapa"}</span></td><td>{broker?.nome || "Sem responsável"}</td><td>{lead.origem || "—"}</td><td>{deal.valor ? money.format(deal.valor) : "—"}</td><td>{shortDate.format(new Date(deal.ultima_movimentacao || deal.criado_em))}</td><td><button type="button">›</button></td></tr>; })}</tbody></table>{deals.length === 0 && <div className="crm-empty-view">Nenhum lead encontrado com esses filtros.</div>}</section>;
}

function AgendaView({ data, leadById, onMutate, setMessage, sessionRole, accessToken }: { data: CrmData; leadById: Map<number, Lead>; onMutate: (body: Record<string, unknown>) => Promise<void>; setMessage: (value: string | null) => void; sessionRole: "admin" | "gestor" | "corretor"; accessToken: string }) {
  const [now] = useState(() => Date.now());
  const [busy, setBusy] = useState<string | number | null>(null);
  const [editVisit, setEditVisit] = useState<Visit | null>(null);
  const run = async (body: Record<string, unknown>, success: string, key: string | number) => { setBusy(key); try { await onMutate(body); setMessage(success); } catch (reason) { setMessage(reason instanceof Error ? reason.message : "Não foi possível salvar."); } finally { setBusy(null); } };
  const tasks = [...data.tasks].sort((a, b) => (a.vencimento || "9999").localeCompare(b.vencimento || "9999"));
  const visits = [...data.visits].sort((a, b) => `${a.data}${a.hora_inicio}`.localeCompare(`${b.data}${b.hora_inicio}`));
  const gerenteNome = (id: number | null) => data.gerentes?.find((g) => g.id === id)?.nome ?? "gerente";
  return <section className="crm-agenda-grid"><article className="agenda-panel"><header><div><span>✓</span><div><h2>Tarefas</h2><p>Acompanhamentos e retornos programados</p></div></div><b>{tasks.filter((item) => !item.concluida).length} pendentes</b></header><div>{tasks.map((task) => <article className={`agenda-item ${task.concluida ? "done" : ""} ${isOverdue(task, now) ? "overdue" : ""}`} key={task.id}><button disabled={busy === task.id} type="button" onClick={() => void run({ action: "toggleTask", taskId: task.id, completed: !task.concluida }, task.concluida ? "Tarefa reaberta." : "Tarefa concluída.", task.id)}>{task.concluida ? "✓" : ""}</button><div><strong>{task.titulo}</strong><span>{task.lead_id ? leadById.get(task.lead_id)?.nome || "Lead" : "Tarefa geral"}</span></div><time>{task.vencimento ? dateTime.format(new Date(task.vencimento)) : "Sem prazo"}</time></article>)}{tasks.length === 0 && <div className="crm-empty-view compact">Nenhuma tarefa cadastrada.</div>}</div></article><article className="agenda-panel visits"><header><div><span>◇</span><div><h2>Visitas</h2><p>Agenda comercial dos imóveis</p></div></div><b>{visits.filter((item) => item.status === "agendada").length} agendadas</b></header><div>{visits.map((visit) => <article className={`visit-item ${visit.status}`} key={visit.id}><div className="visit-date"><strong>{new Date(`${visit.data}T12:00:00`).getDate()}</strong><span>{new Intl.DateTimeFormat("pt-BR", { month: "short" }).format(new Date(`${visit.data}T12:00:00`))}</span></div><div><strong>{visit.cliente_nome || "Cliente"}</strong><span>{visit.produto || visit.local || "Local a confirmar"}</span><small>{visit.hora_inicio?.slice(0, 5) || "Horário a confirmar"} · {visit.status}{visit.com_gerente ? ` · 👤 ${gerenteNome(visit.gerente_id)}` : ""}</small></div><div className="visit-actions"><button type="button" className="visit-edit-btn" onClick={() => setEditVisit(visit)}>Editar</button>{visit.status === "agendada" && <button disabled={busy === visit.id} type="button" onClick={() => void run({ action: "updateVisitStatus", visitId: visit.id, status: "realizada" }, "Visita marcada como realizada.", visit.id)}>Concluir</button>}</div></article>)}{visits.length === 0 && <div className="crm-empty-view compact">Nenhuma visita agendada.</div>}</div></article>{editVisit && <VisitEditModal visit={editVisit} isAdmin={sessionRole !== "corretor"} accessToken={accessToken} gerentes={data.gerentes ?? []} onClose={() => setEditVisit(null)} onMutate={onMutate} setMessage={setMessage} />}</section>;
}

function VisitEditModal({ visit, isAdmin, accessToken, gerentes, onClose, onMutate, setMessage }: { visit: Visit; isAdmin: boolean; accessToken: string; gerentes: Gerente[]; onClose: () => void; onMutate: (body: Record<string, unknown>) => Promise<void>; setMessage: (value: string | null) => void }) {
  const [date, setDate] = useState(visit.data);
  const [start, setStart] = useState(visit.hora_inicio?.slice(0, 5) ?? "");
  const [end, setEnd] = useState(visit.hora_fim?.slice(0, 5) ?? "");
  const [local, setLocal] = useState(visit.local ?? "");
  const [obs, setObs] = useState(visit.observacoes ?? "");
  const [comGerente, setComGerente] = useState(visit.com_gerente);
  const [busy, setBusy] = useState(false);
  const [disp, setDisp] = useState<{ loading: boolean; conflitos: Array<{ cliente_nome: string | null; hora_inicio: string | null; hora_fim: string | null }>; gerenteId: number | null } | null>(null);
  const gerenteNome = gerentes.find((g) => g.id === visit.gerente_id)?.nome ?? (gerentes.find((g) => g.geral)?.nome ?? null);
  useEffect(() => {
    if (!comGerente || !date || !start) { setDisp(null); return; }
    let alive = true;
    setDisp((prev) => ({ loading: true, conflitos: prev?.conflitos ?? [], gerenteId: prev?.gerenteId ?? null }));
    const t = window.setTimeout(async () => {
      try {
        const response = await authedFetch("/api/crm", { method: "PATCH", headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" }, body: JSON.stringify({ action: "gerenteDisponibilidade", corretorId: visit.corretor_id, date, startTime: start, endTime: end || null, visitId: visit.id }) });
        const result = await response.json() as { conflitos?: Array<{ cliente_nome: string | null; hora_inicio: string | null; hora_fim: string | null }>; gerente_id?: number | null };
        if (alive) setDisp({ loading: false, conflitos: result.conflitos ?? [], gerenteId: result.gerente_id ?? null });
      } catch { if (alive) setDisp(null); }
    }, 450);
    return () => { alive = false; window.clearTimeout(t); };
  }, [comGerente, date, start, end, visit.corretor_id, visit.id, accessToken]);
  const save = async () => {
    setBusy(true);
    try {
      await onMutate({ action: "updateVisit", visitId: visit.id, date, startTime: start, endTime: end, local, observations: obs, ...(isAdmin ? { withManager: comGerente } : {}) });
      setMessage("Visita atualizada.");
      onClose();
    } catch (reason) { setMessage(reason instanceof Error ? reason.message : "Não foi possível salvar a visita."); }
    finally { setBusy(false); }
  };
  const conflitos = disp?.conflitos ?? [];
  return <div className="crm-center-modal"><form onSubmit={(event) => { event.preventDefault(); void save(); }}><header><div><span>VISITA</span><h2>Editar visita</h2><p>{visit.cliente_nome || "Cliente"} · {visit.produto || "Produto a confirmar"}</p></div><button type="button" onClick={onClose}>×</button></header>
    <div className="visit-edit-grid"><label>Data<input type="date" value={date} onChange={(event) => setDate(event.target.value)} /></label><label>Início<input type="time" value={start} onChange={(event) => setStart(event.target.value)} /></label><label>Fim<input type="time" value={end} onChange={(event) => setEnd(event.target.value)} /></label><label>Local<input value={local} onChange={(event) => setLocal(event.target.value)} placeholder="Local da visita" /></label></div>
    <label className="visit-edit-obs">Observações<textarea value={obs} onChange={(event) => setObs(event.target.value)} rows={2} /></label>
    <div className="visit-manager-row"><label className="check"><input type="checkbox" disabled={!isAdmin} checked={comGerente} onChange={(event) => setComGerente(event.target.checked)} /> Com gerente{gerenteNome ? ` · ${gerenteNome}` : ""}</label>{!isAdmin && <small>Só o admin liga/desliga "com gerente".</small>}</div>
    {comGerente && <div className={`visit-disp ${conflitos.length ? "conflito" : "livre"}`}>{disp?.loading ? "Checando a agenda do gerente…" : conflitos.length ? `⚠ ${gerenteNome || "O gerente"} já tem ${conflitos.length} visita${conflitos.length > 1 ? "s" : ""} nesse horário (${conflitos.map((c) => `${c.hora_inicio?.slice(0, 5) ?? ""} ${c.cliente_nome ?? ""}`.trim()).join("; ")}). Você pode salvar mesmo assim.` : `✓ ${gerenteNome || "Gerente"} está livre nesse horário.`}</div>}
    <footer><button type="button" onClick={onClose}>Cancelar</button><button className="crm-primary" disabled={busy || !date || !start} type="submit">{busy ? "Salvando…" : "Salvar"}</button></footer>
  </form></div>;
}

function ActivitiesView({ data, leadById, brokerById, onOpen }: { data: CrmData; leadById: Map<number, Lead>; brokerById: Map<number, Broker>; onOpen: (leadId: number) => void }) {
  const feed = [...data.activities, ...(data.historico ?? [])].sort((a, b) => new Date(b.criado_em).getTime() - new Date(a.criado_em).getTime());
  return <section className="crm-activity-view"><header><div><h2>Histórico da operação</h2><p>Observações, movimentações e registros do atendimento.</p></div><span>{feed.length} registros</span></header><div className="activity-feed">{feed.map((activity) => { const lead = activity.lead_id ? leadById.get(activity.lead_id) : null; const broker = activity.corretor_id ? brokerById.get(activity.corretor_id) : null; return <button type="button" onClick={() => activity.lead_id && onOpen(activity.lead_id)} key={`${activity.tipo}-${activity.id}`}><span className={`activity-symbol ${activity.tipo}`}>{activity.tipo === "observacao" ? "✎" : activity.tipo === "descarte" ? "×" : "↻"}</span><div><strong>{activity.tipo.replaceAll("_", " ")}</strong><p>{activity.texto || "Atividade registrada"}</p><small>{lead?.nome || "Operação geral"}{broker ? ` · ${broker.nome}` : ""}</small></div><time>{dateTime.format(new Date(activity.criado_em))}</time></button>; })}{feed.length === 0 && <div className="crm-empty-view">Nenhuma atividade registrada ainda.</div>}</div></section>;
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

function useLeadCopiloto(accessToken: string, leadNome: string) {
  const [state, setState] = useState<{ loading: boolean; data: { nota?: number | null; feedbacks?: { criterio?: string; positivo?: boolean; texto?: string }[]; proxima_acao?: string | null; mensagem_sugerida?: string | null } | null }>({ loading: true, data: null });
  useEffect(() => {
    if (!leadNome) { setState({ loading: false, data: null }); return; }
    let alive = true;
    setState({ loading: true, data: null });
    fetch(`/api/agentes/copiloto-lead?lead=${encodeURIComponent(leadNome)}`, { headers: { Authorization: `Bearer ${accessToken}` } })
      .then((r) => r.json())
      .then((d) => { if (alive) setState({ loading: false, data: d?.ok ? d : null }); })
      .catch(() => { if (alive) setState({ loading: false, data: null }); });
    return () => { alive = false; };
  }, [accessToken, leadNome]);
  return state;
}

function LeadDrawer({ accessToken, lead, deal, data, canReassign, canMoveDeals, onClose, onMutate, onReload, setMessage }: { accessToken: string; lead: Lead; deal: Deal; data: CrmData; canReassign: boolean; canMoveDeals?: boolean; onClose: () => void; onMutate: (body: Record<string, unknown>) => Promise<void>; onReload: () => Promise<void>; setMessage: (value: string | null) => void }) {
  const copiloto = useLeadCopiloto(accessToken, lead.nome || "");
  const [tab, setTab] = useState<"resumo" | "historico" | "agenda" | "produtos">("resumo");
  /* Doc §5 — abas arrastáveis com ordem persistida */
  const [tabOrder, setTabOrder] = useState<string[]>(["resumo", "historico", "agenda", "produtos"]);
  const [dragTab, setDragTab] = useState<string | null>(null);
  useEffect(() => {
    try {
      const stored = JSON.parse(window.localStorage.getItem("apecerto-lead-tab-order") || "null") as unknown;
      if (Array.isArray(stored)) {
        const valid = stored.filter((key): key is string => typeof key === "string" && ["resumo", "historico", "agenda", "produtos"].includes(key));
        if (valid.length) setTabOrder([...new Set([...valid, "resumo", "historico", "agenda", "produtos"])]);
      }
    } catch { /* ordem padrão */ }
  }, []);
  function reorderTab(target: string) {
    if (!dragTab || dragTab === target) return;
    setTabOrder((current) => {
      const next = current.filter((key) => key !== dragTab);
      next.splice(next.indexOf(target), 0, dragTab);
      try { window.localStorage.setItem("apecerto-lead-tab-order", JSON.stringify(next)); } catch { /* sem persistência */ }
      return next;
    });
  }
  const [form, setForm] = useState({ nome: lead.nome || "", telefone: lead.telefone || "", email: lead.email || "", instagram: lead.instagram || "", origem: lead.origem || "", status: lead.status, corretor_id: lead.corretor_id ? String(lead.corretor_id) : "", tags: tagList(lead.tags).join(", "), valor: deal.valor ? String(deal.valor) : "" });
  const [note, setNote] = useState(""); const [task, setTask] = useState(""); const [due, setDue] = useState(""); const [productId, setProductId] = useState("");
  const [action, setAction] = useState<"visit" | "transfer" | "discard" | null>(null); const [busy, setBusy] = useState(false);
  const [quickAction, setQuickAction] = useState<QuickAction | null>(null); const [productOpen, setProductOpen] = useState(false); const [saleOpen, setSaleOpen] = useState(false); const [chatData, setChatData] = useState<ChatData | null>(null);
  const [visit, setVisit] = useState({ date: "", startTime: "", endTime: "", productId: "", local: "", observations: "", reminder: true, withManager: false });
  const [transferBroker, setTransferBroker] = useState(""); const [discard, setDiscard] = useState({ reason: "", observation: "" });
  const stages = data.stages.filter((stage) => stage.pipeline_id === deal.pipeline_id); const activities = [...data.activities, ...(data.historico ?? [])].filter((item) => item.lead_id === lead.id).sort((a, b) => new Date(b.criado_em).getTime() - new Date(a.criado_em).getTime()); const tasks = data.tasks.filter((item) => item.lead_id === lead.id); const visits = data.visits.filter((item) => item.lead_id === lead.id || item.negocio_id === deal.id); const links = data.productLinks.filter((item) => item.lead_id === lead.id); const linkedIds = new Set(links.map((item) => item.empreendimento_id));
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
    const response = await authedFetch(endpoint, { method: endpoint === "/api/crm" ? "PATCH" : "POST", headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const result = await response.json() as { error?: string };
    if (!response.ok) throw new Error(result.error || "Não foi possível concluir.");
    setMessage("Ação concluída e salva no Supabase."); await onReload();
  };
  const openProduct = async () => {
    try { const response = await authedFetch("/api/live-chat", { headers: { Authorization: `Bearer ${accessToken}` } }); const result = await response.json() as ChatData & { error?: string }; if (!response.ok) throw new Error(result.error); setChatData(result); setProductOpen(true); }
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
      <article className="lead-next-action"><header><span>✦</span><b>PRÓXIMA MELHOR AÇÃO</b></header>{copiloto.loading ? <h3>Sara analisando o atendimento…</h3> : <><h3>{copiloto.data?.proxima_acao || `Fazer follow-up com ${lead.nome?.split(/\s+/)[0] || "o lead"}`}</h3><p>{copiloto.data?.resumo_nota || "Um retorno curto mantém o lead ativo."}</p></>}</article>
      <article className="lead-nota-card"><header><b>★ NOTA DO ATENDIMENTO</b>{!copiloto.loading && copiloto.data?.nota != null && <em>{copiloto.data.nota}/10</em>}</header>{copiloto.loading ? <p>Ouvindo os áudios e avaliando a conversa…</p> : (copiloto.data?.feedbacks?.length ? <ul className="lead-feedbacks">{copiloto.data.feedbacks.map((f, i) => <li key={i} className={f.positivo ? "pos" : "neg"}><span>{f.positivo ? "✓" : "✗"}</span><div>{f.criterio ? <b>{f.criterio}: </b> : null}{f.texto}</div></li>)}</ul> : <p>Ainda não há conversa suficiente para avaliar este atendimento.</p>)}</article>
      <h4>AÇÕES RÁPIDAS</h4>
      <div className="lead-action-grid">
        <button type="button" onClick={() => setQuickAction("task")}><LeadActionIcon name="task" /><span>Tarefas</span></button>
        <button type="button" onClick={() => setQuickAction("visit")}><LeadActionIcon name="visit" /><span>Agendar visita</span></button>
        <button type="button" onClick={() => void openProduct()}><LeadActionIcon name="product" /><span>Enviar produto</span></button>
        <button type="button" onClick={() => setSaleOpen(true)}><LeadActionIcon name="proposal" /><span>Gerar venda</span></button>
        <button type="button" onClick={() => setQuickAction("financing")}><LeadActionIcon name="financing" /><span>Financiamento</span></button>
        {canReassign && <button type="button" onClick={() => setQuickAction("transfer")}><LeadActionIcon name="transfer" /><span>Transferir</span></button>}
        <button type="button" onClick={() => setQuickAction("callReminder")}><LeadActionIcon name="call" /><span>Lembrete de ligação</span></button>
        <button type="button" onClick={() => setQuickAction("note")}><LeadActionIcon name="note" /><span>Observação</span></button>
        <button type="button" onClick={() => { setTask(`Fazer follow-up com ${lead.nome || "o lead"}`); setTab("agenda"); setMessage("Sugestão da IA preparada como próxima tarefa."); }}><LeadActionIcon name="ai" /><span>Pedir à IA</span></button>
      </div>
      <article className="lead-context-card"><div><small>ORIGEM</small><strong><span>⌘</span>{lead.origem || "Não informada"}</strong></div><div><small>PRODUTO DE INTERESSE</small><strong><span>▥</span>{currentProduct?.nome || "—"}</strong></div><p>ⓘ Origem e interesse são distintos — alimentam o BI de campanhas.</p><footer><small>Corretor responsável</small><strong><span>♧</span>{responsible?.nome || "Não definido"}</strong></footer></article>
      <article className="lead-funnel-status"><h4>ETAPA DO FUNIL</h4><div className="lead-stage-track">{stages.map((stage, index) => <i className={index <= stageIndex ? "active" : ""} style={{ "--lead-stage-color": stage.cor || "#8b00cc" } as CSSProperties} key={stage.id} />)}</div>{canMoveDeals !== false && data.pipelines.length > 1 && <label className="lead-pipe-move"><span>FUNIL (PIPE)</span><select value={deal.pipeline_id} disabled={busy} onChange={(event) => { const target = Number(event.target.value); if (target === deal.pipeline_id) return; const first = data.stages.filter((s) => s.pipeline_id === target).sort((a, b) => a.ordem - b.ordem)[0]; if (!first) { setMessage("Esse funil ainda não tem etapas configuradas."); return; } const pname = data.pipelines.find((p) => p.id === target)?.nome || "outro funil"; void run({ action: "moveDeal", dealId: deal.id, stageId: first.id }, `Lead movido para o funil ${pname}.`); }}>{data.pipelines.map((p) => <option value={p.id} key={p.id}>{p.nome}</option>)}</select></label>}{canMoveDeals !== false && <label className="lead-stage-move"><span>ETAPA</span><select value={deal.stage_id ?? ""} disabled={busy} onChange={(event) => void run({ action: "moveDeal", dealId: deal.id, stageId: Number(event.target.value) }, "Etapa atualizada.")}>{stages.map((stage) => <option value={stage.id} key={stage.id}>{stage.rotulo || stage.nome}</option>)}</select></label>}{canMoveDeals !== false && <button type="button" onClick={() => setAction("discard")}>Descartar lead</button>}</article>
    </section>
    <nav className="drawer-tabs-v2 draggable-tabs">{tabOrder.map((key) => { const label = key === "resumo" ? "Resumo" : key === "historico" ? "Histórico" : key === "agenda" ? "Tarefas e visitas" : `Produtos (${links.length})`; return <button
      className={`${tab === key ? "active" : ""} ${dragTab === key ? "tab-dragging" : ""}`}
      type="button" draggable title="Clique para abrir · arraste para reordenar"
      onClick={() => setTab(key as typeof tab)}
      onDragStart={(event) => { event.dataTransfer.effectAllowed = "move"; setDragTab(key); }}
      onDragEnd={() => setDragTab(null)}
      onDragOver={(event) => event.preventDefault()}
      onDrop={(event) => { event.preventDefault(); reorderTab(key); setDragTab(null); }}
      key={key}>{label}</button>; })}</nav><div className="drawer-content-v2">
        {tab === "resumo" && <><section className="drawer-overview"><article><span>Valor do negócio</span><strong>{deal.valor ? money.format(deal.valor) : "A definir"}</strong></article><article><span>Responsável</span><strong>{data.brokers.find((broker) => broker.id === (deal.corretor_id ?? lead.corretor_id))?.nome || "Não definido"}</strong></article><article><span>Origem</span><strong>{lead.origem || "Não informada"}</strong></article></section><section className="drawer-card-v2"><div className="drawer-section-title"><div><h3>Dados do lead</h3><p>Informações de contato e qualificação.</p></div><span>Salvo no Supabase</span></div><div className="drawer-form-v2"><label>Nome<input value={form.nome} onChange={(event) => setForm({ ...form, nome: event.target.value })} /></label><label>Telefone<input value={form.telefone} onChange={(event) => setForm({ ...form, telefone: event.target.value })} /></label><label>E-mail<input type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} /></label><label>Instagram<input value={form.instagram} onChange={(event) => setForm({ ...form, instagram: event.target.value })} /></label><label>Origem<input value={form.origem} onChange={(event) => setForm({ ...form, origem: event.target.value })} /></label><label>Status<input value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value })} /></label>{canReassign && <label>Responsável<select value={form.corretor_id} onChange={(event) => setForm({ ...form, corretor_id: event.target.value })}><option value="">Sem responsável</option>{data.brokers.map((broker) => <option value={broker.id} key={broker.id}>{broker.nome}</option>)}</select></label>}<label>Valor do negócio<input inputMode="numeric" value={form.valor} onChange={(event) => setForm({ ...form, valor: event.target.value })} /></label><label className="wide">Tags<input value={form.tags} onChange={(event) => setForm({ ...form, tags: event.target.value })} placeholder="investidor, moema, retorno" /></label></div><button className="crm-primary small" disabled={busy} type="button" onClick={() => void Promise.all([run({ action: "updateLead", leadId: lead.id, lead: { ...form, corretor_id: canReassign ? form.corretor_id || null : undefined, tags: form.tags.split(",").map((item) => item.trim()).filter(Boolean) } }, "Dados do lead salvos."), run({ action: "updateDeal", dealId: deal.id, valor: form.valor }, "Dados do negócio salvos.")])}>Salvar alterações</button></section></>}
        {tab === "historico" && <section className="drawer-card-v2"><div className="drawer-section-title"><div><h3>Histórico do atendimento</h3><p>Tudo o que foi registrado com este lead.</p></div></div><div className="drawer-note-create"><textarea className="drawer-note" value={note} onChange={(event) => setNote(event.target.value)} placeholder="Escreva uma observação importante..." /><button disabled={busy || !note.trim()} type="button" onClick={() => void run({ action: "addNote", leadId: lead.id, dealId: deal.id, texto: note }, "Observação registrada.").then((saved) => { if (saved) setNote(""); })}>Registrar</button></div><div className="drawer-timeline-v2">{activities.map((item) => <article key={`${item.tipo}-${item.id}`}><span>{item.tipo === "observacao" ? "✎" : "↻"}</span><div><strong>{item.tipo.replaceAll("_", " ")}</strong><p>{item.texto || "Atividade registrada"}</p><time>{dateTime.format(new Date(item.criado_em))}</time></div></article>)}{activities.length === 0 && <div className="crm-empty-view compact">Ainda não há registros neste histórico.</div>}</div></section>}
        {tab === "agenda" && <><section className="drawer-card-v2"><div className="drawer-section-title"><div><h3>Nova tarefa</h3><p>Crie um próximo passo para o atendimento.</p></div></div><div className="drawer-task-create"><input className="drawer-task-title" value={task} onChange={(event) => setTask(event.target.value)} placeholder="Ex.: Retornar contato" /><input type="datetime-local" value={due} onChange={(event) => setDue(event.target.value)} /><button disabled={busy || !task.trim()} type="button" onClick={() => void run({ action: "createTask", leadId: lead.id, dealId: deal.id, titulo: task, vencimento: due, prioridade: "normal" }, "Tarefa criada.").then(() => { setTask(""); setDue(""); })}>Criar tarefa</button></div><div className="drawer-list-v2">{tasks.map((item) => <article className={item.concluida ? "done" : ""} key={item.id}><button disabled={busy} type="button" onClick={() => void run({ action: "toggleTask", taskId: item.id, completed: !item.concluida }, item.concluida ? "Tarefa reaberta." : "Tarefa concluída.")}>{item.concluida ? "✓" : ""}</button><div><strong>{item.titulo}</strong><small>{item.vencimento ? dateTime.format(new Date(item.vencimento)) : "Sem vencimento"}</small></div></article>)}</div></section><section className="drawer-card-v2"><div className="drawer-section-title"><div><h3>Visitas</h3><p>Visitas vinculadas a este negócio.</p></div><button type="button" onClick={() => setAction("visit")}>＋ Agendar</button></div><div className="drawer-visits-v2">{visits.map((item) => <article key={item.id}><div><strong>{shortDate.format(new Date(`${item.data}T12:00:00`))}</strong><span>{item.hora_inicio?.slice(0, 5) || "—"}</span></div><div><strong>{item.produto || "Produto não definido"}</strong><small>{item.local || item.status}</small></div></article>)}{visits.length === 0 && <div className="crm-empty-view compact">Nenhuma visita vinculada.</div>}</div></section></>}
        {tab === "produtos" && <section className="drawer-card-v2"><div className="drawer-section-title"><div><h3>Produtos de interesse</h3><p>Associe imóveis ao atendimento deste lead.</p></div></div><div className="drawer-product-link"><select value={productId} onChange={(event) => setProductId(event.target.value)}><option value="">Selecione um produto</option>{data.products.filter((item) => !linkedIds.has(item.id)).map((item) => <option value={item.id} key={item.id}>{item.nome} · {item.bairro || "sem bairro"}</option>)}</select><button disabled={busy || !productId} type="button" onClick={() => void run({ action: "linkProduct", leadId: lead.id, productId }, "Produto vinculado.").then((saved) => { if (saved) setProductId(""); })}>Vincular</button></div><div className="drawer-products-v2">{links.map((link) => <article key={link.empreendimento_id}><div><span>⌂</span><div><strong>{link.empreendimentos?.nome || "Produto"}</strong><small>{[link.empreendimentos?.bairro, link.empreendimentos?.cidade].filter(Boolean).join(" · ") || "Localização não informada"}</small></div></div><strong>{link.empreendimentos?.preco ? money.format(link.empreendimentos.preco) : "Sob consulta"}</strong><button disabled={busy} type="button" onClick={() => void run({ action: "unlinkProduct", leadId: lead.id, productId: link.empreendimento_id }, "Produto desvinculado.")}>×</button></article>)}{links.length === 0 && <div className="crm-empty-view compact">Nenhum produto vinculado.</div>}</div></section>}
      </div>
      {quickAction && <QuickActionModal action={quickAction} lead={lead} deal={deal} brokers={data.brokers} products={data.products} onClose={() => setQuickAction(null)} onSave={async (payload, endpoint) => { await callExternal(payload, endpoint); setQuickAction(null); }} />}
      {productOpen && chatData && <ProductSendModal data={chatData} canSend={Boolean(contact && dapi)} onClose={() => setProductOpen(false)} onSend={async (content, mediaId) => { if (!contact || !dapi) throw new Error("Este lead precisa de uma conversa e uma instância conectada."); await callExternal({ action: "send", leadId: lead.id, dealId: deal.id, phone: contact.telefone, instanceId: dapi.id, content, mediaId }); setProductOpen(false); }} />}
      {saleOpen && <LeadSaleModal accessToken={accessToken} deal={deal} products={data.products} onClose={() => setSaleOpen(false)} onDone={async () => { setSaleOpen(false); await onReload(); setMessage("Venda gerada — o lead saiu do funil e foi para a Esteira de vendas (aguardando aprovação do gestor)."); }} />}
      {action && <div className="drawer-action-modal"><form onSubmit={(event) => { event.preventDefault(); if (action === "visit") void run({ action: "createVisit", leadId: lead.id, dealId: deal.id, ...visit }, "Visita agendada.").then(() => setAction(null)); if (action === "transfer") void run({ action: "transferDeal", dealId: deal.id, brokerId: Number(transferBroker) }, "Negócio transferido.").then(() => setAction(null)); if (action === "discard") void run({ action: "discardDeal", dealId: deal.id, ...discard }, "Negócio descartado.").then(() => { setAction(null); onClose(); }); }}><header><div><h3>{action === "visit" ? "Agendar visita" : action === "transfer" ? "Transferir atendimento" : "Descartar negócio"}</h3><p>{action === "visit" ? "A visita ficará ligada a este lead e ao produto." : action === "transfer" ? "Escolha quem assumirá este atendimento." : "O negócio será movido para a etapa de descarte."}</p></div><button type="button" onClick={() => setAction(null)}>×</button></header>{action === "visit" && <div className="action-form-grid"><label>Data<input required type="date" value={visit.date} onChange={(event) => setVisit({ ...visit, date: event.target.value })} /></label><label>Início<input required type="time" value={visit.startTime} onChange={(event) => setVisit({ ...visit, startTime: event.target.value })} /></label><label>Fim<input type="time" value={visit.endTime} onChange={(event) => setVisit({ ...visit, endTime: event.target.value })} /></label><label>Produto<select value={visit.productId} onChange={(event) => setVisit({ ...visit, productId: event.target.value })}><option value="">Selecionar depois</option>{data.products.map((item) => <option value={item.id} key={item.id}>{item.nome}</option>)}</select></label><label className="wide">Local<input value={visit.local} onChange={(event) => setVisit({ ...visit, local: event.target.value })} placeholder="Preenchido pelo endereço do produto" /></label><label className="wide">Observações<textarea value={visit.observations} onChange={(event) => setVisit({ ...visit, observations: event.target.value })} /></label><label className="check"><input type="checkbox" checked={visit.reminder} onChange={(event) => setVisit({ ...visit, reminder: event.target.checked })} /> Criar lembrete</label><label className="check"><input type="checkbox" checked={visit.withManager} onChange={(event) => setVisit({ ...visit, withManager: event.target.checked })} /> Com gerente</label></div>}{action === "transfer" && <label>Corretor responsável<select required value={transferBroker} onChange={(event) => setTransferBroker(event.target.value)}><option value="">Selecione</option>{data.brokers.filter((broker) => broker.id !== deal.corretor_id).map((broker) => <option value={broker.id} key={broker.id}>{broker.nome}{broker.online ? " · online" : ""}</option>)}</select></label>}{action === "discard" && <><label>Motivo<select required value={discard.reason} onChange={(event) => setDiscard({ ...discard, reason: event.target.value })}><option value="">Selecione</option>{discardReasons.map((item) => <option key={item}>{item}</option>)}</select></label><label>Observação<textarea value={discard.observation} onChange={(event) => setDiscard({ ...discard, observation: event.target.value })} /></label></>}<footer><button type="button" onClick={() => setAction(null)}>Cancelar</button><button className={action === "discard" ? "danger" : ""} disabled={busy} type="submit">Confirmar</button></footer></form></div>}
    </aside></div>;
}

function LeadSaleModal({ accessToken, deal, products, onClose, onDone }: { accessToken: string; deal: Deal; products: Product[]; onClose: () => void; onDone: () => Promise<void> }) {
  const [productId, setProductId] = useState(deal.empreendimento_id || ""); const [value, setValue] = useState(String(deal.valor || "")); const [busy, setBusy] = useState(false); const [error, setError] = useState("");
  return <div className="crm-center-modal"><form onSubmit={(event) => { event.preventDefault(); setBusy(true); setError(""); void authedFetch("/api/crm/sales", { method: "PATCH", headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" }, body: JSON.stringify({ action: "solicitar", dealId: deal.id, productId, vgv: Number(value) }) }).then(async (response) => { const result = await response.json() as { error?: string }; if (!response.ok) throw new Error(result.error); await onDone(); }).catch((reason) => setError(reason instanceof Error ? reason.message : "Não foi possível criar a venda.")).finally(() => setBusy(false)); }}><header><div><span>GERAR VENDA</span><h2>Gerar venda</h2><p>O lead sai do funil e vai para a Esteira de vendas. Se você for corretor, a entrada fica aguardando aprovação do gestor.</p></div><button type="button" onClick={onClose}>×</button></header>{error && <div className="modal-error">{error}</div>}<label>Produto<select required value={productId} onChange={(event) => setProductId(event.target.value)}><option value="">Selecione</option>{products.map((product) => <option value={product.id} key={product.id}>{product.nome}</option>)}</select></label><label>Valor da venda<input required min="1" type="number" value={value} onChange={(event) => setValue(event.target.value)} /></label><footer><button type="button" onClick={onClose}>Cancelar</button><button className="crm-primary" disabled={busy || !productId || !(Number(value) > 0)} type="submit">{busy ? "Enviando…" : "Enviar para aprovação"}</button></footer></form></div>;
}

function CreateLeadModal({ pipelines, brokers, initialPipelineId, canAssign = false, onClose, onCreate }: { pipelines: Pipeline[]; brokers: Broker[]; initialPipelineId: number | null; canAssign?: boolean; onClose: () => void; onCreate: (payload: Record<string, unknown>) => Promise<void> }) {
  const [form, setForm] = useState({ nome: "", telefone: "", email: "", origem: "manual", pipelineId: String(initialPipelineId ?? pipelines[0]?.id ?? ""), corretorId: "" }); const [busy, setBusy] = useState(false); const [error, setError] = useState<string | null>(null);
  return <div className="crm-center-modal"><form onSubmit={(event) => { event.preventDefault(); setBusy(true); setError(null); void onCreate({ ...form, pipelineId: Number(form.pipelineId), corretorId: canAssign ? form.corretorId || null : null }).catch((reason) => setError(reason instanceof Error ? reason.message : "Não foi possível criar o lead.")).finally(() => setBusy(false)); }}><header><div><span>NOVO ATENDIMENTO</span><h2>Cadastrar lead</h2><p>O negócio será criado automaticamente na primeira etapa.</p></div><button type="button" onClick={onClose}>×</button></header>{error && <div className="modal-error">{error}</div>}<div className="create-grid"><label>Nome<input required autoFocus value={form.nome} onChange={(event) => setForm({ ...form, nome: event.target.value })} placeholder="Nome do cliente" /></label><label>Telefone<input required value={form.telefone} onChange={(event) => setForm({ ...form, telefone: event.target.value })} placeholder="(11) 99999-9999" /></label><label>E-mail<input type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} /></label><label>Origem<input value={form.origem} onChange={(event) => setForm({ ...form, origem: event.target.value })} /></label><label>Funil<select required value={form.pipelineId} onChange={(event) => setForm({ ...form, pipelineId: event.target.value })}>{pipelines.map((pipeline) => <option value={pipeline.id} key={pipeline.id}>{pipeline.nome}</option>)}</select></label>{canAssign && <label>Responsável<select value={form.corretorId} onChange={(event) => setForm({ ...form, corretorId: event.target.value })}><option value="">Distribuição automática</option>{brokers.map((broker) => <option value={broker.id} key={broker.id}>{broker.nome}</option>)}</select></label>}</div>{!canAssign && <p className="quick-action-hint">Este lead será atribuído automaticamente a você.</p>}<footer><button type="button" onClick={onClose}>Cancelar</button><button className="crm-primary" disabled={busy} type="submit">{busy ? "Criando..." : "Criar lead"}</button></footer></form></div>;
}

/* Doc §6 — Gerenciador de funis e etapas (admin): criar/renomear/reordenar/excluir etapas e funis por produto. */
function StageConfigModal({ pipelines, stages, deals, leads, products, initialPipelineId, onClose, onChanged }: { pipelines: Array<Pipeline & { empreendimento_id?: string | null }>; stages: Stage[]; deals: Deal[]; leads: Lead[]; products: Product[]; initialPipelineId: number | null; onClose: () => void; onChanged: () => Promise<void> }) {
  const [pipelineId, setPipelineId] = useState<number | null>(initialPipelineId ?? pipelines[0]?.id ?? null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [newStage, setNewStage] = useState("");
  const [pipelineName, setPipelineName] = useState("");
  const [pipelineProduct, setPipelineProduct] = useState("");
  const [creatingPipeline, setCreatingPipeline] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [destinoId, setDestinoId] = useState("");
  const current = pipelines.find((pipeline) => pipeline.id === pipelineId) ?? null;
  const currentStages = stages.filter((stage) => stage.pipeline_id === pipelineId).sort((a, b) => a.ordem - b.ordem);
  const dealCount = (stageId: number) => deals.filter((deal) => deal.stage_id === stageId).length;
  const pipelineDeals = deals.filter((deal) => deal.pipeline_id === pipelineId).length;
  const pipelineLeads = leads.filter((lead) => lead.pipeline_id === pipelineId).length;
  const hasContent = pipelineDeals + pipelineLeads > 0;
  const otherPipelines = pipelines.filter((pipeline) => pipeline.id !== pipelineId);
  const canConfirmDelete = confirmText.trim().toLowerCase() === "remover" && (!hasContent || !!destinoId);

  useEffect(() => { setPipelineName(current?.nome ?? ""); setPipelineProduct((current as { empreendimento_id?: string | null } | null)?.empreendimento_id ?? ""); setDeleteOpen(false); setConfirmText(""); setDestinoId(""); }, [pipelineId, current]);

  const run = async (action: () => Promise<{ error: { message: string } | null }>, success: string) => {
    setBusy(true); setMessage("");
    const { error } = await action();
    if (error) setMessage(error.message);
    else { setMessage(success); await onChanged(); }
    setBusy(false);
  };
  const rpc = getBrowserSupabaseClient();

  return <div className="crm-center-modal stage-config-modal"><form onSubmit={(event) => event.preventDefault()}>
    <header><div><span>CONFIGURAÇÃO DO CRM</span><h2>Funis e etapas</h2><p>Criar, renomear, reordenar e excluir — sem perder nenhum negócio.</p></div><button type="button" onClick={onClose}>×</button></header>
    {message && <div className={message.includes("Etapa tem") || message.includes("apenas") ? "modal-error" : "stage-config-ok"}>{message}</div>}
    <div className="stage-config-pipeline">
      <label>Funil<select value={pipelineId ?? ""} onChange={(event) => setPipelineId(Number(event.target.value))}>{pipelines.map((pipeline) => <option value={pipeline.id} key={pipeline.id}>{pipeline.nome}</option>)}</select></label>
      <label>Renomear<input value={pipelineName} onChange={(event) => setPipelineName(event.target.value)} placeholder="Nome do funil" /></label>
      <label>Produto vinculado<select value={pipelineProduct} onChange={(event) => setPipelineProduct(event.target.value)}><option value="">Nenhum (funil geral)</option>{products.map((product) => <option value={product.id} key={product.id}>{product.nome}</option>)}</select></label>
      <button type="button" disabled={busy || !pipelineId} onClick={() => void run(() => rpc.rpc("crm_funil_salvar", { p_id: pipelineId, p_nome: pipelineName, p_empreendimento_id: pipelineProduct || null }), "Funil atualizado.")}>Salvar funil</button>
    </div>
    <div className="stage-config-list">
      {currentStages.map((stage, index) => <StageConfigRow key={stage.id} stage={stage} count={dealCount(stage.id)} busy={busy}
        onRename={(name, color) => void run(() => rpc.rpc("crm_etapa_salvar", { p_id: stage.id, p_nome: name, p_cor: color }), "Etapa atualizada.")}
        onMove={(direction) => { const ids = currentStages.map((item) => item.id); const target = index + direction; if (target < 0 || target >= ids.length) return; [ids[index], ids[target]] = [ids[target], ids[index]]; void run(() => rpc.rpc("crm_etapa_reordenar", { p_pipeline_id: pipelineId, p_ids: ids }), "Ordem atualizada."); }}
        onDelete={() => { if (!window.confirm(`Excluir a etapa "${stage.rotulo || stage.nome}"?`)) return; void run(() => rpc.rpc("crm_etapa_excluir", { p_id: stage.id }), "Etapa excluída."); }} />)}
    </div>
    <div className="stage-config-new">
      <input value={newStage} onChange={(event) => setNewStage(event.target.value)} placeholder="Nome da nova etapa" />
      <button type="button" disabled={busy || !newStage.trim() || !pipelineId} onClick={() => void run(() => rpc.rpc("crm_etapa_salvar", { p_pipeline_id: pipelineId, p_nome: newStage }), "Etapa criada.").then(() => setNewStage(""))}>＋ Adicionar etapa</button>
    </div>
    <div className="stage-config-newpipe">
      {creatingPipeline ? <>
        <input autoFocus placeholder="Nome do novo funil (ex.: Funil Reserva Alto da Mata)" value={pipelineName} onChange={(event) => setPipelineName(event.target.value)} />
        <button type="button" disabled={busy || !pipelineName.trim()} onClick={() => void run(() => rpc.rpc("crm_funil_salvar", { p_nome: pipelineName, p_empreendimento_id: pipelineProduct || null }), "Funil criado com etapas padrão.").then(() => setCreatingPipeline(false))}>Criar funil</button>
        <button type="button" onClick={() => setCreatingPipeline(false)}>Cancelar</button>
      </> : <button type="button" onClick={() => { setCreatingPipeline(true); setPipelineName(""); }}>＋ Novo funil por produto</button>}
    </div>
    <div className="stage-config-delete" style={{ marginTop: 14, paddingTop: 12, borderTop: "1px solid #f0ece9" }}>
      {!deleteOpen ? (
        <button type="button" style={dangerBtn} disabled={busy || !pipelineId || pipelines.length <= 1} title={pipelines.length <= 1 ? "Não é possível excluir o único funil." : "Excluir este funil"} onClick={() => { setDeleteOpen(true); setConfirmText(""); setDestinoId(""); }}>🗑 Excluir funil</button>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 9, padding: 13, border: "1px solid #f0caca", background: "#fdf3f3", borderRadius: 12 }}>
          <strong style={{ fontSize: 13 }}>Excluir o funil “{current?.nome}”?</strong>
          {hasContent ? (
            <>
              <p style={{ margin: 0, fontSize: 12, color: "#8a4a44" }}>Este funil tem <b>{pipelineDeals}</b> negócio(s) e <b>{pipelineLeads}</b> lead(s). Escolha para qual funil mover tudo — nada será apagado (bolsão):</p>
              <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 12 }}>Mover leads/negócios para<select value={destinoId} onChange={(event) => setDestinoId(event.target.value)}><option value="">Selecione o funil de destino</option>{otherPipelines.map((pipeline) => <option value={pipeline.id} key={pipeline.id}>{pipeline.nome}</option>)}</select></label>
            </>
          ) : <p style={{ margin: 0, fontSize: 12, color: "#8a4a44" }}>Este funil está vazio. A exclusão é definitiva.</p>}
          <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 12 }}>Para confirmar, digite <b>remover</b><input autoFocus value={confirmText} onChange={(event) => setConfirmText(event.target.value)} placeholder="remover" /></label>
          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
            <button type="button" onClick={() => setDeleteOpen(false)}>Cancelar</button>
            <button type="button" style={{ ...dangerBtn, opacity: (busy || !canConfirmDelete) ? 0.5 : 1 }} disabled={busy || !canConfirmDelete} onClick={() => { const alvo = pipelineId; void run(() => rpc.rpc("crm_funil_excluir", { p_id: alvo, p_destino_id: hasContent ? Number(destinoId) : null }), "Funil excluído.").then(() => { setDeleteOpen(false); setConfirmText(""); setDestinoId(""); setPipelineId(pipelines.find((pipeline) => pipeline.id !== alvo)?.id ?? null); }); }}>Remover funil</button>
          </div>
        </div>
      )}
    </div>
    <footer><span className="stage-config-hint">Etapas com negócios não podem ser excluídas — mova os negócios antes (Ações em massa).</span><button type="button" onClick={onClose}>Fechar</button></footer>
  </form></div>;
}

const dangerBtn: CSSProperties = { background: "#c9443d", color: "#fff", border: 0, borderRadius: 9, padding: "9px 14px", fontWeight: 700, cursor: "pointer" };

function StageConfigRow({ stage, count, busy, onRename, onMove, onDelete }: { stage: Stage; count: number; busy: boolean; onRename: (name: string, color: string) => void; onMove: (direction: number) => void; onDelete: () => void }) {
  const [name, setName] = useState(stage.rotulo || stage.nome);
  const [color, setColor] = useState(stage.cor || "#8d2bd1");
  const dirty = name !== (stage.rotulo || stage.nome) || color !== (stage.cor || "#8d2bd1");
  return <div className="stage-config-row">
    <div className="stage-config-order"><button type="button" disabled={busy} onClick={() => onMove(-1)} aria-label="Subir">▲</button><button type="button" disabled={busy} onClick={() => onMove(1)} aria-label="Descer">▼</button></div>
    <input type="color" value={color} onChange={(event) => setColor(event.target.value)} aria-label="Cor da etapa" />
    <input className="stage-config-name" value={name} onChange={(event) => setName(event.target.value)} />
    <span className="stage-config-count">{count} negócio{count === 1 ? "" : "s"}</span>
    {dirty && <button className="stage-config-save" type="button" disabled={busy} onClick={() => onRename(name, color)}>Salvar</button>}
    <button className="stage-config-del" type="button" disabled={busy || count > 0} title={count > 0 ? "Mova os negócios antes de excluir" : "Excluir etapa"} onClick={onDelete}>🗑</button>
  </div>;
}
