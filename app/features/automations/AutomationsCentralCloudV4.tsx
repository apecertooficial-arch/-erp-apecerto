"use client";
/* eslint-disable react-hooks/set-state-in-effect */

import { useCallback, useEffect, useMemo, useState } from "react";

import { AutomationFlowBuilderV4, type BuilderEntryAction } from "./AutomationFlowBuilderV4";
import { TRIGGER_CATALOG, triggerFromMap, type AutomationMap } from "./automationFlowModel";

type Automation = {
  id: number; nome: string; grupo: string | null; ativa: boolean; status: string | null;
  arquivada: boolean; atualizada_em: string | null; versao_publicada_id: number | null;
  mapa: AutomationMap | null; mapa_rascunho: AutomationMap | null; version: number | null;
  triggerKey: string; triggerLabel: string; blocks: number;
};
type Run = { id: number; automacao_id: number | null; automacao_nome: string | null; bloco_id: string | null; evento: string | null; status: string | null; detalhe: string | null; lead_nome: string | null; lead_telefone: string | null; criado_em: string | null };
type Quarantine = { id: number; automacao: string; bloco_id: string; tentativas: number; erro: string; criado_em: string };
type Review = { analise_id: number; funil_lead_id: string; nome: string; momento_codigo: string; resumo: string | null; confianca: number | null; analisado_em: string };
type Health = { agora?: string; abordagem_automatica?: boolean; automacoes?: { ativas?: number; invalidas?: number }; fila?: { pendentes?: number; quarentena?: number; mais_antiga?: string | null }; sara?: { revisao_humana?: number; sem_evidencia?: number; qualidade_pendente?: number }; presenca?: { elegiveis?: number; ativos?: number }; integridade?: { lead_recente_sem_negocio?: number; negocio_funil2_sem_card?: number }; contratos?: Array<{ nome: string; ok: boolean }>; quarentena?: Quarantine[]; revisoes?: Review[] };
type Area = "overview" | "automations" | "triggers" | "runs" | "exceptions";
type Filter = "all" | "active" | "inactive" | "archived";

const NAV: Array<{ id: Area; label: string }> = [
  { id: "overview", label: "Visão geral" }, { id: "automations", label: "Minhas automações" },
  { id: "triggers", label: "Gatilhos" }, { id: "runs", label: "Execuções" }, { id: "exceptions", label: "Exceções" },
];

function icon(name: string) {
  const paths: Record<string, React.ReactNode> = {
    overview: <><rect x="3" y="3" width="7" height="7" rx="2" /><rect x="14" y="3" width="7" height="7" rx="2" /><rect x="3" y="14" width="7" height="7" rx="2" /><rect x="14" y="14" width="7" height="7" rx="2" /></>,
    automations: <><circle cx="6" cy="6" r="3" /><circle cx="18" cy="18" r="3" /><path d="M9 6h5a4 4 0 0 1 4 4v5" /></>,
    triggers: <><path d="M13 2 4 14h7l-1 8 10-12h-7z" /></>, runs: <><path d="M20 11a8 8 0 1 0-2 5.5" /><path d="M20 4v7h-7" /></>,
    exceptions: <><path d="M12 3 2 21h20L12 3Z" /><path d="M12 9v5M12 18h.01" /></>, approaches: <><path d="M4 5h16v12H7l-3 3V5Z" /></>,
    office: <><path d="M4 21h16M6 21V7l6-4 6 4v14M10 10h4M10 14h4" /></>, search: <><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></>,
    grid: <><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" /></>,
    list: <><path d="M8 6h13M8 12h13M8 18h13" /><circle cx="4" cy="6" r="1" /><circle cx="4" cy="12" r="1" /><circle cx="4" cy="18" r="1" /></>,
    trash: <><path d="M3 6h18M8 6V4h8v2M19 6l-1 15H6L5 6" /></>, plus: <><path d="M12 5v14M5 12h14" /></>,
  };
  return <svg viewBox="0 0 24 24" aria-hidden="true">{paths[name] ?? paths.automations}</svg>;
}

