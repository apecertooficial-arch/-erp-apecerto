"use client";

import { useMemo, useState } from "react";
import type { StudioData, StudioSchedule } from "./domain";

const TZ = "America/Sao_Paulo";
const fmtDate = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short", timeZone: TZ });
const fmtTime = new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: TZ });
const isoDay = (date: Date) => new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(date);
const startOfDay = (date: Date) => new Date(`${isoDay(date)}T00:00:00-03:00`);
export function scheduleDropInstant(day: string, hour: number) { return new Date(`${day}T${String(hour).padStart(2, "0")}:00:00-03:00`).toISOString(); }
const addDays = (date: Date, days: number) => new Date(date.getTime() + days * 86400000);

type Props = { data: StudioData; busy: boolean; mutate: (body: Record<string, unknown>, success?: string) => Promise<{ ok?: boolean; code?: string }> };

export function StudioCalendar({ data, busy, mutate }: Props) {
  const [mode, setMode] = useState<"mes" | "semana" | "lista">("mes");
  const [dragged, setDragged] = useState<StudioSchedule | null>(null);
  const [proposal, setProposal] = useState<{ schedule: StudioSchedule; next: string } | null>(null);
  const [optimistic, setOptimistic] = useState<Record<string, string>>({});
  const schedules = data.schedules.map((item) => optimistic[item.id] ? { ...item, agendado_para: optimistic[item.id] } : item);
  const grouped = useMemo(() => { const map = new Map<string, StudioSchedule[]>(); schedules.forEach((item) => { const key = isoDay(new Date(item.agendado_para)); map.set(key, [...(map.get(key) ?? []), item]); }); return [...map.entries()].sort(([a], [b]) => a.localeCompare(b)); }, [schedules]);
  const base = schedules.length ? startOfDay(new Date(schedules[0].agendado_para)) : startOfDay(new Date());
  const monthStart = new Date(base.getFullYear(), base.getMonth(), 1); const monthOffset = (monthStart.getDay() + 6) % 7;
  const days = Array.from({ length: 42 }, (_, index) => addDays(new Date(monthStart.getTime() - monthOffset * 86400000), index));
  const weekStart = addDays(base, -((base.getDay() + 6) % 7)); const weekDays = Array.from({ length: 7 }, (_, index) => addDays(weekStart, index));
  const scheduleInfo = (item: StudioSchedule) => { const version = data.versions.find((v) => v.id === item.piece_version_id); const piece = version ? data.pieces.find((p) => p.id === version.piece_id) : null; return { version, piece }; };
  const requestDrop = (day: string, hour: number) => { if (!dragged) return; const next = scheduleDropInstant(day, hour); if (next !== dragged.agendado_para) setProposal({ schedule: dragged, next }); setDragged(null); };
  const confirmDrop = async () => { if (!proposal) return; const { schedule, next } = proposal; setProposal(null); setOptimistic((current) => ({ ...current, [schedule.id]: next })); try { const result = await mutate({ action: "moveSchedule", scheduleId: schedule.id, agendadoPara: next }, "Horário alterado no calendário."); if (result.code === "schedule_conflict") throw Object.assign(new Error("Conflito"), { code: "schedule_conflict" }); } catch (error) { setOptimistic((current) => { const copy = { ...current }; delete copy[schedule.id]; return copy; }); }
  };
  const event = (item: StudioSchedule) => { const { piece, version } = scheduleInfo(item); return <button type="button" draggable onDragStart={() => setDragged(item)} onDragEnd={() => setDragged(null)} className="studio-calendar-event"><strong>{piece?.titulo ?? "Peça"}</strong><small>{version ? `v${version.versao}` : "—"}</small></button>; };
  return <main className="studio-content"><section className="studio-section studio-calendar"><header><div><span className="studio-eyebrow">Agenda editorial</span><h2>Calendário de conteúdo</h2><p>Arraste uma peça para outro dia/horário. Horários em {TZ}.</p></div><div className="studio-calendar-modes">{([['mes','Mês'],['semana','Semana'],['lista','Lista']] as const).map(([id, label]) => <button type="button" className={mode === id ? "active" : ""} onClick={() => setMode(id)} key={id}>{label}</button>)}</div></header>{mode === "mes" && <div className="studio-calendar-month" data-testid="calendar-month"><div className="studio-calendar-weekdays">{["Seg","Ter","Qua","Qui","Sex","Sáb","Dom"].map((day) => <span key={day}>{day}</span>)}</div><div className="studio-calendar-grid">{days.map((day) => { const key = isoDay(day); return <div className="studio-calendar-day" key={key} onDragOver={(event) => event.preventDefault()} onDrop={() => requestDrop(key, 9)}><strong>{day.getDate()}</strong>{(grouped.find(([date]) => date === key)?.[1] ?? []).map(event)}</div>; })}</div></div>}{mode === "semana" && <div className="studio-calendar-week" data-testid="calendar-week">{weekDays.map((day) => { const key = isoDay(day); return <div className="studio-calendar-column" key={key}><header><strong>{fmtDate.format(day)}</strong></header>{Array.from({ length: 12 }, (_, index) => index + 8).map((hour) => <div className="studio-calendar-slot" key={hour} onDragOver={(event) => event.preventDefault()} onDrop={() => requestDrop(key, hour)}><span>{hour}:00</span>{(grouped.find(([date]) => date === key)?.[1] ?? []).filter((item) => new Date(item.agendado_para).getHours() === hour).map(event)}</div>)}</div>; })}</div>}{mode === "lista" && <div className="studio-calendar-list" data-testid="calendar-list">{grouped.map(([date, rows]) => <section key={date}><header><strong>{fmtDate.format(new Date(`${date}T12:00:00-03:00`))}</strong></header>{rows.map((item) => <article key={item.id} draggable onDragStart={() => setDragged(item)} onDragEnd={() => setDragged(null)}>{event(item)}<span>{fmtTime.format(new Date(item.agendado_para))}</span></article>)}</section>)}</div>}{proposal && <div className="studio-calendar-confirm" role="dialog"><h3>Confirmar reagendamento?</h3><p>{fmtTime.format(new Date(proposal.schedule.agendado_para))} → {fmtTime.format(new Date(proposal.next))}</p><button type="button" className="studio-secondary" onClick={() => setProposal(null)}>Cancelar</button><button type="button" className="studio-primary" disabled={busy} onClick={() => void confirmDrop()}>Confirmar alteração</button></div>}</section></main>;
}
