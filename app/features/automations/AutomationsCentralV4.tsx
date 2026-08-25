"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { CentralOperationsPanel } from "./CentralOperationsPanel";
import { AutomationBuilderWorkspace, type BuilderEntryAction } from "./AutomationsWorkspace";

type Block = { type?: string };
type MapData = { automation?: { blocks?: Block[] } };
type Automation = {
  id: number;
  nome: string;
  grupo: string | null;
  ativa: boolean;
  status: string | null;
  arquivada: boolean;
  atualizada_em: string | null;
  versao_publicada_id: number | null;
  mapa: MapData | null;
  mapa_rascunho: MapData | null;
  version: number | null;
  triggerKey: string;
  triggerLabel: string;
  blocks: number;
};
type Run = {
  id?: number;
  automacao_id: number | null;
  bloco_id: string | null;
  evento: string | null;
  status: string | null;
  detalhe: unknown;
  lead_nome: string | null;
  criado_em: string | null;
};
type Area = "overview" | "automations" | "triggers" | "runs" | "exceptions";
type Filter = "all" | "active" | "inactive" | "draft" | "archived";

const TRIGGERS: Record<string, string> = {
  "json-http-request-trigger": "Webhook (HTTP)",
  "site-lead-created-trigger": "Novo lead do site",
  "automation-start-trigger": "Iniciada por outra automação",
  "manual-trigger": "Início manual",
  "tag-added-trigger": "Tag adicionada",
  "entered-stage-trigger": "Entrada em etapa",
  "moved-stage-trigger": "Mudança de etapa",
  "lead-distributed-trigger": "Lead distribuído",
  "lead-message-received-trigger": "Mensagem recebida do lead",
  "broker-message-sent-trigger": "Mensagem enviada pelo corretor",
  "moment-deadline-trigger": "Prazo do momento",
  "resume-date-trigger": "Data de retomada",
  "entered-moment-trigger": "Entrada em momento",
  "sara-daily-clock-trigger": "Relógio diário da Sara",
};

const NAV: Array<{ id: Area; label: string; hint: string }> = [
  { id: "overview", label: "Visão geral", hint: "Saúde e atalhos" },
  { id: "automations", label: "Minhas automações", hint: "Criar e organizar" },
  { id: "triggers", label: "Gatilhos", hint: "14 tipos disponíveis" },
  { id: "runs", label: "Execuções", hint: "Histórico real" },
  { id: "exceptions", label: "Exceções", hint: "Fila operacional" },
];

function mapInfo(map: MapData | null | undefined) {
  const blocks = map?.automation?.blocks ?? [];
  const trigger = blocks.find((block) => String(block.type ?? "").endsWith("-trigger"));
  const triggerKey = String(trigger?.type ?? "no-trigger");
  return { blocks: blocks.length, triggerKey, triggerLabel: TRIGGERS[triggerKey] ?? "Gatilho não identificado" };
}

function shortDate(value: string | null) {
  if (!value) return "Sem atualização";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Data indisponível";
  return new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }).format(date);
}

