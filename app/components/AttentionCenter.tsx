"use client";
/* eslint-disable react-hooks/exhaustive-deps, react-hooks/set-state-in-effect, react-hooks/purity */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getBrowserSupabaseClient } from "../lib/supabase/browser";
import type { ChatData } from "../features/chat/LiveChatWorkspace";

type Lead = { id: number; nome: string | null; telefone: string | null; corretor_id: number | null; criado_em: string; atualizado_em: string | null };
type Deal = { id: number; lead_id: number; corretor_id: number | null; pipeline_id: number; status: string; ultima_movimentacao: string | null };
type Broker = { id: number; nome: string; usuario_id: string | null; online: boolean };
type Sla = { negocio_id: number | null; lead_id: number | null; sla_situacao: string | null; aguardando_humano: boolean | null; min_aguardando: number | string | null; min_sem_interacao: number | string | null; alarme_ativo: boolean | null; ultima_interacao: string | null };
type LeadAlarm = { id: number; negocio_id: number; corretor_id: number | null; criado_em: string };
type CrmAttentionData = { leads: Lead[]; deals: Deal[]; brokers: Broker[]; sla: Sla[]; alerts: LeadAlarm[]; error?: string };
type AlertKind = "new" | "waiting" | "message" | "risk";
type AttentionAlert = { id: string; kind: AlertKind; dealId: number; leadId: number; title: string; description: string; age: number; severity: number; occurredAt: string | null };
type AlertFilter = "all" | AlertKind;

const kindInfo: Record<AlertKind, { label: string; icon: string }> = {
  new: { label: "Chegaram agora", icon: "✦" },
  waiting: { label: "Sem atendimento", icon: "!" },
  message: { label: "Nova mensagem", icon: "●" },
  risk: { label: "Risco de perda", icon: "↘" },
};

const incoming = (direction?: string | null) => !["out", "saida", "saída", "enviada", "sent"].includes((direction || "").toLowerCase());
const minutesSince = (date?: string | null) => date ? Math.max(0, Math.round((Date.now() - new Date(date).getTime()) / 60000)) : 0;
const elapsed = (minutes: number) => {
  const value = Math.max(0, Math.round(Number(minutes) || 0));
  if (value < 1) return "agora";
  if (value < 60) return `${value} min`;
  if (value < 1440) return `${Math.floor(value / 60)}h ${value % 60}m`;
  const days = Math.floor(value / 1440);
  if (days < 7) return `${days}d ${Math.floor((value % 1440) / 60)}h`;
  const weeks = Math.floor(days / 7);
  if (days < 30) return `${weeks} sem ${days % 7}d`;
  if (days < 365) { const months = Math.floor(days / 30); return `${months} ${months === 1 ? "mês" : "meses"}`; }
  const years = Math.floor(days / 365);
  return `${years} ${years === 1 ? "ano" : "anos"}`;
};

