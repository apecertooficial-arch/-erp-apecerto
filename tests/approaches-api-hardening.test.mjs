import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const route = readFileSync(new URL("../app/api/approaches/route.ts", import.meta.url), "utf8");
const ui = readFileSync(new URL("../app/features/approaches/ApproachesWorkspace.tsx", import.meta.url), "utf8");
const css = readFileSync(new URL("../app/globals.css", import.meta.url), "utf8");
const authz = readFileSync(new URL("../app/lib/supabase/authz.ts", import.meta.url), "utf8");

test("Abordagens sanitiza falhas técnicas sem payload ou mensagem SQL", () => {
  assert.match(route, /function falhaAbordagens\(/);
  assert.match(route, /console\.error\("abordagens_operacao_falhou", \{\s*operacao,\s*codigo:/);
  assert.doesNotMatch(route, /Response\.json\(\{ error: [^}\n]*\.message/);
  assert.doesNotMatch(route, /console\.(?:error|warn|log)\([^\n]*(?:body|messages|mensagens|payload)/i);
});
test("mutações exigem gestão resolvida no servidor", () => {
  assert.match(route, /resolveEffectiveAccess\(auth\.supabase, auth\.user\.id\)/);
  assert.match(route, /if \(!access\.resolved\) return falhaAbordagens\(/);
  assert.match(route, /papelNoGrupo\(access\.role, "gestao"\)/);
  assert.match(route, /A biblioteca de abordagens só pode ser alterada pela gestão/);
  assert.match(route, /denyIfCannot\(access, \[\["abordagens", permission\]\]\)/);
});

test("leitura exige a permissão efetiva de Abordagens", () => {
  assert.match(route, /validar_autorizacao_leitura/);
  assert.match(route, /denyIfCannot\(access, \[\["abordagens", "ver"\]\]\)/);
  assert.match(authz, /if \(roleError \|\| !roleProfile\) return \{ role: "", permissions: \{\}, resolved: false \}/);
});

test("criação comprova contagem e linha persistida", () => {
  assert.match(route, /data: countData, count, error: countError/);
  assert.match(route, /falhaAbordagens\(countError, "contar_abordagens"\)/);
  assert.match(route, /\.insert\([^\n]+\)\.select\("id"\)\.maybeSingle\(\)/);
  assert.match(route, /if \(!created\) return falhaReconciliacaoAbordagens/);
});

test("edição e ativação nunca confirmam zero linhas afetadas", () => {
  assert.ok((route.match(/\.select\("id"\)\.maybeSingle\(\)/g) ?? []).length >= 3);
  assert.match(route, /atualizar_abordagem/);
  assert.match(route, /alternar_abordagem/);
  assert.match(route, /abordagem_nao_encontrada/);
});

test("produto duplicado e exclusão destrutiva deixam de ser autoridades", () => {
  assert.match(route, /action === "createProduct"[\s\S]*status: 410/);
  assert.match(route, /action === "deleteApproach"[\s\S]*status: 409/);
  assert.doesNotMatch(route, /from\("abordagens"\)\.delete\(\)/);
  assert.doesNotMatch(ui, /aria-label="Excluir"/);
});

test("grupo comprova linhas e interface separa falha de vazio real", () => {
  assert.match(route, /renomear_grupo/);
  assert.match(route, /if \(!updated\?\.length\)/);
  assert.match(ui, /loadStatus === "loading"/);
  assert.match(ui, /loadStatus === "error"/);
  assert.match(ui, /Não foi possível carregar a biblioteca de abordagens/);
  assert.match(ui, /Tentar novamente/);
  assert.match(ui, /A alteração foi salva, mas a biblioteca não pôde ser atualizada\. Recarregue antes de repetir\./);
});

test("entrada incompleta e resposta 2xx inválida não viram mutação ou sucesso", () => {
  assert.match(route, /typeof active !== "boolean"/);
  assert.match(route, /JSON\.stringify\(value\)\.length <= 100_000/);
  assert.match(route, /from === to/);
  assert.match(ui, /!payload \|\| payload\.success !== true/);
  assert.match(ui, /response\.json\(\)\.catch\(\(\) => null\)/);
  assert.match(css, /@media\(max-width:800px\)[\s\S]*?\.approaches-workspace button[^}]*min-height:44px/);
});
