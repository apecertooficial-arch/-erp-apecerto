import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

const migration = await read("supabase/migrations/20260930152538_fabiano_gestor_produtos.sql");
const access = await read("app/features/products/access.ts");
const authz = await read("app/lib/supabase/authz.ts");
const session = await read("app/api/session/route.ts");
const catalog = await read("app/api/catalog/route.ts");
const product = await read("app/api/product/route.ts");
const capture = await read("app/api/capture/route.ts");
const detail = await read("app/features/products/ProductDetail.tsx");
const moduleSource = await read("app/features/products/ProductsModule.tsx");

test("concessão individual é restrita a Produtos, ativa e auditada", () => {
  assert.match(migration, /add column if not exists gestor_produtos boolean not null default false/i);
  assert.match(migration, /u\.ativo[\s\S]*u\.role = any \(public\.papeis_do_grupo\('produtos'\)\)[\s\S]*or u\.gestor_produtos/i);
  assert.match(migration, /lower\(btrim\(nome\)\) = 'fabiano'/i);
  assert.match(migration, /if v_alvos <> 1 then[\s\S]*raise exception/i);
  assert.match(migration, /set gestor_produtos = true/i);
  assert.match(migration, /conceder_gestao_produtos/i);
  assert.doesNotMatch(migration, /set\s+role\s*=/i);
});

test("backend reconhece a alçada dedicada em leitura, edição e aprovação", () => {
  assert.match(access, /dedicatedAccess === true \|\| isProductManagerRole\(role\)/);
  for (const source of [catalog, product, capture]) {
    assert.match(source, /gestor_produtos/);
    assert.match(source, /isProductManagerAccess/);
  }
});

test("permissões efetivas ganham somente todas as ações de Produtos", () => {
  for (const source of [authz, session]) {
    assert.match(source, /gestor_produtos/);
    assert.match(source, /produtos: \[\.\.\.MODULE_CAPABILITIES\.produtos\]/);
  }
});

test("ficha usa a decisão autenticada do catálogo, inclusive no mobile", () => {
  assert.match(detail, /canManageProducts = false/);
  assert.match(detail, /const canPublish = canManageProducts === true/);
  assert.doesNotMatch(detail, /sessionRole/);
  assert.equal((moduleSource.match(/canManageProducts=\{canApprove\}/g) ?? []).length, 2);
});