function buildAlerts(crm: CrmAttentionData, chat: ChatData | null, brokerId: number | null) {
  const leadById = new Map(crm.leads.map((lead) => [lead.id, lead]));
  const dealByLead = new Map(crm.deals.map((deal) => [deal.lead_id, deal]));
  const dealById = new Map(crm.deals.map((deal) => [deal.id, deal]));
  const owns = (deal: Deal, lead?: Lead) => brokerId === null || (deal.corretor_id ?? lead?.corretor_id) === brokerId;
  const alerts = new Map<string, AttentionAlert>();

  for (const deal of crm.deals) {
    const lead = leadById.get(deal.lead_id);
    if (!lead || !owns(deal, lead) || deal.status === "perdido" || deal.status === "ganho") continue;
    const age = minutesSince(lead.criado_em);
    if (age <= 60) alerts.set(`new-${deal.id}`, { id: `new-${deal.id}`, kind: "new", dealId: deal.id, leadId: lead.id, title: lead.nome || "Novo lead", description: "Lead recebido agora — faça o primeiro contato.", age, severity: age <= 15 ? 5 : 4, occurredAt: lead.criado_em });
  }

  for (const alarm of crm.alerts) {
    const deal = dealById.get(alarm.negocio_id); const lead = deal && leadById.get(deal.lead_id);
    if (!deal || !lead || !owns(deal, lead)) continue;
    const age = minutesSince(alarm.criado_em);
    alerts.set(`waiting-${deal.id}`, { id: `waiting-${deal.id}`, kind: "waiting", dealId: deal.id, leadId: lead.id, title: lead.nome || "Lead aguardando", description: `Ainda sem atendimento há ${elapsed(age)}.`, age, severity: 5, occurredAt: alarm.criado_em });
  }

  for (const sla of crm.sla) {
    if (!sla.negocio_id) continue;
    const deal = dealById.get(sla.negocio_id); const lead = deal && leadById.get(deal.lead_id);
    if (!deal || !lead || !owns(deal, lead)) continue;
    const waiting = Number(sla.min_aguardando || 0);
    const inactive = Number(sla.min_sem_interacao || 0);
    if (sla.aguardando_humano || sla.alarme_ativo) {
      alerts.set(`waiting-${deal.id}`, { id: `waiting-${deal.id}`, kind: "waiting", dealId: deal.id, leadId: lead.id, title: lead.nome || "Cliente aguardando", description: sla.aguardando_humano ? `Cliente esperando resposta há ${elapsed(waiting)}.` : "Atendimento exige ação imediata.", age: waiting, severity: sla.alarme_ativo ? 5 : 4, occurredAt: sla.ultima_interacao });
    }
    if (inactive >= 1440 || ["atendimento_parado", "erro_abordagem"].includes(sla.sla_situacao || "")) {
      const level = inactive >= 10080 ? "Crítico" : inactive >= 4320 ? "Alto" : "Atenção";
      alerts.set(`risk-${deal.id}`, { id: `risk-${deal.id}`, kind: "risk", dealId: deal.id, leadId: lead.id, title: lead.nome || "Lead em risco", description: `${level}: ${elapsed(inactive)} sem interação útil.`, age: inactive, severity: inactive >= 4320 ? 4 : 3, occurredAt: sla.ultima_interacao });
    }
  }

  if (chat) {
    const contactById = new Map(chat.contacts.map((contact) => [contact.id, contact]));
    for (const conversation of chat.conversations) {
      const latest = chat.latest[conversation.id]; const contact = contactById.get(conversation.contato_id);
      if (!latest?.criado_em || !contact?.lead_id || !incoming(latest.direcao)) continue;
      const age = minutesSince(latest.criado_em); if (age > 30) continue;
      const deal = dealByLead.get(contact.lead_id); const lead = leadById.get(contact.lead_id);
      if (!deal || !lead || !owns(deal, lead)) continue;
      const alertId = `message-${deal.id}-${latest.id}`;
      alerts.set(alertId, { id: alertId, kind: "message", dealId: deal.id, leadId: lead.id, title: lead.nome || contact.nome || "Nova mensagem", description: latest.conteudo || `Cliente enviou ${latest.tipo || "uma mensagem"}.`, age, severity: 5, occurredAt: latest.criado_em });
    }
  }
  return [...alerts.values()].sort((a, b) => b.severity - a.severity || a.age - b.age);
}

