"use client";
/* eslint-disable react-hooks/set-state-in-effect */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  BLOCK_LIBRARY,
  TRIGGER_CATALOG,
  compileFlow,
  createNode,
  hydrateFlow,
  nodePorts,
  nodePresentation,
  triggerFromMap,
  validateFlow,
  type AutomationMap,
  type FlowModel,
  type FlowNode,
} from "./automationFlowModel";

export type BuilderEntryAction = null | { type: "new" } | { type: "group"; group: string };

export type AutomationRow = {
  id: number;
  nome: string;
  grupo: string | null;
  ativa: boolean;
  status: string | null;
  publicado_em: string | null;
  arquivada: boolean;
  mapa: AutomationMap | null;
  mapa_rascunho: AutomationMap | null;
  versao_publicada_id: number | null;
};

type Run = {
  id?: number;
  bloco_id: string | null;
  evento: string | null;
  status: string | null;
  detalhe: unknown;
  lead_nome: string | null;
  criado_em: string | null;
};

type RefItem = { id: number; nome: string; ativo?: boolean; ativa?: boolean; grupo?: string | null; corretor_id?: number | null; conectada?: boolean; status_dapi?: string | null; mensagens?: unknown[]; pipeline_id?: number | null; slug?: string; rotulo?: string };
type ReferenceData = { corretores: RefItem[]; abordagens: RefItem[]; agentes: RefItem[]; pipelines: RefItem[]; stages: RefItem[]; automacoes: RefItem[]; momentos: RefItem[]; instancias: RefItem[]; tags: string[] };
type Mode = "build" | "test" | "compare" | "track" | "resolve";
type Panel = "library" | "inspector" | "validation" | null;

const ACTION_OPTIONS = [
  ["create-business-action", "Criar negócio"],
  ["move-business-action", "Mover negócio de etapa"],
  ["business-win-action", "Ganhar negócio"],
  ["business-restore-action", "Restaurar negócio"],
  ["business-lose-action", "Perder negócio"],
  ["add-attendant-on-business-action", "Transferir atendente ao negócio"],
  ["clean-attendant-on-business-action", "Remover atendente do negócio"],
  ["create-lead-action", "Criar lead"],
  ["create-tags-action", "Criar tags"],
  ["add-tag-action", "Adicionar tags"],
  ["remove-tag-action", "Remover tags"],
  ["set-lead-momento-action", "Definir momento do lead"],
  ["apply-ai-analysis-action", "Aplicar análise da IA"],
  ["assign-lead-attendant-action", "Transferir atendente ao lead"],
  ["clean-lead-attendant-action", "Remover atendente do lead"],
  ["send-notification-action", "Enviar notificação"],
  ["start-another-automation-action", "Iniciar outra automação"],
] as const;

const CONDITION_OPTIONS = [
  ["business-has-attendants", "Negócio possui atendentes"],
  ["business-no-attendants", "Negócio sem atendentes"],
  ["business-won", "Negócio está ganho"],
  ["business-lost", "Negócio está perdido"],
  ["business-pending", "Negócio está pendente"],
  ["lead-exists", "Lead existente"],
  ["lead-has-business-on-pipeline", "Lead possui negócio no funil"],
  ["lead-has-business-on-stage", "Lead possui negócio na etapa"],
  ["lead-email-exists", "Lead com e-mail existente"],
  ["lead-name-exists", "Lead com nome existente"],
  ["lead-phone-exists", "Lead com telefone existente"],
  ["lead-cpf-exists", "Lead com CPF existente"],
  ["lead-has-tag", "Lead possui tag"],
  ["lead-has-attendant", "Lead possui atendente"],
  ["time-day-hour", "Hora dentro do intervalo"],
  ["lead-respondeu", "Lead respondeu"],
  ["field-equals", "Campo igual"],
  ["field-contains", "Campo contém"],
  ["field-has-value", "Campo possui valor"],
  ["field-between", "Campo entre valores"],
] as const;

function svgIcon(name: string) {
  const paths: Record<string, React.ReactNode> = {
    close: <><path d="m18 6-12 12M6 6l12 12" /></>,
    plus: <><path d="M12 5v14M5 12h14" /></>,
    fit: <><path d="M8 3H3v5M16 3h5v5M21 16v5h-5M3 16v5h5" /></>,
    wand: <><path d="m15 4 5 5L8 21l-5-5L15 4Z" /><path d="m6 14 5 5M6 4v3M4.5 5.5h3M19 15v4M17 17h4" /></>,
    check: <><path d="m5 12 4 4L19 6" /></>,
    search: <><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></>,
    copy: <><rect x="9" y="9" width="11" height="11" rx="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" /></>,
    trash: <><path d="M3 6h18M8 6V4h8v2M19 6l-1 15H6L5 6" /></>,
    flow: <><circle cx="6" cy="6" r="3" /><circle cx="18" cy="18" r="3" /><path d="M9 6h5a4 4 0 0 1 4 4v5" /></>,
  };
  return <svg viewBox="0 0 24 24" aria-hidden="true">{paths[name] ?? paths.flow}</svg>;
}

function safeDate(value: string | null | undefined) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(date);
}

function errorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

