"use client";
/* eslint-disable react-hooks/exhaustive-deps, react-hooks/set-state-in-effect, react-hooks/purity */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getBrowserSupabaseClient } from "../lib/supabase/browser";
import type { ChatData } from "../features/chat/LiveChatWorkspace";

type Lead = { id: number; nome: string | null; telefone: string | null; corretor_id: number | null; criado_em: string; atualizado_em: string | null };
type Deal = { id: number; lead_id: number; corretor_id: number | null; pipeline_id: number; status: string; ultima_movimentacao: string | null };
type Broker = { id: number; nome: string; usuario_id: string | null; online: boolean };
type Sla = { negocio_id: number | null; lead_id: number | null; sla_situacao: string | null; aguardando_humano: boolean | null; min_aguardando: number | string | null; min_sem_interacao: number | string | null; alarme_ativo: boolean | null; ultima_interacao: string | null; stage_id: number | null };
type LeadAlarm = { id: number; negocio_id: number; corretor_id: number | null; criado_em: string };
type Stage = { id: number; nome: string | null };
type CrmAttentionData = { leads: Lead[]; deals: Deal[]; brokers: Broker[]; sla: Sla[]; alerts: LeadAlarm[]; stages?: Stage[]; error?: string };
type AlertKind = "new" | "message" | "verde" | "amarelo" | "vermelho" | "preto";
type AttentionAlert = { id: string; kind: AlertKind; dealId: number; leadId: number; title: string; description: string; age: number; severity: number; occurredAt: string | null };
type AlertFilter = "all" | AlertKind;

const kindInfo: Record<AlertKind, { label: string; icon: string }> = {
  new: { label: "Chegaram agora", icon: "✦" },
  message: { label: "Nova mensagem", icon: "✉" },
  verde: { label: "Verde · em dia", icon: "●" },
  amarelo: { label: "Amarelo · 24–48h", icon: "●" },
  vermelho: { label: "Vermelho · 48–72h", icon: "●" },
  preto: { label: "Preto · +72h", icon: "●" },
};
const KINDS: AlertKind[] = ["new", "message", "verde", "amarelo", "vermelho", "preto"];
/* Mesma régua do card do funil: 24/48/72 horas. */
function corPorMinutos(minutes: number) {
  const horas = (Number(minutes) || 0) / 60;
  if (horas < 24) return "verde" as const;
  if (horas < 48) return "amarelo" as const;
  if (horas < 72) return "vermelho" as const;
  return "preto" as const;
}

// Classificação da etapa do funil para separar "Risco de perda" (etapa avançada) de "Desatualizado" (etapa fria).
const normStage = (value?: string | null) => (value || "").normalize("NFD").split("").filter((ch) => { const c = ch.charCodeAt(0); return c < 0x0300 || c > 0x036f; }).join("").replace(/[^a-zA-Z0-9\s]/g, " ").toLowerCase().replace(/\s+/g, " ").trim();
const STAGE_TERMINAL = ["comprou", "negocio fechado", "venda cancelada", "cancelou a compra", "descarte"];
const STAGE_AVANCADA = ["visita agendada", "tentando reagendamento", "visita realizada", "em negociacao"];
function classifyStage(nome?: string | null): "avancada" | "fria" | "terminal" {
  const n = normStage(nome);
  if (!n) return "fria";
  if (STAGE_TERMINAL.some((key) => n.includes(key))) return "terminal";
  if (STAGE_AVANCADA.some((key) => n.includes(key))) return "avancada";
  return "fria";
}

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
  const slaByDeal = new Map(crm.sla.filter((sla) => sla.negocio_id).map((sla) => [sla.negocio_id as number, sla]));
  const owns = (deal: Deal, lead?: Lead) => brokerId === null || (deal.corretor_id ?? lead?.corretor_id) === brokerId;
  const alerts = new Map<string, AttentionAlert>();
  const severidade: Record<AlertKind, number> = { message: 6, new: 5, preto: 4, vermelho: 3, amarelo: 2, verde: 1 };

  // Nova mensagem (últimos 30 min) tem precedência sobre tudo.
  if (chat) {
    const contactById = new Map(chat.contacts.map((contact) => [contact.id, contact]));
    for (const conversation of chat.conversations) {
      const latest = chat.latest[conversation.id]; const contact = contactById.get(conversation.contato_id);
      if (!latest?.criado_em || !contact?.lead_id || !incoming(latest.direcao)) continue;
      const age = minutesSince(latest.criado_em); if (age > 30) continue;
      const deal = dealByLead.get(contact.lead_id); const lead = leadById.get(contact.lead_id);
      if (!deal || !lead || !owns(deal, lead) || deal.status === "perdido" || deal.status === "ganho") continue;
      alerts.set(`message-${deal.id}`, { id: `message-${deal.id}-${latest.id}`, kind: "message", dealId: deal.id, leadId: lead.id, title: lead.nome || contact.nome || "Nova mensagem", description: latest.conteudo || `Cliente enviou ${latest.tipo || "uma mensagem"}.`, age, severity: severidade.message, occurredAt: latest.criado_em });
    }
  }

  // Todo negócio aberto entra em exatamente um balde: chegou agora ou a cor da régua.
  for (const deal of crm.deals) {
    const lead = leadById.get(deal.lead_id);
    if (!lead || !owns(deal, lead) || deal.status === "perdido" || deal.status === "ganho") continue;
    if (alerts.has(`message-${deal.id}`)) continue;

    const idade = minutesSince(lead.criado_em);
    if (idade <= 60) {
      alerts.set(`new-${deal.id}`, { id: `new-${deal.id}`, kind: "new", dealId: deal.id, leadId: lead.id, title: lead.nome || "Novo lead", description: "Lead recebido agora — faça o primeiro contato.", age: idade, severity: severidade.new, occurredAt: lead.criado_em });
      continue;
    }

    const sla = slaByDeal.get(deal.id);
    const fallback = minutesSince(deal.ultima_movimentacao || lead.atualizado_em || lead.criado_em);
    const aguardando = Boolean(sla?.aguardando_humano);
    const minutos = aguardando
      ? Number(sla?.min_aguardando ?? fallback)
      : (sla?.min_sem_interacao !== null && sla?.min_sem_interacao !== undefined ? Number(sla.min_sem_interacao) : fallback);
    const cor = corPorMinutos(minutos);
    const descricao = aguardando
      ? `Cliente esperando resposta há ${elapsed(minutos)}.`
      : cor === "verde"
        ? `Atualizado há ${elapsed(minutos)} — em dia.`
        : `${elapsed(minutos)} sem atualização — abra e atualize hoje.`;
    alerts.set(`${cor}-${deal.id}`, { id: `${cor}-${deal.id}`, kind: cor, dealId: deal.id, leadId: lead.id, title: lead.nome || `Lead #${lead.id}`, description: descricao, age: minutos, severity: severidade[cor] + (aguardando ? 0.5 : 0), occurredAt: sla?.ultima_interacao ?? deal.ultima_movimentacao });
  }

  // Urgência primeiro; dentro das cores, quem está parado há mais tempo no topo.
  return [...alerts.values()].sort((a, b) => b.severity - a.severity || b.age - a.age);
}

