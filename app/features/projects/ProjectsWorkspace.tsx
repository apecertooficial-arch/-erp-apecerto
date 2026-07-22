"use client";
/* eslint-disable react-hooks/exhaustive-deps */

import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { getBrowserSupabaseClient } from "../../lib/supabase/browser";

// Fetch autenticado resiliente (mesmo padrão do CRM): token fresco + 1 retry após refresh.
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

type Projeto = { id: string; nome: string; descricao: string | null; setor: string | null; cor: string | null; responsavel_id: string | null; visibilidade: string; data_inicio: string | null; prazo: string | null; prioridade: string; status: string; criado_por: string | null; criado_em: string; atualizado_em: string };
type Participante = { projeto_id: string; usuario_id: string };
type Coluna = { id: string; projeto_id: string; nome: string; cor: string | null; ordem: number; limite: number | null };
type Tarefa = { id: string; projeto_id: string; coluna_id: string | null; titulo: string; descricao: string | null; prioridade: string; responsavel_id: string | null; data_inicio: string | null; prazo: string | null; ordem: number; etiquetas: string[]; checklist: Array<{ texto: string; feito: boolean }>; concluida: boolean; vinculo_tipo: string | null; vinculo_id: string | null; vinculo_rotulo: string | null; criado_em: string; atualizado_em: string };
type Comentario = { id: string; tarefa_id: string; usuario_id: string | null; texto: string; criado_em: string };
type Atividade = { id: number; projeto_id: string | null; tarefa_id: string | null; usuario_id: string | null; acao: string; detalhe: string | null; criado_em: string };
type Usuario = { id: string; nome: string; role: string; ativo: boolean };
type ApiData = { projetos: Projeto[]; participantes: Participante[]; colunas: Coluna[]; tarefas: Tarefa[]; comentarios: Comentario[]; atividades: Atividade[]; usuarios: Usuario[]; leads: Array<{ id: number; nome: string | null; telefone: string | null }>; produtos: Array<{ id: string; nome: string }>; vendas: Array<{ id: string; empreendimento_nome: string | null; cliente_nome: string | null }>; me: string; error?: string };

const PRIO: Record<string, { label: string; cor: string }> = {
  baixa: { label: "Baixa", cor: "#8d99ae" }, media: { label: "Média", cor: "#2f6fed" },
  alta: { label: "Alta", cor: "#e66200" }, urgente: { label: "Urgente", cor: "#d1362f" },
};
const shortDate = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short" });
const fullDate = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
const dateTime = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
const hoje = () => new Date().toISOString().slice(0, 10);
const atrasada = (t: Tarefa) => Boolean(t.prazo && t.prazo < hoje() && !t.concluida);
const initials = (nome?: string | null) => (nome || "?").trim().split(/\s+/).slice(0, 2).map((p) => p[0]?.toUpperCase() ?? "").join("");