export function AttentionCenter({ accessToken, onOpenLead, onOpenChat, onOpenNotifications }: { accessToken: string; onOpenLead: (dealId: number) => void; onOpenChat?: (leadId: number) => void; onOpenNotifications: () => void }) {
  const [crm, setCrm] = useState<CrmAttentionData | null>(null);
  const [chat, setChat] = useState<ChatData | null>(null);
  const [brokerId, setBrokerId] = useState<number | null>(null);
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState<AlertFilter>("all");
  const [dismissed, setDismissed] = useState<string[]>([]);
  const [mutedUntil, setMutedUntil] = useState(0);
  const previousSignature = useRef("");
  const initialized = useRef(false);

  const load = useCallback(async () => {
    const headers = { Authorization: `Bearer ${accessToken}` };
    const [crmResponse, chatResponse, userResult] = await Promise.all([
      fetch("/api/crm", { headers }), fetch("/api/live-chat", { headers }), getBrowserSupabaseClient().auth.getUser(),
    ]);
    const [crmBody, chatBody] = await Promise.all([crmResponse.json() as Promise<CrmAttentionData>, chatResponse.json() as Promise<ChatData & { error?: string }>]);
    if (!crmResponse.ok || !chatResponse.ok) throw new Error(crmBody.error || chatBody.error || "Não foi possível carregar os alertas.");
    const currentBroker = crmBody.brokers.find((broker) => broker.usuario_id === userResult.data.user?.id);
    setBrokerId(currentBroker?.id ?? null); setCrm(crmBody); setChat(chatBody);
  }, [accessToken]);

  useEffect(() => {
    const storedMute = Number(window.sessionStorage.getItem("apecerto-alert-muted-until") || 0);
    let storedDismissed: string[] = [];
    try {
      const parsed = JSON.parse(window.sessionStorage.getItem("apecerto-alert-dismissed") || "[]") as unknown;
      storedDismissed = Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string") : [];
    } catch { /* ignora preferências antigas inválidas */ }
    setMutedUntil(storedMute); setDismissed(storedDismissed);
    void load().catch(() => undefined);
    const poll = window.setInterval(() => void load().catch(() => undefined), 30000);
    const supabase = getBrowserSupabaseClient();
    const channel = supabase.channel("attention-center")
      .on("postgres_changes", { event: "*", schema: "public", table: "leads" }, () => { void load().catch(() => undefined); })
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "wa_mensagens" }, () => { void load().catch(() => undefined); })
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "crm_lead_alertas" }, () => { void load().catch(() => undefined); })
      .subscribe();
    return () => { window.clearInterval(poll); void supabase.removeChannel(channel); };
  }, [load]);

  const allAlerts = useMemo(() => crm ? buildAlerts(crm, chat, brokerId) : [], [crm, chat, brokerId]);
  const alerts = allAlerts.filter((alert) => !dismissed.includes(alert.id));
  const visible = filter === "all" ? alerts : alerts.filter((alert) => alert.kind === filter);
  const signature = alerts.map((alert) => alert.id).join("|");

  useEffect(() => {
    if (!initialized.current) { initialized.current = true; previousSignature.current = signature; return; }  // não abre sozinha ao entrar
    if (signature && signature !== previousSignature.current && Date.now() >= mutedUntil) setOpen(true);
    previousSignature.current = signature;
  }, [signature, mutedUntil]);

  function dismiss(id: string) {
    const next = [...new Set([...dismissed, id])]; setDismissed(next); window.sessionStorage.setItem("apecerto-alert-dismissed", JSON.stringify(next));
  }
  function dismissAll() { const next = [...new Set([...dismissed, ...alerts.map((alert) => alert.id)])]; setDismissed(next); window.sessionStorage.setItem("apecerto-alert-dismissed", JSON.stringify(next)); }
  function mute(minutes: number) { const until = Date.now() + minutes * 60000; setMutedUntil(until); window.sessionStorage.setItem("apecerto-alert-muted-until", String(until)); setOpen(false); }
  function leadHasChat(leadId: number) {
    if (!chat) return false;
    const contactIds = new Set(chat.contacts.filter((c) => c.lead_id === leadId).map((c) => c.id));
    return chat.conversations.some((c) => contactIds.has(c.contato_id));
  }
  function attend(alert: AttentionAlert) {
    dismiss(alert.id); setOpen(false);
    // Mensagem/cliente aguardando: abre direto no chat pra responder. Sem conversa (lead novo/risco): abre o lead.
    if (onOpenChat && (alert.kind === "message" || alert.kind === "waiting") && leadHasChat(alert.leadId)) onOpenChat(alert.leadId);
    else onOpenLead(alert.dealId);
  }

  const counts = Object.fromEntries((["new", "waiting", "message", "risk"] as AlertKind[]).map((kind) => [kind, alerts.filter((alert) => alert.kind === kind).length])) as Record<AlertKind, number>;
  return <>
    <button className={`attention-trigger ${alerts.length && Date.now() >= mutedUntil ? "ringing" : ""}`} type="button" onClick={() => setOpen(!open)} aria-label={`Central de alertas, ${alerts.length} pendentes`}><span aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 8-3 8h18s-3-1-3-8" /><path d="M10 20h4" /></svg></span><b>{alerts.length}</b></button>
    {open && <aside className="attention-popover" aria-label="Central de alertas de atendimento">
      <header><div><span>ATENDIMENTO EM TEMPO REAL</span><h2>Central de atenção</h2><p>{alerts.length ? `${alerts.length} ação(ões) pedem sua atenção` : "Tudo em dia por aqui"}</p></div><button type="button" onClick={() => setOpen(false)} aria-label="Fechar">×</button></header>
      <section className="attention-summary">{(["new", "waiting", "message", "risk"] as AlertKind[]).map((kind) => <button className={filter === kind ? `active ${kind}` : kind} type="button" onClick={() => setFilter(filter === kind ? "all" : kind)} key={kind}><i>{kindInfo[kind].icon}</i><strong>{counts[kind]}</strong><span>{kindInfo[kind].label}</span></button>)}</section>
      <nav><button className={filter === "all" ? "active" : ""} type="button" onClick={() => setFilter("all")}>Todos</button><button type="button" onClick={() => mute(15)}>Silenciar 15 min</button><button type="button" onClick={dismissAll}>Marcar todos como vistos</button></nav>
      <main>{visible.map((alert) => <article className={alert.kind} key={alert.id}><span>{kindInfo[alert.kind].icon}</span><div><small>{kindInfo[alert.kind].label} · {elapsed(alert.age)}</small><strong>{alert.title}</strong><p>{alert.description}</p><footer><button type="button" onClick={() => attend(alert)}>Abrir e atender</button><button type="button" onClick={() => dismiss(alert.id)}>Agora não</button></footer></div></article>)}{visible.length === 0 && <div className="attention-empty"><span>✓</span><strong>Nenhum alerta neste filtro</strong><p>Novos eventos aparecerão automaticamente.</p></div>}</main>
      <footer><button type="button" onClick={onOpenNotifications}>Abrir histórico de notificações</button><span>{Date.now() < mutedUntil ? `Silenciado por ${elapsed(Math.ceil((mutedUntil - Date.now()) / 60000))}` : "Atualização automática a cada 30 segundos"}</span></footer>
    </aside>}
  </>;
}
