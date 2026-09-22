import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(new URL(path, import.meta.url), "utf8");
const state = read("../app/features/progress/progress-state.ts");
const workspace = read("../app/features/progress/ProgressWorkspace.tsx");
const page = read("../app/(erp)/progresso/page.tsx");
const css = read("../app/styles/project-progress.css");
const routes = read("../app/features/system/erp-routes.ts");
const shell = read("../app/components/AppShell.tsx");

test("fonte versionada valida percentuais, datas e listas", () => {
  assert.match(state, /version: 1/);
  assert.match(state, /function isProjectProgressState/);
  assert.match(state, /percent\(state\.overallPercent\)/);
  assert.match(state, /weeklyUsageCeilingPercent: 70/);
  assert.match(state, /if \(!isProjectProgressState\(PROJECT_PROGRESS\)\) throw/);
});

test("rota falha fechada para qualquer papel que não seja admin", () => {
  assert.match(page, /<ProgressWorkspace \/>/);
  assert.match(workspace, /profile\?\.role !== "admin"/);
  assert.match(workspace, /Acesso restrito ao administrador/);
  assert.doesNotMatch(workspace, /role === "gestor"|isManager/);
  assert.match(routes, /Progresso: \{ path: "\/progresso"/);
  assert.match(routes, /if \(nome === "Progresso"\) return role === "admin"/);
  assert.match(shell, /adminSystemItems[^\n]+"Progresso"/);
  assert.doesNotMatch(shell, /brokerSystemItems[^\n]+"Progresso"/);
});

test("painel consulta build, atualiza e sinaliza checkpoint velho", () => {
  assert.match(workspace, /const REFRESH_MS = 15_000/);
  assert.match(workspace, /STALE_AFTER_MS = 10 \* 60_000/);
  assert.match(workspace, /fetch\("\/api\/build", \{ cache: "no-store" \}\)/);
  assert.match(workspace, /stale \? "Desatualizado" : "Atualizado"/);
  assert.match(workspace, /checado \{updatedAt\}/);
});

test("renderiza barras acessíveis e layout responsivo", () => {
  assert.match(workspace, /role="progressbar"/);
  assert.match(workspace, /aria-valuenow=\{value\}/);
  assert.match(workspace, /PROJECT_PROGRESS\.fronts\.map/);
  assert.match(css, /@media\(max-width:700px\)/);
  assert.match(css, /\.project-progress-grid\{grid-template-columns:1fr\}/);
});
