import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const captureWizard = await readFile("app/features/products/CaptureWizard.tsx", "utf8");
const captureApi = await readFile("app/api/capture/route.ts", "utf8");
const productApi = await readFile("app/api/product/route.ts", "utf8");
const catalogApi = await readFile("app/api/catalog/route.ts", "utf8");
const productAccess = await readFile("app/features/products/access.ts", "utf8");
const sessionApi = await readFile("app/api/session/route.ts", "utf8");
const managerMigration = await readFile("supabase/migrations/20260901173000_produtos_gerente_permissao.sql", "utf8");

test("cadastro e edição de imóvel usam somente RPCs protegidas para proprietários", () => {
  assert.match(captureWizard, /rpc\("produto_proprietarios_meus"\)/);
  assert.match(captureApi, /rpc\("produto_proprietario_captacao_resolver"/);
  assert.match(productApi, /rpc\("produto_proprietario_ler"/);
  assert.match(productApi, /rpc\("produto_proprietario_salvar"/);
  assert.doesNotMatch(captureWizard, /from\("proprietarios"\)/);
  assert.doesNotMatch(captureApi, /from\("proprietarios"\)/);
  assert.doesNotMatch(productApi, /from\("proprietarios"\)/);
  assert.doesNotMatch(productApi, /proprietarios \(\*\)/);
});

test("Minhas captações inclui qualquer unidade atribuída à corretora", () => {
  const myUnitsBlock = catalogApi.match(/let myUnits:[\s\S]*?const mineIds/)?.[0] ?? "";
  assert.match(myUnitsBlock, /eq\("captador_corretor_id", currentBrokerId\)/);
  assert.doesNotMatch(myUnitsBlock, /eq\("de_terceiros", true\)/);
});

test("gerente possui alçada de Produtos na sessão, aplicação e banco", () => {
  assert.match(productAccess, /"gerente"/);
  assert.match(sessionApi, /managerRoles[\s\S]*?"gerente"/);
  assert.match(managerMigration, /u\.role::text in[\s\S]*?'gerente'/);
  assert.match(managerMigration, /u\.id = \(select auth\.uid\(\)\)[\s\S]*?and u\.ativo/);
  assert.match(managerMigration, /revoke all on function public\.is_product_manager\(\) from public, anon, authenticated/);
  assert.match(managerMigration, /grant execute on function public\.is_product_manager\(\) to authenticated/);
});
