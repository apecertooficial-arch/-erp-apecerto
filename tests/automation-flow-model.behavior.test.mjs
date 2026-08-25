import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";

const source = readFileSync(
  new URL("../app/features/automations/automationFlowModel.ts", import.meta.url),
  "utf8",
);
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
}).outputText;
const model = await import(`data:text/javascript;base64,${Buffer.from(compiled).toString("base64")}`);

test("hidratação preserva todos os blocos executáveis quando o editor está incompleto", () => {
  const map = {
    automation: {
      name: "Fluxo íntegro",
      blocks: [
        { id: "inicio", type: "trigger", options: { nextBlockId: "acao" } },
        { id: "acao", type: "action", options: { actions: [], nextBlockId: "fim" } },
        { id: "fim", type: "time", options: { wait_type: "wait-minutes", valor: 5 } },
      ],
    },
    editor: {
      blocks: { inicio: { id: "inicio", fam: "gatilho", x: 10, y: 20 } },
      wires: [{ from: "inicio", port: "out", to: "acao" }],
    },
  };

  const flow = model.hydrateFlow(map, "fallback");
  assert.deepEqual(flow.nodes.map((node) => node.id), ["inicio", "acao", "fim"]);
  assert.deepEqual(flow.wires, [
    { from: "inicio", port: "out", to: "acao" },
    { from: "acao", port: "out", to: "fim" },
  ]);
});

test("compilação é pura e não injeta ids no estado React", () => {
  const flow = {
    uid: 2,
    name: "Sem mutação",
    provider: "apecerto-erp",
    anotacoes: [],
    notes: {},
    nodes: [{ id: "b1", type: "trigger", options: { triggers: [] }, x: 0, y: 0 }],
    wires: [],
  };
  const before = structuredClone(flow);
  const compiledFlow = model.compileFlow(flow);

  assert.deepEqual(flow, before);
  assert.equal(typeof compiledFlow.automation.blocks[0].sourceBlockId, "string");
  assert.ok(compiledFlow.automation.blocks[0].sourceBlockId.length > 0);
});

test("organização automática cria camadas sem sobrepor cartões", () => {
  const flow = {
    uid: 5,
    name: "Ramos",
    provider: "apecerto-erp",
    anotacoes: [],
    notes: {},
    nodes: ["a", "b", "c", "d"].map((id) => ({ id, type: id === "a" ? "trigger" : "action", options: {}, x: 0, y: 0 })),
    wires: [
      { from: "a", port: "out", to: "b" },
      { from: "a", port: "err", to: "c" },
      { from: "b", port: "out", to: "d" },
      { from: "c", port: "out", to: "d" },
    ],
  };
  const arranged = model.arrangeFlow(flow);
  const coordinates = arranged.nodes.map((node) => `${node.x}:${node.y}`);
  assert.equal(new Set(coordinates).size, coordinates.length);
  assert.ok(arranged.nodes.find((node) => node.id === "d").x > arranged.nodes.find((node) => node.id === "a").x);
});

test("simulação percorre conexões e registra o caminho escolhido", () => {
  const flow = {
    uid: 4,
    name: "Condição",
    provider: "apecerto-erp",
    anotacoes: [],
    notes: {},
    nodes: [
      { id: "start", type: "trigger", options: { triggers: [{ name: "json-http-request-trigger" }] }, x: 0, y: 0 },
      { id: "check", type: "condition", options: { conditions: [{ name: "field-equals", options: { campo: "lead.origem", valor: "site" } }] }, x: 400, y: 0 },
      { id: "yes", type: "time", options: { wait_type: "wait-minutes", valor: 1 }, x: 800, y: 0 },
      { id: "no", type: "time", options: { wait_type: "wait-minutes", valor: 1 }, x: 800, y: 300 },
    ],
    wires: [
      { from: "start", port: "out", to: "check" },
      { from: "check", port: "true", to: "yes" },
      { from: "check", port: "false", to: "no" },
    ],
  };
  const trace = model.simulateFlow(flow, { lead: { origem: "site" } });
  assert.deepEqual(trace.steps.map((step) => step.nodeId), ["start", "check", "yes"]);
  assert.equal(trace.steps[1].port, "true");
  assert.equal(trace.safe, true);
});

test("comparação profunda detecta configuração alterada sem depender só de contagem", () => {
  const base = {
    uid: 2,
    name: "Comparar",
    provider: "apecerto-erp",
    anotacoes: [],
    notes: {},
    nodes: [{ id: "b1", type: "time", options: { valor: 5 }, x: 0, y: 0 }],
    wires: [],
  };
  const changed = structuredClone(base);
  changed.nodes[0].options.valor = 10;
  const diff = model.diffFlows(changed, base);
  assert.ok(diff.some((item) => item.kind === "changed" && item.nodeId === "b1"));
});

test("validação relacional bloqueia abordagem sem vínculo com o produto", () => {
  const flow = {
    uid: 2,
    name: "Produto",
    provider: "apecerto-erp",
    anotacoes: [],
    notes: {},
    nodes: [{ id: "send", type: "send-approach", options: { produtoId: 7, abordagemIds: [9], instanciaPorCorretor: {} }, x: 0, y: 0 }],
    wires: [],
  };
  const issues = model.validateFlowReferences(flow, {
    produtos: [{ id: 7, ativo: true }],
    abordagens: [{ id: 9, ativo: true, produto_id: null }],
    agentes: [],
    instancias: [],
  }, 7);
  assert.ok(issues.some((issue) => issue.title === "Abordagem fora do produto"));
});

test("compatibilidade legada preserva somente abordagens ainda sem produto", () => {
  const flow = {
    uid: 2,
    name: "Entrada legada",
    provider: "apecerto-erp",
    anotacoes: [],
    notes: {},
    nodes: [{ id: "send", type: "send-approach", options: { produtoId: 0, abordagemIds: [18], instanciaPorCorretor: {} }, x: 0, y: 0 }],
    wires: [],
  };
  const references = {
    produtos: [{ id: 1, ativo: true }],
    abordagens: [{ id: 18, ativo: true, produto_id: null }],
    agentes: [],
    instancias: [],
  };

  assert.equal(model.validateFlowReferences(flow, references, null, true).some((issue) => issue.title.includes("Produto da abordagem")), false);
  references.abordagens[0].produto_id = 1;
  assert.ok(model.validateFlowReferences(flow, references, null, true).some((issue) => issue.title === "Abordagem legada incompatível"));
});
