"use client";
/* eslint-disable react-hooks/set-state-in-effect, react-hooks/exhaustive-deps, react-hooks/purity, @next/next/no-img-element */

import { useEffect, useMemo, useRef, useState } from "react";
import { getBrowserSupabaseClient } from "../../lib/supabase/browser";
import { StatusTick, ackState } from "./statusTick";

type Message = { id: string; conversa_id: string; direcao: string; tipo: string; conteudo: string | null; media_url?: string | null; raw?: unknown; criado_em: string | null; enviado_em?: string | null; status?: string | number | null; status_detalhe?: string | null };
type Conversation = { id: string; contato_id: string; instancia_id: string; status: string; ultima_msg_em: string | null; origem: string | null };
export type ChatData = {
  conversations: Conversation[];
  contacts: Array<{ id: string; nome: string | null; telefone: string; lead_id: number | null }>;
  instances: Array<{ id: string; session_id: string; rotulo: string | null; status: string; corretor_id: number }>;
  dapi: Array<{ id: number; instancia_dapi: string; nome: string; conectada: boolean }>;
  latest: Record<string, Message>;
  leads: Array<{ id: number; nome: string | null; telefone: string | null; email: string | null; corretor_id: number | null; origem: string | null; tags: unknown }>;
  deals: Array<{ id: number; lead_id: number; corretor_id: number | null; stage_id: number | null; empreendimento_id: string | null; valor: number | null; status: string }>;
  brokers: Array<{ id: number; nome: string; usuario_id: string | null; online: boolean }>;
  products: Array<{ id: string; nome: string; bairro: string | null; cidade: string | null; preco: number | null; status: string }>;
  media: Array<{ id: string; empreendimento_id: string; nome: string | null; tipo: string; categoria: string | null; storage_path: string; is_capa: boolean }>;
  activities: Array<{ id: number; lead_id: number | null; tipo: string; texto: string | null; criado_em: string }>;
  approaches: Array<{ id: number; nome: string; mensagens: unknown; produto_id: number | null }>;
  stages?: Array<{ id: number; nome: string; rotulo: string | null; ordem: number | null }>;
};
type ChatFilter = "all" | "unanswered" | "critical";
export type QuickAction = "callReminder" | "task" | "visit" | "proposal" | "financing" | "transfer" | "note";

const when = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
const money = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
const normalizePhone = (value?: string | null) => (value || "").replace(/\D/g, "").slice(-11);
const isOutgoing = (direction: string) => ["out", "saida", "saída", "enviada", "sent"].includes(direction.toLowerCase());

