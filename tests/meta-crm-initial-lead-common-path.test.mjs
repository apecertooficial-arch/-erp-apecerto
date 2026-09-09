import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const migration = readFileSync(
  new URL(
    "../supabase/migrations/20260909091500_meta_crm_initial_lead_common_path.sql",
    import.meta.url,
  ),
  "utf8",
);
const rollback = readFileSync(
  new URL(
    "../supabase/rollbacks/20260909091500_meta_crm_initial_lead_common_path.down.sql",
    import.meta.url,
  ),
  "utf8",
);
const initialCoverage = readFileSync(
  new URL(
    "../supabase/migrations/20260908210138_meta_crm_initial_lead_coverage.sql",
    import.meta.url,
  ),
  "utf8",
);

test("lead inicial e enfileirado no caminho comum de atribuicao Meta", () => {
  assert.match(
    migration,
    /private\.motor_atribuicao_meta_por_campos\(bigint,jsonb\)/i,
  );
  assert.match(
    migration,
    /get diagnostics v_updated_current_count=row_count;[\s\S]*perform private\.enqueue_meta_initial_lead_event\(\s*p_lead_id,\s*null,\s*v_meta_lead_id\s*\);[\s\S]*return jsonb_build_object/i,
  );
  assert.match(initialCoverage, /on conflict \(channel,event_id\) do nothing/i);
  assert.doesNotMatch(migration, /create\s+trigger/i);
  assert.doesNotMatch(migration, /insert\s+into\s+private\.tracking_delivery_logs/i);
});

test("wrapper antigo perde o envio duplicado somente depois do patch comum", () => {
  assert.match(migration, /META_INITIAL_LEAD_COMMON_PATH_PATCH_FAILED/i);
  assert.match(migration, /META_INITIAL_LEAD_WRAPPER_UNPATCH_FAILED/i);
  assert.match(
    migration,
    /v_sync:=private\.motor_atribuicao_meta_por_campos\(v_lead_id,v_contexto\);/i,
  );
});

test("rollback restaura o wrapper e remove apenas o patch do caminho comum", () => {
  assert.match(
    rollback,
    /private\.motor_atribuicao_meta_por_campos\(bigint,jsonb\)/i,
  );
  assert.match(
    rollback,
    /perform private\.enqueue_meta_initial_lead_event\(\s*v_lead_id,\s*p_neg_id/i,
  );
  assert.doesNotMatch(rollback, /drop\s+table/i);
  assert.doesNotMatch(rollback, /delete\s+from/i);
});
