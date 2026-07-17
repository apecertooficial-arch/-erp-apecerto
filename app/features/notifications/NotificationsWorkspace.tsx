"use client";
/* Doc §16 — Notificações: página completa com categorias, prioridade, contexto,
   ações rápidas, filtros e agrupamento. Papel distinto do sino (AttentionCenter):
   o sino mostra o "agora"; esta página é o histórico organizado. */
/* eslint-disable react-hooks/set-state-in-effect, react-hooks/exhaustive-deps */

import { useEffect, useMemo, useState } from "react";
import { getBrowserSupabaseClient } from "../../lib/supabase/browser";
import type { ChatData } from "../chat/LiveChatWorkspace";

type Lead = { id: number; nome: string | null; telefone: string | null; corretor_id: number | null; criado_em: string };
type Deal = { id: number; lead_id: number; corretor_id: number | null; status: string };
type Task = { id: number; lead_id: number | null; corretor_id: number | null; titulo: string; vencimento: string | null; concluida: boolean };
type Sla = { negocio_id: number | null; sla_situacao: string | null; aguardando_humano: boolean | null; min_aguardando: number | string | null; min_sem_interacao: number | string | null; alarme_ativo: boolean | null };
type CrmData = { leads: Lead[]; deals: Deal[]; tasks: Task[]; sla: Sla[]; brokers: Array<{ id: number; usuario_id: string | null }>; error?: string };
type Category = "leads" | "mensagens" | "tarefas" | "vendas" | "sistema";
type Priority = "alta" | "media" | "baixa";
type Notification = { id: string; category: Category; priority: Priority; title: string; context: string; when: string; dealId: number | null; count: number };

const CATEGORIES: Array<{ key: Category; label: string; icon: string }> = [
  { key: "leads", label: "Leads", icon: "✦" }, { key: "mensagens", label: "Mensagens", icon: "●" },
  { key: "tarefas", label: "Tarefas", icon: "✓" }, { key: "vendas", label: "Vendas", icon: "▣" },
  { key: "sistema", label: "Sistema", icon: "⚙" },
];
const minutesSince = (date?: string | null) => date ? Math.max(0, Math.round((Date.now() - new Date(date).getTime()) / 60000)) : 0;
const ago = (date: string) => { const minutes = minutesSince(date); if (minutes < 1) return "agora"; if (minutes < 60) return `${minutes} min`; if (minutes < 1440) return `${Math.floor(minutes / 60)}h`; return `${Math.floor(minutes / 1440)}d`; };

