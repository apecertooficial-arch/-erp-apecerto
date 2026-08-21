import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const migration = await readFile(
  "supabase/migrations/20260821190806_produtos_publicacao_canonica.sql",
  "utf8",
);
const types = await readFile("app/lib/supabase/database.types.ts", "utf8");
const productRoute = await readFile("app/api/product/route.ts", "utf8");

test("publicação false para true só acontece pela RPC vinculada à sessão", () => {
  assert.match(migration, /new\.publicado is true and old\.publicado is not true/);
  assert.match(migration, /current_setting\('apecerto\.produto_publicacao_context', true\)/);
  assert.match(migration, /v_uid::text \|\| ':' \|\| p_empreendimento_id::text/);
  assert.match(migration, /trg_empreendimentos_bloquear_publicacao_direta/);
  assert.match(migration, /trg_unidades_bloquear_publicacao_direta/);
  assert.equal(
    migration.match(/alter column publicado set default false/g)?.length,
    2,
  );
});

test("exclusão de produto é manager-only, transacional e protege histórico", () => {
  const rpc = migration.match(
    /create or replace function public\.produto_excluir\([\s\S]*?comment on function public\.produto_excluir\(uuid\)[\s\S]*?;/,
  )?.[0] ?? "";

  assert.match(rpc, /security definer/);
  assert.match(rpc, /public\.is_product_manager\(\)/);
  assert.match(rpc, /for update/);
  for (const relation of [
    "negocios",
    "vendas",
    "visitas",
    "f2_visita",
    "pipelines",
    "ncrm_proposta",
    "captacoes_portal",
  ]) {
    assert.match(rpc, new RegExp(`from public\\.${relation}`));
  }
  assert.match(rpc, /PRODUCT_HAS_LINKS/);
  assert.match(rpc, /insert into public\.erp_auditoria/);
  assert.match(rpc, /delete from public\.empreendimentos/);
  assert.match(rpc, /revoke all on function public\.produto_excluir\(uuid\) from anon/);
  assert.match(
    types,
    /produto_excluir:\s*\{\s*Args: \{ p_empreendimento_id: string \}\s*Returns: Json/,
  );
  const deleteBlock = productRoute.match(/if \(body\.action === "deleteProduct"\)[\s\S]*?\/\/ Bloco final/)?.[0] ?? "";
  assert.match(deleteBlock, /rpc\("produto_excluir", \{ p_empreendimento_id: id \}\)/);
  assert.doesNotMatch(deleteBlock, /from\("empreendimentos"\)\.delete\(\)/);
  assert.match(deleteBlock, /storageCleanupPending/);
  assert.match(productRoute, /businessCode === "PRODUCT_HAS_LINKS"[\s\S]*?409/);
});
