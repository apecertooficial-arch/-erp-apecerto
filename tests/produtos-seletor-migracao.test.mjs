import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("a lista compartilhada é autenticada, protegida por RLS e não duplica PII", async () => {
  const migration = await read("supabase/migrations/20261001103737_produtos_seletor_migracao.sql");
  assert.match(migration, /create table if not exists public\.produto_migracao_selecoes/i);
  assert.match(migration, /alter table public\.produto_migracao_selecoes enable row level security/i);
  assert.match(migration, /has_perm\('produtos', 'selecionar_migracao'\)/i);
  assert.match(migration, /selecionado_por = \(select auth\.uid\(\)\)/i);
  assert.match(migration, /revoke all on table public\.produto_migracao_selecoes from public, anon, authenticated/i);
  const table = migration.match(/create table if not exists public\.produto_migracao_selecoes \([\s\S]*?\n\);/i)?.[0] ?? "";
  assert.doesNotMatch(table, /proprietario_(?:nome|contato)\s+(?:text|varchar)/i);
});

test("dados privados só entram na resposta do modo de migração autorizado", async () => {
  const catalog = await read("app/api/catalog/route.ts");
  assert.match(catalog, /searchParams\.get\("view"\) === "migration"/);
  assert.match(catalog, /migrationMode && !canPrepareMigration/);
  assert.match(catalog, /produto_unidades_proprietarios_ler/);
  assert.match(catalog, /ownerName: migrationOwnerByUnit\.get\(unit\.id\)/);
  assert.match(catalog, /selectedForMigration: selectedMigrationUnits\.has\(unit\.id\)/);
});

test("selecionar e remover são idempotentes e revalidam a permissão no servidor", async () => {
  const route = await read("app/api/products/migration/route.ts");
  assert.match(route, /supabase\.auth\.getUser\(accessToken\)/);
  assert.match(route, /p_acao: "selecionar_migracao"/);
  assert.match(route, /error\.code !== "23505"/);
  assert.match(route, /\.delete\(\)\.eq\("unidade_id", body\.unitId\)/);
  assert.doesNotMatch(route, /service_role|SUPABASE_SERVICE_ROLE_KEY/);
});

test("a tela remota oferece estoque ao vivo, filtros e persistência compartilhada", async () => {
  const ui = await read("app/features/products/ProductMigrationSelector.tsx");
  const page = await read("app/migracao-produtos/page.tsx");
  const products = await read("app/features/products/ProductsModule.tsx");
  assert.match(ui, /\/api\/catalog\?view=migration/);
  assert.match(ui, /AP, prédio, unidade, captador, proprietário/);
  assert.match(ui, /Incorporadora/);
  assert.match(ui, /Lista de migração/);
  assert.match(ui, /onPointerDown=\{\(event\) => \{/);
  assert.match(ui, /event\.preventDefault\(\);[\s\S]*event\.stopPropagation\(\);[\s\S]*clearFilters\(\);/);
  assert.match(ui, /\/api\/products\/migration/);
  assert.match(ui, /ownerContact/);
  assert.match(page, /GuardaModulo modulo="Produtos"/);
  assert.match(page, /ErpSessionProvider/);
  assert.doesNotMatch(products, /Selecionar migração|\/produtos\/migracao/);
});
