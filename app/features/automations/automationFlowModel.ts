export type AutomationBlock = {
  id: string;
  type: string;
  options: Record<string, unknown>;
  presentation?: { x?: number; y?: number };
  sourceBlockId?: string;
};

export type AutomationWire = { from: string; port: string; to: string };

export type AutomationMap = {
  editor?: {
    uid?: number;
    notes?: Record<string, unknown>;
    wires?: AutomationWire[];
    blocks?: Record<string, {
      id?: string;
      fam?: string;
      sub?: string;
      x?: number;
      y?: number;
      note?: string;
      ramos?: Array<{ id: string; name?: string; perc?: number }>;
      extra?: { sourceBlockId?: string };
    }>;
  };
  automation?: {
    name?: string;
    provider?: string;
    anotacoes?: unknown[];
    blocks?: AutomationBlock[];
  };
};

export type FlowNode = AutomationBlock & {
  x: number;
  y: number;
  note?: string;
  sub?: string;
  ramos?: Array<{ id: string; name?: string; perc?: number }>;
};

export type FlowModel = {
  uid: number;
  name: string;
  provider: string;
  anotacoes: unknown[];
  notes: Record<string, unknown>;
  nodes: FlowNode[];
  wires: AutomationWire[];
};

export type FlowIssue = {
  level: "block" | "warning";
  nodeId?: string;
  title: string;
  detail: string;
};

export const TRIGGER_CATALOG = [
  ["json-http-request-trigger", "Webhook HTTP", "Recebe um POST JSON por URL única", "Entrada e integração"],
  ["site-lead-created-trigger", "Lead criado no site", "Começa quando o formulário cria um lead", "Entrada e integração"],
  ["initiated-by-another-automation-trigger", "Iniciada por outra automação", "Recebe dados de outro fluxo", "Entrada e integração"],
  ["manually-lead-trigger", "Manual", "Iniciada por uma pessoa", "Entrada e integração"],
  ["tag-added-trigger", "Tag adicionada", "Observa uma tag aplicada ao lead", "Lead e CRM"],
  ["lead-entered-stage-trigger", "Entrou na etapa", "Dispara ao entrar em uma etapa", "Lead e CRM"],
  ["lead-moved-stage-trigger", "Mudou de etapa", "Dispara em uma mudança de etapa", "Lead e CRM"],
  ["lead-distribuido-trigger", "Lead distribuído", "Começa depois da atribuição", "Lead e CRM"],
  ["lead-entrou-momento-trigger", "Entrou no momento", "Observa a jornada do atendimento", "Lead e CRM"],
  ["momento-prazo-vencido-trigger", "Venceu o prazo do momento", "Dispara quando o prazo operacional vence", "Lead e CRM"],
  ["retomar-na-data-trigger", "Chegou a data de retomar", "Retoma o lead na data combinada", "Lead e CRM"],
  ["lead-mensagem-recebida-trigger", "Chegou mensagem do lead", "Observa uma mensagem recebida", "Conversa"],
  ["lead-mensagem-enviada-trigger", "Corretor enviou mensagem", "Observa uma mensagem enviada", "Conversa"],
  ["checagem-diaria-trigger", "Relógio de recuperação da Sara", "Reavalia leads devidos com segurança", "Sistema e IA"],
] as const;

export const TRIGGER_LABELS = Object.fromEntries(TRIGGER_CATALOG.map(([key, label]) => [key, label]));

export const BLOCK_LIBRARY = [
  { type: "trigger", category: "Entrada", label: "Início", description: "gatilho da automação", tone: "orange" },
  { type: "field-operation", category: "Dados", label: "Operações de campos", description: "4 operações", tone: "slate" },
  { type: "condition", category: "Lógica", label: "Condição", description: "20 tipos", tone: "purple" },
  { type: "randomizer", category: "Lógica", label: "Randomizador", description: "divide o tráfego", tone: "purple" },
  { type: "distribution-simple", category: "Distribuição", label: "Distribuir lead", description: "simples", tone: "purple" },
  { type: "send-approach", category: "Mensagem", label: "Enviar abordagem", description: "corretor do lead", tone: "orange" },
  { type: "resposta", category: "Mensagem", label: "Aguardar resposta", description: "com prazo", tone: "orange" },
  { type: "time", category: "Tempo", label: "Espera", description: "adia a execução", tone: "slate" },
  { type: "ai-agent", category: "Inteligência", label: "Agente de IA", description: "analisa e devolve", tone: "purple" },
  { type: "action", category: "CRM", label: "Ação", description: "17 ações", tone: "orange" },
] as const;