export function ProjectsWorkspace({ accessToken }: { accessToken: string }) {
  const [data, setData] = useState<ApiData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [openProject, setOpenProject] = useState<string | null>(null);
  const [homeTab, setHomeTab] = useState<"meus" | "todos" | "arquivados" | "minhas">("meus");
  const [query, setQuery] = useState("");
  const [respFilter, setRespFilter] = useState("");
  const [prioFilter, setPrioFilter] = useState("");
  const [lateOnly, setLateOnly] = useState(false);
  const [creating, setCreating] = useState(false);
  const [editingProject, setEditingProject] = useState<Projeto | null>(null);
  const [taskId, setTaskId] = useState<string | null>(null);

  const load = async () => {
    const response = await authedFetch("/api/projects", { headers: { Authorization: `Bearer ${accessToken}` } });
    const result = await response.json() as ApiData;
    if (!response.ok) throw new Error(result.error || "Não foi possível carregar os projetos.");
    setData(result);
  };
  useEffect(() => { void load().catch((r) => setError(r instanceof Error ? r.message : "Erro ao carregar.")); }, [accessToken]);

  const mutate = async (body: Record<string, unknown>) => {
    setBusy(true); setError(null);
    try {
      const response = await authedFetch("/api/projects", { method: "PATCH", headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const result = await response.json() as { error?: string; projectId?: string };
      if (!response.ok) throw new Error(result.error || "Não foi possível salvar.");
      await load();
      return result;
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Erro ao salvar."); throw reason; }
    finally { setBusy(false); }
  };

  const userById = useMemo(() => new Map((data?.usuarios ?? []).map((u) => [u.id, u])), [data]);
  const isManager = useMemo(() => { const me = data ? userById.get(data.me) : null; return me ? ["admin", "executivo"].includes(me.role) : false; }, [data, userById]);
  const partByProject = useMemo(() => { const m = new Map<string, string[]>(); (data?.participantes ?? []).forEach((p) => { const arr = m.get(p.projeto_id) ?? []; arr.push(p.usuario_id); m.set(p.projeto_id, arr); }); return m; }, [data]);

  if (error && !data) return <div className="module-error">{error}</div>;
  if (!data) return <div className="connections-loading">Carregando projetos…</div>;

  const project = openProject ? data.projetos.find((p) => p.id === openProject) ?? null : null;
  const openTask = taskId ? data.tarefas.find((t) => t.id === taskId) ?? null : null;

  return <div className="pj-workspace">
    {error && <div className="module-error">{error}<button type="button" onClick={() => setError(null)}>×</button></div>}
    {!project && <>
      <header className="pj-head"><div><span>FERRAMENTAS · ADMINISTRATIVO</span><h1>Projetos e Tarefas</h1><p>Organize projetos, processos internos e tarefas da equipe em quadros Kanban.</p></div>
        <div className="pj-head-actions"><label className="crm-search-v2"><span>⌕</span><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar projeto ou tarefa" /></label><button className="crm-primary" type="button" onClick={() => setCreating(true)}>＋ Novo projeto</button></div></header>
      <nav className="pj-tabs">{([["meus", "Meus projetos"], ["todos", "Todos os projetos"], ["arquivados", "Arquivados"], ["minhas", "Minhas tarefas"]] as const).map(([id, label]) => <button className={homeTab === id ? "active" : ""} type="button" onClick={() => setHomeTab(id)} key={id}>{label}</button>)}
        {homeTab !== "minhas" && <span className="pj-filters">
          <select value={respFilter} onChange={(e) => setRespFilter(e.target.value)}><option value="">Responsável: todos</option>{data.usuarios.filter((u) => u.ativo !== false).map((u) => <option value={u.id} key={u.id}>{u.nome}</option>)}</select>
          <select value={prioFilter} onChange={(e) => setPrioFilter(e.target.value)}><option value="">Prioridade: todas</option>{Object.entries(PRIO).map(([id, p]) => <option value={id} key={id}>{p.label}</option>)}</select>
          <label className="pj-late-filter"><input type="checkbox" checked={lateOnly} onChange={(e) => setLateOnly(e.target.checked)} /> Com tarefas atrasadas</label>
        </span>}
      </nav>
      {homeTab === "minhas"
        ? <MyTasks data={data} onOpen={(t) => { setOpenProject(t.projeto_id); setTaskId(t.id); }} />
        : <ProjectGrid data={data} tab={homeTab} query={query} respFilter={respFilter} prioFilter={prioFilter} lateOnly={lateOnly} partByProject={partByProject} userById={userById} onOpen={setOpenProject} />}
      {creating && <ProjectForm data={data} busy={busy} onClose={() => setCreating(false)} onSave={async (payload) => { const r = await mutate({ action: "createProject", ...payload }); setCreating(false); if (r.projectId) setOpenProject(r.projectId); }} />}
    </>}
    {project && <ProjectBoard data={data} project={project} busy={busy} isManager={isManager} userById={userById}
      onBack={() => { setOpenProject(null); setTaskId(null); }} onOpenTask={setTaskId} onEditProject={() => setEditingProject(project)} mutate={mutate} />}
    {editingProject && <ProjectForm data={data} busy={busy} initial={editingProject} participantes={partByProject.get(editingProject.id) ?? []}
      onClose={() => setEditingProject(null)}
      onSave={async (payload) => { await mutate({ action: "updateProject", projectId: editingProject.id, ...payload }); setEditingProject(null); }}
      onArchive={async () => { await mutate({ action: "archiveProject", projectId: editingProject.id, unarchive: editingProject.status === "arquivado" }); setEditingProject(null); setOpenProject(null); }}
      onDelete={isManager ? async () => { if (window.confirm(`Excluir o projeto "${editingProject.nome}" e todas as tarefas? Não dá para desfazer.`)) { await mutate({ action: "deleteProject", projectId: editingProject.id }); setEditingProject(null); setOpenProject(null); } } : undefined} />}
    {openTask && project && <TaskPanel data={data} task={openTask} project={project} busy={busy} userById={userById} onClose={() => setTaskId(null)} mutate={mutate} />}
  </div>;
}

function projectStats(data: ApiData, projectId: string) {
  const tasks = data.tarefas.filter((t) => t.projeto_id === projectId);
  const done = tasks.filter((t) => t.concluida).length;
  const late = tasks.filter(atrasada).length;
  return { total: tasks.length, done, late, pct: tasks.length ? Math.round((done / tasks.length) * 100) : 0 };
}

function ProjectGrid({ data, tab, query, respFilter, prioFilter, lateOnly, partByProject, userById, onOpen }: { data: ApiData; tab: string; query: string; respFilter: string; prioFilter: string; lateOnly: boolean; partByProject: Map<string, string[]>; userById: Map<string, Usuario>; onOpen: (id: string) => void }) {
  const q = query.trim().toLowerCase();
  const visible = data.projetos.filter((p) => {
    if (tab === "arquivados" ? p.status !== "arquivado" : p.status === "arquivado") return false;
    if (tab === "meus" && !(p.responsavel_id === data.me || p.criado_por === data.me || (partByProject.get(p.id) ?? []).includes(data.me))) return false;
    if (respFilter && p.responsavel_id !== respFilter) return false;
    if (prioFilter && p.prioridade !== prioFilter) return false;
    if (lateOnly && projectStats(data, p.id).late === 0) return false;
    if (q && !p.nome.toLowerCase().includes(q) && !data.tarefas.some((t) => t.projeto_id === p.id && t.titulo.toLowerCase().includes(q))) return false;
    return true;
  });
  return <div className="pj-grid">{visible.map((p) => {
    const stats = projectStats(data, p.id);
    const resp = p.responsavel_id ? userById.get(p.responsavel_id) : null;
    const parts = (partByProject.get(p.id) ?? []).map((id) => userById.get(id)?.nome).filter(Boolean) as string[];
    return <article className="pj-card" style={{ "--pj-cor": p.cor || "#ff7000" } as CSSProperties} role="button" tabIndex={0} onClick={() => onOpen(p.id)} onKeyDown={(e) => { if (e.key === "Enter") onOpen(p.id); }} key={p.id}>
      <div className="pj-card-top"><i /><strong>{p.nome}</strong><span className={`pj-prio ${p.prioridade}`}>{PRIO[p.prioridade]?.label ?? p.prioridade}</span></div>
      {p.descricao && <p className="pj-card-desc">{p.descricao}</p>}
      <div className="pj-card-meta">
        <span title="Responsável"><b>{initials(resp?.nome)}</b>{resp?.nome ?? "Sem responsável"}</span>
        {parts.length > 0 && <small>+{parts.length} participante{parts.length > 1 ? "s" : ""}</small>}
        {p.visibilidade === "privado" && <small>🔒 privado</small>}
      </div>
      <div className="pj-progress"><i style={{ width: `${stats.pct}%` }} /></div>
      <footer><span>{stats.done}/{stats.total} tarefas · {stats.pct}%</span>{stats.late > 0 && <em>⚠ {stats.late} atrasada{stats.late > 1 ? "s" : ""}</em>}{p.prazo && <time>prazo {shortDate.format(new Date(`${p.prazo}T12:00:00`))}</time>}</footer>
    </article>;
  })}{visible.length === 0 && <div className="crm-empty-view">Nenhum projeto neste filtro. Crie o primeiro com “＋ Novo projeto”.</div>}</div>;
}

function ProjectForm({ data, initial, participantes = [], busy, onClose, onSave, onArchive, onDelete }: { data: ApiData; initial?: Projeto; participantes?: string[]; busy: boolean; onClose: () => void; onSave: (payload: Record<string, unknown>) => Promise<void>; onArchive?: () => Promise<void>; onDelete?: () => Promise<void> }) {
  const [form, setForm] = useState({ nome: initial?.nome ?? "", descricao: initial?.descricao ?? "", setor: initial?.setor ?? "", responsavelId: initial?.responsavel_id ?? "", dataInicio: initial?.data_inicio ?? "", prazo: initial?.prazo ?? "", prioridade: initial?.prioridade ?? "media", cor: initial?.cor ?? "#ff7000", visibilidade: initial?.visibilidade ?? "publico" });
  const [parts, setParts] = useState<string[]>(participantes);
  return <div className="crm-center-modal" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
    <form className="pj-form" onSubmit={(e) => { e.preventDefault(); if (form.nome.trim()) void onSave({ ...form, participantes: parts }); }}>
      <header><div><span>{initial ? "EDITAR PROJETO" : "NOVO PROJETO"}</span><h2>{initial ? initial.nome : "Criar projeto"}</h2><p>O quadro nasce com as colunas A fazer, Em andamento, Em revisão e Concluído — configuráveis depois.</p></div><button type="button" onClick={onClose}>×</button></header>
      <div className="pj-form-grid">
        <label className="wide">Nome<input required value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} placeholder="Ex.: Implantação do novo site" /></label>
        <label className="wide">Descrição<textarea value={form.descricao} onChange={(e) => setForm({ ...form, descricao: e.target.value })} /></label>
        <label>Setor<input value={form.setor} onChange={(e) => setForm({ ...form, setor: e.target.value })} placeholder="Ex.: Marketing" /></label>
        <label>Responsável<select value={form.responsavelId} onChange={(e) => setForm({ ...form, responsavelId: e.target.value })}><option value="">Selecione</option>{data.usuarios.filter((u) => u.ativo !== false).map((u) => <option value={u.id} key={u.id}>{u.nome}</option>)}</select></label>
        <label>Início<input type="date" value={form.dataInicio} onChange={(e) => setForm({ ...form, dataInicio: e.target.value })} /></label>
        <label>Prazo final<input type="date" value={form.prazo} onChange={(e) => setForm({ ...form, prazo: e.target.value })} /></label>
        <label>Prioridade<select value={form.prioridade} onChange={(e) => setForm({ ...form, prioridade: e.target.value })}>{Object.entries(PRIO).map(([id, p]) => <option value={id} key={id}>{p.label}</option>)}</select></label>
        <label>Cor<input type="color" value={form.cor || "#ff7000"} onChange={(e) => setForm({ ...form, cor: e.target.value })} /></label>
        <label>Visibilidade<select value={form.visibilidade} onChange={(e) => setForm({ ...form, visibilidade: e.target.value })}><option value="publico">Público (toda a equipe)</option><option value="privado">Privado (só participantes)</option></select></label>
        <div className="wide pj-parts"><b>Participantes</b><div>{data.usuarios.filter((u) => u.ativo !== false).map((u) => <label key={u.id}><input type="checkbox" checked={parts.includes(u.id)} onChange={(e) => setParts(e.target.checked ? [...parts, u.id] : parts.filter((id) => id !== u.id))} />{u.nome}</label>)}</div></div>
      </div>
      <footer>
        {onArchive && <button type="button" disabled={busy} onClick={() => void onArchive()}>{initial?.status === "arquivado" ? "Reativar projeto" : "Arquivar projeto"}</button>}
        {onDelete && <button type="button" className="danger" disabled={busy} onClick={() => void onDelete()}>Excluir</button>}
        <span className="pj-form-spacer" />
        <button type="button" onClick={onClose}>Cancelar</button>
        <button className="crm-primary" disabled={busy || !form.nome.trim()} type="submit">{busy ? "Salvando…" : initial ? "Salvar alterações" : "Criar projeto"}</button>
      </footer>
    </form>
  </div>;
}

function ProjectBoard({ data, project, busy, isManager, userById, onBack, onOpenTask, onEditProject, mutate }: { data: ApiData; project: Projeto; busy: boolean; isManager: boolean; userById: Map<string, Usuario>; onBack: () => void; onOpenTask: (id: string) => void; onEditProject: () => void; mutate: (body: Record<string, unknown>) => Promise<{ error?: string }> }) {
  const [tab, setTab] = useState<"kanban" | "lista" | "calendario" | "dashboard">("kanban");
  const [addingCol, setAddingCol] = useState(false);
  const [newCol, setNewCol] = useState("");
  const [colMenu, setColMenu] = useState<string | null>(null);
  const [quickAdd, setQuickAdd] = useState<string | null>(null);
  const [quickTitle, setQuickTitle] = useState("");
  const [collapsed, setCollapsed] = useState<string[]>([]);
  const [dashFilter, setDashFilter] = useState<string | null>(null);
  const cols = data.colunas.filter((c) => c.projeto_id === project.id).sort((a, b) => a.ordem - b.ordem);
  const tasks = data.tarefas.filter((t) => t.projeto_id === project.id);
  const stats = projectStats(data, project.id);
  const resp = project.responsavel_id ? userById.get(project.responsavel_id) : null;
  const reorderCols = (index: number, dir: number) => { const ids = cols.map((c) => c.id); const j = index + dir; if (j < 0 || j >= ids.length) return; [ids[index], ids[j]] = [ids[j], ids[index]]; void mutate({ action: "reorderColumns", projectId: project.id, ids }); };

  return <div className="pj-board">
    <header className="pj-head board"><div><button className="pj-back" type="button" onClick={onBack}>← Projetos</button>
      <h1><i style={{ background: project.cor || "#ff7000" }} />{project.nome}</h1>
      <p>{project.setor ? `${project.setor} · ` : ""}{resp?.nome ? `resp.: ${resp.nome} · ` : ""}{stats.done}/{stats.total} tarefas · {stats.pct}%{stats.late ? ` · ⚠ ${stats.late} atrasada(s)` : ""}{project.prazo ? ` · prazo ${fullDate.format(new Date(`${project.prazo}T12:00:00`))}` : ""}</p></div>
      <div className="pj-head-actions">
        <nav className="pj-view-tabs">{([["kanban", "Kanban"], ["lista", "Lista"], ["calendario", "Calendário"], ["dashboard", "Dashboard"]] as const).map(([id, label]) => <button className={tab === id ? "active" : ""} type="button" onClick={() => setTab(id)} key={id}>{label}</button>)}</nav>
        <button type="button" onClick={onEditProject}>⚙ Projeto</button>
        {tab === "kanban" && <button className="crm-secondary" type="button" onClick={() => { setAddingCol(true); setNewCol(""); }}>＋ Coluna</button>}
      </div></header>
    {addingCol && <div className="sales-add-stage"><input autoFocus value={newCol} onChange={(e) => setNewCol(e.target.value)} placeholder="Nome da nova coluna" onKeyDown={(e) => { if (e.key === "Enter" && newCol.trim()) { void mutate({ action: "createColumn", projectId: project.id, nome: newCol.trim() }); setAddingCol(false); } }} /><button type="button" className="crm-primary small" disabled={busy || !newCol.trim()} onClick={() => { void mutate({ action: "createColumn", projectId: project.id, nome: newCol.trim() }); setAddingCol(false); }}>Criar</button><button type="button" onClick={() => setAddingCol(false)}>Cancelar</button></div>}

    {tab === "kanban" && <div className="pj-kanban">{cols.map((col, index) => {
      const items = tasks.filter((t) => t.coluna_id === col.id).sort((a, b) => a.ordem - b.ordem);
      const isCollapsed = collapsed.includes(col.id);
      return <section className={`pj-col ${isCollapsed ? "collapsed" : ""}`} style={{ "--pj-col-cor": col.cor || "#8d99ae" } as CSSProperties} onDragOver={(e) => e.preventDefault()} onDrop={(e) => { const id = e.dataTransfer.getData("text/pj-task"); if (id && !busy) void mutate({ action: "moveTask", taskId: id, colunaId: col.id }); }} key={col.id}>
        <header><i /><strong onClick={() => setCollapsed(isCollapsed ? collapsed.filter((c) => c !== col.id) : [...collapsed, col.id])}>{isCollapsed ? "▸ " : ""}{col.nome}</strong><span>{items.length}{col.limite ? `/${col.limite}` : ""}</span><button type="button" className="crm-stage-cog" onClick={() => setColMenu(colMenu === col.id ? null : col.id)}>⋯</button></header>
        {colMenu === col.id && <div className="crm-stage-menu">
          <div className="crm-stage-menu-row"><label className="crm-stage-color">Cor<input type="color" value={col.cor || "#8d99ae"} onChange={(e) => void mutate({ action: "updateColumn", colunaId: col.id, cor: e.target.value })} /></label></div>
          <div className="crm-stage-menu-row crm-stage-reorder"><button type="button" disabled={busy || index <= 0} onClick={() => reorderCols(index, -1)}>◀</button><button type="button" disabled={busy || index >= cols.length - 1} onClick={() => reorderCols(index, 1)}>▶</button></div>
          <div className="crm-stage-menu-row"><button type="button" onClick={() => { const nome = window.prompt("Novo nome da coluna:", col.nome); if (nome?.trim()) void mutate({ action: "updateColumn", colunaId: col.id, nome: nome.trim() }); setColMenu(null); }}>✎ Renomear</button></div>
          <div className="crm-stage-menu-row"><button type="button" onClick={() => { const v = window.prompt("Limite de tarefas (vazio = sem limite):", col.limite ? String(col.limite) : ""); if (v !== null) void mutate({ action: "updateColumn", colunaId: col.id, limite: v.trim() ? Number(v) : null }); setColMenu(null); }}>Limite de tarefas</button></div>
          <div className="crm-stage-menu-row"><button type="button" className="crm-stage-danger" disabled={items.length > 0} title={items.length ? "Mova as tarefas antes" : "Arquivar coluna"} onClick={() => { if (window.confirm(`Arquivar a coluna "${col.nome}"?`)) void mutate({ action: "deleteColumn", colunaId: col.id, projectId: project.id }); setColMenu(null); }}>🗑 Arquivar coluna</button></div>
        </div>}
        {!isCollapsed && <div className="pj-col-body">
          {items.map((t) => <TaskCard task={t} userById={userById} data={data} onOpen={() => onOpenTask(t.id)} key={t.id} />)}
          {quickAdd === col.id
            ? <div className="pj-quick"><input autoFocus value={quickTitle} onChange={(e) => setQuickTitle(e.target.value)} placeholder="Título da tarefa" onKeyDown={(e) => { if (e.key === "Enter" && quickTitle.trim()) { void mutate({ action: "createTask", projectId: project.id, colunaId: col.id, titulo: quickTitle.trim() }); setQuickTitle(""); } if (e.key === "Escape") setQuickAdd(null); }} /><button type="button" className="crm-primary small" disabled={busy || !quickTitle.trim()} onClick={() => { void mutate({ action: "createTask", projectId: project.id, colunaId: col.id, titulo: quickTitle.trim() }); setQuickTitle(""); setQuickAdd(null); }}>OK</button></div>
            : <button className="pj-add-task" type="button" onClick={() => { setQuickAdd(col.id); setQuickTitle(""); }}>＋ Nova tarefa</button>}
        </div>}
      </section>;
    })}</div>}

    {tab === "lista" && <div className="pj-list"><table><thead><tr><th>Tarefa</th><th>Coluna</th><th>Responsável</th><th>Prioridade</th><th>Prazo</th><th>Checklist</th></tr></thead><tbody>
      {tasks.sort((a, b) => (a.prazo || "9999").localeCompare(b.prazo || "9999")).map((t) => { const col = cols.find((c) => c.id === t.coluna_id); const done = t.checklist.filter((i) => i.feito).length; return <tr className={atrasada(t) ? "late" : t.concluida ? "done" : ""} onClick={() => onOpenTask(t.id)} key={t.id}><td><strong>{t.titulo}</strong></td><td><span className="pj-col-chip" style={{ background: col?.cor || "#8d99ae" }}>{col?.nome ?? "—"}</span></td><td>{userById.get(t.responsavel_id ?? "")?.nome ?? "—"}</td><td><span className={`pj-prio ${t.prioridade}`}>{PRIO[t.prioridade]?.label}</span></td><td>{t.prazo ? fullDate.format(new Date(`${t.prazo}T12:00:00`)) : "—"}{atrasada(t) && " ⚠"}</td><td>{t.checklist.length ? `${done}/${t.checklist.length}` : "—"}</td></tr>; })}
      {tasks.length === 0 && <tr><td colSpan={6}><div className="crm-empty-view compact">Nenhuma tarefa ainda.</div></td></tr>}
    </tbody></table></div>}

    {tab === "calendario" && <CalendarView tasks={tasks} onOpen={onOpenTask} />}

    {tab === "dashboard" && <div className="pj-dash">
      <div className="pj-dash-cards">
        {([["total", "Total de tarefas", stats.total], ["andamento", "Em andamento", tasks.filter((t) => !t.concluida && !atrasada(t)).length], ["concluidas", "Concluídas", stats.done], ["atrasadas", "Atrasadas", stats.late], ["semresp", "Sem responsável", tasks.filter((t) => !t.responsavel_id && !t.concluida).length]] as const).map(([id, label, value]) => <button className={`pj-dash-card ${id === "atrasadas" && value > 0 ? "danger" : ""} ${dashFilter === id ? "active" : ""}`} type="button" onClick={() => setDashFilter(dashFilter === id ? null : id)} key={id}><strong>{value}</strong><span>{label}</span></button>)}
        <div className="pj-dash-card wide"><strong>{stats.pct}%</strong><span>Progresso geral</span><div className="pj-progress"><i style={{ width: `${stats.pct}%` }} /></div></div>
      </div>
      <div className="pj-dash-tables">
        <article><h3>Por responsável</h3>{data.usuarios.filter((u) => tasks.some((t) => t.responsavel_id === u.id)).map((u) => { const mine = tasks.filter((t) => t.responsavel_id === u.id); return <div className="pj-dash-row" key={u.id}><span>{u.nome}</span><b>{mine.filter((t) => t.concluida).length}/{mine.length}</b></div>; })}</article>
        <article><h3>Por prioridade</h3>{Object.entries(PRIO).map(([id, p]) => { const n = tasks.filter((t) => t.prioridade === id && !t.concluida).length; return n ? <div className="pj-dash-row" key={id}><span>{p.label}</span><b>{n}</b></div> : null; })}</article>
        <article><h3>Próximos prazos</h3>{tasks.filter((t) => t.prazo && !t.concluida).sort((a, b) => (a.prazo || "").localeCompare(b.prazo || "")).slice(0, 6).map((t) => <div className={`pj-dash-row ${atrasada(t) ? "late" : ""}`} role="button" tabIndex={0} onClick={() => onOpenTask(t.id)} key={t.id}><span>{t.titulo}</span><b>{shortDate.format(new Date(`${t.prazo}T12:00:00`))}</b></div>)}</article>
      </div>
      {dashFilter && <div className="pj-dash-drill">{tasks.filter((t) => dashFilter === "total" ? true : dashFilter === "concluidas" ? t.concluida : dashFilter === "atrasadas" ? atrasada(t) : dashFilter === "semresp" ? (!t.responsavel_id && !t.concluida) : (!t.concluida && !atrasada(t))).map((t) => <TaskCard task={t} userById={userById} data={data} onOpen={() => onOpenTask(t.id)} key={t.id} />)}</div>}
      <article className="pj-activity"><h3>Atividades recentes</h3>{data.atividades.filter((a) => a.projeto_id === project.id).slice(0, 12).map((a) => <div className="pj-dash-row" key={a.id}><span>{a.detalhe}</span><b>{userById.get(a.usuario_id ?? "")?.nome ?? ""} · {dateTime.format(new Date(a.criado_em))}</b></div>)}</article>
    </div>}
  </div>;
}

function TaskCard({ task, userById, data, onOpen }: { task: Tarefa; userById: Map<string, Usuario>; data: ApiData; onOpen: () => void }) {
  const resp = task.responsavel_id ? userById.get(task.responsavel_id) : null;
  const done = task.checklist.filter((i) => i.feito).length;
  const comments = data.comentarios.filter((c) => c.tarefa_id === task.id).length;
  return <article className={`pj-task ${task.concluida ? "done" : ""} ${atrasada(task) ? "late" : ""}`} draggable onDragStart={(e) => e.dataTransfer.setData("text/pj-task", task.id)} role="button" tabIndex={0} onClick={onOpen} onKeyDown={(e) => { if (e.key === "Enter") onOpen(); }}>
    <div className="pj-task-top"><span className={`pj-prio dot ${task.prioridade}`} title={PRIO[task.prioridade]?.label} /><strong>{task.titulo}</strong></div>
    {task.etiquetas.length > 0 && <div className="pj-task-tags">{task.etiquetas.slice(0, 3).map((tag) => <em key={tag}>{tag}</em>)}</div>}
    <footer>
      {resp && <span className="pj-avatar" title={resp.nome}>{initials(resp.nome)}</span>}
      {task.prazo && <time className={atrasada(task) ? "late" : ""}>{shortDate.format(new Date(`${task.prazo}T12:00:00`))}</time>}
      {task.checklist.length > 0 && <small>☑ {done}/{task.checklist.length}</small>}
      {comments > 0 && <small>💬 {comments}</small>}
      {task.vinculo_tipo && <small title={task.vinculo_rotulo || ""}>🔗</small>}
    </footer>
  </article>;
}

function CalendarView({ tasks, onOpen }: { tasks: Tarefa[]; onOpen: (id: string) => void }) {
  const [month, setMonth] = useState(() => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1); });
  const label = new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric" }).format(month);
  const first = new Date(month); first.setDate(1 - ((first.getDay() + 7) % 7));
  const cells = Array.from({ length: 42 }, (_, i) => { const d = new Date(first); d.setDate(first.getDate() + i); return d; });
  const key = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  return <div className="pj-cal">
    <header><button type="button" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))}>◀</button><strong>{label}</strong><button type="button" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))}>▶</button></header>
    <div className="pj-cal-grid">{["dom", "seg", "ter", "qua", "qui", "sex", "sáb"].map((d) => <span className="pj-cal-dow" key={d}>{d}</span>)}
      {cells.map((d) => { const dayTasks = tasks.filter((t) => t.prazo === key(d)); const other = d.getMonth() !== month.getMonth(); return <div className={`pj-cal-cell ${other ? "other" : ""} ${key(d) === hoje() ? "today" : ""}`} key={key(d)}><span>{d.getDate()}</span>{dayTasks.slice(0, 3).map((t) => <button className={`pj-cal-task ${atrasada(t) ? "late" : t.concluida ? "done" : ""}`} type="button" onClick={() => onOpen(t.id)} key={t.id}>{t.titulo}</button>)}{dayTasks.length > 3 && <small>+{dayTasks.length - 3}</small>}</div>; })}
    </div>
  </div>;
}

