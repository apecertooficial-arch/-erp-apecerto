import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(new URL(path, import.meta.url), "utf8");
const api = read("../app/api/dashboard/route.ts");
const client = read("../app/features/home/dashboard-client.tsx");
const home = read("../app/features/home/HomeWorkspace.tsx");
const style = read("../app/styles/redesign-apecerto-inicio.css");
const cards = ["FinanceiroCards", "NaMesaCards", "FunilCards", "RodagemCards"]
  .map((name) => read(`../app/features/home/${name}.tsx`));

test("dashboard falha fechado ao resolver perfil e seção", () => {
  assert.match(api, /if \(profileError\) return falhaDashboard/);
  assert.doesNotMatch(api, /\?\.role \?\? "corretor"/);
  assert.match(api, /!\["financeiro", "funil", "namesa", "rodagem"\]\.includes\(section\)/);
  assert.match(api, /Seção inválida/);
});

test("dashboard não expõe SQL, não cacheia e confirma o contrato das RPCs", () => {
  assert.doesNotMatch(api, /error\.message/);
  assert.doesNotMatch(api, /console\.error\([^\n]*(token|data|message)/i);
  assert.match(api, /private, no-store, no-cache/);
  assert.equal((api.match(/!respostaConfirmada\(data\)/g) ?? []).length, 4);
  assert.equal((api.match(/return json\(\{/g) ?? []).length >= 8, true);
});

test("cliente rejeita HTTP, JSON ou shape incertos sem mostrar erro interno", () => {
  assert.match(client, /response\.json\(\)\.catch\(\(\) => null\)/);
  assert.match(client, /!response\.ok \|\| !isRecord\(body\) \|\| !validate\(body\[key\]\)/);
  assert.doesNotMatch(client, /body\.error|error\.message/);
  assert.match(client, /cache: "no-store"/);
});

test("as quatro seções tornam falha visível, validam dados e permitem repetir", () => {
  for (const source of cards) {
    assert.doesNotMatch(source, /if \(failed\) return null/);
    assert.match(source, /DashboardSectionError/);
    assert.match(source, /fetchDashboardSection/);
    assert.match(source, /controller\.abort\(\)/);
    assert.match(source, /setRetry\(\(v\) => v \+ 1\)/);
  }
  assert.match(style, /\.hv2-dashboard-error button \{ min-height:44px/);
});

test("o início não transforma falha de metas ou payload financeiro incerto em dado confirmado", () => {
  assert.match(home, /!response\.ok \|\| !isRecord\(json\) \|\| !Array\.isArray\(json\.metas\)/);
  assert.match(home, /if \(!isFinanceData\(finance\)\) throw/);
  assert.match(home, /Dados parciais · meta não confirmada/);
  assert.doesNotMatch(home, /response\.ok \? response\.json\(\) : \{ metas: \[\] \}/);
});