function number(value: unknown) { const parsed = Number(value ?? 0); return Number.isFinite(parsed) ? parsed : 0; }
function date(value: string | null | undefined) { if (!value) return "—"; const parsed = new Date(value); return Number.isNaN(parsed.getTime()) ? "—" : new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(parsed); }
function mapInfo(map: AutomationMap | null | undefined) { const trigger = triggerFromMap(map); return { triggerKey: trigger.key, triggerLabel: trigger.label, blocks: map?.automation?.blocks?.length ?? 0 }; }

export function AutomationsCentralCloudV4({ accessToken }: { accessToken: string }) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  const headers = useMemo(() => ({ apikey: publishableKey ?? "", Authorization: `Bearer ${accessToken}` }), [accessToken, publishableKey]);
  const [screen, setScreen] = useState<"central" | "builder">("central");
  const [area, setArea] = useState<Area>("automations");
  const [automations, setAutomations] = useState<Automation[]>([]);
  const [runs, setRuns] = useState<Run[]>([]);
  const [health, setHealth] = useState<Health | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [triggerFilter, setTriggerFilter] = useState("all");
  const [view, setView] = useState<"list" | "grid">("list");
  const [builderId, setBuilderId] = useState<number | null>(null);
  const [builderAction, setBuilderAction] = useState<BuilderEntryAction>(null);
  const [expandedRun, setExpandedRun] = useState<number | null>(null);
  const [exceptionTab, setExceptionTab] = useState<"quarantine" | "review">("quarantine");
  const [processing, setProcessing] = useState<number | null>(null);
  const [officeOpen, setOfficeOpen] = useState(false);
  const [officeLoading, setOfficeLoading] = useState(false);
  const [officeSaving, setOfficeSaving] = useState(false);
  const [officeIps, setOfficeIps] = useState<string[]>([]);
  const [currentIp, setCurrentIp] = useState("");
  const [officeInput, setOfficeInput] = useState("");

  const request = useCallback(async <T,>(path: string, init?: RequestInit): Promise<T> => {
    if (!supabaseUrl || !publishableKey) throw new Error("Configuração pública do Supabase não encontrada.");
    const response = await fetch(`${supabaseUrl}/rest/v1${path}`, { ...init, headers: { ...headers, ...(init?.headers ?? {}) } });
    if (!response.ok) { const payload = await response.json().catch(() => ({})) as { message?: string }; throw new Error(payload.message ?? `A operação respondeu ${response.status}.`); }
    if (response.status === 204) return undefined as T;
    const text = await response.text(); return (text ? JSON.parse(text) : undefined) as T;
  }, [headers, publishableKey, supabaseUrl]);
  const getHealth = useCallback(async () => { const response = await fetch("/api/automacoes-operacao", { headers: { Authorization: `Bearer ${accessToken}` }, cache: "no-store" }); const payload = await response.json().catch(() => ({})) as Health & { error?: string }; if (!response.ok) throw new Error(payload.error ?? "Não foi possível consultar a saúde da Central."); return payload; }, [accessToken]);
  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const [rows, versions, runRows, healthData] = await Promise.all([
        request<Array<Omit<Automation, "version" | "triggerKey" | "triggerLabel" | "blocks">>>("/automacoes?select=id,nome,grupo,ativa,status,arquivada,atualizada_em,versao_publicada_id,mapa,mapa_rascunho&order=grupo,id"),
        request<Array<{ id: number; versao: number }>>("/automacao_versoes?select=id,versao&order=versao.desc"),
        request<Run[]>("/motor_execucoes?select=id,automacao_id,automacao_nome,bloco_id,evento,status,detalhe,lead_nome,lead_telefone,criado_em&order=id.desc&limit=100").catch(() => []), getHealth().catch(() => null),
      ]);
      const versionsById = new Map(versions.map((item) => [item.id, item.versao]));
      setAutomations(rows.map((row) => ({ ...row, arquivada: Boolean(row.arquivada), version: row.versao_publicada_id ? versionsById.get(row.versao_publicada_id) ?? null : null, ...mapInfo(row.mapa_rascunho ?? row.mapa) })));
      setRuns(runRows); setHealth(healthData);
    } catch (failure) { setError(failure instanceof Error ? failure.message : "Não foi possível carregar a Central."); } finally { setLoading(false); }
  }, [getHealth, request]);
  useEffect(() => { void load(); }, [load]);

  const counts = useMemo(() => { const operational = automations.filter((item) => !item.arquivada); return { total: operational.length, active: operational.filter((item) => item.ativa).length, inactive: operational.filter((item) => !item.ativa).length, archived: automations.filter((item) => item.arquivada).length }; }, [automations]);
  const filtered = useMemo(() => automations.filter((item) => {
    if (filter === "archived" ? !item.arquivada : item.arquivada) return false; if (filter === "active" && !item.ativa) return false; if (filter === "inactive" && item.ativa) return false; if (triggerFilter !== "all" && item.triggerKey !== triggerFilter) return false;
    const term = query.trim().toLocaleLowerCase("pt-BR"); return !term || `${item.nome} ${item.grupo ?? ""} ${item.triggerLabel}`.toLocaleLowerCase("pt-BR").includes(term);
  }), [automations, filter, query, triggerFilter]);
  const groups = useMemo(() => { const result = new Map<string, Automation[]>(); filtered.forEach((item) => { const group = item.grupo?.trim() || "Sem grupo"; result.set(group, [...(result.get(group) ?? []), item]); }); return [...result.entries()]; }, [filtered]);
  const triggerUsage = useMemo(() => new Map(TRIGGER_CATALOG.map(([key]) => [key, automations.filter((item) => !item.arquivada && item.triggerKey === key).length])), [automations]);
  const contracts = health?.contratos ?? []; const contractsOk = contracts.filter((item) => item.ok).length; const exceptionCount = number(health?.fila?.quarentena) + number(health?.sara?.revisao_humana);
  const openBuilder = (id: number | null, action: BuilderEntryAction = null) => { setBuilderId(id); setBuilderAction(action); setScreen("builder"); };
  const patchAutomation = useCallback(async (id: number, body: Record<string, unknown>) => { await request<void>(`/automacoes?id=eq.${id}`, { method: "PATCH", headers: { "Content-Type": "application/json", Prefer: "return=minimal" }, body: JSON.stringify(body) }); await load(); }, [load, request]);
  const duplicarAutomacao = async (item: Automation) => { try { const map = item.mapa_rascunho ?? item.mapa ?? { automation: { blocks: [] } }; await request("/automacoes", { method: "POST", headers: { "Content-Type": "application/json", Prefer: "return=representation" }, body: JSON.stringify({ nome: `${item.nome} (cópia)`, grupo: item.grupo, ativa: false, status: "rascunho", mapa: map, mapa_rascunho: map }) }); setNotice("Automação duplicada como rascunho."); await load(); } catch (failure) { setError(failure instanceof Error ? failure.message : "Não foi possível duplicar."); } };
  const arquivarAutomacao = async (item: Automation) => { try { await patchAutomation(item.id, { arquivada: !item.arquivada }); setNotice(item.arquivada ? "Automação desarquivada." : "Automação arquivada."); } catch (failure) { setError(failure instanceof Error ? failure.message : "Não foi possível arquivar."); } };
  const moverAutomacao = async (item: Automation) => { const group = window.prompt("Mover para qual grupo?", item.grupo ?? ""); if (group == null) return; try { await patchAutomation(item.id, { grupo: group.trim() || null }); setNotice("Automação movida."); } catch (failure) { setError(failure instanceof Error ? failure.message : "Não foi possível mover."); } };
  const excluirAutomacao = async (item: Automation) => { if (!window.confirm(`Excluir “${item.nome}” definitivamente? Esta ação não pode ser desfeita.`)) return; try { await request<void>(`/automacoes?id=eq.${item.id}`, { method: "DELETE", headers: { Prefer: "return=minimal" } }); setNotice("Automação excluída."); await load(); } catch (failure) { setError(failure instanceof Error ? failure.message : "Não foi possível excluir."); } };
  const exportarAutomacao = (item: Automation) => { const url = URL.createObjectURL(new Blob([JSON.stringify(item.mapa_rascunho ?? item.mapa ?? {}, null, 2)], { type: "application/json" })); const link = document.createElement("a"); link.href = url; link.download = `${item.nome.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "").toLowerCase() || "automacao"}.json`; link.click(); URL.revokeObjectURL(url); };
  const reprocess = async (item: Quarantine) => { const versionMismatch = item.erro.includes("AUTOMATION_RUNTIME_CONTRACT_INVALID"); if (versionMismatch && !window.confirm("Migrar para a versão publicada e reprocessar com registro de auditoria?")) return; setProcessing(item.id); setError(null); try { const response = await fetch("/api/automacoes-operacao", { method: "POST", headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" }, body: JSON.stringify({ action: versionMismatch ? "reprocessar_versao_publicada" : "reprocessar", fila_id: item.id }) }); const payload = await response.json().catch(() => ({})) as { error?: string }; if (!response.ok) throw new Error(payload.error ?? "A execução não foi reprocessada."); setNotice("Execução enviada para reprocessamento seguro."); await load(); } catch (failure) { setError(failure instanceof Error ? failure.message : "Não foi possível reprocessar."); } finally { setProcessing(null); } };
  const openOffice = async () => {
    setOfficeOpen(true); setOfficeLoading(true); setError(null);
    try {
      const [config, detected] = await Promise.all([
        request<Array<{ ips: string[] | null }>>("/escritorio_config?id=eq.1&select=ips"),
        supabaseUrl && publishableKey ? fetch(`${supabaseUrl}/functions/v1/presenca`, { method: "POST", headers: { ...headers, "Content-Type": "application/json" }, body: "{}" }).then((response) => response.ok ? response.json() : {}).catch(() => ({})) : Promise.resolve({}),
      ]);
      setOfficeIps(Array.isArray(config[0]?.ips) ? config[0].ips.filter((item): item is string => typeof item === "string") : []);
      setCurrentIp(typeof (detected as { ip?: unknown }).ip === "string" ? (detected as { ip: string }).ip : "");
    } catch (failure) { setError(failure instanceof Error ? failure.message : "Não foi possível carregar os IPs do escritório."); } finally { setOfficeLoading(false); }
  };
  const saveOfficeIps = async (nextIps: string[]) => {
    setOfficeSaving(true); setError(null);
    try { await request<void>("/escritorio_config?id=eq.1", { method: "PATCH", headers: { "Content-Type": "application/json", Prefer: "return=minimal" }, body: JSON.stringify({ ips: nextIps, atualizado_em: new Date().toISOString() }) }); setOfficeIps(nextIps); setNotice("IPs do escritório atualizados."); }
    catch (failure) { setError(failure instanceof Error ? failure.message : "Não foi possível salvar os IPs do escritório."); }
    finally { setOfficeSaving(false); }
  };
  const addOfficeIp = (candidate: string) => {
    const value = candidate.trim();
    if (!value) return;
    if (/\s/.test(value) || value.length > 64) { setError("Informe um endereço IP válido, sem espaços."); return; }
    if (officeIps.includes(value)) { setNotice("Esse IP já está cadastrado."); return; }
    setOfficeInput(""); void saveOfficeIps([...officeIps, value]);
  };

  if (screen === "builder") {
    return <AutomationFlowBuilderV4 accessToken={accessToken} initialAutomationId={builderId} entryAction={builderAction} onBack={() => { setScreen("central"); setBuilderAction(null); void load(); }} />;
  }
  const navCounts: Partial<Record<Area, number>> = { automations: counts.total, triggers: TRIGGER_CATALOG.length, runs: runs.length, exceptions: exceptionCount };

  return <div className="apn-v4">
    <aside className="apn-v4-nav" aria-label="Áreas da Central de Automações"><p>CENTRAL</p>{NAV.map((item) => <button key={item.id} type="button" className={area === item.id ? "is-active" : ""} onClick={() => setArea(item.id)}>{icon(item.id)}<span>{item.label}</span>{navCounts[item.id] != null && <em>{navCounts[item.id]}</em>}{item.id === "exceptions" && exceptionCount > 0 && <i />}</button>)}<hr /><button type="button" onClick={() => { window.location.href = "/abordagens"; }}>{icon("approaches")}<span>Abordagens</span></button><button type="button" onClick={() => void openOffice()}>{icon("office")}<span>IP do escritório</span></button></aside>
    <main className="apn-v4-content">{error && <div className="apn-v4-alert is-error" role="alert"><span>{error}</span><button type="button" onClick={() => setError(null)}>Fechar</button></div>}{notice && <div className="apn-v4-alert" role="status"><span>{notice}</span><button type="button" onClick={() => setNotice(null)}>Fechar</button></div>}
      {area === "automations" && <section className="apn-v4-page"><header className="apn-v4-page-head"><h1>Minhas automações</h1><div><button type="button" onClick={() => { window.location.href = "/abordagens"; }}>Abordagens</button><button type="button" onClick={() => void openOffice()}>IP do escritório</button><button type="button" className="apn-v4-primary" onClick={() => openBuilder(null, { type: "new" })}>{icon("plus")}Nova automação</button></div></header><div className="apn-v4-toolbar"><label>{icon("search")}<input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar" /></label><select aria-label="Qualquer gatilho" value={triggerFilter} onChange={(event) => setTriggerFilter(event.target.value)}><option value="all">Qualquer gatilho</option>{TRIGGER_CATALOG.map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select><div className="apn-v4-pills">{([['all', 'Todas', counts.total], ['active', 'Ativas', counts.active], ['inactive', 'Inativas', counts.inactive], ['archived', 'Arquivadas', counts.archived]] as Array<[Filter, string, number]>).map(([id, label, total]) => <button key={id} type="button" className={filter === id ? "is-active" : ""} onClick={() => setFilter(id)}>{label}<span>{total}</span></button>)}</div><button type="button" className="apn-v4-view" onClick={() => setView((current) => current === "list" ? "grid" : "list")}>{icon(view === "list" ? "grid" : "list")}{view === "list" ? "Ver em grade" : "Ver em lista"}</button><button type="button" className="apn-v4-icon-button" aria-label="Ver arquivadas" onClick={() => setFilter("archived")}>{icon("trash")}</button></div>
        {loading ? <div className="apn-v4-loading">Carregando automações…</div> : !groups.length ? <div className="apn-v4-empty"><b>Nenhuma automação encontrada</b><p>Ajuste os filtros ou crie um novo rascunho.</p><button type="button" onClick={() => openBuilder(null, { type: "new" })}>Nova automação</button></div> : <div className={`apn-v4-groups is-${view}`}>{groups.map(([group, items]) => <section className="apn-v4-group" key={group}><header><b>{group}</b><span>{items.length} {items.length === 1 ? "automação" : "automações"}</span></header><div>{items.map((item) => <article className="apn-v4-item" key={item.id}><button type="button" className="apn-v4-item-main" onClick={() => openBuilder(item.id)}><span className="apn-v4-item-name"><i className={item.ativa ? "is-active" : ""} /><b>{item.nome}</b></span><span className="apn-v4-trigger">{icon("triggers")}<em>{item.triggerLabel}</em></span><span className={`apn-v4-state ${item.ativa ? "is-active" : ""}`}><i />{item.arquivada ? "Arquivada" : item.ativa ? "Ativa" : "Inativa"}</span><span className="apn-v4-version">{item.version ? `Publicada v${item.version}` : item.status === "rascunho" ? "Rascunho" : "Sem versão"}</span></button><details className="apn-v4-menu"><summary aria-label={`Ações de ${item.nome}`}>•••</summary><div><button type="button" onClick={() => openBuilder(item.id)}>Abrir construtor</button><button type="button" onClick={() => void duplicarAutomacao(item)}>Duplicar</button><button type="button" onClick={() => exportarAutomacao(item)}>Exportar JSON</button><button type="button" onClick={() => void moverAutomacao(item)}>Mover para grupo</button><button type="button" onClick={() => void arquivarAutomacao(item)}>{item.arquivada ? "Desarquivar" : "Arquivar"}</button><button type="button" className="is-danger" onClick={() => void excluirAutomacao(item)}>Excluir</button></div></details></article>)}</div></section>)}</div>}</section>}
      {area === "overview" && <Overview counts={counts} health={health} contracts={contracts} contractsOk={contractsOk} exceptionCount={exceptionCount} onAutomations={(next) => { setFilter(next); setArea("automations"); }} onExceptions={(next) => { setExceptionTab(next); setArea("exceptions"); }} />}
      {area === "triggers" && <section className="apn-v4-page"><header className="apn-v4-page-head"><h1>Gatilhos</h1></header><div className="apn-v4-trigger-catalog">{[...new Set(TRIGGER_CATALOG.map((item) => item[3]))].map((category) => <section key={category}><h2>{category}</h2><div>{TRIGGER_CATALOG.filter((item) => item[3] === category).map(([key, label, description]) => { const usage = triggerUsage.get(key) ?? 0; return <button type="button" key={key} onClick={() => { setTriggerFilter(key); setFilter("all"); setArea("automations"); }}><span>{icon("triggers")}</span><div><b>{label}</b><small>{description}</small></div><em>{usage ? `${usage} ${usage === 1 ? "automação" : "automações"}` : "nenhuma ainda"}</em><i className={usage ? "is-used" : ""}>{usage ? "em uso" : "disponível"}</i></button>; })}</div></section>)}</div></section>}
      {area === "runs" && <RunsPage runs={runs} automations={automations} loading={loading} expanded={expandedRun} onExpanded={setExpandedRun} onOpen={(id) => openBuilder(id)} onReload={() => void load()} />}
      {area === "exceptions" && <ExceptionsPage tab={exceptionTab} onTab={setExceptionTab} health={health} automations={automations} processing={processing} onOpen={(id) => openBuilder(id)} onReprocess={reprocess} />}
    </main>
    {officeOpen && <div className="apn-v4-office-scrim" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setOfficeOpen(false); }}><section className="apn-v4-office-modal" role="dialog" aria-modal="true" aria-labelledby="office-title"><header><div><span>SEGURANÇA DA OPERAÇÃO</span><h2 id="office-title">IP do escritório</h2></div><button type="button" aria-label="Fechar IP do escritório" onClick={() => setOfficeOpen(false)}>×</button></header><p>No horário comercial, só recebe lead quem está conectado a partir de um destes IPs.</p><div className="apn-v4-current-ip"><span><small>SEU IP AGORA</small><b>{currentIp || (officeLoading ? "detectando…" : "não identificado")}</b></span>{currentIp && (officeIps.includes(currentIp) ? <em>já cadastrado ✓</em> : <button type="button" onClick={() => addOfficeIp(currentIp)} disabled={officeSaving}>Usar este IP</button>)}</div><h3>IPs cadastrados</h3><div className="apn-v4-office-list">{officeLoading ? <p>Carregando…</p> : officeIps.length ? officeIps.map((ip) => <div key={ip}><b>{ip}</b><button type="button" onClick={() => { if (window.confirm(`Remover o IP ${ip}?`)) void saveOfficeIps(officeIps.filter((item) => item !== ip)); }} disabled={officeSaving}>Remover</button></div>) : <p>Nenhum IP cadastrado.</p>}</div><footer><input value={officeInput} onChange={(event) => setOfficeInput(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); addOfficeIp(officeInput); } }} placeholder="Adicionar IP manualmente" aria-label="Novo IP do escritório" /><button type="button" onClick={() => addOfficeIp(officeInput)} disabled={officeSaving}>{officeSaving ? "Salvando…" : "Adicionar"}</button></footer></section></div>}
  </div>;
}

