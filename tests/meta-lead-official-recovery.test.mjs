import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(new URL(path, import.meta.url), "utf8");
const batch = read("../supabase/migrations/20260901153000_meta_lead_submissions_recovery_batch.sql");
const stage = read("../supabase/migrations/20260901154000_meta_lead_recovery_stage.sql");
const recovery = read("../supabase/migrations/20260901155000_recover_meta_official_batch.sql");
const cleanup = read("../supabase/migrations/20260901160000_cleanup_meta_lead_recovery_stage.sql");
const rollback = read("../supabase/verificacao/20260901_meta_official_203_rollback.sql");

test("lote de recuperacao permite rollback exato", () => {
  assert.match(batch, /add column if not exists recovery_batch text/i);
  assert.match(batch, /meta_lead_submissions_recovery_batch_valid/i);
  assert.match(batch, /where recovery_batch is not null/i);
});

test("staging com PII e efemero, privado e fechado para clientes", () => {
  assert.match(stage, /private\.meta_lead_recovery_stage/i);
  assert.match(stage, /enable row level security/i);
  assert.match(stage, /revoke all on table private\.meta_lead_recovery_stage from public, anon, authenticated/i);
  assert.match(cleanup, /drop table if exists private\.meta_lead_recovery_stage/i);
  assert.match(cleanup, /drop function if exists private\.recover_meta_official_batch\(text\)/i);
});

test("executor exige contagens oficiais e impede efeitos operacionais", () => {
  assert.match(recovery, /count\(\*\).*<>203/is);
  assert.match(recovery, /label='miruna'\)<>173/i);
  assert.match(recovery, /label='aratans'\)<>30/i);
  assert.match(recovery, /method='direct'\)<>188/i);
  assert.match(recovery, /method='resolved'\)<>14/i);
  assert.match(recovery, /method='unmatched'\)<>1/i);
  assert.match(recovery, /corretor_id,pipeline_id/i);
  assert.match(recovery, /RECOVERY_NEW_LEAD_SIDE_EFFECT_DETECTED/i);
  assert.doesNotMatch(recovery, /insert into public\.(?:negocios|motor_fila|mensagens_agendadas|crm_atividades|crm_tarefas)/i);
  assert.match(recovery, /revoke all on function private\.recover_meta_official_batch\(text\) from public,anon,authenticated/i);
});

test("rollback falha fechado se houver mudanca concorrente", () => {
  assert.match(rollback, /ROLLBACK_CONCURRENT_CHANGE_DETECTED/i);
  assert.match(rollback, /after_checksum/i);
  assert.match(rollback, /ROLLBACK_NEW_LEAD_HAS_OPERATIONAL_ACTIVITY/i);
  assert.match(rollback, /delete from private\.meta_lead_submissions/i);
  assert.match(rollback, /jsonb_populate_record\(/i);
  assert.match(rollback, /delete from public\.leads/i);
  assert.match(rollback, /rolled_back_at=now\(\)/i);
});
