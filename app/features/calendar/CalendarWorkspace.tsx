"use client";
/* Doc §8 — Calendário estilo agenda: Dia/Semana/Mês/Lista, cores por tipo,
   "mais X" no mês e criação arrastando no grid de horários. */
/* eslint-disable react-hooks/set-state-in-effect, react-hooks/exhaustive-deps */

import { useEffect, useMemo, useState } from "react";

type Broker = { id: number; nome: string };
type Lead = { id: number; nome: string | null };
type Deal = { id: number; lead_id: number; corretor_id: number | null };
type Product = { id: string; nome: string };
type Visit = { id: string; lead_id: number | null; negocio_id: number | null; corretor_id: number | null; cliente_nome: string | null; produto: string | null; empreendimento_id: string | null; data: string; hora_inicio: string | null; hora_fim: string | null; local: string | null; observacoes: string | null; com_gerente: boolean; gerente_id: number | null; status: string };
type Task = { id: number; lead_id: number | null; corretor_id: number | null; titulo: string; vencimento: string | null; concluida: boolean; prioridade: string };
type Gerente = { id: number; nome: string; geral: boolean; corretor_id: number | null };
type Conflito = { cliente_nome: string | null; hora_inicio: string | null; hora_fim: string | null };
type CrmData = { brokers: Broker[]; leads: Lead[]; deals: Deal[]; products: Product[]; visits: Visit[]; tasks: Task[]; role?: string; gerentes?: Gerente[] };
type CalendarItem = { id: string; date: string; time: string; endTime: string; label: string; brokerId: number | null; product: string; status: string; manager: boolean; type: "visit" | "task"; raw: Visit | Task };
type ViewMode = "day" | "week" | "month" | "list";

const monthNames = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
const weekdays = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
const HOURS = Array.from({ length: 15 }, (_, index) => index + 7); // 07h às 21h
const iso = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
const addDays = (date: Date, days: number) => { const next = new Date(date); next.setDate(next.getDate() + days); return next; };
const startOfWeek = (date: Date) => addDays(date, -date.getDay());