export function NotificationsWorkspace({ accessToken, onOpenLead }: { accessToken: string; onOpenLead: (dealId: number) => void }) {
  const [crm, setCrm] = useState<CrmData | null>(null);
  const [chat, setChat] = useState<ChatData | null>(null);
  const [system, setSystem] = useState<Array<{ id: number; detalhe: string | null; acao: string; modulo: string; usuario_nome: string; criado_em: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [category, setCategory] = useState<Category | "todas">("todas");
  const [priority, setPriority] = useState<Priority | "todas">("todas");
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [read, setRead] = useState<string[]>([]);

  useEffect(() => {
    try { const stored = JSON.parse(window.localStorage.getItem("apecerto-notif-read") || "[]") as unknown; if (Array.isArray(stored)) setRead(stored.filter((item): item is string => typeof item === "string")); } catch { /* vazio */ }
    void (async () => {
      setLoading(true); setError("");
      try {
        const headers = { Authorization: `Bearer ${accessToken}` };
        const [crmResponse, chatResponse] = await Promise.all([fetch("/api/crm", { headers }), fetch("/api/live-chat", { headers })]);
        const [crmBody, chatBody] = await Promise.all([crmResponse.json() as Promise<CrmData>, chatResponse.json() as Promise<ChatData & { error?: string }>]);
        if (!crmResponse.ok) throw new Error(crmBody.error || "Não foi possível carregar as notificações.");
        setCrm(crmBody); if (chatResponse.ok) setChat(chatBody);
        const { data: auditRows } = await getBrowserSupabaseClient().from("erp_auditoria").select("id,detalhe,acao,modulo,usuario_nome,criado_em").order("criado_em", { ascending: false }).limit(40);
        setSystem(auditRows ?? []);
      } catch (reason) { setError(reason instanceof Error ? reason.message : "Erro ao carregar."); }
      finally { setLoading(false); }
    })();
  }, [accessToken]);

  const notifications = useMemo<Notification[]>(() => {
    if (!crm) return [];
    const list: Notification[] = [];
    const leadById = new Map(crm.leads.map((lead) => [lead.id, lead]));
    const dealByLead = new Map(crm.deals.map((deal) => [deal.lead_id, deal]));
    const dealById = new Map(crm.deals.map((deal) => [deal.id, deal]));
    for (const lead of crm.leads) {
      const age = minutesSince(lead.criado_em);
      if (age <= 7 * 1440) { const deal = dealByLead.get(lead.id); list.push({ id: `lead-${lead.id}`, category: "leads", priority: age <= 60 ? "alta" : "media", title: `Novo lead: ${lead.nome || "sem nome"}`, context: `Entrou há ${ago(lead.criado_em)} · ${lead.telefone || "sem telefone"}`, when: lead.criado_em, dealId: deal?.id ?? null, count: 1 }); }
    }
    for (const sla of crm.sla) {
      if (!sla.negocio_id) continue;
      const deal = dealById.get(sla.negocio_id); const lead = deal && leadById.get(deal.lead_id);
      if (!deal || !lead) continue;
      if (sla.aguardando_humano || sla.alarme_ativo) list.push({ id: `wait-${deal.id}`, category: "leads", priority: "alta", title: `${lead.nome || "Lead"} aguardando atendimento`, context: `Cliente esperando há ${Math.round(Number(sla.min_aguardando || 0) / 60)}h`, when: new Date(Date.now() - Number(sla.min_aguardando || 0) * 60000).toISOString(), dealId: deal.id, count: 1 });
    }
    if (chat) {
      const contactById = new Map(chat.contacts.map((contact) => [contact.id, contact]));
      for (const conversation of chat.conversations) {
        const latest = chat.latest[conversation.id]; const contact = contactById.get(conversation.contato_id);
        if (!latest?.criado_em || !contact?.lead_id) continue;
        if (["out", "saida", "saída", "enviada", "sent"].includes((latest.direcao || "").toLowerCase())) continue;
        if (minutesSince(latest.criado_em) > 2880) continue;
        const deal = dealByLead.get(contact.lead_id); const lead = leadById.get(contact.lead_id);
        list.push({ id: `msg-${conversation.id}`, category: "mensagens", priority: minutesSince(latest.criado_em) <= 30 ? "alta" : "media", title: `Mensagem de ${lead?.nome || contact.nome || "cliente"}`, context: latest.conteudo?.slice(0, 90) || `Enviou ${latest.tipo || "mensagem"}`, when: latest.criado_em, dealId: deal?.id ?? null, count: 1 });
      }
    }
    for (const task of crm.tasks) {
      if (task.concluida || !task.vencimento) continue;
      const overdue = new Date(task.vencimento).getTime() < Date.now();
      const dueToday = task.vencimento.slice(0, 10) === new Date().toISOString().slice(0, 10);
      if (!overdue && !dueToday) continue;
      const deal = task.lead_id ? dealByLead.get(task.lead_id) : null;
      list.push({ id: `task-${task.id}`, category: "tarefas", priority: overdue ? "alta" : "media", title: overdue ? `Tarefa vencida: ${task.titulo}` : `Vence hoje: ${task.titulo}`, context: task.lead_id ? `Lead: ${leadById.get(task.lead_id)?.nome || `#${task.lead_id}`}` : "Tarefa geral", when: task.vencimento, dealId: deal?.id ?? null, count: 1 });
    }
    for (const deal of crm.deals) {
      if (deal.status === "ganho") { const lead = leadById.get(deal.lead_id); list.push({ id: `sale-${deal.id}`, category: "vendas", priority: "media", title: `Negócio ganho: ${lead?.nome || `#${deal.id}`}`, context: "Enviado para o processo de venda", when: new Date().toISOString(), dealId: deal.id, count: 1 }); }
    }
    for (const entry of system) list.push({ id: `sys-${entry.id}`, category: "sistema", priority: "baixa", title: entry.detalhe || `${entry.acao} em ${entry.modulo}`, context: `${entry.usuario_nome} · ${entry.modulo}`, when: entry.criado_em, dealId: null, count: 1 });

    /* agrupar repetidas (mesma categoria + mesmo título-base) */
    const grouped = new Map<string, Notification>();
    for (const item of list) {
      const key = `${item.category}:${item.title}`;
      const existing = grouped.get(key);
      if (existing) { existing.count += 1; if (item.when > existing.when) existing.when = item.when; }
      else grouped.set(key, { ...item });
    }
    return [...grouped.values()].sort((a, b) => (a.priority === b.priority ? b.when.localeCompare(a.when) : a.priority === "alta" ? -1 : b.priority === "alta" ? 1 : a.priority === "media" ? -1 : 1));
  }, [crm, chat, system]);

  const visible = notifications.filter((item) => (category === "todas" || item.category === category) && (priority === "todas" || item.priority === priority) && (!unreadOnly || !read.includes(item.id)));
  const counts = Object.fromEntries(CATEGORIES.map((entry) => [entry.key, notifications.filter((item) => item.category === entry.key).length])) as Record<Category, number>;

  function markRead(ids: string[]) { const next = [...new Set([...read, ...ids])]; setRead(next); try { window.localStorage.setItem("apecerto-notif-read", JSON.stringify(next)); } catch { /* sem persistência */ } }

  return <div className="notif-workspace">
    <header className="workspace-top"><div><h1>Notificações</h1><p>{visible.length} exibidas · o sino mostra o agora, aqui fica o histórico organizado</p></div><button className="notif-mark-all" type="button" onClick={() => markRead(visible.map((item) => item.id))}>✓ Marcar tudo como lido</button></header>
    <div className="notif-filters">
      <button className={category === "todas" ? "active" : ""} type="button" onClick={() => setCategory("todas")}>Todas</button>
      {CATEGORIES.map((entry) => <button className={category === entry.key ? "active" : ""} type="button" onClick={() => setCategory(entry.key)} key={entry.key}>{entry.icon} {entry.label} <b>{counts[entry.key]}</b></button>)}
      <i />
      {(["todas", "alta", "media", "baixa"] as const).map((level) => <button className={`prio ${priority === level ? "active" : ""}`} type="button" onClick={() => setPriority(level)} key={level}>{level === "todas" ? "Toda prioridade" : level === "media" ? "Média" : level.charAt(0).toUpperCase() + level.slice(1)}</button>)}
      <label className="notif-unread"><input type="checkbox" checked={unreadOnly} onChange={(event) => setUnreadOnly(event.target.checked)} /> Só não lidas</label>
    </div>
    {loading ? <div className="workspace-loading">Carregando notificações…</div> : error ? <div className="workspace-error">{error}</div> : <main className="notif-list">
      {visible.length === 0 && <div className="audit-empty">Nenhuma notificação neste filtro. Tudo em dia ✓</div>}
      {visible.map((item) => { const isRead = read.includes(item.id); return <article className={`notif-item ${item.priority} ${isRead ? "read" : ""}`} key={item.id}>
        <span className={`notif-icon ${item.category}`}>{CATEGORIES.find((entry) => entry.key === item.category)?.icon}</span>
        <div className="notif-body"><strong>{item.title}{item.count > 1 && <em className="notif-count">×{item.count}</em>}</strong><p>{item.context}</p><small>{CATEGORIES.find((entry) => entry.key === item.category)?.label} · prioridade {item.priority} · {ago(item.when)}</small></div>
        <div className="notif-actions">
          {item.dealId && <button type="button" onClick={() => { markRead([item.id]); onOpenLead(item.dealId!); }}>Abrir lead</button>}
          {!isRead && <button className="ghost" type="button" onClick={() => markRead([item.id])}>Lida</button>}
        </div>
      </article>; })}
    </main>}
  </div>;
}