function Overview({ counts, health, contracts, contractsOk, exceptionCount, onAutomations, onExceptions }: { counts: { total: number; active: number; inactive: number; archived: number }; health: Health | null; contracts: Array<{ nome: string; ok: boolean }>; contractsOk: number; exceptionCount: number; onAutomations: (filter: Filter) => void; onExceptions: (tab: "quarantine" | "review") => void }) {
  return <section className="apn-v4-page"><header className="apn-v4-page-head"><h1>Visão geral</h1></header><div className="apn-v4-metrics"><button type="button" onClick={() => onAutomations("all")}><span>OPERACIONAIS</span><b>{counts.total}</b><small>automações não arquivadas</small></button><button type="button" onClick={() => onAutomations("active")}><span>ATIVAS</span><b>{counts.active}</b><small>{counts.inactive} inativas entre operacionais</small></button><button type="button" onClick={() => onAutomations("archived")}><span>ARQUIVADA</span><b>{counts.archived}</b><small>fora da operação</small></button><article><span>CONTRATOS</span><b>{contractsOk}/{contracts.length}</b><small>contratos de módulo confirmados</small></article></div><div className="apn-v4-overview-grid"><section className="apn-v4-health"><header><h2>Saúde da Central</h2><em className={exceptionCount || number(health?.automacoes?.invalidas) ? "is-warning" : "is-good"}>{exceptionCount || number(health?.automacoes?.invalidas) ? "Requer atenção" : "Operação íntegra"}</em></header>{[["Fila pendente", "execuções esperando processamento", number(health?.fila?.pendentes), ""], ["Quarentena", "exigem decisão humana", number(health?.fila?.quarentena), "warning"], ["Aguardando corretor elegível", "distribuição sem candidato", Math.max(0, number(health?.presenca?.ativos) - number(health?.presenca?.elegiveis)), "warning"], ["Freio de mensagens", health?.abordagem_automatica ? "envio liberado, nada retido" : "envios automáticos bloqueados", health?.abordagem_automatica ? "livre" : "bloqueado", health?.abordagem_automatica ? "good" : "warning"]].map(([title, description, value, state]) => <div key={String(title)} className={`is-${state}`}><span><b>{title}</b><small>{description}</small></span><em>{value}</em></div>)}</section><div className="apn-v4-decisions"><section><h2>Precisa de decisão humana</h2><button type="button" onClick={() => onExceptions("quarantine")}><span><b>Quarentena</b><small>{number(health?.fila?.quarentena)} execuções aguardando análise</small></span><em>→</em></button><button type="button" onClick={() => onExceptions("review")}><span><b>Revisão da Sara</b><small>{number(health?.sara?.revisao_humana)} leads aguardando uma pessoa</small></span><em>→</em></button></section><section className="apn-v4-contracts"><b>Integridade dos contratos</b><p>Os contratos publicáveis são conferidos pelo motor antes de uma nova versão entrar em operação.</p><div>{contracts.map((item) => <span key={item.nome} className={item.ok ? "is-ok" : "is-bad"}>{item.ok ? "✓" : "!"} {item.nome}</span>)}</div></section></div></div></section>;
}