export function CalendarWorkspace({ accessToken }: { accessToken: string }) {
  const now = new Date();
  const todayIso = iso(now);
  const [data, setData] = useState<CrmData>({ brokers: [], leads: [], deals: [], products: [], visits: [], tasks: [] });
  const [view, setView] = useState<ViewMode>("month");
  const [anchor, setAnchor] = useState(() => new Date());
  const [broker, setBroker] = useState(""); const [type, setType] = useState(""); const [manager, setManager] = useState(""); const [product, setProduct] = useState(""); const [status, setStatus] = useState("");
  const [selected, setSelected] = useState<CalendarItem | null>(null); const [creating, setCreating] = useState(false); const [loading, setLoading] = useState(true); const [error, setError] = useState(""); const [notice, setNotice] = useState("");
  const [form, setForm] = useState({ dealId: "", productId: "", date: todayIso, startTime: "10:00", endTime: "11:00", local: "", observations: "", withManager: false, gerenteId: "", reminder: true });
  const [drag, setDrag] = useState<{ date: string; start: number; end: number } | null>(null);
  const [editing, setEditing] = useState<Visit | null>(null);
  const [editForm, setEditForm] = useState({ date: "", startTime: "", endTime: "", local: "", observations: "", withManager: false, gerenteId: "" });
  const [savingEdit, setSavingEdit] = useState(false);
  const [disp, setDisp] = useState<{ loading: boolean; conflitos: Conflito[]; gerenteNome: string | null } | null>(null);
  const isAdmin = data.role === "admin" || data.role === "gestor";
  const gerenteNomeGeral = useMemo(() => (data.gerentes ?? []).find((g) => g.geral)?.nome ?? null, [data.gerentes]);
  const geralGerenteId = useMemo(() => (data.gerentes ?? []).find((g) => g.geral)?.id ?? null, [data.gerentes]);

  async function load() { setLoading(true); setError(""); const response = await fetch("/api/crm", { headers: { Authorization: `Bearer ${accessToken}` } }); const body = await response.json() as CrmData & { error?: string }; if (!response.ok) setError(body.error ?? "Não foi possível carregar a agenda."); else setData(body); setLoading(false); }
  useEffect(() => { void load(); }, [accessToken]);
  const brokerById = useMemo(() => new Map(data.brokers.map((item) => [item.id, item.nome])), [data.brokers]);
  const leadById = useMemo(() => new Map(data.leads.map((item) => [item.id, item.nome ?? `Lead #${item.id}`])), [data.leads]);

  const allItems = useMemo(() => {
    const visits: CalendarItem[] = data.visits.map((visit) => ({ id: `v-${visit.id}`, date: visit.data, time: visit.hora_inicio?.slice(0, 5) ?? "—", endTime: visit.hora_fim?.slice(0, 5) ?? "", label: visit.cliente_nome ?? (visit.lead_id ? leadById.get(visit.lead_id) ?? "Visita" : "Visita"), brokerId: visit.corretor_id, product: visit.produto ?? "", status: visit.status, manager: visit.com_gerente, type: "visit", raw: visit }));
    const tasks: CalendarItem[] = data.tasks.filter((task) => task.vencimento).map((task) => { const date = task.vencimento!.slice(0, 10); return { id: `t-${task.id}`, date, time: task.vencimento!.slice(11, 16) || "—", endTime: "", label: task.titulo, brokerId: task.corretor_id, product: "", status: task.concluida ? "realizada" : "pendente", manager: false, type: "task", raw: task }; });
    return [...visits, ...tasks].filter((item) => (!broker || item.brokerId === Number(broker)) && (!type || item.type === type) && (!manager || (manager === "yes" ? item.manager : !item.manager)) && (!product || item.product === product) && (!status || item.status === status)).sort((a, b) => `${a.date}${a.time}`.localeCompare(`${b.date}${b.time}`));
  }, [data, leadById, broker, type, manager, product, status]);
  const byDate = useMemo(() => { const map = new Map<string, CalendarItem[]>(); allItems.forEach((item) => map.set(item.date, [...(map.get(item.date) ?? []), item])); return map; }, [allItems]);

  const year = anchor.getFullYear(); const month = anchor.getMonth();
  const firstDay = new Date(year, month, 1).getDay(); const daysInMonth = new Date(year, month + 1, 0).getDate();
  const monthCells = [...Array(firstDay).fill(null), ...Array.from({ length: daysInMonth }, (_, index) => index + 1)];
  const weekStart = startOfWeek(anchor);
  const weekDates = Array.from({ length: 7 }, (_, index) => addDays(weekStart, index));
  const todayItems = byDate.get(todayIso) ?? [];

  function navigate(delta: number) {
    if (view === "month") { const next = new Date(year, month + delta, 1); setAnchor(next); }
    else if (view === "week") setAnchor(addDays(anchor, delta * 7));
    else setAnchor(addDays(anchor, delta));
  }
  const rangeLabel = view === "month" ? `${monthNames[month]} ${year}`
    : view === "week" ? `${weekDates[0].getDate()} ${monthNames[weekDates[0].getMonth()].slice(0, 3)} – ${weekDates[6].getDate()} ${monthNames[weekDates[6].getMonth()].slice(0, 3)} ${weekDates[6].getFullYear()}`
    : view === "day" ? anchor.toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long" })
    : "Próximos compromissos";

  function clearFilters() { setBroker(""); setType(""); setManager(""); setProduct(""); setStatus(""); }
  function openCreate(date: string, startHour?: number, endHour?: number) {
    setForm((current) => ({ ...current, date, startTime: startHour !== undefined ? `${String(startHour).padStart(2, "0")}:00` : current.startTime, endTime: endHour !== undefined ? `${String(endHour).padStart(2, "0")}:00` : current.endTime }));
    setCreating(true);
  }
  function finishDrag() {
    if (!drag) return;
    const [start, end] = drag.start <= drag.end ? [drag.start, drag.end + 1] : [drag.end, drag.start + 1];
    openCreate(drag.date, start, end);
    setDrag(null);
  }
  async function updateVisitStatus(visitId: string, nextStatus: string) { setNotice(""); const response = await fetch("/api/crm", { method: "PATCH", headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" }, body: JSON.stringify({ action: "updateVisitStatus", visitId, status: nextStatus }) }); const body = await response.json() as { error?: string }; if (!response.ok) setNotice(body.error ?? "Não foi possível atualizar."); else { setNotice("Visita atualizada."); setSelected(null); await load(); } }
  async function createVisit() { const deal = data.deals.find((item) => String(item.id) === form.dealId); if (!deal) { setNotice("Selecione um lead com negócio aberto."); return; } const response = await fetch("/api/crm", { method: "PATCH", headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" }, body: JSON.stringify({ action: "createVisit", leadId: deal.lead_id, dealId: deal.id, productId: form.productId, date: form.date, startTime: form.startTime, endTime: form.endTime, local: form.local, observations: form.observations, withManager: form.withManager, gerenteId: form.withManager ? (form.gerenteId || geralGerenteId) : null, reminder: form.reminder }) }); const body = await response.json() as { error?: string }; if (!response.ok) setNotice(body.error ?? "Não foi possível agendar."); else { setNotice("Visita agendada."); setCreating(false); await load(); } }
  function openEdit(visit: Visit) {
    setEditForm({ date: visit.data, startTime: visit.hora_inicio?.slice(0, 5) ?? "", endTime: visit.hora_fim?.slice(0, 5) ?? "", local: visit.local ?? "", observations: visit.observacoes ?? "", withManager: visit.com_gerente, gerenteId: visit.gerente_id ? String(visit.gerente_id) : (visit.com_gerente ? String(geralGerenteId ?? "") : "") });
    setDisp(null); setSelected(null); setEditing(visit);
  }
  async function saveEdit() {
    if (!editing) return;
    setSavingEdit(true); setNotice("");
    const response = await fetch("/api/crm", { method: "PATCH", headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" }, body: JSON.stringify({ action: "updateVisit", visitId: editing.id, date: editForm.date, startTime: editForm.startTime, endTime: editForm.endTime, local: editForm.local, observations: editForm.observations, ...(isAdmin ? { withManager: editForm.withManager, gerenteId: editForm.withManager ? (editForm.gerenteId || geralGerenteId) : null } : {}) }) });
    const body = await response.json() as { error?: string };
    setSavingEdit(false);
    if (!response.ok) setNotice(body.error ?? "Não foi possível salvar a visita."); else { setNotice("Visita atualizada."); setEditing(null); await load(); }
  }
  // checa a agenda do gerente quando editando "com gerente"
  useEffect(() => {
    if (!editing || !editForm.withManager || !editForm.date || !editForm.startTime || !editing.corretor_id) { setDisp(null); return; }
    let alive = true;
    setDisp((prev) => ({ loading: true, conflitos: prev?.conflitos ?? [], gerenteNome: prev?.gerenteNome ?? null }));
    const timer = window.setTimeout(async () => {
      try {
        const response = await fetch("/api/crm", { method: "PATCH", headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" }, body: JSON.stringify({ action: "gerenteDisponibilidade", corretorId: editing.corretor_id, gerenteId: editForm.gerenteId || geralGerenteId, date: editForm.date, startTime: editForm.startTime, endTime: editForm.endTime || null, visitId: editing.id }) });
        const result = await response.json() as { conflitos?: Conflito[]; gerente_id?: number | null };
        const gnome = (data.gerentes ?? []).find((g) => g.id === (result.gerente_id ?? -1))?.nome ?? gerenteNomeGeral;
        if (alive) setDisp({ loading: false, conflitos: result.conflitos ?? [], gerenteNome: gnome });
      } catch { if (alive) setDisp(null); }
    }, 450);
    return () => { alive = false; window.clearTimeout(timer); };
  }, [editing, editForm.withManager, editForm.gerenteId, editForm.date, editForm.startTime, editForm.endTime, accessToken]);

  const gerenteNomeDe = (item: CalendarItem) => item.type === "visit" && item.manager ? ((data.gerentes ?? []).find((g) => g.id === (item.raw as Visit).gerente_id)?.nome ?? "") : "";
  const eventChip = (item: CalendarItem, compact = false) => <button className={`cal-event type-${item.type} ${item.manager ? "with-manager" : ""} ${/eliz/i.test(gerenteNomeDe(item)) ? "eliz" : ""} ${item.status}`} type="button" onClick={() => setSelected(item)} key={item.id}>
    <span>{item.status === "realizada" ? "✓ " : item.status === "cancelada" ? "× " : ""}{item.time !== "—" ? `${item.time} · ` : ""}{item.label}</span>
    {!compact && <small>{item.brokerId ? brokerById.get(item.brokerId) ?? "Sem corretor" : item.type === "task" ? "Tarefa" : "Sem corretor"}</small>}
  </button>;

  const hourItems = (date: string, hour: number) => (byDate.get(date) ?? []).filter((item) => item.time !== "—" && Number(item.time.slice(0, 2)) === hour);
  const noTimeItems = (date: string) => (byDate.get(date) ?? []).filter((item) => item.time === "—");

  return <div className="calendar-workspace" onMouseUp={() => finishDrag()} onMouseLeave={() => setDrag(null)}>
    <header className="workspace-top"><div><h1>Calendário</h1><p>Visitas, tarefas e compromissos da equipe</p></div><button className="calendar-primary" type="button" onClick={() => openCreate(view === "month" ? todayIso : iso(anchor))}>＋ Nova visita</button></header>
    {loading ? <div className="workspace-loading">Carregando agenda...</div> : error ? <div className="workspace-error">{error}<button type="button" onClick={() => void load()}>Tentar novamente</button></div> : <main className="calendar-main">
      <section className="today-summary"><span>▣</span><div><small>RESUMO DE HOJE</small><strong>{todayItems.length ? `${todayItems.length} compromisso(s) na agenda de hoje` : "Nenhum compromisso agendado para hoje"}</strong></div><i>{data.visits.filter((visit) => visit.status === "agendada").length} visitas futuras</i><i>{data.tasks.filter((task) => !task.concluida).length} tarefas pendentes</i></section>
      <div className="calendar-nav">
        <button type="button" onClick={() => navigate(-1)}>‹</button>
        <button className="cal-today-btn" type="button" onClick={() => setAnchor(new Date())}>Hoje</button>
        <button type="button" onClick={() => navigate(1)}>›</button>
        <strong>{rangeLabel}</strong>
        <nav className="cal-view-switch">{([["day", "Dia"], ["week", "Semana"], ["month", "Mês"], ["list", "Lista"]] as Array<[ViewMode, string]>).map(([key, label]) => <button className={view === key ? "active" : ""} type="button" onClick={() => setView(key)} key={key}>{label}</button>)}</nav>
        <i /><span><b className="legend-visit" /> Visita</span><span><b className="legend-task" /> Tarefa</span><span><b className="manager-color" /> Com gerente</span><span><b className="manager-eliz" /> Gerente Eliz</span>
      </div>
      <div className="calendar-filters"><span>▽</span><select aria-label="Corretor" value={broker} onChange={(event) => setBroker(event.target.value)}><option value="">Todos os corretores</option>{data.brokers.map((item) => <option value={item.id} key={item.id}>{item.nome}</option>)}</select><select aria-label="Tipo" value={type} onChange={(event) => setType(event.target.value)}><option value="">Todos os tipos</option><option value="visit">Visitas</option><option value="task">Tarefas</option></select><select aria-label="Acompanhamento" value={manager} onChange={(event) => setManager(event.target.value)}><option value="">Com ou sem gerente</option><option value="yes">Com gerente</option><option value="no">Sem gerente</option></select><select aria-label="Produto" value={product} onChange={(event) => setProduct(event.target.value)}><option value="">Todos os produtos</option>{[...new Set(data.visits.map((visit) => visit.produto).filter(Boolean))].map((item) => <option key={item!}>{item}</option>)}</select><select aria-label="Status" value={status} onChange={(event) => setStatus(event.target.value)}><option value="">Todos os status</option><option value="agendada">Agendada</option><option value="confirmada">Confirmada</option><option value="realizada">Realizada</option><option value="cancelada">Cancelada</option><option value="pendente">Pendente</option></select><button type="button" onClick={clearFilters}>× Limpar</button><i /> <b>{allItems.length} no total</b></div>

      {view === "month" && <section className="calendar-grid"><div className="calendar-weekdays">{weekdays.map((day) => <span key={day}>{day}</span>)}</div><div className="calendar-days">{monthCells.map((day, index) => { if (day === null) return <div className="calendar-blank" key={`blank-${index}`} />; const dateIso = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`; const dayItems = byDate.get(dateIso) ?? []; const shown = dayItems.slice(0, 3); const hidden = dayItems.length - shown.length; return <div className={dateIso === todayIso ? "calendar-day today" : "calendar-day"} key={day} onDoubleClick={() => openCreate(dateIso)}><strong>{day}</strong><div>{shown.map((item) => eventChip(item))}{hidden > 0 && <button className="cal-more" type="button" onClick={() => { setAnchor(new Date(`${dateIso}T12:00:00`)); setView("day"); }}>＋ mais {hidden}</button>}</div></div>; })}</div><p className="cal-hint">Duplo clique num dia cria uma visita; "＋ mais X" abre o dia completo.</p></section>}

      {view === "week" && <section className="cal-week"><div className="cal-week-head"><span /> {weekDates.map((date) => <button className={iso(date) === todayIso ? "today" : ""} type="button" onClick={() => { setAnchor(date); setView("day"); }} key={iso(date)}><small>{weekdays[date.getDay()]}</small><strong>{date.getDate()}</strong></button>)}</div><div className="cal-week-grid">{HOURS.map((hour) => <div className="cal-week-row" key={hour}><span>{String(hour).padStart(2, "0")}h</span>{weekDates.map((date) => { const dateIso = iso(date); const inDrag = drag && drag.date === dateIso && hour >= Math.min(drag.start, drag.end) && hour <= Math.max(drag.start, drag.end); return <div className={`cal-slot ${inDrag ? "dragging" : ""}`} key={dateIso}
        onMouseDown={(event) => { if ((event.target as HTMLElement).closest(".cal-event")) return; setDrag({ date: dateIso, start: hour, end: hour }); }}
        onMouseEnter={() => setDrag((current) => current && current.date === dateIso ? { ...current, end: hour } : current)}
      >{hourItems(dateIso, hour).map((item) => eventChip(item, true))}</div>; })}</div>)}</div><p className="cal-hint">Clique e arraste sobre os horários para criar uma visita no intervalo.</p></section>}

      {view === "day" && <section className="cal-day">{noTimeItems(iso(anchor)).length > 0 && <div className="cal-day-notime"><small>SEM HORÁRIO</small>{noTimeItems(iso(anchor)).map((item) => eventChip(item))}</div>}{HOURS.map((hour) => { const dateIso = iso(anchor); const inDrag = drag && drag.date === dateIso && hour >= Math.min(drag.start, drag.end) && hour <= Math.max(drag.start, drag.end); return <div className="cal-day-row" key={hour}><span>{String(hour).padStart(2, "0")}h</span><div className={`cal-slot wide ${inDrag ? "dragging" : ""}`}
        onMouseDown={(event) => { if ((event.target as HTMLElement).closest(".cal-event")) return; setDrag({ date: dateIso, start: hour, end: hour }); }}
        onMouseEnter={() => setDrag((current) => current && current.date === dateIso ? { ...current, end: hour } : current)}
      >{hourItems(dateIso, hour).map((item) => eventChip(item))}</div></div>; })}<p className="cal-hint">Clique e arraste para criar uma visita no intervalo.</p></section>}

      {view === "list" && <section className="cal-list">{allItems.filter((item) => item.date >= todayIso).slice(0, 60).map((item) => <button className={`cal-list-row type-${item.type} ${item.status}`} type="button" onClick={() => setSelected(item)} key={item.id}><div className="cal-list-date"><strong>{new Date(`${item.date}T12:00:00`).getDate()}</strong><span>{monthNames[Number(item.date.slice(5, 7)) - 1].slice(0, 3)}</span></div><div><strong>{item.label}</strong><small>{item.time !== "—" ? `${item.time}${item.endTime ? `–${item.endTime}` : ""} · ` : ""}{item.type === "visit" ? "Visita" : "Tarefa"}{item.product ? ` · ${item.product}` : ""}{item.manager ? " · com gerente" : ""}</small></div><em>{item.brokerId ? brokerById.get(item.brokerId) ?? "—" : "—"}</em><span className={`cal-status ${item.status}`}>{item.status}</span></button>)}{allItems.filter((item) => item.date >= todayIso).length === 0 && <div className="audit-empty">Nenhum compromisso futuro nos filtros atuais.</div>}</section>}

      {notice && <div className="calendar-notice">{notice}</div>}
    </main>}
    {selected && <div className="calendar-modal-layer" onClick={() => setSelected(null)}><aside className="calendar-detail" onClick={(event) => event.stopPropagation()}><header><div><small>{selected.type === "visit" ? "VISITA" : "TAREFA"}</small><h2>{selected.label}</h2><p>{new Date(`${selected.date}T12:00:00`).toLocaleDateString("pt-BR")} · {selected.time}{selected.endTime ? ` – ${selected.endTime}` : ""}</p></div><button type="button" onClick={() => setSelected(null)}>×</button></header><dl><div><dt>Corretor</dt><dd>{selected.brokerId ? brokerById.get(selected.brokerId) ?? "—" : "—"}</dd></div><div><dt>Produto</dt><dd>{selected.product || "—"}</dd></div><div><dt>Status</dt><dd>{selected.status}</dd></div><div><dt>Acompanhamento</dt><dd>{selected.manager ? `Com gerente${(() => { const gid = (selected.raw as Visit).gerente_id; const gn = (data.gerentes ?? []).find((g) => g.id === gid)?.nome ?? gerenteNomeGeral; return gn ? ` · ${gn}` : ""; })()}` : "Sem gerente"}</dd></div></dl>{selected.type === "visit" && <footer><button type="button" onClick={() => openEdit(selected.raw as Visit)}>✎ Editar</button><button type="button" onClick={() => void updateVisitStatus(String((selected.raw as Visit).id), "cancelada")}>Cancelar visita</button><button className="confirm" type="button" onClick={() => void updateVisitStatus(String((selected.raw as Visit).id), "realizada")}>✓ Marcar realizada</button></footer>}</aside></div>}
    {creating && <div className="calendar-modal-layer" onClick={() => setCreating(false)}><form className="calendar-create" onClick={(event) => event.stopPropagation()} onSubmit={(event) => { event.preventDefault(); void createVisit(); }}><header><div><h2>Agendar visita</h2><p>A visita ficará vinculada ao lead e ao produto.</p></div><button type="button" onClick={() => setCreating(false)}>×</button></header><div><label>Lead<select required value={form.dealId} onChange={(event) => setForm({ ...form, dealId: event.target.value })}><option value="">Selecione</option>{data.deals.map((deal) => <option value={deal.id} key={deal.id}>{leadById.get(deal.lead_id) ?? `Lead #${deal.lead_id}`}</option>)}</select></label><label>Produto<select value={form.productId} onChange={(event) => setForm({ ...form, productId: event.target.value })}><option value="">Selecionar depois</option>{data.products.map((item) => <option value={item.id} key={item.id}>{item.nome}</option>)}</select></label><label>Data<input required type="date" value={form.date} onChange={(event) => setForm({ ...form, date: event.target.value })} /></label><label>Início<input required type="time" value={form.startTime} onChange={(event) => setForm({ ...form, startTime: event.target.value })} /></label><label>Fim<input type="time" value={form.endTime} onChange={(event) => setForm({ ...form, endTime: event.target.value })} /></label><label className="wide">Local<input value={form.local} onChange={(event) => setForm({ ...form, local: event.target.value })} placeholder="Preenchido pelo endereço do produto" /></label><label className="wide">Observações<textarea value={form.observations} onChange={(event) => setForm({ ...form, observations: event.target.value })} /></label><label className="check"><input type="checkbox" checked={form.reminder} onChange={(event) => setForm({ ...form, reminder: event.target.checked })} /> Criar lembrete</label><label className="check"><input type="checkbox" checked={form.withManager} onChange={(event) => setForm({ ...form, withManager: event.target.checked, gerenteId: event.target.checked ? (form.gerenteId || String(geralGerenteId ?? "")) : "" })} /> Com gerente</label>{form.withManager && <label className="wide">Gerente que vai atender<select value={form.gerenteId || String(geralGerenteId ?? "")} onChange={(event) => setForm({ ...form, gerenteId: event.target.value })}>{(data.gerentes ?? []).map((g) => <option value={String(g.id)} key={g.id}>{g.nome}{g.geral ? " (geral)" : ""}</option>)}</select></label>}</div><footer><button type="button" onClick={() => setCreating(false)}>Cancelar</button><button className="confirm" type="submit">Agendar visita</button></footer></form></div>}
    {editing && <div className="calendar-modal-layer" onClick={() => setEditing(null)}><form className="calendar-create" onClick={(event) => event.stopPropagation()} onSubmit={(event) => { event.preventDefault(); void saveEdit(); }}><header><div><h2>Editar visita</h2><p>{editing.cliente_nome || "Cliente"}{editing.produto ? ` · ${editing.produto}` : ""}{isAdmin ? "" : " · você ajusta o horário"}</p></div><button type="button" onClick={() => setEditing(null)}>×</button></header><div><label>Data<input required type="date" value={editForm.date} onChange={(event) => setEditForm({ ...editForm, date: event.target.value })} /></label><label>Início<input required type="time" value={editForm.startTime} onChange={(event) => setEditForm({ ...editForm, startTime: event.target.value })} /></label><label>Fim<input type="time" value={editForm.endTime} onChange={(event) => setEditForm({ ...editForm, endTime: event.target.value })} /></label><label>Local<input value={editForm.local} onChange={(event) => setEditForm({ ...editForm, local: event.target.value })} placeholder="Local da visita" /></label><label className="wide">Observações<textarea value={editForm.observations} onChange={(event) => setEditForm({ ...editForm, observations: event.target.value })} /></label><label className="check"><input type="checkbox" disabled={!isAdmin} checked={editForm.withManager} onChange={(event) => setEditForm({ ...editForm, withManager: event.target.checked, gerenteId: event.target.checked ? (editForm.gerenteId || String(geralGerenteId ?? "")) : "" })} /> Com gerente{!isAdmin && <em className="only-admin"> · só o admin altera</em>}</label>{editForm.withManager && <label className="wide">Gerente que vai atender<select disabled={!isAdmin} value={editForm.gerenteId || String(geralGerenteId ?? "")} onChange={(event) => setEditForm({ ...editForm, gerenteId: event.target.value })}>{(data.gerentes ?? []).map((g) => <option value={String(g.id)} key={g.id}>{g.nome}{g.geral ? " (geral)" : ""}</option>)}</select>{!isAdmin && <em className="only-admin"> · só o admin altera</em>}</label>}{editForm.withManager && <div className={`cal-disp wide ${disp && disp.conflitos.length ? "conflito" : "livre"}`}>{disp?.loading ? "Checando a agenda do gerente…" : disp && disp.conflitos.length ? `⚠ ${disp.gerenteNome || "O gerente"} já tem ${disp.conflitos.length} visita${disp.conflitos.length > 1 ? "s" : ""} nesse horário (${disp.conflitos.map((c) => `${c.hora_inicio?.slice(0, 5) ?? ""} ${c.cliente_nome ?? ""}`.trim()).join("; ")}). Pode salvar mesmo assim.` : `✓ ${disp?.gerenteNome || gerenteNomeGeral || "Gerente"} livre nesse horário.`}</div>}</div><footer><button type="button" onClick={() => setEditing(null)}>Cancelar</button><button className="confirm" type="submit" disabled={savingEdit || !editForm.date || !editForm.startTime}>{savingEdit ? "Salvando…" : "Salvar"}</button></footer></form></div>}
  </div>;
}