export function AttentionCenter({ accessToken, onOpenLead, onOpenChat, onOpenNotifications }: { accessToken: string; onOpenLead: (dealId: number) => void; onOpenChat?: (dealId: number) => void; onOpenNotifications: () => void }) {
  const [crm, setCrm] = useState<CrmAttentionData | null>(null);
  const [chat, setChat] = useState<ChatData | null>(null);
  const [brokerId, setBrokerId] = useState<number | null>(null);
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState<AlertFilter>("all");
  const [dismissed, setDismissed] = useState<string[]>([]);
  const [mutedUntil, setMutedUntil] = useState(0);
  const previousSignature = useRef("");
  const initialized = useRef(false);
  const audioRef = useRef<AudioContext | null>(null);
  const notifiedRef = useRef<Set<string> | null>(null);

  const playChime = useCallback(() => {
    try {
      const AC = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AC) return;
      const ctx = audioRef.current ?? (audioRef.current = new AC());
      if (ctx.state === "suspended") void ctx.resume();
      const start = ctx.currentTime;
      [880, 1174.66].forEach((freq, i) => {
        const osc = ctx.createOscillator(); const gain = ctx.createGain();
        osc.type = "sine"; osc.frequency.value = freq;
        const t = start + i * 0.16;
        gain.gain.setValueAtTime(0.0001, t);
        gain.gain.exponentialRampToValueAtTime(0.25, t + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.24);
        osc.connect(gain); gain.connect(ctx.destination);
        osc.start(t); osc.stop(t + 0.26);
      });
    } catch { /* som é best-effort */ }
  }, []);

  const showDesktopNotif = useCallback((alert: AttentionAlert) => {
    try {
      if (typeof Notification === "undefined" || Notification.permission !== "granted") return;
      if (typeof document !== "undefined" && document.visibilityState === "visible") return;
      const n = new Notification(kindInfo[alert.kind].label, { body: `${alert.title} — ${alert.description}`, tag: alert.id });
      n.onclick = () => { try { window.focus(); } catch { /* */ } onOpenLead(alert.dealId); n.close(); };
    } catch { /* notificação é best-effort */ }
  }, [onOpenLead]);

  useEffect(() => {
    try { if (typeof Notification !== "undefined" && Notification.permission === "default") void Notification.requestPermission(); } catch { /* */ }
  }, []);

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
  const visible = filter === "all" ? alerts.filter((alert) => alert.kind !== "verde") : alerts.filter((alert) => alert.kind === filter);
  // Verde é "em dia": aparece no chip para o corretor varrer, mas não conta como pendência,
  // não toca sino e não abre o painel sozinho.
  const pendentes = alerts.filter((alert) => alert.kind !== "verde");
  const signature = pendentes.map((alert) => alert.id).join("|");

  useEffect(() => {
    if (!initialized.current) { initialized.current = true; previousSignature.current = signature; return; }  // não abre sozinha ao entrar
    if (signature && signature !== previousSignature.current && Date.now() >= mutedUntil) setOpen(true);
    previousSignature.current = signature;
  }, [signature, mutedUntil]);

  useEffect(() => {
    const ids = pendentes.map((alert) => alert.id);
    if (notifiedRef.current === null) { notifiedRef.current = new Set(ids); return; }  // não notifica no primeiro carregamento
    if (Date.now() < mutedUntil) { ids.forEach((id) => notifiedRef.current!.add(id)); return; }  // silenciado: marca como visto sem tocar/notificar
    const fresh = pendentes.filter((alert) => !notifiedRef.current!.has(alert.id));
    fresh.forEach((alert) => notifiedRef.current!.add(alert.id));
    if (fresh.length) { playChime(); fresh.slice(0, 3).forEach(showDesktopNotif); }
  }, [signature, mutedUntil, playChime, showDesktopNotif]);

  function dismiss(id: string) {
    const next = [...new Set([...dismissed, id])]; setDismissed(next); window.sessionStorage.setItem("apecerto-alert-dismissed", JSON.stringify(next));
  }
  function dismissAll() { const next = [...new Set([...dismissed, ...alerts.map((alert) => alert.id)])]; setDismissed(next); window.sessionStorage.setItem("apecerto-alert-dismissed", JSON.stringify(next)); }
  function mute(minutes: number) { const until = Date.now() + minutes * 60000; setMutedUntil(until); window.sessionStorage.setItem("apecerto-alert-muted-until", String(until)); setOpen(false); }
  function attend(alert: AttentionAlert) {
    dismiss(alert.id); setOpen(false);
    // "Abrir e atender" sempre abre o chatzinho do lead (no CRM) pra responder na hora, qualquer que seja o tipo de alerta.
    if (onOpenChat) onOpenChat(alert.dealId);
    else onOpenLead(alert.dealId);
  }

  const counts = Object.fromEntries(KINDS.map((kind) => [kind, alerts.filter((alert) => alert.kind === kind).length])) as Record<AlertKind, number>;
  return <>
    <button className={`attention-trigger ${pendentes.length && Date.now() >= mutedUntil ? "ringing" : ""}`} type="button" onClick={() => { try { if (typeof Notification !== "undefined" && Notification.permission === "default") void Notification.requestPermission(); } catch { /* */ } setOpen(!open); }} aria-label={`Central de alertas, ${pendentes.length} pendentes`}><span aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 8-3 8h18s-3-1-3-8" /><path d="M10 20h4" /></svg></span><b>{pendentes.length}</b></button>
    {open && <aside className="attention-popover" aria-label="Central de alertas de atendimento">
      <header><div><span>ATENDIMENTO EM TEMPO REAL</span><h2>Central de atenção</h2><p>{pendentes.length ? `${pendentes.length} ação(ões) pedem sua atenção` : "Tudo em dia por aqui"}</p></div><button type="button" onClick={() => setOpen(false)} aria-label="Fechar">×</button></header>
      <section className="attention-summary">{KINDS.map((kind) => <button className={filter === kind ? `active ${kind}` : kind} type="button" onClick={() => setFilter(filter === kind ? "all" : kind)} key={kind}><i>{kindInfo[kind].icon}</i><strong>{counts[kind]}</strong><span>{kindInfo[kind].label}</span></button>)}</section>
      <nav><button className={filter === "all" ? "active" : ""} type="button" onClick={() => setFilter("all")}>Todos</button><button type="button" onClick={() => mute(15)}>Silenciar 15 min</button><button type="button" onClick={dismissAll}>Marcar todos como vistos</button></nav>
      <main>{visible.slice(0, 120).map((alert) => <article className={alert.kind} key={alert.id}><span>{kindInfo[alert.kind].icon}</span><div><small>{kindInfo[alert.kind].label} · {elapsed(alert.age)}</small><strong>{alert.title}</strong><p>{alert.description}</p><footer><button type="button" onClick={() => attend(alert)}>Abrir e atender</button><button type="button" onClick={() => dismiss(alert.id)}>Agora não</button></footer></div></article>)}{visible.length > 120 && <p className="attention-more">Mostrando os 120 mais urgentes de {visible.length} — use os filtros acima para afunilar.</p>}{visible.length === 0 && <div className="attention-empty"><span>✓</span><strong>Nenhum alerta neste filtro</strong><p>Novos eventos aparecerão automaticamente.</p></div>}</main>
      <footer><button type="button" onClick={onOpenNotifications}>Abrir histórico de notificações</button><span>{Date.now() < mutedUntil ? `Silenciado por ${elapsed(Math.ceil((mutedUntil - Date.now()) / 60000))}` : "Atualização automática a cada 30 segundos"}</span></footer>
    </aside>}
  </>;
}
