import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const sql = readFileSync(new URL("../docs/erp-reestruturacao/P0_CONVITES_USUARIOS_DRAFT.sql", import.meta.url), "utf8");

test("draft fica fora de migrations e falha se RLS ou tabelas não existirem", () => {
  assert.match(sql, /DRAFT NÃO EXECUTÁVEL AUTOMATICAMENTE/);
  assert.match(sql, /to_regclass\('public\.acesso_convites'\)/);
  assert.match(sql, /convites_preflight_rls_desligada/);
});

test("navegador perde autoridade e service_role mantém somente operações necessárias", () => {
  assert.match(sql, /revoke all on table public\.acesso_convites from anon, authenticated/);
  assert.match(sql, /revoke all on table public\.cadastro_convites from anon, authenticated/);
  assert.match(sql, /grant select, insert, update, delete on table public\.acesso_convites to service_role/);
  assert.match(sql, /grant select, insert, update, delete on table public\.cadastro_convites to service_role/);
});

test("novos tokens são hashes, autocadastro é corretor e legado não é apagado", () => {
  assert.equal((sql.match(/check \(token ~ '\^sha256:\[0-9a-f\]\{64\}\$'\) not valid/g) ?? []).length, 2);
  assert.match(sql, /check \(role = 'corretor'\) not valid/);
  assert.doesNotMatch(sql, /delete\s+from\s+public\.(?:acesso|cadastro)_convites/i);
  assert.doesNotMatch(sql, /truncate/i);
});

test("draft possui índices de abertos e rollback explícito", () => {
  assert.equal((sql.match(/where usado_em is null/g) ?? []).length, 2);
  assert.match(sql, /ROLLBACK OPERACIONAL/);
  assert.match(sql, /drop constraint if exists acesso_convites_token_hash_novo_ck/);
});