export function AutomationsCentralV4({ accessToken }: { accessToken: string }) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  const headers = useMemo(() => ({ apikey: publishableKey ?? "", Authorization: `Bearer ${accessToken}` }), [accessToken, publishableKey]);
  const [screen, setScreen] = useState<"central" | "builder">("central");
  const [area, setArea] = useState<Area>("automations");
  const [automations, setAutomations] = useState<Automation[]>([]);
  const [runs, setRuns] = useState<Run[]>([]);
  const [loading, setLoading] = useState(true);
  const [runsLoading, setRunsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [triggerFilter, setTriggerFilter] = useState("all");
  const [view, setView] = useState<"list" | "grid">("list");
  const [builderId, setBuilderId] = useState<number | null>(null);
  const [builderAction, setBuilderAction] = useState<BuilderEntryAction>(null);

  const request = useCallback(async <T,>(path: string, init?: RequestInit): Promise<T> => {
    if (!supabaseUrl || !publishableKey) throw new Error("Configuração pública do Supabase não encontrada.");
    const response = await fetch(`${supabaseUrl}/rest/v1${path}`, { ...init, headers: { ...headers, ...(init?.headers ?? {}) } });
    if (!response.ok) {
      let message = `Supabase respondeu ${response.status}`;
      try { message = (await response.json())?.message ?? message; } catch { /* body vazio */ }
      throw new Error(message);
    }
    if (response.status === 204) return undefined as T;
    const body = await response.text();
    return (body ? JSON.parse(body) : undefined) as T;
  }, [headers, publishableKey, supabaseUrl]);

  const loadAutomations = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const [rows, versions] = await Promise.all([
        request<Array<Omit<Automation, "version" | "triggerKey" | "triggerLabel" | "blocks">>>("/automacoes?select=id,nome,grupo,ativa,status,arquivada,atualizada_em,versao_publicada_id,mapa,mapa_rascunho&order=grupo,id"),
        request<Array<{ id: number; versao: number }>>("/automacao_versoes?select=id,automacao_id,versao&order=versao.desc"),
      ]);
      const versionById = new Map(versions.map((item) => [item.id, item.versao]));
      setAutomations(rows.map((row) => ({ ...row, arquivada: Boolean(row.arquivada), version: row.versao_publicada_id ? versionById.get(row.versao_publicada_id) ?? null : null, ...mapInfo(row.mapa_rascunho ?? row.mapa) })));
    } catch (failure) { setError(failure instanceof Error ? failure.message : "Não foi possível carregar as automações."); }
    finally { setLoading(false); }
  }, [request]);

  useEffect(() => { void Promise.resolve().then(loadAutomations); }, [loadAutomations]);
  useEffect(() => {
    if (area !== "runs" || runs.length) return;
    void Promise.resolve().then(() => {
      setRunsLoading(true);
      return request<Run[]>("/motor_execucoes?select=id,automacao_id,bloco_id,evento,status,detalhe,lead_nome,criado_em&order=id.desc&limit=100")
        .then(setRuns).catch((failure: unknown) => setError(failure instanceof Error ? failure.message : "Não foi possível carregar as execuções."))
        .finally(() => setRunsLoading(false));
    });
  }, [area, request, runs.length]);

  const counts = useMemo(() => ({
    total: automations.filter((item) => !item.arquivada).length,
    active: automations.filter((item) => item.ativa && !item.arquivada).length,
    draft: automations.filter((item) => item.status === "rascunho" && !item.arquivada).length,
    archived: automations.filter((item) => item.arquivada).length,
  }), [automations]);
  const filtered = useMemo(() => automations.filter((item) => {
    if (filter === "archived" ? !item.arquivada : item.arquivada) return false;
    if (filter === "active" && !item.ativa) return false;
    if (filter === "inactive" && item.ativa) return false;
    if (filter === "draft" && item.status !== "rascunho") return false;
    if (triggerFilter !== "all" && item.triggerKey !== triggerFilter) return false;
    const term = query.trim().toLocaleLowerCase("pt-BR");
    return !term || `${item.nome} ${item.grupo ?? ""} ${item.triggerLabel}`.toLocaleLowerCase("pt-BR").includes(term);
  }), [automations, filter, query, triggerFilter]);
  const groups = useMemo(() => {
    const result = new Map<string, Automation[]>();
    filtered.forEach((item) => { const group = item.grupo?.trim() || "Sem grupo"; result.set(group, [...(result.get(group) ?? []), item]); });
    return [...result.entries()];
  }, [filtered]);

  const openBuilder = (id: number | null = null, action: BuilderEntryAction = null) => { setBuilderId(id); setBuilderAction(action); setScreen("builder"); };
  const patchAutomation = useCallback(async (id: number, body: Record<string, unknown>) => {
    await request<void>(`/automacoes?id=eq.${id}`, { method: "PATCH", headers: { "Content-Type": "application/json", Prefer: "return=minimal" }, body: JSON.stringify(body) });
    await loadAutomations();
  }, [loadAutomations, request]);
  const duplicarAutomacao = async (item: Automation) => {
    try {
      const map = item.mapa_rascunho ?? item.mapa ?? { automation: { blocks: [] } };
      await request("/automacoes", { method: "POST", headers: { "Content-Type": "application/json", Prefer: "return=representation" }, body: JSON.stringify({ nome: `${item.nome} (cópia)`, grupo: item.grupo, ativa: false, status: "rascunho", mapa: map, mapa_rascunho: map }) });
      setNotice("Automação duplicada como rascunho."); await loadAutomations();
    } catch (failure) { setError(failure instanceof Error ? failure.message : "Não foi possível duplicar."); }
  };
  const arquivarAutomacao = async (item: Automation) => {
    try { await patchAutomation(item.id, { arquivada: !item.arquivada }); setNotice(item.arquivada ? "Automação desarquivada." : "Automação arquivada."); }
    catch (failure) { setError(failure instanceof Error ? failure.message : "Não foi possível arquivar."); }
  };
  const moverAutomacao = async (item: Automation) => {
    const group = window.prompt("Mover para qual grupo?", item.grupo ?? ""); if (!group?.trim()) return;
    try { await patchAutomation(item.id, { grupo: group.trim() }); setNotice(`Automação movida para “${group.trim()}”.`); }
    catch (failure) { setError(failure instanceof Error ? failure.message : "Não foi possível mover."); }
  };
  const excluirAutomacao = async (item: Automation) => {
    if (!window.confirm(`Excluir “${item.nome}” definitivamente? Esta ação não pode ser desfeita.`)) return;
    try { await request<void>(`/automacoes?id=eq.${item.id}`, { method: "DELETE", headers: { Prefer: "return=minimal" } }); setNotice("Automação excluída."); await loadAutomations(); }
    catch (failure) { setError(failure instanceof Error ? failure.message : "Não foi possível excluir."); }
  };
  const exportarAutomacao = (item: Automation) => {
    const url = URL.createObjectURL(new Blob([JSON.stringify(item.mapa_rascunho ?? item.mapa ?? {}, null, 2)], { type: "application/json" }));
    const link = document.createElement("a"); link.href = url; link.download = `${item.nome.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "").toLowerCase() || "automacao"}.json`; link.click(); URL.revokeObjectURL(url);
  };

  if (screen === "builder") return <AutomationBuilderWorkspace accessToken={accessToken} initialAutomationId={builderId} entryAction={builderAction} onBack={() => { setScreen("central"); setBuilderAction(null); void loadAutomations(); }} />;

  return <div className="apn-v4">
    <header className="apn-v4-topbar"><div><span>OPERAÇÃO COMERCIAL</span><h1>Central de Automações</h1><p>Crie, acompanhe e mantenha os fluxos que movimentam o atendimento.</p></div><button type="button" className="apn-v4-primary" onClick={() => openBuilder(null, { type: "new" })}>＋ Nova automação</button></header>
    <div className="apn-v4-layout">
      <aside className="apn-v4-nav" aria-label="Áreas da Central de Automações"><p>CENTRAL</p>{NAV.map((item) => <button key={item.id} type="button" className={area === item.id ? "is-active" : ""} onClick={() => setArea(item.id)}><i className={`icon-${item.id}`} /><span><strong>{item.label}</strong><small>{item.hint}</small></span></button>)}<hr /><button type="button" onClick={() => { window.location.href = "/abordagens"; }}><i className="icon-approaches" /><span><strong>Abordagens</strong><small>Conteúdo das mensagens</small></span></button><button type="button" onClick={() => openBuilder(null, { type: "office" })}><i className="icon-office" /><span><strong>IP do escritório</strong><small>Segurança da operação</small></span></button></aside>
      <main className="apn-v4-content">
        {error && <div className="apn-v4-alert is-error" role="alert"><span>{error}</span><button type="button" onClick={() => { setError(null); void loadAutomations(); }}>Tentar novamente</button></div>}
        {notice && <div className="apn-v4-alert" role="status"><span>{notice}</span><button type="button" onClick={() => setNotice(null)}>Fechar</button></div>}

        {area === "overview" && <section className="apn-v4-section"><div className="apn-v4-section-head"><div><span>VISÃO GERAL</span><h2>Operação em um só lugar</h2><p>Números calculados a partir das automações atuais, sem dados de demonstração.</p></div></div><div className="apn-v4-summary"><button type="button" onClick={() => { setFilter("all"); setArea("automations"); }}><span>Automações</span><strong>{counts.total}</strong><small>não arquivadas</small></button><button type="button" onClick={() => { setFilter("active"); setArea("automations"); }}><span>Ativas agora</span><strong>{counts.active}</strong><small>processando eventos</small></button><button type="button" onClick={() => { setFilter("draft"); setArea("automations"); }}><span>Em rascunho</span><strong>{counts.draft}</strong><small>aguardando publicação</small></button><button type="button" onClick={() => { setFilter("archived"); setArea("automations"); }}><span>Arquivadas</span><strong>{counts.archived}</strong><small>fora da operação</small></button></div><div className="apn-v4-quick-grid"><button type="button" onClick={() => openBuilder(null, { type: "new" })}><b>＋</b><strong>Criar automação</strong><small>Comece com um gatilho e monte o fluxo livremente.</small></button><button type="button" onClick={() => setArea("triggers")}><b>⌁</b><strong>Explorar gatilhos</strong><small>Veja os eventos que podem iniciar uma rotina.</small></button><button type="button" onClick={() => setArea("runs")}><b>↻</b><strong>Acompanhar execuções</strong><small>Consulte o histórico recente processado pelo motor.</small></button></div><CentralOperationsPanel accessToken={accessToken} /></section>}

        {area === "automations" && <section className="apn-v4-section"><div className="apn-v4-section-head"><div><span>AUTOMAÇÕES</span><h2>Minhas automações</h2><p>Organize por grupo, encontre rapidamente e abra qualquer fluxo no construtor.</p></div><strong>{filtered.length} de {automations.length}</strong></div><div className="apn-v4-tools"><label><i /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar automações" /></label><select aria-label="Filtrar por gatilho" value={triggerFilter} onChange={(event) => setTriggerFilter(event.target.value)}><option value="all">Todos os gatilhos</option>{Object.entries(TRIGGERS).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select><div><button type="button" className={view === "list" ? "is-active" : ""} onClick={() => setView("list")} title="Lista">☷</button><button type="button" className={view === "grid" ? "is-active" : ""} onClick={() => setView("grid")} title="Grade">⊞</button></div></div><div className="apn-v4-filters">{([["all", "Todas", counts.total], ["active", "Ativas", counts.active], ["inactive", "Inativas", Math.max(0, counts.total - counts.active)], ["draft", "Rascunhos", counts.draft], ["archived", "Arquivadas", counts.archived]] as Array<[Filter, string, number]>).map(([id, label, total]) => <button key={id} type="button" className={filter === id ? "is-active" : ""} onClick={() => setFilter(id)}>{label}<span>{total}</span></button>)}</div>
          {loading ? <div className="apn-v4-loading"><i />Carregando automações…</div> : !groups.length ? <div className="apn-v4-empty"><b>⌕</b><h3>Nenhuma automação encontrada</h3><p>Ajuste os filtros ou crie um novo fluxo.</p><button type="button" onClick={() => openBuilder(null, { type: "new" })}>Nova automação</button></div> : <div className={`apn-v4-groups is-${view}`}>{groups.map(([group, items]) => <section className="apn-v4-group" key={group}><header><div><i /><strong>{group}</strong><small>{items.length} {items.length === 1 ? "automação" : "automações"}</small></div><button type="button" onClick={() => openBuilder(null, { type: "group", group })}>＋ Adicionar</button></header><div className="apn-v4-items">{items.map((item) => <article className="apn-v4-item" key={item.id}><button type="button" className="apn-v4-item-main" onClick={() => openBuilder(item.id)}><i className={item.ativa ? "is-on" : item.status === "rascunho" ? "is-draft" : ""} /><span><strong>{item.nome}</strong><small>{item.triggerLabel} · {item.blocks} {item.blocks === 1 ? "bloco" : "blocos"}</small></span><em>{item.arquivada ? "Arquivada" : item.ativa ? "Ativa" : item.status === "rascunho" ? "Rascunho" : "Inativa"}</em><span className="apn-v4-version">{item.version ? `v${item.version}` : "Sem versão"}<small>{shortDate(item.atualizada_em)}</small></span></button><details className="apn-v4-menu"><summary aria-label={`Ações de ${item.nome}`}>•••</summary><div><button type="button" onClick={() => openBuilder(item.id)}>Abrir construtor</button><button type="button" onClick={() => void duplicarAutomacao(item)}>Duplicar</button><button type="button" onClick={() => exportarAutomacao(item)}>Exportar JSON</button><button type="button" onClick={() => void moverAutomacao(item)}>Mover para grupo</button><button type="button" onClick={() => void arquivarAutomacao(item)}>{item.arquivada ? "Desarquivar" : "Arquivar"}</button><button type="button" className="is-danger" onClick={() => void excluirAutomacao(item)}>Excluir</button></div></details></article>)}</div></section>)}</div>}
        </section>}

        {area === "triggers" && <section className="apn-v4-section"><div className="apn-v4-section-head"><div><span>BIBLIOTECA</span><h2>Gatilhos</h2><p>Escolha um evento para ver as automações que começam por ele.</p></div></div><div className="apn-v4-trigger-grid">{Object.entries(TRIGGERS).map(([key, label]) => { const total = automations.filter((item) => !item.arquivada && item.triggerKey === key).length; return <button type="button" key={key} onClick={() => { setTriggerFilter(key); setFilter("all"); setArea("automations"); }}><b>⌁</b><strong>{label}</strong><small>{total} {total === 1 ? "automação" : "automações"}</small><i>→</i></button>; })}</div></section>}

        {area === "runs" && <section className="apn-v4-section"><div className="apn-v4-section-head"><div><span>MONITORAMENTO</span><h2>Execuções recentes</h2><p>Últimos eventos registrados pelo motor de automações.</p></div><button type="button" className="apn-v4-secondary" onClick={() => setRuns([])}>Atualizar</button></div>{runsLoading ? <div className="apn-v4-loading"><i />Carregando execuções…</div> : !runs.length ? <div className="apn-v4-empty"><b>↻</b><h3>Nenhuma execução recente</h3><p>Quando o motor processar um evento, ele aparecerá aqui.</p></div> : <div className="apn-v4-runs"><header><span>Automação / lead</span><span>Evento</span><span>Estado</span><span>Horário</span></header>{runs.map((run, index) => { const automation = automations.find((item) => item.id === run.automacao_id); return <button type="button" key={run.id ?? `${run.automacao_id}-${index}`} onClick={() => run.automacao_id && openBuilder(run.automacao_id)} title={typeof run.detalhe === "string" ? run.detalhe : "Abrir automação"}><span><strong>{automation?.nome ?? `Automação ${run.automacao_id ?? "—"}`}</strong><small>{run.lead_nome ?? run.bloco_id ?? "Sem identificação"}</small></span><span>{run.evento ?? "Evento"}</span><em className={`is-${run.status ?? "unknown"}`}>{run.status ?? "sem estado"}</em><span>{shortDate(run.criado_em)}</span></button>; })}</div>}</section>}

        {area === "exceptions" && <section className="apn-v4-section"><div className="apn-v4-section-head"><div><span>OPERAÇÃO</span><h2>Exceções e reprocessamento</h2><p>Diagnóstico real da Central, com ações seguras para recuperar itens interrompidos.</p></div></div><CentralOperationsPanel accessToken={accessToken} /></section>}
      </main>
    </div>
  </div>;
}
