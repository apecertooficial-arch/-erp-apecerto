import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

const root = new URL("../", import.meta.url);
const page = readFileSync(new URL("app/(erp)/automacoes/page.tsx", root), "utf8");
const layout = readFileSync(new URL("app/layout.tsx", root), "utf8");
const workspace = readFileSync(new URL("app/features/automations/AutomationsWorkspaceV2.tsx", root), "utf8");
const home = readFileSync(new URL("app/features/automations/AutomationsHome.tsx", root), "utf8");
const runtime = readFileSync(new URL("app/features/automations/automationBuilderRuntime.js", root), "utf8");
const builderCss = readFileSync(new URL("app/styles/automation-workspace.css", root), "utf8");

test("a aba Automações separa gestão, operação e construtor canônico", () => {
  assert.match(page, /AutomationsWorkspaceV2/);
  assert.doesNotMatch(page, /AutomationsCentral(?:Cloud)?V4/);
  assert.match(workspace, /automationBuilderRuntime\.js/);
  assert.match(workspace, /AutomationsHome/);
  assert.match(home, /CentralOperationsPanel/);
  assert.match(workspace, /Organizar na horizontal/);
  assert.match(workspace, /Voltar para automações/);
  assert.doesNotMatch(workspace, /decorarBlocos/);
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
  assert.equal(existsSync(new URL("supabase/migrations/20260817205409_automacoes_titulos_por_bloco.sql", root)), true);
});

test("o construtor recupera a automação pela URL sem remontar ao abrir", () => {
  assert.match(runtime, /initialAutomationId/);
  assert.match(runtime, /openAutomacao\(\+_ctx\.initialAutomationId\)/);
  assert.match(workspace, /initialAutomationId/);
  assert.doesNotMatch(workspace, /\[abrirId, remontar,/);
});

test("os cartões usam resumo compacto e expandem a configuração no próprio bloco", () => {
  assert.match(runtime, /function nodeSummary/);
  assert.match(runtime, /node-summary/);
  assert.match(runtime, /data-node-toggle/);
  assert.match(runtime, /selectedId===n\.id\?bodyHtml\(n\):''/);
  assert.match(builderCss, /\.node\.editable\.selected/);
});

test("o construtor reconcilia editor e mapa executável por ID", () => {
  assert.match(runtime, /function reconcileAutomationMap/);
  assert.match(runtime, /blockIds:\[\.\.\.automationIds/);
  assert.match(runtime, /recoveredRuntimeIds/);
  assert.match(runtime, /editorOnlyIds/);
  assert.doesNotMatch(runtime, /Object\.keys\(edB\)\.length\?Object\.keys\(edB\)/);
});

test("modo foco remove a navegação global e preserva somente a navegação do construtor", () => {
  assert.match(builderCss, /body\.automation-builder-focus \.app-shell > \.sidebar/);
  assert.match(builderCss, /grid-template-columns:\s*minmax\(0,\s*1fr\)\s*!important/);
  assert.match(builderCss, /\.app\.sb-collapsed \.sidebar[\s\S]*visibility:\s*hidden/);
});

test("organização atua no estado aberto e fica pendente de salvar", () => {
  assert.match(runtime, /function organizeHorizontal/);
  assert.match(runtime, /setDirty\(\)/);
  assert.match(runtime, /organizeHorizontal/);
  assert.doesNotMatch(workspace, /select=mapa/);
});

test("a identidade da Central não depende das folhas de correção antigas", () => {
  assert.doesNotMatch(layout, /redesign-apecerto-automacoes/);
  assert.doesNotMatch(layout, /redesign-apecerto-construtor-paridade/);
  assert.match(builderCss, /var\(--ape-orange\)/);
  assert.match(builderCss, /:focus-visible/);
  assert.match(builderCss, /@media/);
});

test("logs e validação ficam escopados ao painel aberto", () => {
  assert.doesNotMatch(runtime, /document\.querySelectorAll\('\[data-logtab\]'\)/);
  assert.doesNotMatch(runtime, /document\.querySelectorAll\('\[data-vgo\]'\)/);
});
