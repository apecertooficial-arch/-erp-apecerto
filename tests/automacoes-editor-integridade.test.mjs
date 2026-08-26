import test from "node:test";
import assert from "node:assert/strict";

import {
  AUTOMATION_EXPORT_SCHEMA,
  createAutomationExport,
  findCollisionFreePosition,
  parseAutomationImport,
  reconcileAutomationMap,
  reconcileAutomationWires,
} from "../app/features/automations/automationBuilderRuntime.js";

function block(id, type = "action") {
  return { id, type, options: {}, presentation: { x: 0, y: 0 } };
}

test("recupera módulos executáveis ausentes do editor sem remover módulos visuais", () => {
  const reconciled = reconcileAutomationMap({
    editor: { blocks: { b3: { id: "b3", fam: "acao" } } },
    automation: { blocks: [block("b1", "trigger"), block("b2", "ai-agent"), block("b3"), block("b4")] },
  });

  assert.deepEqual(reconciled.blockIds, ["b1", "b2", "b3", "b4"]);
  assert.deepEqual(reconciled.recoveredRuntimeIds, ["b1", "b2", "b4"]);
  assert.deepEqual(reconciled.editorOnlyIds, []);
});

test("preserva módulo exclusivo do editor e o marca para revisão", () => {
  const reconciled = reconcileAutomationMap({
    editor: { blocks: { b1: { id: "b1", fam: "gatilho" }, b16: { id: "b16", fam: "acao" } } },
    automation: { blocks: [block("b1", "trigger"), block("bTags")] },
  });

  assert.deepEqual(reconciled.blockIds, ["b1", "bTags", "b16"]);
  assert.deepEqual(reconciled.recoveredRuntimeIds, ["bTags"]);
  assert.deepEqual(reconciled.editorOnlyIds, ["b16"]);
});

test("um editor vazio usa todos os módulos executáveis sem perda", () => {
  const reconciled = reconcileAutomationMap({
    editor: { blocks: {} },
    automation: { blocks: [block("start", "trigger"), block("finish")] },
  });

  assert.deepEqual(reconciled.blockIds, ["start", "finish"]);
  assert.deepEqual(reconciled.recoveredRuntimeIds, ["start", "finish"]);
});

test("rotas executáveis prevalecem e conexões visuais adicionais são preservadas", () => {
  const reconciled = reconcileAutomationWires(
    [
      { from: "start", port: "out", to: "stale" },
      { from: "draft", port: "out", to: "finish" },
    ],
    [
      { id: "start", options: { nextBlockId: "runtime" } },
      { id: "runtime", options: { errorNextBlockId: "fallback" } },
    ],
  );

  assert.deepEqual(reconciled.wires, [
    { from: "start", port: "out", to: "runtime" },
    { from: "runtime", port: "err", to: "fallback" },
    { from: "draft", port: "out", to: "finish" },
  ]);
  assert.deepEqual(reconciled.recoveredWireKeys, ["start::out", "runtime::err"]);
  assert.deepEqual(reconciled.editorOnlyWireKeys, ["draft::out"]);
});

test("novo módulo procura uma área livre sem mover os módulos existentes", () => {
  const nodes = {
    b1: { x: 100, y: 100 },
    b2: { x: 500, y: 100 },
  };

  assert.deepEqual(findCollisionFreePosition(nodes, { x: 120, y: 120 }), { x: 120, y: 340 });
  assert.deepEqual(nodes, {
    b1: { x: 100, y: 100 },
    b2: { x: 500, y: 100 },
  });
});

test("exportação é versionada e remove credenciais sem alterar o mapa aberto", () => {
  const map = {
    editor: { uid: 2, blocks: { b1: { id: "b1", fam: "gatilho" } }, wires: [] },
    automation: {
      name: "Entrada segura",
      blocks: [{ id: "b1", type: "trigger", options: { apiKey: "segredo", webhook_token: "segredo-2", nextBlockId: "" } }],
    },
  };

  const exported = createAutomationExport(map, { name: "Entrada segura", group: "Miruna" }, "2026-08-26T12:00:00.000Z");

  assert.equal(exported.schema, AUTOMATION_EXPORT_SCHEMA);
  assert.equal(exported.version, 1);
  assert.equal(exported.automation.name, "Entrada segura");
  assert.equal(exported.automation.map.automation.blocks[0].options.apiKey, undefined);
  assert.equal(exported.automation.map.automation.blocks[0].options.webhook_token, undefined);
  assert.equal(map.automation.blocks[0].options.apiKey, "segredo");
});

test("importação aceita o formato versionado como novo rascunho e rejeita mapa inválido", () => {
  const map = {
    editor: { uid: 2, blocks: { b1: { id: "b1", fam: "gatilho" } }, wires: [] },
    automation: { name: "Entrada", blocks: [block("b1", "trigger")] },
  };
  const payload = createAutomationExport(map, { name: "Entrada", group: "Produto" }, "2026-08-26T12:00:00.000Z");
  const imported = parseAutomationImport(JSON.stringify(payload));

  assert.equal(imported.name, "Entrada");
  assert.equal(imported.group, "Produto");
  assert.deepEqual(imported.map, map);
  assert.throws(() => parseAutomationImport('{"automation":{"blocks":[]}}'), /nenhum bloco executável/i);
  assert.throws(() => parseAutomationImport('{"automation":{"blocks":[{"id":"x","type":"trigger"},{"id":"x","type":"action"}]}}'), /IDs repetidos/i);
  assert.throws(() => parseAutomationImport('{"schema":"apecerto-automation/v1","version":2,"automation":{"map":{}}}'), /não suportada/i);
});