function RunsPage({ runs, automations, loading, expanded, onExpanded, onOpen, onReload }: { runs: Run[]; automations: Automation[]; loading: boolean; expanded: number | null; onExpanded: (id: number | null) => void; onOpen: (id: number) => void; onReload: () => void }) {
  return <section className="apn-v4-page"><header className="apn-v4-page-head"><div><h1>Execuções</h1><p>Jornadas reais registradas pelo motor. Os detalhes visíveis são sanitizados.</p></div><button type="button" onClick={onReload}>Atualizar</button></header><div className="apn-v4-run-table"><header><span>execution_id</span><span>Automação</span><span>Bloco atual</span><span>Versão</span><span>Horário</span><span>Estado</span></header>{runs.map((run) => { const automation = automations.find((item) => item.id === run.automacao_id); return <article key={run.id} className={expanded === run.id ? "is-open" : ""}><button type="button" onClick={() => onExpanded(expanded === run.id ? null : run.id)}><code>exec_{run.id}</code><span>{run.automacao_nome ?? automation?.nome ?? "Automação"}</span><span>{run.bloco_id ?? "—"}</span><span>{automation?.version ? `v${automation.version}` : "—"}</span><span>{date(run.criado_em)}</span><em className={`is-${run.status ?? "unknown"}`}>{run.status ?? "sem estado"}</em></button>{expanded === run.id && <div className="apn-v4-run-expanded"><div><small>entrada sanitizada</small><pre>{JSON.stringify({ lead: run.lead_nome ?? "identidade removida", telefone: run.lead_telefone ? "***" : null }, null, 2)}</pre></div><div><small>saída sanitizada</small><pre>{JSON.stringify({ evento: run.evento, detalhe: run.detalhe ?? "sem detalhe" }, null, 2)}</pre></div>{run.automacao_id && <button type="button" onClick={() => onOpen(run.automacao_id!)}>Acompanhar no fluxo</button>}</div>}</article>; })}</div>{!runs.length && !loading && <div className="apn-v4-empty"><b>Nenhuma execução recente</b><p>Quando o motor registrar uma jornada, ela aparecerá aqui.</p></div>}</section>;
}

