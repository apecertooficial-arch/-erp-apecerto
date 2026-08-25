import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const migration = readFileSync("supabase/migrations/20260825190000_produtos_unidade_alugada_custos_ciclo_vida.sql", "utf8");
const productApi = readFileSync("app/api/product/route.ts", "utf8");
const detail = readFileSync("app/features/products/ProductDetail.tsx", "utf8");
const unitWizard = readFileSync("app/features/products/UnitWizard.tsx", "utf8");
const captureApi = readFileSync("app/api/capture/route.ts", "utf8");

test("unidade guarda condição de locação e custos próprios", () => {
  assert.match(migration, /add column if not exists compre_ja_alugado boolean not null default false/);
  assert.match(migration, /add column if not exists condominio_valor numeric/);
  assert.doesNotMatch(migration, /create or replace view public\.site_produtos/);
  assert.match(captureApi, /compre_ja_alugado: unit\.alreadyRented === true/);
  assert.match(detail, /Compre já alugado/);
  assert.match(detail, /unit\.condominio_valor \?\? currentProduct\.condominio_valor/);
  assert.doesNotMatch(detail, /focusedUnitStandalone \? "—" : currentProduct\.condominio_valor/);
});

test("captador e gestão podem inativar sem excluir dados", () => {
  const rpc = migration.match(/create or replace function public\.produto_unidade_definir_disponibilidade[\s\S]*?comment on function public\.produto_unidade_definir_disponibilidade[\s\S]*?;/)?.[0] ?? "";
  assert.match(rpc, /security definer/);
  assert.match(rpc, /public\.is_product_manager\(\)/);
  assert.match(rpc, /v_unidade\.captador_corretor_id is distinct from v_corretor_id/);
  assert.match(rpc, /publicado = case when p_disponivel then v_unidade\.publicado else false end/);
  assert.match(rpc, /revoke all on function[\s\S]*from anon/);
  assert.match(rpc, /grant execute on function[\s\S]*to authenticated/);
  assert.match(productApi, /body\.action === "setUnitAvailability"/);
  assert.match(detail, /Inativar imóvel/);
  assert.match(detail, /Reativar imóvel/);
});

test("exclusão individual preserva condomínio, bloqueia histórico e limpa Storage pela API", () => {
  const rpc = migration.match(/create or replace function public\.produto_unidade_excluir[\s\S]*?comment on function public\.produto_unidade_excluir[\s\S]*?;/)?.[0] ?? "";
  assert.match(rpc, /UNIT_HAS_LINKS/);
  assert.match(rpc, /v_unidade\.de_terceiros is not true/);
  assert.match(rpc, /delete from public\.unidades/);
  assert.match(rpc, /v_emp\.origem = 'terceiros'[\s\S]*v_emp\.condominio_id is null[\s\S]*v_unidades_total = 1/);
  assert.match(productApi, /body\.action === "deleteUnit"/);
  assert.match(productApi, /storage\.from\("empreendimentos"\)\.remove\(paths\)/);
  assert.match(detail, /O condomínio e as outras unidades não serão alterados/);
});

test("upload interrompido retoma na mesma unidade e atualização exige confirmação", () => {
  assert.match(unitWizard, /createdUnitId/);
  assert.match(unitWizard, /uploadedItemIds/);
  assert.match(unitWizard, /if \(completed\.has\(item\.id\)\) continue/);
  assert.match(unitWizard, /Enviar fotos restantes/);
  assert.match(productApi, /select\("id"\)\.maybeSingle\(\)/);
  assert.match(productApi, /UNIT_UPDATE_NOT_CONFIRMED/);
});