const FAMILY_BY_TYPE: Record<string, string> = {
  trigger: "gatilho",
  "field-operation": "mapeamento",
  condition: "condicao",
  action: "acao",
  randomizer: "randomizador",
  "distribution-simple": "distribuicao_simples",
  "send-approach": "mensagem",
  resposta: "resposta",
  time: "espera",
  "ai-agent": "agente",
};

const TYPE_BY_FAMILY = Object.fromEntries(Object.entries(FAMILY_BY_TYPE).map(([type, family]) => [family, type]));

function copy<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function routeWires(block: AutomationBlock): AutomationWire[] {
  const options = block.options ?? {};
  const routes: AutomationWire[] = [];
  const add = (port: string, target: unknown) => {
    if (typeof target === "string" && target) routes.push({ from: block.id, port, to: target });
  };
  add("out", options.nextBlockId);
  add("err", options.errorNextBlockId);
  add("true", options.trueNextBlockId);
  add("false", options.falseNextBlockId);
  add("timeout", options.timeoutNextBlockId);
  add("respondeu", options.respondeuNextBlockId);
  add("naoRespondeu", options.naoRespondeuNextBlockId);
  const randomizers = Array.isArray(options.randomizers) ? options.randomizers : [];
  randomizers.forEach((branch) => {
    if (branch && typeof branch === "object") {
      const item = branch as Record<string, unknown>;
      if (typeof item.id === "string") add(item.id, item.nextBlockId);
    }
  });
  return routes;
}

export function hydrateFlow(map: AutomationMap | null | undefined, fallbackName: string): FlowModel {
  const source = map ?? {};
  const editor = source.editor ?? {};
  const automation = source.automation ?? {};
  const storedBlocks = automation.blocks ?? [];
  const byId = new Map(storedBlocks.map((block) => [block.id, block]));
  const editorBlocks = editor.blocks ?? {};
  const ids = Object.keys(editorBlocks).length ? Object.keys(editorBlocks) : storedBlocks.map((block) => block.id);
  const nodes = ids.map((id, index): FlowNode => {
    const stored = byId.get(id);
    const visual = editorBlocks[id] ?? {};
    const type = stored?.type ?? TYPE_BY_FAMILY[visual.fam ?? ""] ?? "action";
    const options = copy(stored?.options ?? {});
    ["nextBlockId", "errorNextBlockId", "trueNextBlockId", "falseNextBlockId", "timeoutNextBlockId", "respondeuNextBlockId", "naoRespondeuNextBlockId"].forEach((key) => delete options[key]);
    const randomizers = Array.isArray(options.randomizers) ? options.randomizers as Array<Record<string, unknown>> : [];
    const ramos = visual.ramos?.length
      ? copy(visual.ramos)
      : randomizers.map((item) => ({ id: String(item.id ?? ""), name: String(item.name ?? ""), perc: Number(item.perc ?? 0) }));
    if (type === "randomizer") delete options.randomizers;
    return {
      id,
      type,
      options,
      x: visual.x ?? stored?.presentation?.x ?? 120 + index * 390,
      y: visual.y ?? stored?.presentation?.y ?? 220,
      note: visual.note ?? "",
      sub: visual.sub ?? "",
      ramos,
      sourceBlockId: stored?.sourceBlockId ?? visual.extra?.sourceBlockId,
    };
  });
  const nodeIds = new Set(nodes.map((node) => node.id));
  const wires = (editor.wires?.length ? copy(editor.wires) : storedBlocks.flatMap(routeWires))
    .filter((wire) => nodeIds.has(wire.from) && nodeIds.has(wire.to));
  return {
    uid: editor.uid ?? 100,
    name: automation.name ?? fallbackName,
    provider: automation.provider ?? "apecerto-erp",
    anotacoes: copy(automation.anotacoes ?? []),
    notes: copy(editor.notes ?? {}),
    nodes,
    wires,
  };
}

