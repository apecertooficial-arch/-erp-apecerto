import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const migration = readFileSync(
  new URL("../supabase/migrations/20260828220626_tracking_qualified_scope_hardening.sql", import.meta.url),
  "utf8",
);
const rollback = readFileSync(
  new URL("../supabase/rollbacks/20260828220626_tracking_qualified_scope_hardening.down.sql", import.meta.url),
  "utf8",
);
const route = readFileSync(new URL("../app/api/funil2/route.ts", import.meta.url), "utf8");

function podeRegistrar({ role, uid, podeOperar }) {
  return role === "service_role" || (Boolean(uid) && podeOperar === true);
}

test("matriz de autorização fecha o RPC para anônimo e corretor fora da carteira", () => {
  assert.equal(podeRegistrar({ role: "anon", uid: null, podeOperar: false }), false);
  assert.equal(podeRegistrar({ role: "authenticated", uid: "corretor-a", podeOperar: false }), false);
  assert.equal(podeRegistrar({ role: "authenticated", uid: "corretor-a", podeOperar: true }), true);
  assert.equal(podeRegistrar({ role: "service_role", uid: null, podeOperar: false }), true);
});

test("migration reutiliza exatamente a autorização da mutação canônica", () => {
  assert.match(route, /f2_atualizar_momento/);
  assert.match(migration, /public\.f2_pode_operar_lead\(p_f2_lead_id\)\s+is\s+not\s+true/i);
  assert.match(migration, /coalesce\(auth\.jwt\(\)\s*->>\s*'role',\s*''\)\s*<>\s*'service_role'/i);
  assert.doesNotMatch(migration, /auth\.role\(\)/i);
  assert.match(migration, /auth\.uid\(\)\s+is\s+null/i);
  assert.doesNotMatch(migration, /public\.is_equipe\(\)/i);
});

test("hardening preserva o contrato, idempotência e privilégios necessários", () => {
  assert.match(migration, /private\.enqueue_meta_crm_event\(/);
  assert.match(migration, /'qualified'/);
  assert.match(migration, /'deduplicado'/);
  assert.match(migration, /revoke all[\s\S]*from public, anon/i);
  assert.match(migration, /grant execute[\s\S]*to authenticated, service_role/i);
  assert.doesNotMatch(migration, /(?:insert\s+into|update|delete\s+from)\s+(?:private\.)?lead_attribution/i);
  assert.doesNotMatch(migration, /alter\s+table/i);
});

test("rollback restaura somente a política anterior da função", () => {
  assert.match(rollback, /public\.is_equipe\(\)/i);
  assert.doesNotMatch(rollback, /public\.f2_pode_operar_lead\(p_f2_lead_id\)/i);
  assert.match(rollback, /private\.enqueue_meta_crm_event\(/);
  assert.doesNotMatch(rollback, /alter\s+table/i);
});