export function AutomationFlowBuilderV4({
  accessToken,
  initialAutomationId,
  entryAction,
  onBack,
}: {
  accessToken: string;
  initialAutomationId: number | null;
  entryAction: BuilderEntryAction;
  onBack: () => void;
}) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  const headers = useMemo(() => ({ apikey: publishableKey ?? "", Authorization: `Bearer ${accessToken}` }), [accessToken, publishableKey]);
  const [row, setRow] = useState<AutomationRow | null>(null);
  const [flow, setFlow] = useState<FlowModel | null>(null);
  const [publishedFlow, setPublishedFlow] = useState<FlowModel | null>(null);
  const [references, setReferences] = useState<ReferenceData>({ corretores: [], abordagens: [], agentes: [], pipelines: [], stages: [], automacoes: [], momentos: [], instancias: [], tags: [] });
  const [runs, setRuns] = useState<Run[]>([]);
  const [mode, setMode] = useState<Mode>("build");
  const [panel, setPanel] = useState<Panel>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [pendingPort, setPendingPort] = useState<{ from: string; port: string } | null>(null);
  const [zoom, setZoom] = useState(.62);
  const [offset, setOffset] = useState({ x: 90, y: 150 });
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [publishOpen, setPublishOpen] = useState(false);
  const [newOpen, setNewOpen] = useState(initialAutomationId == null);
  const [newName, setNewName] = useState("Nova automação");
  const [newGroup, setNewGroup] = useState(entryAction?.type === "group" ? entryAction.group : "");
  const [simStep, setSimStep] = useState(0);
  const canvasRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ kind: "pan" | "node"; startX: number; startY: number; originX: number; originY: number; nodeId?: string } | null>(null);

  const request = useCallback(async <T,>(path: string, init?: RequestInit): Promise<T> => {
    if (!supabaseUrl || !publishableKey) throw new Error("Configuração pública do Supabase não encontrada.");
    const response = await fetch(`${supabaseUrl}/rest/v1${path}`, { ...init, headers: { ...headers, ...(init?.headers ?? {}) } });
    if (!response.ok) {
      const payload = await response.json().catch(() => ({})) as { message?: string; hint?: string };
      throw new Error(payload.message ?? payload.hint ?? `A operação respondeu ${response.status}.`);
    }
    if (response.status === 204) return undefined as T;
    const text = await response.text();
    return (text ? JSON.parse(text) : undefined) as T;
  }, [headers, publishableKey, supabaseUrl]);

  const loadAutomation = useCallback(async (id: number) => {
    setLoading(true); setError(null);
    try {
      const rows = await request<AutomationRow[]>(`/automacoes?id=eq.${id}&select=id,nome,grupo,ativa,status,publicado_em,arquivada,mapa,mapa_rascunho,versao_publicada_id`);
      const current = rows[0];
      if (!current) throw new Error("Automação não encontrada.");
      const draft = hydrateFlow(current.mapa_rascunho ?? current.mapa, current.nome);
      setRow(current);
      setFlow(draft);
      setPublishedFlow(hydrateFlow(current.mapa, current.nome));
      setSelectedId(null);
      setDirty(false);
      setPanel(null);
      const runRows = await request<Run[]>(`/motor_execucoes?automacao_id=eq.${id}&select=id,bloco_id,evento,status,detalhe,lead_nome,criado_em&order=id.desc&limit=100`).catch(() => []);
      setRuns(runRows);
    } catch (failure) {
      setError(errorMessage(failure, "Não foi possível abrir a automação."));
    } finally { setLoading(false); }
  }, [request]);

  useEffect(() => {
    let active = true;
    void Promise.all([
      request<RefItem[]>("/corretores?select=id,nome,ativo&ativo=is.true&order=nome").catch(() => []),
      request<RefItem[]>("/abordagens?select=id,nome,grupo,ativo,mensagens&ativo=is.true&order=grupo,ordem,id").catch(() => []),
      request<RefItem[]>("/agentes_ia?select=id,nome,ativo&ativo=is.true&order=nome").catch(() => []),
      request<RefItem[]>("/pipelines?select=id,nome&order=id").catch(() => []),
      request<RefItem[]>("/pipeline_stages?select=id,pipeline_id,nome&order=pipeline_id,ordem").catch(() => []),
      request<RefItem[]>("/automacoes?select=id,nome,ativa,arquivada&arquivada=is.false&order=nome").catch(() => []),
      request<RefItem[]>("/lead_momento_catalogo?select=slug,rotulo,grupo&ativo=eq.true&order=ordem").catch(() => []),
      request<RefItem[]>("/instancias?select=id,nome,ativa,conectada,status_dapi,corretor_id&order=id").catch(() => []),
      request<string[]>("/rpc/automacao_tags", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" }).catch(() => []),
    ]).then(([corretores, abordagens, agentes, pipelines, stages, automacoes, momentos, instancias, tags]) => { if (active) setReferences({ corretores, abordagens, agentes, pipelines, stages, automacoes, momentos, instancias, tags }); });
    if (initialAutomationId != null) void loadAutomation(initialAutomationId);
    else setLoading(false);
    return () => { active = false; };
  }, [initialAutomationId, loadAutomation, request]);

  const updateFlow = useCallback((updater: (current: FlowModel) => FlowModel) => {
    setFlow((current) => current ? updater(current) : current);
    setDirty(true);
  }, []);

  const updateNode = useCallback((id: string, updater: (node: FlowNode) => FlowNode) => {
    updateFlow((current) => ({ ...current, nodes: current.nodes.map((node) => node.id === id ? updater(node) : node) }));
  }, [updateFlow]);

  const selected = useMemo(() => flow?.nodes.find((node) => node.id === selectedId) ?? null, [flow, selectedId]);
  const issues = useMemo(() => flow ? validateFlow(flow) : [], [flow]);
  const blocks = issues.filter((issue) => issue.level === "block");
  const warnings = issues.filter((issue) => issue.level === "warning");
  const currentRun = runs[0] ?? null;
  const trackedNodeId = mode === "track" || mode === "resolve" ? currentRun?.bloco_id : mode === "test" ? flow?.nodes[Math.min(simStep, Math.max(0, (flow?.nodes.length ?? 1) - 1))]?.id : null;

  const saveDraft = useCallback(async () => {
    if (!row || !flow) return false;
    setSaving(true); setError(null);
    try {
      await request<void>(`/automacoes?id=eq.${row.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Prefer: "return=minimal" },
        body: JSON.stringify({ nome: flow.name, mapa_rascunho: compileFlow(flow), atualizada_em: new Date().toISOString() }),
      });
      setRow((current) => current ? { ...current, nome: flow.name, mapa_rascunho: compileFlow(flow) } : current);
      setDirty(false);
      setMessage("Rascunho salvo. A versão publicada não mudou.");
      return true;
    } catch (failure) {
      setError(errorMessage(failure, "Não foi possível salvar o rascunho."));
      return false;
    } finally { setSaving(false); }
  }, [flow, request, row]);

  useEffect(() => {
    if (!dirty || !row || !flow) return;
    const timer = window.setTimeout(() => { void saveDraft(); }, 1600);
    return () => window.clearTimeout(timer);
  }, [dirty, flow, row, saveDraft]);

  const createAutomation = async () => {
    if (!newName.trim()) return;
    setSaving(true); setError(null);
    try {
      const starter: FlowModel = { uid: 102, name: newName.trim(), provider: "apecerto-erp", anotacoes: [], notes: {}, nodes: [createNode("trigger", 100, 120, 240)], wires: [] };
      const map = compileFlow(starter);
      const rows = await request<AutomationRow[]>("/automacoes", {
        method: "POST",
        headers: { "Content-Type": "application/json", Prefer: "return=representation" },
        body: JSON.stringify({ nome: newName.trim(), grupo: newGroup.trim() || null, ativa: false, status: "rascunho", mapa: map, mapa_rascunho: map }),
      });
      if (!rows[0]) throw new Error("A criação não retornou a nova automação.");
      setNewOpen(false);
      await loadAutomation(rows[0].id);
    } catch (failure) { setError(errorMessage(failure, "Não foi possível criar a automação.")); }
    finally { setSaving(false); }
  };

  const addBlock = (type: string) => {
    if (!flow) return;
    const source = pendingPort ? flow.nodes.find((node) => node.id === pendingPort.from) : null;
    const id = `b${flow.uid}`;
    const node = createNode(type, flow.uid, source ? source.x + 390 : Math.max(120, (-offset.x + 420) / zoom), source ? source.y : Math.max(160, (-offset.y + 340) / zoom));
    const used = type === "randomizer" ? 3 : 1;
    updateFlow((current) => ({ ...current, uid: current.uid + used, nodes: [...current.nodes, node], wires: pendingPort ? [...current.wires.filter((wire) => !(wire.from === pendingPort.from && wire.port === pendingPort.port)), { from: pendingPort.from, port: pendingPort.port, to: id }] : current.wires }));
    setSelectedId(id);
    setPendingPort(null);
    setPanel("inspector");
  };

  const removeNode = (id: string) => {
    updateFlow((current) => ({ ...current, nodes: current.nodes.filter((node) => node.id !== id), wires: current.wires.filter((wire) => wire.from !== id && wire.to !== id) }));
    setSelectedId(null); setPanel(null);
  };

  const duplicateNode = (id: string) => {
    if (!flow) return;
    const source = flow.nodes.find((node) => node.id === id);
    if (!source) return;
    const clone: FlowNode = JSON.parse(JSON.stringify(source)) as FlowNode;
    clone.id = `b${flow.uid}`; clone.x += 36; clone.y += 36; clone.sourceBlockId = undefined;
    updateFlow((current) => ({ ...current, uid: current.uid + 1, nodes: [...current.nodes, clone] }));
    setSelectedId(clone.id); setPanel("inspector");
  };

  const autoArrange = () => {
    if (!flow) return;
    const incoming = new Set(flow.wires.map((wire) => wire.to));
    const starts = flow.nodes.filter((node) => node.type === "trigger" || !incoming.has(node.id));
    const positions = new Map<string, { x: number; y: number }>();
    const queue = starts.map((node, index) => ({ id: node.id, col: 0, row: index }));
    const seen = new Set<string>();
    while (queue.length) {
      const item = queue.shift()!;
      if (seen.has(item.id)) continue;
      seen.add(item.id); positions.set(item.id, { x: 120 + item.col * 390, y: 220 + item.row * 300 });
      flow.wires.filter((wire) => wire.from === item.id).forEach((wire, index) => queue.push({ id: wire.to, col: item.col + 1, row: item.row + index }));
    }
    flow.nodes.filter((node) => !seen.has(node.id)).forEach((node, index) => positions.set(node.id, { x: 120 + index * 390, y: 560 }));
    updateFlow((current) => ({ ...current, nodes: current.nodes.map((node) => ({ ...node, ...(positions.get(node.id) ?? {}) })) }));
    setOffset({ x: 80, y: 80 }); setZoom(.62);
  };

  const fitFlow = useCallback(() => {
    if (!flow?.nodes.length || !canvasRef.current) return;
    const minX = Math.min(...flow.nodes.map((node) => node.x));
    const minY = Math.min(...flow.nodes.map((node) => node.y));
    const maxX = Math.max(...flow.nodes.map((node) => node.x + 340));
    const maxY = Math.max(...flow.nodes.map((node) => node.y + 250));
    const rect = canvasRef.current.getBoundingClientRect();
    const next = Math.max(.3, Math.min(1, Math.min((rect.width - 160) / Math.max(600, maxX - minX), (rect.height - 160) / Math.max(400, maxY - minY))));
    setZoom(next);
    setOffset({ x: (rect.width - (maxX - minX) * next) / 2 - minX * next, y: (rect.height - (maxY - minY) * next) / 2 - minY * next });
  }, [flow]);

  const beginPan = (event: React.PointerEvent<HTMLDivElement>) => {
    if ((event.target as HTMLElement).closest(".apf-node,.apf-controls,.apf-library,.apf-mode-panel")) return;
    dragRef.current = { kind: "pan", startX: event.clientX, startY: event.clientY, originX: offset.x, originY: offset.y };
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const movePointer = (event: React.PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag) return;
    if (drag.kind === "pan") setOffset({ x: drag.originX + event.clientX - drag.startX, y: drag.originY + event.clientY - drag.startY });
    else if (drag.nodeId) updateNode(drag.nodeId, (node) => ({ ...node, x: drag.originX + (event.clientX - drag.startX) / zoom, y: drag.originY + (event.clientY - drag.startY) / zoom }));
  };

  const publish = async () => {
    if (!row || !flow || blocks.length) return;
    setSaving(true); setError(null);
    try {
      if (dirty && !(await saveDraft())) return;
      const result = await request<{ versao_id: number; versao: number }>("/rpc/automacao_publicar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ p_automacao_id: row.id, p_nome: flow.name, p_mapa: compileFlow(flow), p_expected_version_id: row.versao_publicada_id }),
      });
      setRow((current) => current ? { ...current, status: "publicado", versao_publicada_id: result.versao_id, mapa: compileFlow(flow), mapa_rascunho: compileFlow(flow) } : current);
      setPublishedFlow(hydrateFlow(compileFlow(flow), flow.name));
      setPublishOpen(false);
      setMessage(`Versão v${result.versao} publicada com sucesso.`);
    } catch (failure) {
      const text = errorMessage(failure, "Não foi possível publicar.");
      setError(text.includes("AUTOMATION_STALE_VERSION") ? "Esta automação mudou em outra sessão. Reabra antes de publicar." : text);
    } finally { setSaving(false); }
  };

  const compare = useMemo(() => {
    if (!flow || !publishedFlow) return [];
    const currentIds = new Set(flow.nodes.map((node) => node.id));
    const publishedIds = new Set(publishedFlow.nodes.map((node) => node.id));
    const added = [...currentIds].filter((id) => !publishedIds.has(id)).length;
    const removed = [...publishedIds].filter((id) => !currentIds.has(id)).length;
    const trigger = triggerFromMap(compileFlow(flow)).label;
    const publishedTrigger = triggerFromMap(compileFlow(publishedFlow)).label;
    return [
      ["Blocos", `${flow.nodes.length} · ${added} adicionados, ${removed} removidos`, added || removed ? "changed" : "ok"],
      ["Conexões e ramos", flow.wires.length === publishedFlow.wires.length ? "sem alteração de quantidade" : `${publishedFlow.wires.length} → ${flow.wires.length}`, flow.wires.length === publishedFlow.wires.length ? "ok" : "changed"],
      ["Gatilho", trigger === publishedTrigger ? `${trigger} · sem alteração` : `${publishedTrigger} → ${trigger}`, trigger === publishedTrigger ? "ok" : "changed"],
      ["Saída de erro não conectada", `${warnings.length} avisos`, warnings.length ? "warning" : "ok"],
    ];
  }, [flow, publishedFlow, warnings.length]);

  const connectionPaths = useMemo(() => {
    if (!flow) return [];
    return flow.wires.map((wire) => {
      const from = flow.nodes.find((node) => node.id === wire.from);
      const to = flow.nodes.find((node) => node.id === wire.to);
      if (!from || !to) return null;
      const index = Math.max(0, nodePorts(from).findIndex((port) => port.key === wire.port));
      const x1 = from.x + 340; const y1 = from.y + 159 + index * 34;
      const x2 = to.x; const y2 = to.y + 104;
      const curve = Math.max(70, Math.abs(x2 - x1) * .45);
      return { ...wire, d: `M${x1},${y1} C${x1 + curve},${y1} ${x2 - curve},${y2} ${x2},${y2}`, error: ["err", "false", "naoRespondeu"].includes(wire.port), active: trackedNodeId === wire.to || trackedNodeId === wire.from };
    }).filter(Boolean) as Array<{ from: string; port: string; to: string; d: string; error: boolean; active: boolean }>;
  }, [flow, trackedNodeId]);

  return <div className="apf-shell">
    <header className="apf-topbar">
      <div className="apf-breadcrumb"><button type="button" onClick={onBack}>Minhas automações</button><span>›</span><strong>{flow?.name ?? row?.nome ?? "Nova automação"}</strong>{row && <em className={dirty ? "is-dirty" : ""}>{svgIcon("check")}{saving ? "Salvando…" : dirty ? "Alterações pendentes" : "Rascunho salvo"}</em>}</div>
      <nav aria-label="Modos do construtor">{(["build", "test", "compare", "track", "resolve"] as Mode[]).map((item) => <button key={item} type="button" className={mode === item ? "is-active" : ""} onClick={() => { setMode(item); setPanel(null); if (item === "compare") setPanel(null); }}>{({ build: "Construir", test: "Testar", compare: "Comparar", track: "Acompanhar", resolve: "Resolver" })[item]}</button>)}</nav>
      <div className="apf-top-actions"><button type="button" className="apf-outline" onClick={() => setPanel("validation")}>Validar</button><button type="button" className="apf-primary" onClick={() => blocks.length ? setPanel("validation") : setPublishOpen(true)} disabled={!row}>Publicar</button></div>
    </header>

    {mode === "test" && <div className="apf-simulation-banner">SIMULAÇÃO — NENHUM DADO SERÁ ALTERADO</div>}
    {message && <div className="apf-toast is-ok" role="status">{message}<button type="button" onClick={() => setMessage(null)}>×</button></div>}
    {error && <div className="apf-toast is-error" role="alert">{error}<button type="button" onClick={() => setError(null)}>×</button></div>}

    <div className="apf-canvas" ref={canvasRef} onPointerDown={beginPan} onPointerMove={movePointer} onPointerUp={() => { dragRef.current = null; }} onPointerCancel={() => { dragRef.current = null; }}>
      {loading ? <div className="apf-loading">Abrindo a automação…</div> : !flow ? <div className="apf-loading">Escolha ou crie uma automação.</div> : <>
        <div className="apf-canvas-tip">{mode === "test" ? "Modo simulação: avance passo a passo no painel à esquerda" : mode === "compare" ? "Comparando o rascunho com a versão publicada" : mode === "track" ? `Acompanhando ${currentRun?.id ? `exec_${currentRun.id}` : "a execução mais recente"} · o bloco atual está destacado` : mode === "resolve" ? "Resolvendo uma exceção · o bloco responsável está destacado" : "Arraste o fundo para navegar · use + para adicionar um passo"}</div>
        <div className="apf-world" style={{ transform: `translate(${offset.x}px, ${offset.y}px) scale(${zoom})` }}>
          <svg className="apf-edges" viewBox="0 0 3200 1800" preserveAspectRatio="none">{connectionPaths.map((path) => <path key={`${path.from}-${path.port}-${path.to}`} d={path.d} className={`${path.error ? "is-error" : ""} ${path.active ? "is-active" : ""}`} />)}</svg>
          {flow.nodes.map((node) => {
            const presentation = nodePresentation(node);
            const ports = nodePorts(node);
            const selectedNode = selectedId === node.id;
            const tracked = trackedNodeId === node.id;
            return <article key={node.id} className={`apf-node type-${node.type} ${selectedNode ? "is-selected" : ""} ${tracked ? "is-tracked" : ""} ${mode === "test" && trackedNodeId && !tracked ? "is-dimmed" : ""}`} style={{ left: node.x, top: node.y }} onClick={(event) => { event.stopPropagation(); setSelectedId(node.id); setPanel("inspector"); }}>
              {tracked && <span className="apf-current-chip">{mode === "test" ? "simulado" : mode === "resolve" ? "responsável" : "bloco atual"}</span>}
              {selectedNode && <div className="apf-node-tools"><button type="button" aria-label="Duplicar bloco" onClick={(event) => { event.stopPropagation(); duplicateNode(node.id); }}>{svgIcon("copy")}</button><button type="button" aria-label="Excluir bloco" onClick={(event) => { event.stopPropagation(); removeNode(node.id); }}>{svgIcon("trash")}</button></div>}
              <div className="apf-node-head" onPointerDown={(event) => { event.stopPropagation(); dragRef.current = { kind: "node", nodeId: node.id, startX: event.clientX, startY: event.clientY, originX: node.x, originY: node.y }; canvasRef.current?.setPointerCapture(event.pointerId); }}><span className="apf-node-icon">{svgIcon(node.type === "trigger" ? "flow" : node.type === "action" ? "wand" : "flow")}</span><div><small>{presentation.type}</small><strong>{presentation.title}</strong></div></div>
              <div className="apf-node-summary">{presentation.lines.map((line, index) => <span key={`${line}-${index}`}>{line}</span>)}</div>
              <div className="apf-node-ports">{ports.map((port) => <div key={port.key} className={port.error ? "is-error" : ""}><span>{port.label}</span><i /><button type="button" aria-label={`Adicionar passo na saída ${port.label}`} onClick={(event) => { event.stopPropagation(); setPendingPort({ from: node.id, port: port.key }); setPanel("library"); }}>+</button></div>)}</div>
            </article>;
          })}
        </div>

        <div className="apf-controls">
          <button type="button" className="apf-add" aria-label="Abrir biblioteca de módulos" onClick={() => { setPendingPort(null); setPanel("library"); }}>{svgIcon("plus")}</button>
          <button type="button" title="Auto-organizar" onClick={autoArrange}>{svgIcon("wand")}</button>
          <button type="button" title="Ajustar ao fluxo" onClick={fitFlow}>{svgIcon("fit")}</button>
          <div><button type="button" aria-label="Aproximar" onClick={() => setZoom((value) => Math.min(1.4, value + .1))}>+</button><span>{Math.round(zoom * 100)}%</span><button type="button" aria-label="Afastar" onClick={() => setZoom((value) => Math.max(.3, value - .1))}>−</button></div>
        </div>
      </>}

      {mode === "test" && flow && <aside className="apf-mode-panel apf-test-panel"><header><div><b>Simulação bloco a bloco</b><small>lead sintético</small></div></header><pre>{`{\n  "nome": "Lead de teste",\n  "telefone": "5511999999999",\n  "origem": "simulacao"\n}`}</pre><ol>{flow.nodes.map((node, index) => <li key={node.id} className={index === simStep ? "is-current" : index < simStep ? "is-done" : ""}><span>{index < simStep ? "✓" : index + 1}</span><div><b>{nodePresentation(node).title}</b><small>{index < simStep ? "seguiu" : index === simStep ? "passo atual" : "aguardando"}</small></div></li>)}</ol><div className="apf-mode-actions"><button type="button" className="apf-purple" onClick={() => setSimStep((value) => Math.min(flow.nodes.length - 1, value + 1))}>Próximo passo</button><button type="button" onClick={() => setSimStep(0)}>Reiniciar</button></div><p>Nenhuma gravação, mensagem, notificação ou chamada externa é executada.</p></aside>}

      {mode === "compare" && <aside className="apf-mode-panel"><header><div><b>Rascunho versus publicada</b><small>comparação estrutural real</small></div></header><div className="apf-compare-list">{compare.map(([label, value, state]) => <div key={label} className={`is-${state}`}><span>{state === "ok" ? "✓" : state === "warning" ? "!" : "•"}</span><div><b>{label}</b><small>{value}</small></div></div>)}</div><div className="apf-impact"><b>Impacto operacional</b><p>A publicação cria uma nova versão imutável. Execuções em curso permanecem presas à versão em que começaram.</p></div></aside>}

      {(mode === "track" || mode === "resolve") && <aside className="apf-mode-panel"><header><div><b>{mode === "track" ? "Execução acompanhada" : "Exceção em análise"}</b><small>{currentRun?.lead_nome ?? "Nenhuma execução disponível"}</small></div></header>{currentRun ? <div className="apf-run-detail"><span className={`is-${currentRun.status ?? "unknown"}`}>{currentRun.status ?? "sem estado"}</span><b>{currentRun.evento ?? "Evento"}</b><small>{safeDate(currentRun.criado_em)}</small><p>{typeof currentRun.detalhe === "string" ? currentRun.detalhe : "O detalhe desta execução está sanitizado."}</p><button type="button" onClick={() => currentRun.bloco_id && setSelectedId(currentRun.bloco_id)}>Abrir bloco responsável</button></div> : <p className="apf-panel-empty">Ainda não há execução real para acompanhar nesta automação.</p>}</aside>}
    </div>

    {panel === "library" && <BlockLibrary onClose={() => { setPanel(null); setPendingPort(null); }} onAdd={addBlock} />}
    {panel === "inspector" && selected && <NodeInspector node={selected} references={references} flow={flow!} webhookUrl={row && supabaseUrl ? `${supabaseUrl}/functions/v1/entrada?auto=${row.id}` : ""} onClose={() => { setPanel(null); setSelectedId(null); }} onChange={(next) => updateNode(selected.id, () => next)} />}
    {panel === "validation" && <ValidationPanel issues={issues} onClose={() => setPanel(null)} onGo={(nodeId) => { setSelectedId(nodeId); setPanel("inspector"); }} />}

    {publishOpen && row && flow && <div className="apf-scrim" role="dialog" aria-modal="true" aria-label="Revisar antes de publicar"><section className="apf-publish-modal"><header><span>REVISAR ANTES DE PUBLICAR</span><h2>{flow.name}</h2><button type="button" aria-label="Fechar" onClick={() => setPublishOpen(false)}>{svgIcon("close")}</button></header><div className="apf-version-change"><div><small>publicada</small><b>{row.versao_publicada_id ? "versão atual" : "nenhuma"}</b></div><span>→</span><div><small>nova versão</small><b>próxima</b></div><p>O rascunho continua salvo. Nada é enviado agora.</p></div><h3>Diferenças em relação à versão publicada</h3><div className="apf-publish-diff">{compare.map(([label, value, state]) => <div key={label} className={`is-${state}`}><span>{state === "ok" ? "✓" : state === "warning" ? "!" : "•"}</span><b>{label}</b><em>{value}</em></div>)}</div><footer><button type="button" onClick={() => setPublishOpen(false)}>Cancelar</button><button type="button" className="apf-primary" onClick={() => void publish()} disabled={saving}>{saving ? "Publicando…" : "Publicar nova versão"}</button></footer></section></div>}

    {newOpen && <div className="apf-scrim" role="dialog" aria-modal="true" aria-label="Nova automação"><section className="apf-new-modal"><header><span>NOVA AUTOMAÇÃO</span><h2>Comece pelo nome e pelo grupo</h2></header><label>Nome<input autoFocus value={newName} onChange={(event) => setNewName(event.target.value)} /></label><label>Grupo<input value={newGroup} onChange={(event) => setNewGroup(event.target.value)} placeholder="Sem grupo" /></label><p>O primeiro bloco será um gatilho vazio. Nada será ativado ou publicado automaticamente.</p><footer><button type="button" onClick={onBack}>Cancelar</button><button type="button" className="apf-primary" onClick={() => void createAutomation()} disabled={saving || !newName.trim()}>{saving ? "Criando…" : "Criar rascunho"}</button></footer></section></div>}
  </div>;
}

function BlockLibrary({ onClose, onAdd }: { onClose: () => void; onAdd: (type: string) => void }) {
  const groups = [...new Set(BLOCK_LIBRARY.map((item) => item.category))];
  return <aside className="apf-library apf-block-library"><header><div><b>Adicionar passo</b><small>10 tipos publicáveis</small></div><button type="button" aria-label="Fechar biblioteca" onClick={onClose}>{svgIcon("close")}</button></header><div>{groups.map((group) => <section key={group}><h3>{group}</h3><div>{BLOCK_LIBRARY.filter((item) => item.category === group).map((item) => <button key={item.type} type="button" className={`tone-${item.tone}`} onClick={() => onAdd(item.type)}><span>{svgIcon(item.type === "action" ? "wand" : "flow")}</span><div><b>{item.label}</b><small>{item.description}</small></div></button>)}</div></section>)}</div></aside>;
}

function ValidationPanel({ issues, onClose, onGo }: { issues: ReturnType<typeof validateFlow>; onClose: () => void; onGo: (id: string) => void }) {
  const blocks = issues.filter((issue) => issue.level === "block");
  const warnings = issues.filter((issue) => issue.level === "warning");
  const groupedWarnings = warnings.reduce((map, issue) => map.set(issue.title, [...(map.get(issue.title) ?? []), issue]), new Map<string, typeof warnings>());
  return <aside className="apf-library apf-validation"><header><div><b>Validação</b><small className={blocks.length ? "is-bad" : "is-good"}>{blocks.length} bloqueios</small></div><button type="button" aria-label="Fechar validação" onClick={onClose}>{svgIcon("close")}</button></header><div className="apf-validation-body">{!issues.length && <div className="apf-all-good">✓<b>Pronto para publicar</b><p>Nenhum bloqueio ou aviso encontrado.</p></div>}{blocks.map((issue, index) => <article key={`${issue.title}-${index}`} className="is-block"><div><span>!</span><b>{issue.title}</b></div><p>{issue.detail}</p>{issue.nodeId && <button type="button" onClick={() => onGo(issue.nodeId!)}>Ir para bloco</button>}</article>)}{[...groupedWarnings.entries()].map(([title, items]) => <article key={title} className="is-warning"><div><span>!</span><b>{title}</b><em>{items.length} blocos</em></div><p>Uma regra agregada, {items.length} passos afetados.</p>{items.map((item) => item.nodeId && <button key={item.nodeId} type="button" onClick={() => onGo(item.nodeId!)}>{nodePresentation({ id: item.nodeId!, type: "action", options: {}, x: 0, y: 0 }).title}<em>Ir para bloco</em></button>)}</article>)}<small className="apf-validation-note">Aviso não impede publicar. Um bloqueio impede e aparece individualmente.</small></div></aside>;
}

function ContractOptionFields({ kind, name, options, references, onChange }: { kind: "trigger" | "condition" | "action"; name: string; options: Record<string, unknown>; references: ReferenceData; onChange: (options: Record<string, unknown>) => void }) {
  const update = (changes: Record<string, unknown>) => onChange({ ...options, ...changes });
  const pipelineSelect = <select value={Number(options.pipeline_id ?? 0)} onChange={(event) => { const id = Number(event.target.value); update({ pipeline_id: id || "", pipeline: references.pipelines.find((item) => item.id === id)?.nome ?? "", etapa_id: "", etapa: "" }); }}><option value={0}>Escolha o funil</option>{references.pipelines.map((item) => <option key={item.id} value={item.id}>{item.nome}</option>)}</select>;
  const stageSelect = <select value={Number(options.etapa_id ?? 0)} onChange={(event) => { const id = Number(event.target.value); update({ etapa_id: id || "", etapa: references.stages.find((item) => item.id === id)?.nome ?? "" }); }}><option value={0}>Escolha a etapa</option>{references.stages.filter((item) => !options.pipeline_id || Number(item.pipeline_id) === Number(options.pipeline_id)).map((item) => <option key={item.id} value={item.id}>{item.nome}</option>)}</select>;
  if (kind === "trigger") {
    if (name === "tag-added-trigger") return <label>Tag observada<input list="apf-tags" value={String(options.tag ?? "")} onChange={(event) => update({ tag: event.target.value })} /><datalist id="apf-tags">{references.tags.map((tag) => <option key={tag} value={tag} />)}</datalist></label>;
    if (["lead-entered-stage-trigger", "lead-moved-stage-trigger"].includes(name)) return <div className="apf-inline-fields"><label>Funil{pipelineSelect}</label><label>Etapa{stageSelect}</label></div>;
    if (name === "checagem-diaria-trigger") return <><label>Reavaliar a cada (horas)<input type="number" min="1" max="168" value={Number(options.intervaloHoras ?? 24)} onChange={(event) => update({ intervaloHoras: Number(event.target.value) })} /></label><label>Aguardar após interação (minutos)<input type="number" min="0" max="1440" value={Number(options.atrasoInteracaoMinutos ?? 10)} onChange={(event) => update({ atrasoInteracaoMinutos: Number(event.target.value) })} /></label><label>Máximo por ciclo<input type="number" min="1" max="50" value={Number(options.limitePorCiclo ?? 12)} onChange={(event) => update({ limitePorCiclo: Number(event.target.value) })} /></label><div className="apf-contract-note"><b>Regra explícita</b><p>O relógio apenas localiza itens devidos. A continuação permanece desenhada no fluxo.</p></div></>;
    if (name === "initiated-by-another-automation-trigger") return <div className="apf-contract-note"><b>Fonte: Api-request-1</b><p>A automação chamadora escolhe iniciar este fluxo pela ação “Iniciar outra automação”.</p></div>;
    return null;
  }
  if (kind === "condition") {
    if (name === "lead-has-business-on-pipeline") return <label>Funil{pipelineSelect}</label>;
    if (name === "lead-has-business-on-stage") return <div className="apf-inline-fields"><label>Funil{pipelineSelect}</label><label>Etapa{stageSelect}</label></div>;
    if (name === "lead-has-tag") return <label>Tag<input list="apf-tags" value={String(options.tag ?? "")} onChange={(event) => update({ tag: event.target.value })} /></label>;
    if (name === "lead-has-attendant") return <label>Corretor<select value={String(options.corretor ?? "")} onChange={(event) => update({ corretor: event.target.value })}><option value="">Qualquer corretor</option>{references.corretores.map((item) => <option key={item.id} value={item.nome}>{item.nome}</option>)}</select></label>;
    if (["field-equals", "field-contains", "field-has-value", "field-between"].includes(name)) return <><label>Campo<input value={String(options.campo ?? "")} placeholder="lead.nome" onChange={(event) => update({ campo: event.target.value })} /></label>{["field-equals", "field-contains"].includes(name) && <label>Valor<input value={String(options.valor ?? "")} onChange={(event) => update({ valor: event.target.value })} /></label>}{name === "field-between" && <div className="apf-inline-fields"><label>Mínimo<input type="number" value={String(options.min ?? "")} onChange={(event) => update({ min: event.target.value === "" ? null : Number(event.target.value) })} /></label><label>Máximo<input type="number" value={String(options.max ?? "")} onChange={(event) => update({ max: event.target.value === "" ? null : Number(event.target.value) })} /></label></div>}</>;
    if (name === "lead-respondeu") return <label>Janela em horas<input type="number" min="1" value={Number(options.janela_horas ?? 24)} onChange={(event) => update({ janela_horas: Number(event.target.value) })} /></label>;
    if (name === "time-day-hour") return <div className="apf-inline-fields"><label>Hora inicial<input type="time" value={String(options.hora_inicio ?? "09:00")} onChange={(event) => update({ hora_inicio: event.target.value })} /></label><label>Hora final<input type="time" value={String(options.hora_fim ?? "18:00")} onChange={(event) => update({ hora_fim: event.target.value })} /></label></div>;
    return null;
  }
  if (["create-business-action", "move-business-action"].includes(name)) return <div className="apf-inline-fields"><label>Funil{pipelineSelect}</label><label>Etapa{stageSelect}</label></div>;
  if (["create-tags-action", "add-tag-action", "remove-tag-action"].includes(name)) return <label>Tag<input list="apf-tags" value={String(options.tag ?? "")} onChange={(event) => update({ tag: event.target.value })} /></label>;
  if (["add-attendant-on-business-action", "assign-lead-attendant-action"].includes(name)) return <label>Corretor<select value={String(options.corretor ?? "")} onChange={(event) => update({ corretor: event.target.value })}><option value="">Escolha o corretor</option>{references.corretores.map((item) => <option key={item.id} value={item.nome}>{item.nome}</option>)}</select></label>;
  if (name === "business-lose-action") return <label>Motivo<input value={String(options.motivo ?? "")} onChange={(event) => update({ motivo: event.target.value })} /></label>;
  if (name === "set-lead-momento-action") return <label>Momento<select value={String(options.momento ?? "")} onChange={(event) => update({ momento: event.target.value })}><option value="">Escolha o momento</option>{references.momentos.map((item) => <option key={item.slug ?? item.id} value={item.slug}>{item.rotulo ?? item.nome}</option>)}</select></label>;
  if (name === "start-another-automation-action") return <label>Automação<select value={String(options.automacao ?? "")} onChange={(event) => update({ automacao: event.target.value })}><option value="">Escolha a automação</option>{references.automacoes.map((item) => <option key={item.id} value={item.nome}>{item.nome}</option>)}</select></label>;
  if (name === "apply-ai-analysis-action") return <div className="apf-contract-note"><b>Aplicar explicitamente</b>{[["aplicarMomento", "Momento"], ["aplicarEtapa", "Etapa"], ["aplicarTemperatura", "Temperatura"], ["aplicarAcao", "Próxima ação e prazo"], ["aplicarQualidade", "Nota do atendimento"]].map(([key, label]) => <label className="apf-toggle-row" key={key}><input type="checkbox" checked={options[key] !== false} onChange={(event) => update({ [key]: event.target.checked })} /><span>{label}</span></label>)}</div>;
  return null;
}

function NodeInspector({ node, references, flow, webhookUrl, onClose, onChange }: { node: FlowNode; references: ReferenceData; flow: FlowModel; webhookUrl: string; onClose: () => void; onChange: (node: FlowNode) => void }) {
  const presentation = nodePresentation(node);
  const mutateOptions = (changes: Record<string, unknown>) => onChange({ ...node, options: { ...node.options, ...changes } });
  const triggers = Array.isArray(node.options.triggers) ? node.options.triggers as Array<Record<string, unknown>> : [];
  const actions = Array.isArray(node.options.actions) ? node.options.actions as Array<Record<string, unknown>> : [];
  const conditions = Array.isArray(node.options.conditions) ? node.options.conditions as Array<Record<string, unknown>> : [];
  const fieldOperations = Array.isArray(node.options.fieldOperations) ? node.options.fieldOperations as Array<Record<string, unknown>> : [];
  const distribution = (node.options.distribuicao ?? {}) as Record<string, unknown>;
  const distributionItems = Array.isArray(distribution.items) ? distribution.items as Array<Record<string, unknown>> : [];
  const approachIds = Array.isArray(node.options.abordagemIds) ? node.options.abordagemIds.map(Number) : [];
  const approachRoutes = node.options.instanciaPorCorretor && typeof node.options.instanciaPorCorretor === "object" ? node.options.instanciaPorCorretor as Record<string, unknown> : {};
  const upstreamIds = new Set<string>(); const upstreamQueue = [node.id];
  while (upstreamQueue.length) { const current = upstreamQueue.pop()!; flow.wires.filter((wire) => wire.to === current).forEach((wire) => { if (!upstreamIds.has(wire.from)) { upstreamIds.add(wire.from); upstreamQueue.push(wire.from); } }); }
  const distributedNames = new Set(flow.nodes.filter((item) => upstreamIds.has(item.id) && item.type === "distribution-simple").flatMap((item) => { const config = (item.options.distribuicao ?? {}) as Record<string, unknown>; return (Array.isArray(config.items) ? config.items as Array<Record<string, unknown>> : []).filter((candidate) => candidate.on !== false && Number(candidate.peso ?? 0) > 0).map((candidate) => String(candidate.corretor ?? "").toLocaleLowerCase("pt-BR")); }));
  const approachMembers = references.corretores.filter((item) => distributedNames.has(item.nome.toLocaleLowerCase("pt-BR")));
  const trigger = triggers[0] ?? { name: "json-http-request-trigger", group: "system", options: {} };
  const triggerOptions = trigger.options && typeof trigger.options === "object" ? trigger.options as Record<string, unknown> : {};
  return <aside className={`apf-library apf-inspector type-${node.type}`}><header><div><b>{presentation.title}</b><small>{presentation.type}</small></div><button type="button" aria-label="Fechar propriedades" onClick={onClose}>{svgIcon("close")}</button></header><div className="apf-inspector-body"><label>Título do bloco<input value={node.sub ?? ""} placeholder={presentation.title} onChange={(event) => onChange({ ...node, sub: event.target.value })} /></label>
    {node.type === "trigger" && <section><label>Tipo de gatilho<select value={String(trigger.name)} onChange={(event) => mutateOptions({ triggers: [{ ...trigger, name: event.target.value, group: "system", options: {} }] })}>{TRIGGER_CATALOG.map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label><ContractOptionFields kind="trigger" name={String(trigger.name)} options={triggerOptions} references={references} onChange={(options) => mutateOptions({ triggers: [{ ...trigger, options }] })} />{String(trigger.name) === "json-http-request-trigger" && <div className="apf-contract-note"><b>URL do webhook</b><p>{webhookUrl || "Salve a automação para gerar a URL."}</p></div>}</section>}
    {node.type === "field-operation" && <section><h3>Operações de campos publicáveis</h3>{fieldOperations.map((operation, index) => { const operationOptions = operation.options && typeof operation.options === "object" ? operation.options as Record<string, unknown> : operation; return <div className="apf-field-row" key={index}><input value={String(operationOptions.parameter ?? "")} placeholder="Destino: lead.nome" onChange={(event) => { const next = [...fieldOperations]; next[index] = { ...operation, name: String(operation.name ?? "set-field-operation"), group: String(operation.group ?? "field"), options: { ...operationOptions, parameter: event.target.value } }; mutateOptions({ fieldOperations: next }); }} /><input value={String(operationOptions.value ?? "")} placeholder="Origem: [Api-request-1]nome" onChange={(event) => { const next = [...fieldOperations]; next[index] = { ...operation, name: String(operation.name ?? "set-field-operation"), group: String(operation.group ?? "field"), options: { ...operationOptions, value: event.target.value } }; mutateOptions({ fieldOperations: next }); }} /><button type="button" onClick={() => mutateOptions({ fieldOperations: fieldOperations.filter((_, itemIndex) => itemIndex !== index) })}>×</button></div>; })}<button type="button" className="apf-add-row" onClick={() => mutateOptions({ fieldOperations: [...fieldOperations, { name: "set-field-operation", group: "field", options: { parameter: "", value: "" } }] })}>＋ Mapear campo</button></section>}
    {node.type === "action" && <section><h3>Ações publicáveis</h3>{actions.map((action, index) => { const actionOptions = action.options && typeof action.options === "object" ? action.options as Record<string, unknown> : {}; return <div className="apf-config-card" key={index}><div className="apf-select-row"><select value={String(action.name ?? "create-business-action")} onChange={(event) => { const next = [...actions]; next[index] = { ...action, name: event.target.value, group: "system", options: {} }; mutateOptions({ actions: next }); }}>{ACTION_OPTIONS.map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select><button type="button" onClick={() => mutateOptions({ actions: actions.filter((_, itemIndex) => itemIndex !== index) })}>×</button></div><ContractOptionFields kind="action" name={String(action.name ?? "")} options={actionOptions} references={references} onChange={(options) => { const next = [...actions]; next[index] = { ...action, options }; mutateOptions({ actions: next }); }} /></div>; })}<button type="button" className="apf-add-row" onClick={() => mutateOptions({ actions: [...actions, { name: "create-business-action", group: "business", options: {} }] })}>＋ Adicionar ação</button></section>}
    {node.type === "condition" && <section><h3>Condições publicáveis</h3>{conditions.map((condition, index) => { const conditionOptions = condition.options && typeof condition.options === "object" ? condition.options as Record<string, unknown> : {}; return <div className="apf-config-card" key={index}><div className="apf-select-row"><select value={String(condition.name ?? "lead-exists")} onChange={(event) => { const next = [...conditions]; next[index] = { ...condition, id: condition.id ?? `k${flow.uid + index}`, name: event.target.value, options: {} }; mutateOptions({ conditions: next }); }}>{CONDITION_OPTIONS.map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select><button type="button" onClick={() => mutateOptions({ conditions: conditions.filter((_, itemIndex) => itemIndex !== index) })}>×</button></div><ContractOptionFields kind="condition" name={String(condition.name ?? "")} options={conditionOptions} references={references} onChange={(options) => { const next = [...conditions]; next[index] = { ...condition, options }; mutateOptions({ conditions: next }); }} /></div>; })}<button type="button" className="apf-add-row" onClick={() => mutateOptions({ conditions: [...conditions, { id: `k${flow.uid + conditions.length}`, name: "lead-exists", group: "lead", options: {} }] })}>＋ Adicionar condição</button></section>}
    {node.type === "randomizer" && <section><h3>Caminhos</h3>{(node.ramos ?? []).map((branch) => <div className="apf-branch-row" key={branch.id}><input value={branch.name ?? ""} onChange={(event) => onChange({ ...node, ramos: (node.ramos ?? []).map((item) => item.id === branch.id ? { ...item, name: event.target.value } : item) })} /><input type="number" min="0" max="100" value={branch.perc ?? 0} onChange={(event) => onChange({ ...node, ramos: (node.ramos ?? []).map((item) => item.id === branch.id ? { ...item, perc: Number(event.target.value) } : item) })} /><span>%</span></div>)}</section>}
    {node.type === "distribution-simple" && <section><h3>Corretores</h3>{references.corretores.map((corretor) => { const current = distributionItems.find((item) => String(item.corretor ?? "").toLocaleLowerCase("pt-BR") === corretor.nome.toLocaleLowerCase("pt-BR")); const checked = current?.on !== false && Boolean(current); return <label className="apf-check-row" key={corretor.id}><input type="checkbox" checked={checked} onChange={(event) => { const next = distributionItems.filter((item) => String(item.corretor ?? "").toLocaleLowerCase("pt-BR") !== corretor.nome.toLocaleLowerCase("pt-BR")); next.push({ corretor: corretor.nome, peso: Number(current?.peso ?? 1), on: event.target.checked }); mutateOptions({ distribuicao: { ...distribution, items: next } }); }} /><span>{corretor.nome}</span><input type="number" min="0" value={Number(current?.peso ?? 1)} onChange={(event) => { const next = distributionItems.filter((item) => String(item.corretor ?? "").toLocaleLowerCase("pt-BR") !== corretor.nome.toLocaleLowerCase("pt-BR")); next.push({ corretor: corretor.nome, peso: Number(event.target.value), on: checked }); mutateOptions({ distribuicao: { ...distribution, items: next } }); }} /></label>; })}<label className="apf-toggle-row"><input type="checkbox" checked={distribution.onlineOnly !== false} onChange={(event) => mutateOptions({ distribuicao: { ...distribution, onlineOnly: event.target.checked } })} /><span>Somente corretores online</span></label><div className="apf-contract-note"><b>Proteções</b><p>Venda · visita agendada · visita realizada</p></div></section>}
    {node.type === "send-approach" && <section><label>Grupo de abordagens<select value={String(node.options.abordagemGrupo ?? "")} onChange={(event) => mutateOptions({ abordagemGrupo: event.target.value, abordagemIds: [] })}><option value="">Escolha o grupo</option>{[...new Set(references.abordagens.map((item) => item.grupo).filter(Boolean))].map((group) => <option key={group!} value={group!}>{group}</option>)}</select></label><h3>Seleção em round-robin</h3>{references.abordagens.filter((item) => !node.options.abordagemGrupo || item.grupo === node.options.abordagemGrupo).map((approach) => <label className="apf-check-row" key={approach.id}><input type="checkbox" checked={approachIds.includes(approach.id)} onChange={(event) => mutateOptions({ abordagemIds: event.target.checked ? [...approachIds, approach.id] : approachIds.filter((id) => id !== approach.id) })} /><span>{approach.nome}</span><small>{approach.mensagens?.length ?? 0} partes</small></label>)}<h3>Instância de cada corretor</h3>{approachMembers.length ? approachMembers.map((member) => <label key={member.id}>{member.nome}<select value={Number(approachRoutes[String(member.id)] ?? 0)} onChange={(event) => mutateOptions({ instanciaPorCorretor: { ...approachRoutes, [String(member.id)]: Number(event.target.value) || 0 } })}><option value={0}>Escolha a instância conectada</option>{references.instancias.filter((instance) => Number(instance.corretor_id) === member.id && instance.ativa !== false && instance.conectada === true && instance.status_dapi === "connected").map((instance) => <option key={instance.id} value={instance.id}>{instance.nome}</option>)}</select></label>) : <div className="apf-contract-note"><b>Nenhum corretor recebido</b><p>Conecte este passo depois de “Distribuir lead”.</p></div>}<div className="apf-contract-note"><b>Ordem das partes</b><p>Vídeo → Texto</p><label className="apf-toggle-row"><input type="checkbox" checked={node.options.stopOnFailure !== false} onChange={(event) => mutateOptions({ stopOnFailure: event.target.checked })} /><span>Interromper se uma parte falhar</span></label></div></section>}
    {node.type === "resposta" && <div className="apf-inline-fields"><label>Janela<input type="number" min="1" value={Number(node.options.janelaValor ?? 12)} onChange={(event) => mutateOptions({ janelaValor: Number(event.target.value) })} /></label><label>Unidade<select value={String(node.options.janelaUnidade ?? "horas")} onChange={(event) => mutateOptions({ janelaUnidade: event.target.value })}><option>minutos</option><option>horas</option><option>dias</option></select></label></div>}
    {node.type === "time" && <div className="apf-inline-fields"><label>Duração<input type="number" min="1" value={Number(node.options.valor ?? 5)} onChange={(event) => mutateOptions({ valor: Number(event.target.value) })} /></label><label>Unidade<select value={String(node.options.unidade ?? "minutos")} onChange={(event) => mutateOptions({ unidade: event.target.value, wait_type: `wait-${event.target.value}` })}><option>segundos</option><option>minutos</option><option>horas</option><option>dias</option></select></label></div>}
    {node.type === "ai-agent" && <label>Agente<select value={Number(node.options.agenteId ?? 0)} onChange={(event) => mutateOptions({ agenteId: Number(event.target.value), funcao: "analisar_atendimento" })}><option value={0}>Escolha um agente</option>{references.agentes.map((agent) => <option key={agent.id} value={agent.id}>{agent.nome}</option>)}</select></label>}
    <section className="apf-output-contract"><h3>Saídas</h3>{nodePorts(node).map((port) => <div key={port.key} className={port.error ? "is-error" : ""}><span><i />{port.label}</span><em>{flow.wires.some((wire) => wire.from === node.id && wire.port === port.key) ? "conectada" : "não conectada"}</em></div>)}</section><details><summary>Contrato do bloco</summary><pre>{JSON.stringify(node.options, null, 2)}</pre></details></div><footer><button type="button" className="apf-primary" onClick={onClose}>Salvar</button><button type="button" onClick={onClose}>Fechar</button></footer></aside>;
}