function uuid() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `source-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function compileFlow(flow: FlowModel): AutomationMap {
  flow.nodes.forEach((node) => {
    if (!node.sourceBlockId) node.sourceBlockId = uuid();
  });
  const targetByPort = (nodeId: string, port: string) => flow.wires.find((wire) => wire.from === nodeId && wire.port === port)?.to ?? "";
  const blocks = flow.nodes.map((node): AutomationBlock => {
    const options = copy(node.options ?? {});
    if (node.type === "condition") {
      options.trueNextBlockId = targetByPort(node.id, "true");
      options.falseNextBlockId = targetByPort(node.id, "false");
    } else if (node.type === "randomizer") {
      options.randomizers = (node.ramos ?? []).map((branch) => ({ ...branch, nextBlockId: targetByPort(node.id, branch.id) }));
    } else if (node.type === "resposta") {
      options.respondeuNextBlockId = targetByPort(node.id, "respondeu");
      options.naoRespondeuNextBlockId = targetByPort(node.id, "naoRespondeu");
    } else {
      options.nextBlockId = targetByPort(node.id, "out");
      if (["action", "field-operation", "distribution-simple", "send-approach", "ai-agent"].includes(node.type)) {
        options.errorNextBlockId = targetByPort(node.id, "err");
      }
    }
    return {
      id: node.id,
      type: node.type,
      options,
      presentation: { x: Math.round(node.x), y: Math.round(node.y) },
      sourceBlockId: node.sourceBlockId,
    };
  });
  const editorBlocks: NonNullable<NonNullable<AutomationMap["editor"]>["blocks"]> = {};
  flow.nodes.forEach((node) => {
    editorBlocks[node.id] = {
      id: node.id,
      fam: FAMILY_BY_TYPE[node.type] ?? "acao",
      sub: node.sub ?? "",
      x: Math.round(node.x),
      y: Math.round(node.y),
      note: node.note ?? "",
      ramos: copy(node.ramos ?? []),
      extra: { sourceBlockId: node.sourceBlockId },
    };
  });
  return {
    editor: { uid: flow.uid, notes: copy(flow.notes), wires: copy(flow.wires), blocks: editorBlocks },
    automation: { name: flow.name, provider: flow.provider, anotacoes: copy(flow.anotacoes), blocks },
  };
}

export function triggerFromMap(map: AutomationMap | null | undefined) {
  const block = map?.automation?.blocks?.find((item) => item.type === "trigger" || item.type.endsWith("-trigger"));
  const triggers = block?.options?.triggers;
  const first = Array.isArray(triggers) ? triggers[0] as Record<string, unknown> | undefined : undefined;
  const key = block?.type === "trigger" ? String(first?.name ?? "no-trigger") : String(block?.type ?? "no-trigger");
  return { key, label: TRIGGER_LABELS[key] ?? "Gatilho não identificado" };
}

export function createNode(type: string, uid: number, x: number, y: number): FlowNode {
  const node: FlowNode = { id: `b${uid}`, type, options: {}, x, y, ramos: [], sourceBlockId: uuid() };
  if (type === "trigger") node.options.triggers = [{ name: "json-http-request-trigger", group: "system", options: {} }];
  if (type === "field-operation") node.options.fieldOperations = [];
  if (type === "condition") node.options.conditions = [];
  if (type === "action") node.options.actions = [];
  if (type === "randomizer") node.ramos = [{ id: `r${uid + 1}`, name: "A", perc: 50 }, { id: `r${uid + 2}`, name: "B", perc: 50 }];
  if (type === "distribution-simple") node.options.distribuicao = { items: [], onlineOnly: true, tambemNegocio: true, protecao: ["venda", "visita_agendada", "visita_realizada"] };
  if (type === "send-approach") Object.assign(node.options, { produtoId: 0, abordagemGrupo: "", abordagemIds: [], selectionMode: "round-robin", instanciaPorCorretor: {} });
  if (type === "resposta") Object.assign(node.options, { janelaValor: 12, janelaUnidade: "horas" });
  if (type === "time") Object.assign(node.options, { wait_type: "wait-minutes", valor: 5, unidade: "minutos" });
  if (type === "ai-agent") Object.assign(node.options, { agenteId: 0, funcao: "analisar_atendimento" });
  return node;
}

export function nodePorts(node: FlowNode) {
  if (node.type === "condition") return [{ key: "true", label: "Então" }, { key: "false", label: "Senão", error: true }];
  if (node.type === "randomizer") return (node.ramos ?? []).map((item) => ({ key: item.id, label: `${item.name || "Caminho"} · ${item.perc ?? 0}%` }));
  if (node.type === "resposta") return [{ key: "respondeu", label: "Respondeu" }, { key: "naoRespondeu", label: "Não respondeu", error: true }];
  if (node.type === "trigger") return [{ key: "out", label: "Então" }];
  if (["action", "field-operation", "distribution-simple", "ai-agent"].includes(node.type)) return [{ key: "out", label: "Próximo passo" }, { key: "err", label: "Erro", error: true }];
  if (node.type === "send-approach") return [{ key: "out", label: "Próximo passo" }, { key: "err", label: "Falha de entrega", error: true }];
  return [{ key: "out", label: "Próximo passo" }];
}

function asArray(value: unknown) {
  return Array.isArray(value) ? value : [];
}

function nestedOptions(value: unknown) {
  if (!value || typeof value !== "object") return {} as Record<string, unknown>;
  const item = value as Record<string, unknown>;
  return item.options && typeof item.options === "object" ? item.options as Record<string, unknown> : item;
}

export function nodePresentation(node: FlowNode) {
  const opts = node.options ?? {};
  if (node.type === "trigger") {
    const first = asArray(opts.triggers)[0] as Record<string, unknown> | undefined;
    return { type: "Início", title: TRIGGER_LABELS[String(first?.name ?? "")] ?? "Escolha o gatilho", lines: ["Entrada da automação"] };
  }
  if (node.type === "field-operation") return { type: "Operações de campos", title: node.sub || "Mapear dados recebidos", lines: [`${asArray(opts.fieldOperations).length} campos normalizados`] };
  if (node.type === "distribution-simple") {
    const distribution = (opts.distribuicao ?? {}) as Record<string, unknown>;
    const active = asArray(distribution.items).filter((item) => (item as Record<string, unknown>).on !== false).length;
    return { type: "Distribuir lead", title: node.sub || "Escolher e atribuir corretor", lines: [`${active} corretores · ${distribution.onlineOnly === false ? "todos configurados" : "somente online"}`, "Proteções ativas"] };
  }
  if (node.type === "send-approach") return { type: "Enviar abordagem", title: node.sub || "Abordagem de entrada", lines: ["1  Vídeo", "2  Texto"] };
  if (node.type === "action") {
    const actions = asArray(opts.actions) as Array<Record<string, unknown>>;
    const name = String(actions[0]?.name ?? "");
    const labels: Record<string, string> = { "create-business-action": "Criar negócio", "send-notification-action": "Notificar corretor", "start-another-automation-action": "Iniciar outra automação" };
    return { type: "Ação", title: node.sub || labels[name] || "Configurar ação", lines: [actions.length ? `${actions.length} ação configurada` : "Nenhuma ação configurada"] };
  }
  if (node.type === "condition") return { type: "Condição", title: node.sub || "Avaliar condições", lines: [`${asArray(opts.conditions).length} condições`] };
  if (node.type === "randomizer") return { type: "Randomizador", title: node.sub || "Dividir tráfego", lines: [`${node.ramos?.length ?? 0} caminhos`] };
  if (node.type === "resposta") return { type: "Aguardar resposta", title: node.sub || "Aguardar o lead", lines: [`${String(opts.janelaValor ?? 12)} ${String(opts.janelaUnidade ?? "horas")}`] };
  if (node.type === "time") return { type: "Espera", title: node.sub || "Aguardar", lines: [`${String(opts.valor ?? 5)} ${String(opts.unidade ?? "minutos")}`] };
  if (node.type === "ai-agent") return { type: "Agente de IA", title: node.sub || "Analisar atendimento", lines: [opts.agenteId ? "Agente definido" : "Escolha um agente"] };
  return { type: "Bloco", title: node.sub || node.type, lines: [] };
}

export function validateFlow(flow: FlowModel): FlowIssue[] {
  const issues: FlowIssue[] = [];
  const supportedTypes = new Set(BLOCK_LIBRARY.map((item) => item.type));
  const supportedTriggers = new Set(TRIGGER_CATALOG.map((item) => item[0]));
  const supportedActions = new Set(["create-lead-action", "create-business-action", "move-business-action", "business-win-action", "business-restore-action", "business-lose-action", "add-attendant-on-business-action", "clean-attendant-on-business-action", "assign-lead-attendant-action", "clean-lead-attendant-action", "create-tags-action", "add-tag-action", "remove-tag-action", "set-lead-momento-action", "apply-ai-analysis-action", "send-notification-action", "start-another-automation-action"]);
  const supportedConditions = new Set(["business-has-attendants", "business-no-attendants", "business-won", "business-lost", "business-pending", "lead-exists", "lead-has-business-on-pipeline", "lead-has-business-on-stage", "lead-email-exists", "lead-name-exists", "lead-phone-exists", "lead-cpf-exists", "lead-has-tag", "lead-has-attendant", "time-day-hour", "lead-respondeu", "field-equals", "field-contains", "field-has-value", "field-between"]);
  const supportedWaits = new Set(["wait-seconds", "wait-minutes", "wait-hours", "wait-days"]);
  const incoming = new Set(flow.wires.map((wire) => wire.to));
  const outgoing = new Map<string, string[]>();
  const reverse = new Map<string, string[]>();
  flow.wires.forEach((wire) => { outgoing.set(wire.from, [...(outgoing.get(wire.from) ?? []), wire.to]); reverse.set(wire.to, [...(reverse.get(wire.to) ?? []), wire.from]); });
  const hasOut = (id: string, port: string) => flow.wires.some((wire) => wire.from === id && wire.port === port);
  const hasUpstreamType = (id: string, type: string) => {
    const seen = new Set<string>(); const queue = [...(reverse.get(id) ?? [])];
    while (queue.length) { const current = queue.pop()!; if (seen.has(current)) continue; seen.add(current); if (flow.nodes.some((node) => node.id === current && node.type === type)) return true; queue.push(...(reverse.get(current) ?? [])); }
    return false;
  };
  const triggers = flow.nodes.filter((node) => node.type === "trigger");
  if (triggers.length !== 1) issues.push({ level: "block", title: "O fluxo precisa de um único início", detail: `Foram encontrados ${triggers.length}.` });
  const reachable = new Set<string>(); const queue = triggers.map((node) => node.id);
  while (queue.length) { const id = queue.pop()!; if (reachable.has(id)) continue; reachable.add(id); queue.push(...(outgoing.get(id) ?? [])); }
  flow.nodes.forEach((node) => {
    if (!supportedTypes.has(node.type as (typeof BLOCK_LIBRARY)[number]["type"])) issues.push({ level: "block", nodeId: node.id, title: "Módulo não publicável", detail: `O motor determinístico não reconhece “${node.type}”.` });
    if (node.type !== "trigger" && (!incoming.has(node.id) || !reachable.has(node.id))) issues.push({ level: "block", nodeId: node.id, title: "Bloco fora da jornada", detail: "Conecte este bloco a um caminho que começa no gatilho." });
    if (node.type === "trigger") {
      const triggerItems = asArray(node.options.triggers) as Array<Record<string, unknown>>;
      const trigger = triggerItems[0]; const name = String(trigger?.name ?? ""); const options = nestedOptions(trigger);
      if (triggerItems.length !== 1 || !supportedTriggers.has(name as (typeof TRIGGER_CATALOG)[number][0])) issues.push({ level: "block", nodeId: node.id, title: "Gatilho não publicável", detail: "Escolha exatamente um gatilho implementado pelo motor." });
      if (["lead-entered-stage-trigger", "lead-moved-stage-trigger"].includes(name) && (!options.pipeline_id || !options.etapa_id)) issues.push({ level: "block", nodeId: node.id, title: "Etapa do gatilho não definida", detail: "Escolha o funil e a etapa." });
      if (name === "tag-added-trigger" && !String(options.tag ?? "").trim()) issues.push({ level: "block", nodeId: node.id, title: "Tag do gatilho não definida", detail: "Escolha a tag observada." });
      if (name === "checagem-diaria-trigger") { const hours = Number(options.intervaloHoras ?? 24); const delay = Number(options.atrasoInteracaoMinutos ?? 10); const limit = Number(options.limitePorCiclo ?? 12); if (hours < 1 || hours > 168 || delay < 0 || delay > 1440 || limit < 1 || limit > 50) issues.push({ level: "block", nodeId: node.id, title: "Relógio da Sara fora dos limites", detail: "Use intervalo de 1–168h, atraso de 0–1440min e lote de 1–50 leads." }); }
    }
    if (node.type === "field-operation") {
      const operations = asArray(node.options.fieldOperations) as Array<Record<string, unknown>>;
      if (!operations.length) issues.push({ level: "block", nodeId: node.id, title: "Operações de campos vazias", detail: "Adicione pelo menos um mapeamento publicável." });
      operations.forEach((operation) => { const options = nestedOptions(operation); const name = String(operation.name ?? "set-field-operation"); if (!["set-field-operation", "parse-phone-field-operation", "store-json-payload-field-operation", "sync-meta-attribution-field-operation", "sync-site-attribution-field-operation"].includes(name)) issues.push({ level: "block", nodeId: node.id, title: "Operação de campo não implementada", detail: name }); if (["set-field-operation", "store-json-payload-field-operation"].includes(name) && !String(options.parameter ?? "").trim()) issues.push({ level: "block", nodeId: node.id, title: "Destino do campo não definido", detail: "Escolha qual campo será alterado." }); });
    }
    if (node.type === "condition") {
      const conditions = asArray(node.options.conditions) as Array<Record<string, unknown>>;
      if (!conditions.length) issues.push({ level: "block", nodeId: node.id, title: "Condição vazia", detail: "Adicione uma condição antes de publicar." });
      conditions.forEach((condition) => { const name = String(condition.name ?? "").replace(/-condition$/, ""); const options = nestedOptions(condition); if (!supportedConditions.has(name)) issues.push({ level: "block", nodeId: node.id, title: "Condição não implementada", detail: name }); if (name === "lead-has-business-on-pipeline" && !options.pipeline_id) issues.push({ level: "block", nodeId: node.id, title: "Funil da condição não definido", detail: "Escolha o funil." }); if (name === "lead-has-business-on-stage" && (!options.pipeline_id || !options.etapa_id)) issues.push({ level: "block", nodeId: node.id, title: "Etapa da condição não definida", detail: "Escolha o funil e a etapa." }); if (name === "lead-has-tag" && !String(options.tag ?? "").trim()) issues.push({ level: "block", nodeId: node.id, title: "Tag da condição não definida", detail: "Escolha uma tag." }); if (["field-equals", "field-contains", "field-has-value", "field-between"].includes(name) && !String(options.campo ?? "").trim()) issues.push({ level: "block", nodeId: node.id, title: "Campo da condição não definido", detail: "Escolha o campo avaliado." }); if (name === "field-between" && options.min == null && options.max == null) issues.push({ level: "block", nodeId: node.id, title: "Intervalo da condição vazio", detail: "Informe um limite mínimo ou máximo." }); if (name === "lead-respondeu" && Number(options.janela_horas ?? 0) <= 0) issues.push({ level: "block", nodeId: node.id, title: "Janela de resposta inválida", detail: "Informe uma quantidade de horas maior que zero." }); });
    }
    if (node.type === "action") {
      const actions = asArray(node.options.actions) as Array<Record<string, unknown>>;
      if (!actions.length) issues.push({ level: "block", nodeId: node.id, title: "Ação vazia", detail: "Escolha uma ação do CRM." });
      actions.forEach((action) => { const name = String(action.name ?? ""); const options = nestedOptions(action); if (!supportedActions.has(name)) issues.push({ level: "block", nodeId: node.id, title: "Ação não implementada", detail: name }); if (["create-tags-action", "add-tag-action", "remove-tag-action"].includes(name) && !String(options.tag ?? "").trim()) issues.push({ level: "block", nodeId: node.id, title: "Tag da ação não definida", detail: "Escolha uma tag." }); if (["create-business-action", "move-business-action"].includes(name) && (!options.pipeline_id || !options.etapa_id)) issues.push({ level: "block", nodeId: node.id, title: "Destino do negócio não definido", detail: "Escolha o funil e a etapa." }); if (["add-attendant-on-business-action", "assign-lead-attendant-action"].includes(name) && !String(options.corretor ?? "").trim()) issues.push({ level: "block", nodeId: node.id, title: "Corretor não definido", detail: "Escolha o corretor." }); if (name === "set-lead-momento-action" && !String(options.momento ?? "").trim()) issues.push({ level: "block", nodeId: node.id, title: "Momento não definido", detail: "Escolha o momento do lead." }); if (name === "start-another-automation-action" && (!String(options.automacao ?? "").trim() || options.automacao === flow.name)) issues.push({ level: "block", nodeId: node.id, title: "Automação de destino inválida", detail: "Escolha outra automação." }); if (name === "apply-ai-analysis-action" && !hasUpstreamType(node.id, "ai-agent")) issues.push({ level: "block", nodeId: node.id, title: "Análise de IA ausente", detail: "Conecte um Agente de IA antes desta ação." }); });
    }
    if (node.type === "send-approach" && !asArray(node.options.abordagemIds).length) issues.push({ level: "block", nodeId: node.id, title: "Abordagem não definida", detail: "Escolha pelo menos uma abordagem." });
    if (node.type === "send-approach") { const ids = asArray(node.options.abordagemIds).map(Number); if (new Set(ids).size !== ids.length) issues.push({ level: "block", nodeId: node.id, title: "Abordagem repetida", detail: "Cada abordagem pode aparecer somente uma vez." }); if (!hasUpstreamType(node.id, "distribution-simple")) issues.push({ level: "block", nodeId: node.id, title: "Corretor não distribuído", detail: "Enviar abordagem precisa receber o corretor de um bloco de distribuição." }); const routes = node.options.instanciaPorCorretor; if (!routes || typeof routes !== "object" || !Object.values(routes as Record<string, unknown>).some((value) => Number(value) > 0)) issues.push({ level: "block", nodeId: node.id, title: "Instâncias de envio não definidas", detail: "Escolha a instância conectada de cada corretor distribuído." }); }
    if (node.type === "ai-agent" && !Number(node.options.agenteId)) issues.push({ level: "block", nodeId: node.id, title: "Agente de IA não definido", detail: "Escolha o agente que fará a análise." });
    if (node.type === "distribution-simple") { const distribution = (node.options.distribuicao ?? {}) as Record<string, unknown>; const items = asArray(distribution.items) as Array<Record<string, unknown>>; if (!items.some((item) => item.on !== false && Number(item.peso ?? 0) > 0)) issues.push({ level: "block", nodeId: node.id, title: "Distribuição sem corretor", detail: "Ative pelo menos um corretor com peso positivo." }); }
    if (node.type === "time" && (!supportedWaits.has(String(node.options.wait_type ?? "")) || Number(node.options.valor ?? 0) <= 0)) issues.push({ level: "block", nodeId: node.id, title: "Espera inválida", detail: "Escolha segundos, minutos, horas ou dias e informe uma duração maior que zero." });
    if (node.type === "randomizer") { const branches = node.ramos ?? []; const total = branches.reduce((sum, branch) => sum + Number(branch.perc ?? 0), 0); if (total !== 100) issues.push({ level: "block", nodeId: node.id, title: "Percentuais não somam 100%", detail: `Total atual: ${total}%.` }); branches.forEach((branch) => { if (!hasOut(node.id, branch.id)) issues.push({ level: "block", nodeId: node.id, title: `Caminho “${branch.name || "sem nome"}” sem destino`, detail: "Conecte todos os caminhos do randomizador." }); }); }
    if (["field-operation", "distribution-simple", "action", "ai-agent"].includes(node.type) && !flow.wires.some((wire) => wire.from === node.id && wire.port === "err")) {
      issues.push({ level: "warning", nodeId: node.id, title: "Saída de erro não conectada", detail: "Uma falha interromperá esta execução e ficará visível na fila." });
    }
    nodePorts(node).forEach((port) => {
      if (["true", "false", "respondeu", "naoRespondeu"].includes(port.key) && !flow.wires.some((wire) => wire.from === node.id && wire.port === port.key)) {
        issues.push({ level: "block", nodeId: node.id, title: `Saída “${port.label}” sem destino`, detail: "Conecte todos os caminhos obrigatórios." });
      }
    });
  });
  const colors = new Map<string, number>(); let cycleNode: string | null = null;
  const visit = (id: string): boolean => { colors.set(id, 1); for (const next of outgoing.get(id) ?? []) { if (colors.get(next) === 1) { cycleNode = next; return true; } if (!colors.has(next) && visit(next)) return true; } colors.set(id, 2); return false; };
  flow.nodes.some((node) => !colors.has(node.id) && visit(node.id));
  if (cycleNode) issues.push({ level: flow.nodes.some((node) => node.type === "time") ? "warning" : "block", nodeId: cycleNode, title: "Ciclo no fluxo", detail: flow.nodes.some((node) => node.type === "time") ? "Confirme que o ciclo sempre passa pela espera." : "Adicione uma espera ou remova o possível loop infinito." });
  return issues;
}