function ExceptionsPage({ tab, onTab, health, automations, processing, onOpen, onReprocess }: { tab: "quarantine" | "review"; onTab: (tab: "quarantine" | "review") => void; health: Health | null; automations: Automation[]; processing: number | null; onOpen: (id: number) => void; onReprocess: (item: Quarantine) => Promise<void> }) {
  return <section className="apn-v4-page"><header className="apn-v4-page-head"><h1>Exceções</h1></header><div className="apn-v4-exception-tabs"><button type="button" className={tab === "quarantine" ? "is-active" : ""} onClick={() => onTab("quarantine")}>Quarentena <span>{health?.quarentena?.length ?? 0}</span></button><button type="button" className={tab === "review" ? "is-active" : ""} onClick={() => onTab("review")}>Aguardando decisão humana <span>{health?.revisoes?.length ?? 0}</span></button></div>{tab === "quarantine" ? <div className="apn-v4-exception-list">{(health?.quarentena ?? []).map((item) => <article key={item.id}><header><div><b>{item.automacao}</b><span>execução #{item.id}</span></div><em className={item.erro.includes("AUTOMATION_RUNTIME_CONTRACT_INVALID") ? "is-definitive" : "is-recoverable"}>{item.erro.includes("AUTOMATION_RUNTIME_CONTRACT_INVALID") ? "requer migração" : "recuperável"}</em></header><h3>Bloco {item.bloco_id}</h3><p>{item.erro}</p><div className="apn-v4-exception-facts"><span><small>TENTATIVAS</small><b>{item.tentativas}</b></span><span><small>IMPACTO</small><b>jornada interrompida</b></span><span><small>REGISTRADA EM</small><b>{date(item.criado_em)}</b></span><span><small>SEGURANÇA</small><b>idempotência ativa</b></span></div><footer><button type="button" onClick={() => { const automation = automations.find((candidate) => candidate.nome === item.automacao); if (automation) onOpen(automation.id); }}>Abrir bloco</button><button type="button" className="apn-v4-reprocess" onClick={() => void onReprocess(item)} disabled={processing === item.id}>{processing === item.id ? "Reprocessando…" : "Reprocessar com segurança"}</button></footer><small>O motor preserva a chave idempotente e não repete um efeito já confirmado.</small></article>)}</div> : <div className="apn-v4-exception-list">{(health?.revisoes ?? []).map((item) => <article key={item.analise_id}><header><div><b>{item.nome || "Lead"}</b><span>{item.momento_codigo}</span></div><em className="is-review">revisão humana</em></header><p>{item.resumo || "A Sara interrompeu a aplicação automática porque não havia evidência suficiente."}</p><div className="apn-v4-exception-facts"><span><small>CONFIANÇA</small><b>{item.confianca == null ? "—" : `${Math.round(Number(item.confianca) * 100)}%`}</b></span><span><small>ANALISADO EM</small><b>{date(item.analisado_em)}</b></span><span><small>DECISÃO</small><b>aguardando uma pessoa</b></span></div></article>)}</div>}{tab === "quarantine" && !(health?.quarentena ?? []).length && <div className="apn-v4-empty"><b>Nenhuma execução em quarentena</b><p>A fila está livre de exceções recuperáveis.</p></div>}</section>;
}
