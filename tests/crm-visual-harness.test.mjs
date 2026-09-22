import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(new URL(path, import.meta.url), "utf8");
const harness = read("./crm-visual-harness/main.tsx");
const fixtures = read("./crm-visual-harness/fixtures.ts");
const vite = read("./crm-visual-harness/vite.config.mjs");
const workspace = read("../app/features/funil-2/Funil2Workspace.tsx");
const entry = read("../app/features/funil-2/FunilEntry.tsx");
const mobile = read("../app/features/funil-2/Funil2Mobile.tsx");
const funilCss = read("../app/styles/funil.css");
const mobileCss = read("../app/styles/app-mobile-aprovado.css");

test("harness renderiza a rota e o shell reais sem segunda interface", () => {
  assert.match(harness, /import PaginaCrm from "\.\.\/\.\.\/app\/\(erp\)\/crm\/page"/);
  assert.match(harness, /import \{ ErpShell \} from "\.\.\/\.\.\/app\/features\/system\/ErpShell"/);
  assert.match(harness, /import "\.\.\/\.\.\/app\/styles\/funil\.css"/);
  assert.doesNotMatch(harness, /import "\.\.\/\.\.\/app\/styles\/funil-2\.css"/);
  assert.doesNotMatch(harness, /import "\.\.\/\.\.\/app\/styles\/funil-trilhas\.css"/);
  assert.match(funilCss, /\.f2-funil-troca \{/);
  assert.match(funilCss, /\.f2m-funil-etiqueta \{/);
  assert.match(harness, /window\.history\.replaceState\(null, "", `\/crm\$\{window\.location\.search\}`\)/);
  assert.match(harness, /<ErpShell><PaginaCrm \/><\/ErpShell>/);
  assert.doesNotMatch(harness, /crm-v3|iframe|dangerouslySetInnerHTML/);
  assert.match(vite, /root: aqui/);
});

test("harness exercita a cobrança real da Agenda sem dados pessoais nem mutações", () => {
  assert.match(harness, /import \{ CalendarWorkspace \}/);
  assert.match(harness, /import \{ TelaAgendaMobile \}/);
  assert.match(harness, /tela === "agenda-manager"/);
  assert.match(harness, /tela === "agenda-mobile"/);
  assert.match(harness, /url\.pathname === "\/api\/agenda"/);
  assert.match(harness, /Cliente sanitizado 1/);
  assert.doesNotMatch(harness, /@gmail\.|@hotmail\.|\+55 1[1-9]/);
});

test("harness reproduz prazo que vence com o Meu Dia aberto", () => {
  assert.match(harness, /tela === "meu-dia-mobile"/);
  assert.match(harness, /relogioNoLimite/);
  assert.match(harness, /new Date\(Date\.now\(\) \+ 5_000\)\.toISOString\(\)/);
  assert.match(harness, /modo="inicio"/);
  assert.match(harness, /Cliente relógio sanitizado/);
});

test("harness reproduz compromisso que vence com a Agenda aberta", () => {
  assert.match(harness, /payloadAgendaRelogioNoLimite/);
  assert.match(harness, /Cliente agenda relógio sanitizado/);
  assert.match(harness, /faltam_min: 0\.05/);
});

test("interceptador sintético permite somente GETs locais inventariados", () => {
  assert.match(harness, /if \(method !== "GET"\)/);
  assert.match(harness, /url\.origin !== window\.location\.origin/);
  for (const rota of ["/api/funil2", "/api/funil2/conversa", "/api/funil2/carteira", "/api/crm/sales", "/api/agenda"]) {
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
  assert.match(harness, /type Estado = "normal" \| "loading" \| "vazio" \| "erro" \| "invalido" \| "offline" \| "negado"/);
  assert.match(harness, /dataset\.crmHarness = "visual-sintetico"/);
  assert.doesNotMatch(`${workspace}\n${mobile}`, /crmHarness|harness-test-only|visual-sintetico/);
});

test("falha inicial não expõe mutações e falha posterior preserva a carteira", () => {
  assert.match(workspace, /try \{[\s\S]*await fetch\("\/api\/funil2"[\s\S]*catch \{/);
  assert.match(workspace, /Sem conexão — nenhum dado em cache está disponível/);
  assert.match(workspace, /const \[carregado, setCarregado\] = useState\(false\)/);
  assert.match(workspace, /!carregando && carregado && aba === "quadro"/);
  assert.match(workspace, /setCarregado\(true\)/);
  assert.match(entry, /<Funil2Workspace[\s\S]*key=\{profile\?\.userId \|\| "perfil-pendente"\}/);
});

test("Funil móvel remove junto o cabeçalho global oculto e o espaço reservado", () => {
  assert.match(funilCss, /\.app-shell:has\(\.funil-oficial\.modo-crm\) \.app-mobile-top\{display:none\}/);
  assert.match(funilCss, /\.app-shell:has\(\.funil-oficial\.modo-crm\) \.workspace\{padding-top:0\}/);
});

test("controles móveis acionáveis preservam alvo mínimo de 44 px", () => {
  assert.match(mobileCss, /\.ape-atualizar \{[^}]*min-height: 44px/);
  assert.match(mobileCss, /\.ape-filtros button \{[^}]*min-height: 44px/);
  assert.match(mobileCss, /\.ape-quem \{[^}]*min-height: 44px/);
  assert.match(mobileCss, /\.ape-temperatura-filtros button \{[^}]*min-height:44px/);
});
