import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

const root = new URL("../", import.meta.url);
const page = readFileSync(new URL("app/(erp)/automacoes/page.tsx", root), "utf8");
const layout = readFileSync(new URL("app/layout.tsx", root), "utf8");
const workspace = readFileSync(new URL("app/features/automations/AutomationsWorkspace.tsx", root), "utf8");

test("a aba Automações monta somente o construtor operacional canônico", () => {
  assert.match(page, /AutomationsWorkspace/);
  assert.doesNotMatch(page, /AutomationsCentral(?:Cloud)?V4/);
  assert.match(workspace, /automationBuilderRuntime\.js/);
  assert.match(workspace, /CentralOperationsPanel/);
  assert.match(workspace, /Organizar na horizontal/);
});

test("as camadas V4 e Cloud Design deixam de existir", () => {
  const removed = [
    "app/automacoes-design-preview/page.tsx",
    "app/features/automations/AutomationFlowBuilderV4.tsx",
    "app/features/automations/AutomationsCentralCloudV4.tsx",
    "app/features/automations/AutomationsCentralV4.tsx",
    "app/features/automations/automationFlowModel.ts",
    "app/styles/central-automacoes-cloud-v4.css",
    "app/styles/central-automacoes-v4.css",
  ];
  removed.forEach((path) => assert.equal(existsSync(new URL(path, root)), false, `${path} não deve permanecer`));
  assert.doesNotMatch(layout, /central-automacoes-(?:cloud-)?v4\.css/);
});

test("o runtime e os dados operacionais antigos são preservados", () => {
  assert.equal(existsSync(new URL("app/features/automations/automationBuilderRuntime.js", root)), true);
  assert.equal(existsSync(new URL("app/features/automations/CentralOperationsPanel.tsx", root)), true);
  assert.equal(existsSync(new URL("supabase/migrations/20260825183530_central_automacoes_integridade_produto_e_experiencia.sql", root)), true);
  assert.equal(existsSync(new URL("supabase/migrations/20260825194200_central_automacoes_indices_operacionais.sql", root)), true);
});
