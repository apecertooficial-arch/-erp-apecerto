import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(new URL(path, import.meta.url), "utf8");
const harness = read("./crm-visual-harness/main.tsx");
const fixtures = read("./crm-visual-harness/fixtures.ts");
const vite = read("./crm-visual-harness/vite.config.mjs");
const workspace = read("../app/features/funil-2/Funil2Workspace.tsx");
const mobile = read("../app/features/funil-2/Funil2Mobile.tsx");
const funilCss = read("../app/styles/funil.css");

test("harness renderiza a rota e o shell reais sem segunda interface", () => {
  assert.match(harness, /import PaginaCrm from "\.\.\/\.\.\/app\/\(erp\)\/crm\/page"/);
  assert.match(harness, /import \{ ErpShell \} from "\.\.\/\.\.\/app\/features\/system\/ErpShell"/);
  assert.match(harness, /<ErpShell><PaginaCrm \/><\/ErpShell>/);
  assert.doesNotMatch(harness, /crm-v3|iframe|dangerouslySetInnerHTML/);
  assert.match(vite, /root: aqui/);
});

test("interceptador sintético permite somente GETs locais inventariados", () => {
  assert.match(harness, /if \(method !== "GET"\)/);
  assert.match(harness, /url\.origin !== window\.location\.origin/);
  for (const rota of ["/api/funil2", "/api/funil2/conversa", "/api/funil2/carteira", "/api/crm/sales"]) {
    assert.match(harness, new RegExp(rota.replaceAll("/", "\\/")));
  }
  assert.match(harness, /Harness visual: mutações são bloqueadas/);
  assert.match(harness, /Harness visual: domínio externo bloqueado/);
});

test("fixtures são sanitizadas, tipadas e exercitam limite incremental", () => {
  assert.match(fixtures, /Array\.from\(\{ length: 18 \}/);
  assert.match(fixtures, /satisfies LeadFunil2/);
  assert.match(fixtures, /example\.invalid/);
  assert.match(fixtures, /Endereço sanitizado/);
  assert.doesNotMatch(fixtures, /@gmail\.|@hotmail\.|\+55 1[1-9]/);
});

test("roles e estados visuais são parametrizados somente no runner", () => {
  assert.match(harness, /type Papel = "admin" \| "gestor" \| "corretor"/);
  assert.match(harness, /type Estado = "normal" \| "loading" \| "vazio" \| "erro" \| "offline" \| "negado"/);
  assert.match(harness, /dataset\.crmHarness = "visual-sintetico"/);
  assert.doesNotMatch(`${workspace}\n${mobile}`, /crmHarness|harness-test-only|visual-sintetico/);
});

test("offline não gera rejeição solta nem mantém mutações disponíveis", () => {
  assert.match(workspace, /try \{[\s\S]*await fetch\("\/api\/funil2"[\s\S]*catch \{/);
  assert.match(workspace, /Sem conexão — nenhum dado em cache está disponível/);
  assert.match(workspace, /!carregando && !erro && aba === "quadro"/);
  assert.match(mobile, /dados && !erro && !leadAberto/);
  assert.match(mobile, /As ações ficam indisponíveis até reconectar/);
});

test("Funil móvel remove junto o cabeçalho global oculto e o espaço reservado", () => {
  assert.match(funilCss, /\.app-shell:has\(\.funil-oficial\.modo-crm\) \.app-mobile-top\{display:none\}/);
  assert.match(funilCss, /\.app-shell:has\(\.funil-oficial\.modo-crm\) \.workspace\{padding-top:0\}/);
});
