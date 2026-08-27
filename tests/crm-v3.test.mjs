import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(new URL(path, import.meta.url), "utf8");
const route = read("../app/(erp)/crm/page.tsx");
const workspace = read("../app/features/funil-2/Funil2Workspace.tsx");
const mobile = read("../app/features/funil-2/Funil2Mobile.tsx");
const api = read("../app/api/funil2/route.ts");
const layout = read("../app/layout.tsx");
const erpLayout = read("../app/(erp)/layout.tsx");
const shell = read("../app/features/system/ErpShell.tsx");

test("/crm promove V3 por padrão e possui rollback servidor para o legado", () => {
  assert.doesNotMatch(route, /"use client"/);
  assert.match(route, /process\.env\.CRM_V3_EXPERIENCE === "legacy"/);
  assert.match(route, /<CrmEntry experience=\{experience\}/);
  assert.doesNotMatch(route, /CrmV3Route|fixture|localValidation/);
});

test("V3 oficial é uma apresentação do motor canônico, não um segundo CRM", () => {
  assert.match(workspace, /experience = "legacy"/);
  assert.match(workspace, /crm-v3-official/);
  assert.match(workspace, /fetch\("\/api\/funil2"/);
  assert.match(mobile, /experience = "legacy"/);
  assert.match(mobile, /crm-v3-official/);
  assert.match(mobile, /fetch\("\/api\/funil2"/);
});

test("autenticação, RLS e mutações continuam na API Funil 2.0", () => {
  assert.match(api, /supabase\.auth\.getUser\(token\)/);
  assert.match(api, /f2_atualizar_momento/);
  assert.match(api, /f2_confirmar_acao/);
  assert.match(api, /f2_salvar_visita/);
  assert.match(workspace, /Feedback pendente/);
  assert.match(workspace, /Registrar resultado/);
  assert.doesNotMatch(api, /CRM_V3|fixture|validationAdapter/);
});

test("laboratório local não faz parte do caminho compilado de produção", () => {
  assert.equal(existsSync(new URL("../app/(erp)/crm-v3/page.tsx", import.meta.url)), false);
  assert.equal(existsSync(new URL("../app/features/funil-2-v3/fixtures.ts", import.meta.url)), false);
  assert.equal(existsSync(new URL("../app/features/funil-2-v3/validationAdapter.ts", import.meta.url)), false);
  assert.equal(existsSync(new URL("../app/features/system/ErpRuntime.tsx", import.meta.url)), false);
  assert.doesNotMatch(layout, /funil-2-v3\.css/);
  assert.doesNotMatch(erpLayout, /ErpRuntime/);
  assert.doesNotMatch(shell, /crmV3Validation|\/crm-v3/);
});

test("folha oficial é isolada e o legado permanece intacto sem a classe V3", () => {
  assert.match(layout, /crm-v3-official\.css/);
  const css = read("../app/styles/crm-v3-official.css");
  assert.match(css, /^\.crm-v3-official/m);
  assert.doesNotMatch(css, /^(html|body|:root|\*)[\s,{]/m);
  assert.doesNotMatch(css, /!important/);
  assert.match(css, /@media\(max-width:720px\)/);
});
