"use client";
/* Doc §18 — Auditoria: viewer de eventos reais com filtros (usuário, ação, módulo, período, antes/depois). */
/* eslint-disable react-hooks/set-state-in-effect, react-hooks/exhaustive-deps */

import { useEffect, useMemo, useState } from "react";
import { getBrowserSupabaseClient } from "../../lib/supabase/browser";

type AuditRow = { id: number; usuario_id: string | null; usuario_nome: string; acao: string; modulo: string; entidade: string | null; entidade_id: string | null; antes: Record<string, unknown> | null; depois: Record<string, unknown> | null; detalhe: string | null; ip: string | null; criado_em: string };

const PERIODS = [{ key: "24h", label: "Últimas 24h", hours: 24 }, { key: "7d", label: "7 dias", hours: 168 }, { key: "30d", label: "30 dias", hours: 720 }, { key: "all", label: "Tudo", hours: 0 }];
const ACTION_LABEL: Record<string, string> = { criar: "Criou", editar: "Editou", excluir: "Excluiu", editar_acesso: "Editou acesso", editar_corretor: "Editou corretor", enviar_documento: "Enviou documento", salvar_configuracao: "Salvou configuração", toggle_distribuicao: "Alterou roleta", salvar_ips: "Salvou IPs" };

function changedKeys(before: Record<string, unknown> | null, after: Record<string, unknown> | null) {
  if (!before || !after) return [];
  return Object.keys(after).filter((key) => JSON.stringify(before[key]) !== JSON.stringify(after[key])).slice(0, 12);
}

export function AuditWorkspace() {
  const [rows, setRows] = useState<AuditRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [period, setPeriod] = useState("7d");
  const [moduleFilter, setModuleFilter] = useState("Todos");
  const [actionFilter, setActionFilter] = useState("Todas");
  const [userFilter, setUserFilter] = useState("Todos");
  const [query, setQuery] = useState("");
  const [openId, setOpenId] = useState<number | null>(null);

  async function load() {
    setLoading(true); setError("");
    let request = getBrowserSupabaseClient().from("erp_auditoria").select("*").order("criado_em", { ascending: false }).limit(400);
    const hours = PERIODS.find((item) => item.key === period)?.hours ?? 0;
    if (hours > 0) request = request.gte("criado_em", new Date(Date.now() - hours * 3600000).toISOString());
    const { data, error: dbError } = await request;
    if (dbError) setError(dbError.message.includes("policy") || dbError.message.includes("permission") ? "A auditoria é visível apenas para administração." : dbError.message);
    else setRows((data ?? []) as AuditRow[]);
    setLoading(false);
  }
  useEffect(() => { void load(); }, [period]);

  const modules = useMemo(() => ["Todos", ...new Set(rows.map((row) => row.modulo))], [rows]);
  const actions = useMemo(() => ["Todas", ...new Set(rows.map((row) => row.acao))], [rows]);
  const users = useMemo(() => ["Todos", ...new Set(rows.map((row) => row.usuario_nome))], [rows]);
  const filtered = rows.filter((row) =>
    (moduleFilter === "Todos" || row.modulo === moduleFilter) &&
    (actionFilter === "Todas" || row.acao === actionFilter) &&
    (userFilter === "Todos" || row.usuario_nome === userFilter) &&
    (!query || `${row.detalhe} ${row.entidade} ${row.entidade_id} ${row.usuario_nome}`.toLowerCase().includes(query.toLowerCase())));

  return <div className="audit-workspace">
    <header className="workspace-top"><div><h1>Auditoria</h1><p>{filtered.length} eventos · quem fez o quê, quando e o que mudou</p></div><label className="workspace-search">⌕ <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar evento, entidade, usuário..." /></label></header>
    <div className="audit-filters">
      {PERIODS.map((item) => <button className={period === item.key ? "active" : ""} type="button" onClick={() => setPeriod(item.key)} key={item.key}>{item.label}</button>)}
      <i />
      <select value={moduleFilter} onChange={(event) => setModuleFilter(event.target.value)} aria-label="Módulo">{modules.map((item) => <option key={item}>{item}</option>)}</select>
      <select value={actionFilter} onChange={(event) => setActionFilter(event.target.value)} aria-label="Ação">{actions.map((item) => <option value={item} key={item}>{item === "Todas" ? "Todas as ações" : ACTION_LABEL[item] ?? item}</option>)}</select>
      <select value={userFilter} onChange={(event) => setUserFilter(event.target.value)} aria-label="Usuário">{users.map((item) => <option key={item}>{item === "Todos" ? "Todos os usuários" : item}</option>)}</select>
      <button className="audit-refresh" type="button" onClick={() => void load()}>↻ Atualizar</button>
    </div>
    {loading ? <div className="workspace-loading">Carregando auditoria…</div> : error ? <div className="workspace-error">{error}</div> : <main className="audit-list">
      {filtered.length === 0 && <div className="audit-empty">Nenhum evento no filtro atual. As ações auditadas (vendas, comissões, metas, funis, usuários, configurações, abordagens) aparecem aqui automaticamente.</div>}
      {filtered.map((row) => { const changes = changedKeys(row.antes, row.depois); const open = openId === row.id; return <article className={`audit-item ${row.acao}`} key={row.id}>
        <button type="button" onClick={() => setOpenId(open ? null : row.id)}>
          <span className="audit-when">{new Date(row.criado_em).toLocaleDateString("pt-BR")}<small>{new Date(row.criado_em).toLocaleTimeString("pt-BR")}</small></span>
          <span className="audit-what"><strong>{row.usuario_nome}</strong> {(ACTION_LABEL[row.acao] ?? row.acao).toLowerCase()} · <em>{row.modulo}</em><small>{row.detalhe ?? `${row.entidade ?? ""} ${row.entidade_id ?? ""}`}</small></span>
          <span className="audit-badge">{row.entidade ?? "—"}{row.entidade_id ? ` #${row.entidade_id}` : ""}</span>
          <span className="audit-caret">{open ? "▾" : "▸"}</span>
        </button>
        {open && <div className="audit-detail">
          {changes.length > 0 && <div className="audit-changes"><h4>Campos alterados</h4>{changes.map((key) => <div key={key}><b>{key}</b><s>{JSON.stringify(row.antes?.[key]) ?? "—"}</s><span>→</span><ins>{JSON.stringify(row.depois?.[key]) ?? "—"}</ins></div>)}</div>}
          <div className="audit-json">
            {row.antes && <div><h4>Antes</h4><pre>{JSON.stringify(row.antes, null, 2)}</pre></div>}
            {row.depois && <div><h4>Depois</h4><pre>{JSON.stringify(row.depois, null, 2)}</pre></div>}
          </div>
        </div>}
      </article>; })}
    </main>}
  </div>;
}
