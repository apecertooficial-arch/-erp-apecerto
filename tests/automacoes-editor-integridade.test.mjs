import test from "node:test";
import assert from "node:assert/strict";

import { reconcileAutomationMap, reconcileAutomationWires } from "../app/features/automations/automationBuilderRuntime.js";

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
