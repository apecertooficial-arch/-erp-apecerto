import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const migrations = [
  "supabase/migrations/20260829012504_produtos_public_contract_expand.sql",
  "supabase/migrations/20260829012505_produtos_public_contract_cutover.sql",
  "supabase/migrations/20260829012506_produtos_authenticated_active_rls.sql",
  "supabase/migrations/20260829012507_produtos_legacy_rpc_lockdown.sql",
  "supabase/migrations/20260829012509_produtos_storage_private.sql",
].map(read);

test("migrations A-E falham fechado e não fazem DML comercial", () => {
  for (const [index, sql] of migrations.entries()) {
    assert.match(sql, /lock_timeout = '5s'/);
    assert.match(sql, /statement_timeout = '60s'/);
    if (index !== 3) assert.doesNotMatch(sql, /(?:insert into|update|delete from)\s+public\.(?:empreendimentos|unidades|midias)\b/i);
    if (index !== 3) assert.doesNotMatch(sql, /\b(?:preco|publicado|captador_corretor_id|proprietario_id)\s*=/i);
  }
  assert.match(migrations[3], /create or replace function public\.produto_unidade_definir_disponibilidade_canonica[\s\S]*update public\.unidades set disponivel = p_disponivel/);
});

test("contrato público revoga superfícies sensíveis e preserva views suportadas", () => {
  assert.match(migrations[0], /generated always as \(public\.site_logradouro_publico\(endereco\)\) stored/i);
  assert.match(migrations[0], /security_invoker=true/);
  assert.match(migrations[1], /revoke all privileges on table public\.empreendimentos, public\.unidades, public\.midias from anon, public/i);
  assert.match(migrations[1], /has_column_privilege\('anon', 'public\.midias', 'storage_path', 'select'\)/);
  assert.match(migrations[1], /grant select on table public\.site_produtos, public\.site_produtos_catalogo to anon/);
});

test("authenticated exige perfil ativo e RPC mutável canônica", () => {
  assert.match(migrations[2], /produtos_authz\.usuario_ativo\(\)/);
  assert.match(migrations[2], /where u\.id = \(select auth\.uid\(\)\) and u\.ativo is true/);
  assert.equal((migrations[2].match(/as restrictive/g) ?? []).length, 3);
  assert.match(migrations[3], /produto_unidade_definir_disponibilidade_canonica/);
  assert.match(migrations[3], /for update/);
  assert.match(migrations[3], /revoke all on function public\.produto_unidade_definir_disponibilidade\(uuid,uuid,boolean\) from public, anon, authenticated/);
  assert.match(read("app/api/product/route.ts"), /rpc\("produto_unidade_definir_disponibilidade_canonica"/);
});

test("bucket privado e mídia autenticada usam id opaco, sem URL pública direta", () => {
  assert.match(migrations[4], /update storage\.buckets set public = false where id = 'empreendimentos'/);
  assert.match(migrations[4], /\(storage\.foldername\(name\)\)\[1\] = \(select auth\.uid\(\)\)::text/);
  const route = read("app/api/product-media/route.ts");
  assert.match(route, /\.from\("midias"\)\.select\("storage_path"\)\.eq\("id", mediaId\)/);
  assert.match(route, /createSignedUrl\(media\.storage_path, 300\)/);
  assert.match(route, /profile\?\.ativo !== true/);
  for (const path of ["app/api/product/route.ts", "app/api/catalog/route.ts", "app/api/live-chat/route.ts", "app/features/studio/StudioModule.tsx", "supabase/functions/enviar-produto/index.ts"]) {
    assert.doesNotMatch(read(path), /storage\/v1\/object\/public\/empreendimentos/);
  }
  assert.doesNotMatch(read("app/api/live-chat/route.ts"), /select\("id,empreendimento_id,nome,tipo,categoria,storage_path,is_capa"\)/);
});

test("respostas de Produto removem storage_path antes de chegar ao cliente", () => {
  const product = read("app/api/product/route.ts");
  assert.match(product, /map\(\(\{ storage_path, \.\.\.item \}\) => \(\{ \.\.\.item, url: signedMedia\.get\(storage_path\) \?\? null \}\)\)/);
  assert.doesNotMatch(product, /url:\s*publicMediaUrl/);
});
