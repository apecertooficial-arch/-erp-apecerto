import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const migration = readFileSync(
  new URL(
    "../supabase/migrations/20260909110410_meta_crm_initial_lead_after_action.sql",
    import.meta.url,
  ),
  "utf8",
);
const rollback = readFileSync(
  new URL(
    "../supabase/rollbacks/20260909110410_meta_crm_initial_lead_after_action.down.sql",
    import.meta.url,
  ),
  "utf8",
);

test("lead Meta e enfileirado depois que o bloco de acao devolve o negocio", () => {
  assert.match(
    migration,
    /public\.motor_rodar_unchecked\(bigint,jsonb,text,integer\)/i,
  );
  assert.match(
    migration,
    /v_negocio_id:=nullif\(_res->>'negocio_id',''\)::bigint;[\s\S]*perform private\.enqueue_meta_initial_lead_event\(\s*v_lead_id,\s*v_negocio_id/i,
  );
  assert.match(migration, /META_INITIAL_LEAD_AFTER_ACTION_PATCH_FAILED/i);
  assert.doesNotMatch(migration, /create\s+trigger/i);
  assert.doesNotMatch(migration, /insert\s+into\s+private\.tracking_delivery_logs/i);
});

test("fallback preserva o leadgen_id em contexto direto ou entrada_payload", () => {
  for (const key of ["meta_lead_id", "leadgen_id"]) {
    assert.match(
      migration,
      new RegExp(`p_lead->'entrada_payload'->>'${key}'`),
    );
    assert.match(migration, new RegExp(`p_lead->>'${key}'`));
  }
});

test("rollback remove somente o fallback posterior ao bloco de acao", () => {
  assert.match(
    rollback,
    /public\.motor_rodar_unchecked\(bigint,jsonb,text,integer\)/i,
  );
  assert.match(rollback, /META_INITIAL_LEAD_AFTER_ACTION_UNPATCH_FAILED/i);
  assert.doesNotMatch(rollback, /drop\s+table/i);
  assert.doesNotMatch(rollback, /delete\s+from/i);
});