function MyTasks({ data, onOpen }: { data: ApiData; onOpen: (t: Tarefa) => void }) {
  const mine = data.tarefas.filter((t) => t.responsavel_id === data.me);
  const groups: Array<[string, Tarefa[]]> = [
    ["Atrasadas", mine.filter(atrasada)],
    ["Hoje", mine.filter((t) => t.prazo === hoje() && !t.concluida)],
    ["Próximas", mine.filter((t) => Boolean(t.prazo && t.prazo > hoje() && !t.concluida))],
    ["Sem prazo", mine.filter((t) => !t.prazo && !t.concluida)],
    ["Concluídas", mine.filter((t) => t.concluida).slice(0, 20)],
  ];
  const projById = new Map(data.projetos.map((p) => [p.id, p]));
  return <div className="pj-mytasks">{groups.map(([label, list]) => <section key={label}><h3>{label} <span>{list.length}</span></h3>
    {list.map((t) => <button className={`pj-my-row ${atrasada(t) ? "late" : ""} ${t.concluida ? "done" : ""}`} type="button" onClick={() => onOpen(t)} key={t.id}><i style={{ background: projById.get(t.projeto_id)?.cor || "#ff7000" }} /><strong>{t.titulo}</strong><span>{projById.get(t.projeto_id)?.nome}</span>{t.prazo && <time>{shortDate.format(new Date(`${t.prazo}T12:00:00`))}</time>}</button>)}
    {list.length === 0 && <div className="crm-empty-view compact">Nada por aqui.</div>}
  </section>)}</div>;
}