export function LiveChatWorkspace({ accessToken }: { accessToken: string }) {
  const [data, setData] = useState<ChatData | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const activeConversation = useRef<string | null>(null);
  const [draft, setDraft] = useState("");
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<ChatFilter>("all");
  const [filterBroker, setFilterBroker] = useState<number | "">("");
  const [filterStage, setFilterStage] = useState<number | "">("");
  const [filterInstance, setFilterInstance] = useState<string>("");
  const [filterSlaDays, setFilterSlaDays] = useState<number>(0);
  const [instanceId, setInstanceId] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [quickAction, setQuickAction] = useState<QuickAction | null>(null);
  const [productOpen, setProductOpen] = useState(false);
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [approachOpen, setApproachOpen] = useState(false);
  const [recording, setRecording] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const recorder = useRef<MediaRecorder | null>(null);
  const chunks = useRef<Blob[]>([]);
  const messageStream = useRef<HTMLDivElement>(null);

  const load = async () => {
    const response = await fetch("/api/live-chat", { headers: { Authorization: `Bearer ${accessToken}` } });
    const result = await response.json() as ChatData & { error?: string };
    if (!response.ok) throw new Error(result.error || "Não foi possível carregar o chat.");
    setData(result);
    setSelectedId((current) => current || result.conversations[0]?.id || null);
  };
  const loadMessages = async (id: string) => {
    const response = await fetch(`/api/live-chat?conversationId=${encodeURIComponent(id)}`, { headers: { Authorization: `Bearer ${accessToken}` } });
    const result = await response.json() as { messages?: Message[]; error?: string };
    if (!response.ok) throw new Error(result.error || "Não foi possível carregar as mensagens.");
    if (activeConversation.current !== id) return;
    const dbMessages = result.messages ?? [];
    const at = (m: Message) => new Date(m.enviado_em || m.criado_em || 0).getTime();
    setMessages((prev) => {
      const pending = prev.filter((m) => String(m.id).startsWith("temp-") && !dbMessages.some((d) => isOutgoing(d.direcao) && (d.conteudo || "") === (m.conteudo || "")));
      return [...dbMessages, ...pending].sort((a, b) => at(a) - at(b));
    });
  };

  useEffect(() => { void load().catch((reason) => setNotice(reason instanceof Error ? reason.message : "Erro ao carregar chat.")); }, [accessToken]);
  useEffect(() => { activeConversation.current = selectedId; if (selectedId) { setMessages([]); void loadMessages(selectedId).catch((reason) => setNotice(reason instanceof Error ? reason.message : "Erro ao carregar mensagens.")); } else { setMessages([]); } }, [selectedId]);
  useEffect(() => { const stream = messageStream.current; if (stream) stream.scrollTop = stream.scrollHeight; }, [messages]);
  useEffect(() => {
    const supabase = getBrowserSupabaseClient();
    const channel = supabase.channel("live-chat-screen")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "wa_mensagens" }, () => { if (selectedId) void loadMessages(selectedId); void load(); })
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [selectedId]);

  const contactById = useMemo(() => new Map((data?.contacts ?? []).map((item) => [item.id, item])), [data]);
  const leadById = useMemo(() => new Map((data?.leads ?? []).map((item) => [item.id, item])), [data]);
  const instanceById = useMemo(() => new Map((data?.instances ?? []).map((item) => [item.id, item])), [data]);
  const dealByLead = useMemo(() => new Map((data?.deals ?? []).map((item) => [item.lead_id, item])), [data]);
  const selected = data?.conversations.find((item) => item.id === selectedId);
  const contact = selected ? contactById.get(selected.contato_id) : null;
  const lead = contact?.lead_id ? leadById.get(contact.lead_id) : null;
  const deal = data?.deals.find((item) => item.lead_id === lead?.id);
  const instance = selected ? instanceById.get(selected.instancia_id) : null;
  const dapi = data?.dapi.find((item) => item.instancia_dapi === instance?.session_id);
  const relatedConversations = useMemo(() => {
    const phone = normalizePhone(contact?.telefone);
    if (!phone) return selected ? [selected] : [];
    return (data?.conversations ?? []).filter((item) => normalizePhone(contactById.get(item.contato_id)?.telefone) === phone);
  }, [data, contact?.telefone, selectedId, contactById]);

  useEffect(() => { setInstanceId(dapi?.id ?? null); }, [dapi?.id]);
  const isUnanswered = (item: Conversation) => isOutgoing(data?.latest[item.id]?.direcao || "");
  const isCritical = (item: Conversation) => {
    const latest = data?.latest[item.id];
    if (item.status.toLowerCase().match(/critic|urgent/)) return true;
    return Boolean(latest?.criado_em && !isOutgoing(latest.direcao) && Date.now() - new Date(latest.criado_em).getTime() > 3_600_000);
  };
  const unansweredCount = (data?.conversations ?? []).filter(isUnanswered).length;
  const criticalCount = (data?.conversations ?? []).filter(isCritical).length;
  const waitingDays = (item: Conversation) => { const l = data?.latest[item.id]; if (!l?.criado_em || isOutgoing(l.direcao)) return 0; return (Date.now() - new Date(l.criado_em).getTime()) / 86_400_000; };
  const filtered = (data?.conversations ?? []).filter((item) => {
    const person = contactById.get(item.contato_id);
    const leadNome = person?.lead_id ? leadById.get(person.lead_id)?.nome : null;
    const matches = `${leadNome || ""} ${person?.nome || ""} ${person?.telefone || ""}`.toLowerCase().includes(query.toLowerCase());
    const deal = person?.lead_id ? dealByLead.get(person.lead_id) : null;
    const lead = person?.lead_id ? leadById.get(person.lead_id) : null;
    const corretorId = deal?.corretor_id ?? lead?.corretor_id ?? instanceById.get(item.instancia_id)?.corretor_id ?? null;
    const stageId = deal?.stage_id ?? null;
    const okBroker = filterBroker === "" || corretorId === filterBroker;
    const okStage = filterStage === "" || stageId === filterStage;
    const okInstance = filterInstance === "" || item.instancia_id === filterInstance;
    const okSla = filterSlaDays === 0 || waitingDays(item) >= filterSlaDays;
    return matches && okBroker && okStage && okInstance && okSla
      && (filter === "all" || (filter === "unanswered" && isUnanswered(item)) || (filter === "critical" && isCritical(item)));
  });

  const call = async (body: Record<string, unknown>, endpoint = "/api/live-chat") => {
    setBusy(true); setNotice(null);
    try {
      const response = await fetch(endpoint, { method: endpoint === "/api/crm" ? "PATCH" : "POST", headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const result = await response.json() as { error?: string; scheduled?: number };
      if (!response.ok) throw new Error(result.error || "Não foi possível concluir.");
      setNotice(result.scheduled ? `${result.scheduled} mensagem(ns) programada(s).` : "Ação concluída e salva no Supabase.");
      await load();
      return result;
    } catch (reason) {
      setNotice(reason instanceof Error ? reason.message : "Não foi possível concluir.");
      throw reason;
    } finally { setBusy(false); }
  };
  const send = async (content: string, mediaId?: string) => {
    if (!contact) { setNotice("Selecione uma conversa vinculada a um contato."); throw new Error("Contato não selecionado."); }
    if (!instanceId) { setNotice("Selecione uma instância conectada antes de enviar."); throw new Error("Instância não selecionada."); }
    if (!content.trim() && !mediaId) { setNotice("Escreva uma mensagem ou escolha um material."); throw new Error("Mensagem vazia."); }
    const text = content;
    const tempId = `temp-${Date.now()}`;
    setDraft("");
    setNotice(null);
    setMessages((prev) => [...prev, { id: tempId, conversa_id: selectedId || "", direcao: "enviada", tipo: "texto", conteudo: text, media_url: null, criado_em: new Date().toISOString() }]);
    void (async () => {
      try {
        const response = await fetch("/api/live-chat", { method: "POST", headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" }, body: JSON.stringify({ action: "send", phone: contact.telefone, instanceId, content: text, mediaId }) });
        const result = await response.json() as { error?: string };
        if (!response.ok) throw new Error(result.error || "Não foi possível enviar.");
        void load();
      } catch (reason) {
        setNotice(reason instanceof Error ? reason.message : "Não foi possível enviar.");
        setMessages((prev) => prev.map((m) => m.id === tempId ? { ...m, conteudo: `${m.conteudo || ""} ⚠️ (falha ao enviar)` } : m));
      }
    })();
  };
  const upload = async (file?: File) => {
    if (!file || !contact || !instanceId) return;
    setBusy(true); setNotice("Enviando arquivo…");
    try {
      const form = new FormData(); form.set("file", file); form.set("phone", contact.telefone); form.set("instanceId", String(instanceId)); form.set("content", draft);
      const response = await fetch("/api/live-chat", { method: "POST", headers: { Authorization: `Bearer ${accessToken}` }, body: form });
      const result = await response.json() as { error?: string };
      if (!response.ok) throw new Error(result.error || "Não foi possível enviar o arquivo.");
      setDraft(""); setNotice("Arquivo enviado pela instância selecionada.");
    } catch (reason) { setNotice(reason instanceof Error ? reason.message : "Não foi possível enviar o arquivo."); }
    finally { setBusy(false); if (fileInput.current) fileInput.current.value = ""; }
  };
  const toggleRecording = async () => {
    if (recording) { recorder.current?.stop(); setRecording(false); return; }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      chunks.current = [];
      const mediaRecorder = new MediaRecorder(stream);
      recorder.current = mediaRecorder;
      mediaRecorder.ondataavailable = (event) => { if (event.data.size) chunks.current.push(event.data); };
      mediaRecorder.onstop = () => { const blob = new Blob(chunks.current, { type: mediaRecorder.mimeType || "audio/webm" }); stream.getTracks().forEach((track) => track.stop()); void upload(new File([blob], `audio-${Date.now()}.webm`, { type: blob.type })); };
      mediaRecorder.start(); setRecording(true); setNotice("Gravando áudio. Clique novamente para enviar.");
    } catch { setNotice("Autorize o microfone no navegador para gravar o áudio."); }
  };

  const openQuickAction = (action: QuickAction) => {
    if (!lead) return setNotice("Esta conversa ainda não está vinculada a um lead.");
    if (["visit", "proposal", "financing", "transfer"].includes(action) && !deal) return setNotice("Vincule a conversa a um negócio antes de concluir esta ação.");
    setNotice(null);
    setQuickAction(action);
  };

  return <div className="live-chat">
    <header><div><span>WHATSAPP EM TEMPO REAL</span><h1>Chat ao vivo</h1><p>{data?.conversations.length || 0} conversas conectadas às instâncias do Supabase</p></div><label><span>⌕</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar lead ou telefone" /></label></header>
    {notice && <button className="live-notice" type="button" onClick={() => setNotice(null)}>{notice} ×</button>}
    <main>
      <aside className="conversation-list"><nav><button className={filter === "all" ? "active" : ""} onClick={() => setFilter("all")} type="button">Todas <b>{data?.conversations.length || 0}</b></button><button className={filter === "unanswered" ? "active" : ""} onClick={() => setFilter("unanswered")} type="button">Sem resposta <b>{unansweredCount}</b></button><button className={filter === "critical" ? "active" : ""} onClick={() => setFilter("critical")} type="button">Críticas <b>{criticalCount}</b></button></nav><div className="chat-filter-row"><select aria-label="Filtrar por corretor" value={filterBroker} onChange={(event) => setFilterBroker(event.target.value ? Number(event.target.value) : "")}><option value="">Corretor</option>{(data?.brokers ?? []).map((broker) => <option value={broker.id} key={broker.id}>{broker.nome}</option>)}</select><select aria-label="Filtrar por etapa" value={filterStage} onChange={(event) => setFilterStage(event.target.value ? Number(event.target.value) : "")}><option value="">Etapa</option>{(data?.stages ?? []).map((stage) => <option value={stage.id} key={stage.id}>{stage.rotulo || stage.nome}</option>)}</select><select aria-label="Filtrar por instância" value={filterInstance} onChange={(event) => setFilterInstance(event.target.value)}><option value="">Instância</option>{(data?.instances ?? []).map((inst) => <option value={inst.id} key={inst.id}>{inst.rotulo || inst.session_id}</option>)}</select><select aria-label="Filtrar por tempo sem resposta" value={filterSlaDays} onChange={(event) => setFilterSlaDays(Number(event.target.value))}><option value={0}>SLA</option><option value={1}>+1 dia sem responder</option><option value={3}>+3 dias sem responder</option><option value={5}>+5 dias sem responder</option><option value={7}>+7 dias sem responder</option></select>{(filterBroker !== "" || filterStage !== "" || filterInstance !== "" || filterSlaDays !== 0) && <button type="button" className="chat-filter-clear" onClick={() => { setFilterBroker(""); setFilterStage(""); setFilterInstance(""); setFilterSlaDays(0); }}>Limpar filtros</button>}</div>{filtered.map((item) => { const person = contactById.get(item.contato_id); const leadNome = person?.lead_id ? leadById.get(person.lead_id)?.nome : null; const displayName = leadNome || person?.nome || person?.telefone || "Contato"; const last = data?.latest[item.id]; return <button className={item.id === selectedId ? "active" : ""} type="button" onClick={() => setSelectedId(item.id)} key={item.id}><span>{displayName.slice(0, 2).toUpperCase()}</span><div><strong>{displayName}</strong><small>{last?.conteudo || (last?.tipo ? `◉ ${last.tipo}` : "Conversa iniciada")}</small><em>{item.ultima_msg_em ? when.format(new Date(item.ultima_msg_em)) : ""}</em></div></button>; })}{filtered.length === 0 && <div className="conversation-empty">Nenhuma conversa neste filtro.</div>}</aside>
      <section className="chat-thread">
        <header><div><strong>{contact?.nome || contact?.telefone || "Selecione uma conversa"}</strong><small>ATENDENDO · {instance?.rotulo || instance?.session_id || "Sem instância"}</small>{relatedConversations.length > 0 && <label className="history-instance">Histórico da instância<select aria-label="Instância do histórico" value={selectedId ?? ""} onChange={(event) => setSelectedId(event.target.value)}>{relatedConversations.map((item) => { const linked = instanceById.get(item.instancia_id); return <option value={item.id} key={item.id}>{linked?.rotulo || linked?.session_id || "Instância"} · {item.ultima_msg_em ? when.format(new Date(item.ultima_msg_em)) : "sem data"}</option>; })}</select></label>}</div><span className={dapi?.conectada ? "chat-connection connected" : "chat-connection"}>{dapi?.conectada ? "● conectada" : "○ offline"}</span></header>
        <div className="message-stream" ref={messageStream}>{messages.map((message) => <article className={`${isOutgoing(message.direcao) ? "out" : "in"} ${isOutgoing(message.direcao) && ackState(message.status) === "erro" ? "msg-failed" : ""}`} key={message.id}><MessageMedia message={message} /><span>{message.conteudo}</span><small>{(message.enviado_em || message.criado_em) ? when.format(new Date((message.enviado_em || message.criado_em) as string)) : ""}{isOutgoing(message.direcao) && <StatusTick status={message.status} detalhe={message.status_detalhe} />}</small></article>)}{messages.length === 0 && <div className="crm-empty-view">Nenhuma mensagem encontrada nesta instância.</div>}</div>
        <form className="chat-composer" onSubmit={(event) => { event.preventDefault(); void send(draft); }}><div className="composer-tools"><button className={recording ? "recording" : ""} type="button" title="Gravar áudio" aria-label="Gravar áudio" onClick={() => void toggleRecording()}>{recording ? <svg viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="6" width="12" height="12" rx="2" /></svg> : <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="2" width="6" height="12" rx="3" /><path d="M5 10a7 7 0 0 0 14 0" /><line x1="12" y1="17" x2="12" y2="21" /></svg>}</button><button type="button" title="Enviar imagem, vídeo ou documento" aria-label="Anexar mídia" onClick={() => fileInput.current?.click()}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="M21.4 11.05 12.2 20.2a5 5 0 0 1-7.1-7.1l9.2-9.2a3.3 3.3 0 0 1 4.7 4.7l-9.2 9.2a1.6 1.6 0 0 1-2.3-2.3l8.5-8.5" /></svg></button><button type="button" title="Agendar mensagem" aria-label="Agendar mensagem" onClick={() => setScheduleOpen(true)}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg></button><button type="button" title="Enviar abordagem" aria-label="Enviar abordagem" onClick={() => setApproachOpen(true)}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="M3 11.5 12 4l9 7.5" /><path d="M5 10v9a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-9" /></svg></button><input ref={fileInput} hidden type="file" accept="image/*,video/*,audio/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx" onChange={(event) => void upload(event.target.files?.[0])} /></div><textarea value={draft} onChange={(event) => setDraft(event.target.value)} placeholder="Escreva uma mensagem…" /><button disabled={busy || !draft.trim() || !instanceId} type="submit">➤</button></form>
      </section>
      <aside className="chat-sidebar"><div className="lead-summary"><span>{(lead?.nome || contact?.nome || "C").slice(0, 2).toUpperCase()}</span><div><strong>{lead?.nome || contact?.nome || "Contato sem vínculo"}</strong><small>{contact?.telefone}</small></div></div><article className="ai-summary"><b>RESUMO DO ATENDIMENTO</b><p>{lead ? `Lead de origem ${lead.origem || "não informada"}, com ${messages.length} mensagens nesta conversa.` : "Associe este contato a um lead para completar o resumo."}</p><span>Valor em negociação <strong>{deal?.valor ? money.format(deal.valor) : "a confirmar"}</strong></span></article><h3>Ações rápidas</h3><div className="quick-actions"><button type="button" onClick={() => openQuickAction("callReminder")}>☎ Lembrete de ligação</button><button type="button" onClick={() => openQuickAction("task")}>✓ Tarefa</button><button type="button" onClick={() => openQuickAction("visit")}>▣ Agendar visita</button><button type="button" onClick={() => setProductOpen(true)}>▥ Enviar produto</button><button type="button" onClick={() => openQuickAction("proposal")}>✎ Gerar proposta</button><button type="button" onClick={() => openQuickAction("financing")}>▤ Financiamento</button><button type="button" onClick={() => openQuickAction("transfer")}>⇄ Transferir</button><button type="button" onClick={() => openQuickAction("note")}>◯ Observação</button></div><h3>Observações</h3><div className="chat-notes">{(data?.activities ?? []).filter((item) => item.lead_id === lead?.id).slice(0, 5).map((item) => <article key={item.id}><p>{item.texto}</p><small>{when.format(new Date(item.criado_em))}</small></article>)}{!(data?.activities ?? []).some((item) => item.lead_id === lead?.id) && <small>Nenhuma observação ainda.</small>}</div></aside>
    </main>
    {quickAction && data && lead && <QuickActionModal action={quickAction} lead={lead} deal={deal ?? null} brokers={data.brokers} products={data.products} onClose={() => setQuickAction(null)} onSave={async (payload, endpoint) => { await call(payload, endpoint); setQuickAction(null); }} />}
    {productOpen && data && <ProductSendModal data={data} canSend={Boolean(contact && instanceId)} onClose={() => setProductOpen(false)} onSend={async (content, mediaId) => { await send(content, mediaId); setProductOpen(false); }} />}
    {scheduleOpen && <ScheduleModal initialText={draft} onClose={() => setScheduleOpen(false)} onSchedule={async (content, scheduledFor) => { if (!contact || !instanceId) return; await call({ action: "schedule", phone: contact.telefone, instanceId, leadId: lead?.id, content, when: scheduledFor }); setDraft(""); setScheduleOpen(false); }} />}
    {approachOpen && data && <ApproachModal approaches={data.approaches} onClose={() => setApproachOpen(false)} onSend={async (approachId) => { if (!contact || !instanceId) return; await call({ action: "sendApproach", approachId, phone: contact.telefone, instanceId, leadId: lead?.id, leadName: lead?.nome || contact.nome }); setApproachOpen(false); }} />}
  </div>;
}

export function MessageMedia({ message }: { message: Pick<Message, "tipo" | "media_url" | "conteudo"> }) {
  const type = message.tipo.toLowerCase();
  if (!message.media_url) {
    const missing = (label: string) => <span style={{ display: "block", marginTop: 3, color: "#9a8f88", fontStyle: "italic", fontSize: 11 }}>{label}</span>;
    if (type.includes("audio")) return missing("🎙️ Áudio antigo — arquivo indisponível");
    if (type.includes("video")) return missing("🎥 Vídeo antigo — arquivo indisponível");
    if (type.includes("imagem") || type.includes("image") || type.includes("foto") || type.includes("figurinha")) return missing("🖼️ Imagem antiga — arquivo indisponível");
    if (type.includes("documento") || type.includes("document")) return missing("📄 Documento antigo — indisponível");
    return null;
  }
  if (type.includes("audio")) return <audio className="chat-audio" controls preload="none" src={message.media_url} />;
  if (type.includes("video")) return <video className="chat-video" controls preload="none" src={message.media_url} />;
  if (type.includes("imagem") || type.includes("image") || type.includes("foto") || type.includes("figurinha")) return <a className="chat-image-link" href={message.media_url} target="_blank" rel="noreferrer"><img loading="lazy" decoding="async" src={message.media_url} alt={message.conteudo || "Imagem da conversa"} /></a>;
  return <a className="chat-document" href={message.media_url} target="_blank" rel="noreferrer">▤ Abrir documento</a>;
}

export function QuickActionModal({ action, lead, deal, brokers, products, onClose, onSave }: {
  action: QuickAction;
  lead: ChatData["leads"][number];
  deal: ChatData["deals"][number] | null;
  brokers: ChatData["brokers"];
  products: ChatData["products"];
  onClose: () => void;
  onSave: (payload: Record<string, unknown>, endpoint?: string) => Promise<void>;
}) {
  const tomorrow = new Date(Date.now() + 86_400_000).toISOString().slice(0, 10);
  const nextHour = new Date(Date.now() + 3_600_000).toISOString().slice(0, 16);
  const [title, setTitle] = useState(action === "callReminder" ? `Ligar para ${lead.nome || "cliente"}` : "");
  const [description, setDescription] = useState("");
  const [due, setDue] = useState(nextHour);
  const [priority, setPriority] = useState("normal");
  const [date, setDate] = useState(tomorrow);
  const [startTime, setStartTime] = useState("10:00");
  const [endTime, setEndTime] = useState("11:00");
  const [productId, setProductId] = useState(deal?.empreendimento_id || "");
  const [local, setLocal] = useState("");
  const [withManager, setWithManager] = useState(false);
  const [value, setValue] = useState(String(deal?.valor || ""));
  const [financing, setFinancing] = useState("");
  const [brokerId, setBrokerId] = useState("");
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const config: Record<QuickAction, { eyebrow: string; title: string; description: string; submit: string }> = {
    callReminder: { eyebrow: "AGENDA COMERCIAL", title: "Lembrete de ligação", description: "Cria um lembrete no CRM para este lead.", submit: "Salvar lembrete" },
    task: { eyebrow: "AGENDA COMERCIAL", title: "Nova tarefa", description: "Registre a próxima ação e seu prazo.", submit: "Criar tarefa" },
    visit: { eyebrow: "AGENDA DE VISITAS", title: "Agendar visita", description: "A visita será vinculada ao lead e ao negócio.", submit: "Agendar visita" },
    proposal: { eyebrow: "NEGOCIAÇÃO", title: "Gerar proposta", description: "Salva a proposta no histórico sem enviá-la automaticamente.", submit: "Salvar proposta" },
    financing: { eyebrow: "CRÉDITO IMOBILIÁRIO", title: "Abrir ficha de financiamento", description: "Cria uma ficha em rascunho para completar depois.", submit: "Criar ficha" },
    transfer: { eyebrow: "DISTRIBUIÇÃO", title: "Transferir atendimento", description: "Escolha o corretor que assumirá este negócio.", submit: "Transferir" },
    note: { eyebrow: "HISTÓRICO DO LEAD", title: "Adicionar observação", description: "A observação ficará visível neste painel.", submit: "Salvar observação" },
  };
  const selectedProduct = products.find((item) => item.id === productId);
  const submit = async () => {
    setBusy(true); setError("");
    try {
      if (action === "callReminder" || action === "task") await onSave({ action, leadId: lead.id, dealId: deal?.id, name: lead.nome, title, description, due, priority });
      if (action === "visit") await onSave({ action: "createVisit", leadId: lead.id, dealId: deal?.id, productId: productId || null, productName: selectedProduct?.nome, date, startTime, endTime, local, observations: description, reminder: true, withManager }, "/api/crm");
      if (action === "proposal") await onSave({ action, leadId: lead.id, dealId: deal?.id, productId: productId || null, productName: selectedProduct?.nome, value, conditions: description });
      if (action === "financing") await onSave({ action, leadId: lead.id, dealId: deal?.id, productId: productId || null, productName: selectedProduct?.nome, name: lead.nome, phone: lead.telefone, email: lead.email, value, downPayment: String(Math.max(0, Number(value) - Number(financing))), financing: Number(financing), consent });
      if (action === "transfer") await onSave({ action, leadId: lead.id, dealId: deal?.id, brokerId: Number(brokerId) });
      if (action === "note") await onSave({ action, leadId: lead.id, dealId: deal?.id, content: description });
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Não foi possível salvar esta ação."); }
    finally { setBusy(false); }
  };
  const invalid = busy
    || ((action === "task" || action === "callReminder") && (!title.trim() || !due))
    || (action === "visit" && (!date || !startTime))
    || (action === "proposal" && !(Number(value) > 0))
    || (action === "financing" && !(Number(value) > 0 && Number(financing) > 0 && Number(financing) < Number(value)))
    || (action === "transfer" && !brokerId)
    || (action === "note" && !description.trim());

  return <div className="crm-center-modal quick-action-modal" role="dialog" aria-modal="true" aria-label={config[action].title}><form onSubmit={(event) => { event.preventDefault(); void submit(); }}><header><div><span>{config[action].eyebrow}</span><h2>{config[action].title}</h2><p>{config[action].description}</p></div><button aria-label="Fechar" type="button" onClick={onClose}>×</button></header><div className="quick-action-form">
    {(action === "task" || action === "callReminder") && <><label className="wide">Título<input required value={title} onChange={(event) => setTitle(event.target.value)} /></label><label>Data e hora<input required type="datetime-local" value={due} onChange={(event) => setDue(event.target.value)} /></label><label>Prioridade<select value={priority} onChange={(event) => setPriority(event.target.value)}><option value="baixa">Baixa</option><option value="normal">Normal</option><option value="alta">Alta</option></select></label><label className="wide">Descrição<textarea rows={3} value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Instruções para o corretor" /></label></>}
    {action === "visit" && <><label>Data<input required type="date" value={date} onChange={(event) => setDate(event.target.value)} /></label><label>Produto<select value={productId} onChange={(event) => setProductId(event.target.value)}><option value="">Sem produto definido</option>{products.map((item) => <option value={item.id} key={item.id}>{item.nome}</option>)}</select></label><label>Início<input required type="time" value={startTime} onChange={(event) => setStartTime(event.target.value)} /></label><label>Fim<input type="time" value={endTime} onChange={(event) => setEndTime(event.target.value)} /></label><label className="wide">Local<input value={local} onChange={(event) => setLocal(event.target.value)} placeholder="Preenchido pelo endereço do produto quando vazio" /></label><label className="wide">Observações<textarea rows={3} value={description} onChange={(event) => setDescription(event.target.value)} /></label><label className="check wide"><input type="checkbox" checked={withManager} onChange={(event) => setWithManager(event.target.checked)} /> Ir com gerente</label></>}
    {action === "proposal" && <><label>Produto<select value={productId} onChange={(event) => setProductId(event.target.value)}><option value="">Produto do negócio</option>{products.map((item) => <option value={item.id} key={item.id}>{item.nome}</option>)}</select></label><label>Valor da proposta<input required min="1" step="0.01" type="number" value={value} onChange={(event) => setValue(event.target.value)} /></label><label className="wide">Condições e observações<textarea rows={5} value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Entrada, parcelas, validade e demais condições" /></label><p className="quick-action-hint">A proposta será registrada no histórico. Nenhuma mensagem será enviada ao cliente nesta etapa.</p></>}
    {action === "financing" && <><label>Produto<select value={productId} onChange={(event) => setProductId(event.target.value)}><option value="">Produto do negócio</option>{products.map((item) => <option value={item.id} key={item.id}>{item.nome}</option>)}</select></label><label>Valor do imóvel<input required min="1" step="0.01" type="number" value={value} onChange={(event) => setValue(event.target.value)} /></label><label>Valor a financiar<input required min="1" step="0.01" type="number" value={financing} onChange={(event) => setFinancing(event.target.value)} /></label><label>Entrada (calculada)<input readOnly value={Number(value) > 0 && Number(financing) > 0 ? Math.max(0, Number(value) - Number(financing)) || "" : ""} /></label>{Number(value) > 0 && Number(financing) > 0 && Number(financing) >= Number(value) && <p className="quick-action-hint wide" style={{ color: "#bd4034" }}>O valor a financiar deve ser menor que o valor do imóvel.</p>}<label className="wide check-line"><input type="checkbox" checked={consent} onChange={(event) => setConsent(event.target.checked)} /> Consentimento LGPD já confirmado pelo cliente</label></>}
    {action === "transfer" && <label className="wide">Novo corretor<select required value={brokerId} onChange={(event) => setBrokerId(event.target.value)}><option value="">Selecione um corretor</option>{brokers.filter((item) => item.id !== deal?.corretor_id).map((item) => <option value={item.id} key={item.id}>{item.nome}{item.online ? " · online" : ""}</option>)}</select></label>}
    {action === "note" && <label className="wide">Observação<textarea autoFocus required rows={6} value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Escreva a observação do atendimento" /></label>}
  </div>{error && <div className="modal-error">{error}</div>}<footer><button type="button" onClick={onClose}>Cancelar</button><button className="crm-primary" disabled={invalid} type="submit">{busy ? "Salvando…" : config[action].submit}</button></footer></form></div>;
}

export function ProductSendModal({ data, canSend, onClose, onSend }: { data: ChatData; canSend: boolean; onClose: () => void; onSend: (content: string, mediaId?: string) => Promise<void> }) {
  const [productId, setProductId] = useState(""); const [mediaId, setMediaId] = useState(""); const product = data.products.find((item) => item.id === productId); const items = data.media.filter((item) => item.empreendimento_id === productId);
  const [busy, setBusy] = useState(false); const [error, setError] = useState("");
  return <div className="crm-center-modal"><form onSubmit={(event) => { event.preventDefault(); if (!product || !canSend) return; setBusy(true); setError(""); void onSend(`${product.nome} · ${product.bairro || ""}, ${product.cidade || ""} · ${product.preco ? money.format(product.preco) : "valor sob consulta"}`, mediaId || undefined).catch((reason) => setError(reason instanceof Error ? reason.message : "Não foi possível enviar o produto.")).finally(() => setBusy(false)); }}><header><div><span>ENVIO PELO CHAT</span><h2>Enviar produto</h2><p>Escolha o imóvel e, se quiser, um material específico.</p></div><button type="button" onClick={onClose}>×</button></header>{!canSend && <div className="modal-error">Selecione uma conversa com contato e uma instância conectada antes de enviar.</div>}<label>Produto<select required value={productId} onChange={(event) => { setProductId(event.target.value); setMediaId(""); }}><option value="">Selecione</option>{data.products.map((item) => <option value={item.id} key={item.id}>{item.nome}</option>)}</select></label><label>Material<select value={mediaId} onChange={(event) => setMediaId(event.target.value)}><option value="">Somente resumo do produto</option>{items.map((item) => <option value={item.id} key={item.id}>{item.tipo} · {item.categoria || item.nome || "material"}</option>)}</select></label>{error && <div className="modal-error">{error}</div>}<footer><button type="button" onClick={onClose}>Cancelar</button><button className="crm-primary" disabled={busy || !productId || !canSend} type="submit">{busy ? "Enviando…" : "Enviar no WhatsApp"}</button></footer></form></div>;
}

export function ScheduleModal({ initialText, onClose, onSchedule }: { initialText: string; onClose: () => void; onSchedule: (content: string, when: string) => Promise<void> }) {
  const [content, setContent] = useState(initialText); const [scheduledFor, setScheduledFor] = useState(new Date(Date.now() + 3_600_000).toISOString().slice(0, 16)); const [busy, setBusy] = useState(false);
  return <div className="crm-center-modal"><form onSubmit={(event) => { event.preventDefault(); setBusy(true); void onSchedule(content, scheduledFor).finally(() => setBusy(false)); }}><header><div><span>MENSAGEM PROGRAMADA</span><h2>Agendar mensagem</h2><p>A mensagem entra na fila segura da instância selecionada.</p></div><button type="button" onClick={onClose}>×</button></header><label>Mensagem<textarea required rows={5} value={content} onChange={(event) => setContent(event.target.value)} /></label><label>Data e hora<input required type="datetime-local" value={scheduledFor} onChange={(event) => setScheduledFor(event.target.value)} /></label><footer><button type="button" onClick={onClose}>Cancelar</button><button className="crm-primary" disabled={busy || !content.trim()} type="submit">{busy ? "Agendando…" : "Agendar"}</button></footer></form></div>;
}

function ApproachModal({ approaches, onClose, onSend }: { approaches: ChatData["approaches"]; onClose: () => void; onSend: (approachId: number) => Promise<void> }) {
  const [approachId, setApproachId] = useState(""); const [busy, setBusy] = useState(false); const selected = approaches.find((item) => String(item.id) === approachId); const count = Array.isArray(selected?.mensagens) ? selected.mensagens.length : 0;
  return <div className="crm-center-modal"><form onSubmit={(event) => { event.preventDefault(); setBusy(true); void onSend(Number(approachId)).finally(() => setBusy(false)); }}><header><div><span>BIBLIOTECA COMERCIAL</span><h2>Enviar abordagem</h2><p>As partes e intervalos cadastrados serão respeitados.</p></div><button type="button" onClick={onClose}>×</button></header><label>Abordagem<select required value={approachId} onChange={(event) => setApproachId(event.target.value)}><option value="">Selecione</option>{approaches.map((item) => <option value={item.id} key={item.id}>{item.nome}</option>)}</select></label>{selected && <div className="approach-send-summary"><strong>{selected.nome}</strong><span>{count} parte{count === 1 ? "" : "s"} na sequência</span></div>}<footer><button type="button" onClick={onClose}>Cancelar</button><button className="crm-primary" disabled={busy || !approachId} type="submit">{busy ? "Programando…" : "Enviar abordagem"}</button></footer></form></div>;
}
