import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync("supabase/migrations/20260923195500_produto_decisao_captacao_atomica.sql", "utf8");
const route = readFileSync("app/api/product/route.ts", "utf8");
const moduleSource = readFileSync("app/features/products/ProductsModule.tsx", "utf8");
const detail = readFileSync("app/features/products/ProductDetail.tsx", "utf8");

test("aprovação e reprovação usam uma única decisão gerencial transacional", () => {
  assert.match(migration, /create or replace function public\.produto_decidir_captacao/);
  assert.match(migration, /not coalesce\(public\.is_product_manager\(\), false\)/);
  assert.match(migration, /from public\.empreendimentos[\s\S]*for update[\s\S]*from public\.unidades[\s\S]*for update/);
  assert.match(migration, /public\.produto_definir_publicacao\(p_empreendimento_id, true, p_unidade_id\)/);
  assert.match(migration, /set aprovacao = 'reprovado',[\s\S]*publicado = false/);
  assert.match(migration, /CAPTURE_DECISION_REASON_REQUIRED/);
});

test("retry não publica nem audita novamente e a decisão confirma a auditoria", () => {
  assert.match(migration, /'replayed', true/);
  assert.match(migration, /v_unidade\.aprovacao is distinct from 'pendente'/);
  assert.match(migration, /CAPTURE_DECISION_CONFLICT/);
  assert.match(migration, /CAPTURE_DECISION_AUDIT_MISSING/);
  assert.match(migration, /'aprovar_publicar'/);
  assert.match(migration, /'Decisão gerencial de captação txid='/);
});

test("mudança direta de decisão fica bloqueada fora das RPCs canônicas", () => {
  assert.match(migration, /create trigger trg_unidades_bloquear_decisao_direta/);
  assert.match(migration, /CAPTURE_DECISION_RPC_REQUIRED/);
  assert.match(migration, /apecerto\.produto_decisao_context/);
  assert.doesNotMatch(migration, /current_setting\('apecerto\.produto_publicacao_context'/);
  assert.match(migration, /revoke all on function public\.produto_decidir_captacao[\s\S]*from public, anon, authenticated, service_role/);
  assert.match(migration, /grant execute on function public\.produto_decidir_captacao[\s\S]*to authenticated/);
});

test("API não mantém uma segunda implementação da decisão", () => {
  const block = route.match(/if \(body\.action === "decideUnit"\)[\s\S]*?if \(body\.action === "toggleFavorite"\)/)?.[0] ?? "";
  assert.match(block, /rpc\("produto_decidir_captacao"/);
  assert.doesNotMatch(block, /from\("unidades"\)\.update/);
  assert.match(block, /CAPTURE_DECISION_REASON_REQUIRED/);
  assert.match(block, /result\.auditoria_id/);
});

test("interfaces exigem motivo e respeitam cancelamento da reprovação", () => {
  for (const source of [moduleSource, detail]) {
    assert.match(source, /Motivo da reprovação \(obrigatório\)/);
    assert.match(source, /if \(reasonInput === null\) return/);
    assert.match(source, /if \(!motivo && !approve\)/);
  }
});