function TaskPanel({ data, task, project, busy, userById, onClose, mutate }: { data: ApiData; task: Tarefa; project: Projeto; busy: boolean; userById: Map<string, Usuario>; onClose: () => void; mutate: (body: Record<string, unknown>) => Promise<unknown> }) {
  const [titulo, setTitulo] = useState(task.titulo);
  const [descricao, setDescricao] = useState(task.descricao ?? "");
  const [newCheck, setNewCheck] = useState("");
  const [newTag, setNewTag] = useState("");
  const [comment, setComment] = useState("");
  const [vincTipo, setVincTipo] = useState(task.vinculo_tipo ?? "");
  const cols = data.colunas.filter((c) => c.projeto_id === project.id).sort((a, b) => a.ordem - b.ordem);
  const comments = data.comentarios.filter((c) => c.tarefa_id === task.id);
  const history = data.atividades.filter((a) => a.tarefa_id === task.id).slice(0, 20);
  const upd = (patch: Record<string, unknown>) => void mutate({ action: "updateTask", taskId: task.id, ...patch });
  const vincOptions = vincTipo === "lead" ? data.leads.map((l) => ({ id: String(l.id), rotulo: l.nome || l.telefone || `Lead #${l.id}` }))
    : vincTipo === "produto" ? data.produtos.map((p) => ({ id: p.id, rotulo: p.nome }))
    : vincTipo === "venda" ? data.vendas.map((v) => ({ id: v.id, rotulo: `${v.cliente_nome || "Venda"} · ${v.empreendimento_nome || ""}` })) : [];

  return <div className="crm-drawer-layer" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
    <aside className="pj-task-panel" aria-label="Detalhes da tarefa">
      <header><div><span>{project.nome} · TAREFA</span>
        <input className="pj-task-title" value={titulo} onChange={(e) => setTitulo(e.target.value)} onBlur={() => { if (titulo.trim() && titulo !== task.titulo) upd({ titulo: titulo.trim() }); }} />
      </div><div className="pj-panel-actions">
        <button type="button" className={task.concluida ? "pj-done-btn active" : "pj-done-btn"} disabled={busy} onClick={() => upd({ concluida: !task.concluida })}>{task.concluida ? "✓ Concluída" : "Concluir"}</button>
        <button type="button" onClick={onClose} aria-label="Fechar">×</button></div></header>
      <div className="pj-panel-grid">
        <div className="pj-panel-main">
          <label>Descrição<textarea value={descricao} onChange={(e) => setDescricao(e.target.value)} onBlur={() => { if (descricao !== (task.descricao ?? "")) upd({ descricao }); }} placeholder="Detalhe o que precisa ser feito…" /></label>
          <section><h4>Checklist {task.checklist.length > 0 && <span>{task.checklist.filter((i) => i.feito).length}/{task.checklist.length}</span>}</h4>
            {task.checklist.map((item, index) => <label className="pj-check" key={`${index}-${item.texto}`}><input type="checkbox" checked={item.feito} onChange={() => upd({ checklist: task.checklist.map((i, j) => j === index ? { ...i, feito: !i.feito } : i) })} /><span className={item.feito ? "done" : ""}>{item.texto}</span><button type="button" onClick={() => upd({ checklist: task.checklist.filter((_, j) => j !== index) })}>×</button></label>)}
            <div className="pj-inline-add"><input value={newCheck} onChange={(e) => setNewCheck(e.target.value)} placeholder="Novo item do checklist" onKeyDown={(e) => { if (e.key === "Enter" && newCheck.trim()) { upd({ checklist: [...task.checklist, { texto: newCheck.trim(), feito: false }] }); setNewCheck(""); } }} /><button type="button" disabled={!newCheck.trim()} onClick={() => { upd({ checklist: [...task.checklist, { texto: newCheck.trim(), feito: false }] }); setNewCheck(""); }}>＋</button></div></section>
          <section><h4>Comentários</h4>
            <div className="pj-comments">{comments.map((c) => <div className="pj-comment" key={c.id}><b>{userById.get(c.usuario_id ?? "")?.nome ?? "Usuário"}</b><p>{c.texto}</p><time>{dateTime.format(new Date(c.criado_em))}</time></div>)}{comments.length === 0 && <small>Sem comentários ainda.</small>}</div>
            <div className="pj-inline-add"><input value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Escreva um comentário…" onKeyDown={(e) => { if (e.key === "Enter" && comment.trim()) { void mutate({ action: "comment", taskId: task.id, texto: comment.trim() }); setComment(""); } }} /><button type="button" disabled={busy || !comment.trim()} onClick={() => { void mutate({ action: "comment", taskId: task.id, texto: comment.trim() }); setComment(""); }}>Enviar</button></div></section>
          <section><h4>Histórico</h4><div className="pj-history">{history.map((a) => <div key={a.id}><span>{a.detalhe}</span><time>{userById.get(a.usuario_id ?? "")?.nome ?? ""} · {dateTime.format(new Date(a.criado_em))}</time></div>)}</div></section>
        </div>
        <div className="pj-panel-side">
          <label>Coluna<select value={task.coluna_id ?? ""} onChange={(e) => void mutate({ action: "moveTask", taskId: task.id, colunaId: e.target.value })}>{cols.map((c) => <option value={c.id} key={c.id}>{c.nome}</option>)}</select></label>
          <label>Responsável<select value={task.responsavel_id ?? ""} onChange={(e) => upd({ responsavelId: e.target.value })}><option value="">Sem responsável</option>{data.usuarios.filter((u) => u.ativo !== false).map((u) => <option value={u.id} key={u.id}>{u.nome}</option>)}</select></label>
          <label>Prioridade<select value={task.prioridade} onChange={(e) => upd({ prioridade: e.target.value })}>{Object.entries(PRIO).map(([id, p]) => <option value={id} key={id}>{p.label}</option>)}</select></label>
          <label>Início<input type="date" value={task.data_inicio ?? ""} onChange={(e) => upd({ dataInicio: e.target.value })} /></label>
          <label>Prazo<input type="date" value={task.prazo ?? ""} onChange={(e) => upd({ prazo: e.target.value })} />{atrasada(task) && <em className="pj-late-flag">⚠ atrasada</em>}</label>
          <section><h4>Etiquetas</h4><div className="pj-task-tags block">{task.etiquetas.map((tag) => <em key={tag}>{tag}<button type="button" onClick={() => upd({ etiquetas: task.etiquetas.filter((t) => t !== tag) })}>×</button></em>)}</div>
            <div className="pj-inline-add"><input value={newTag} onChange={(e) => setNewTag(e.target.value)} placeholder="Nova etiqueta" onKeyDown={(e) => { if (e.key === "Enter" && newTag.trim()) { upd({ etiquetas: [...task.etiquetas, newTag.trim()] }); setNewTag(""); } }} /><button type="button" disabled={!newTag.trim()} onClick={() => { upd({ etiquetas: [...task.etiquetas, newTag.trim()] }); setNewTag(""); }}>＋</button></div></section>
          <section><h4>Vínculo com o ERP</h4>
            <select value={vincTipo} onChange={(e) => { setVincTipo(e.target.value); if (!e.target.value) upd({ vinculoTipo: "", vinculoId: "", vinculoRotulo: "" }); }}><option value="">Sem vínculo</option><option value="lead">Lead</option><option value="produto">Produto</option><option value="venda">Venda</option></select>
            {vincTipo && <select value={task.vinculo_id ?? ""} onChange={(e) => { const opt = vincOptions.find((o) => o.id === e.target.value); upd({ vinculoTipo: vincTipo, vinculoId: e.target.value, vinculoRotulo: opt?.rotulo ?? "" }); }}><option value="">Selecione</option>{vincOptions.map((o) => <option value={o.id} key={o.id}>{o.rotulo}</option>)}</select>}
            {task.vinculo_rotulo && <small className="pj-vinc">🔗 {task.vinculo_rotulo}</small>}</section>
          <section className="pj-panel-danger">
            <button type="button" disabled={busy} onClick={() => void mutate({ action: "duplicateTask", taskId: task.id })}>⧉ Duplicar</button>
            <button type="button" disabled={busy} onClick={() => { upd({ arquivar: true }); onClose(); }}>▣ Arquivar</button>
            <button type="button" className="danger" disabled={busy} onClick={() => { if (window.confirm("Excluir esta tarefa? Não dá para desfazer.")) { void mutate({ action: "deleteTask", taskId: task.id }); onClose(); } }}>🗑 Excluir</button>
          </section>
        </div>
      </div>
    </aside>
  </div>;
}
