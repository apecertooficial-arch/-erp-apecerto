import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const migration = readFileSync(
  new URL("../supabase/migrations/20260908210138_meta_crm_initial_lead_coverage.sql", import.meta.url),
  "utf8",
);
const rollback = readFileSync(
  new URL("../supabase/rollbacks/20260908210138_meta_crm_initial_lead_coverage.down.sql", import.meta.url),
  "utf8",
);
const crmCapi = readFileSync(
  new URL("../supabase/functions/crm-capi/index.ts", import.meta.url),
  "utf8",
);

test("lead inicial nasce do mesmo bloco explicito que registra a atribuicao Meta", () => {
  assert.match(migration, /create or replace function private\.enqueue_meta_initial_lead_event/i);
  assert.match(migration, /private\.meta_lead_submissions/i);
  assert.match(migration, /s\.meta_lead_id\s*=\s*p_meta_lead_id/i);
  assert.match(migration, /private\.enqueue_meta_crm_event\(\s*'lead'/i);
  assert.match(migration, /'meta_lead_submissions'/i);
  assert.match(migration, /s\.created_time/i);
  assert.match(migration, /private\.enqueue_meta_initial_lead_event\(\s*v_lead_id\s*,\s*p_neg_id/i);
  assert.doesNotMatch(migration, /create\s+trigger/i);
});

test("outbox aceita Lead e preserva idempotencia pelo leadgen_id", () => {
  assert.match(migration, /p_event_type not in \([^)]*'lead'/is);
  assert.match(migration, /v_event_id text := p_event_type \|\| '-' \|\| p_source_id/i);
  assert.match(migration, /on conflict \(channel,event_id\) do nothing/i);
  assert.match(migration, /l\.disparo_optout\s+is\s+not\s+true/i);
});

test("CRM CAPI segue o contrato de Conversion Leads da Meta", () => {
  assert.match(crmCapi, /lead:\s*"Lead"/);
  assert.match(crmCapi, /action_source:\s*"system_generated"/);
  assert.match(crmCapi, /lead_event_source:\s*"ApeCerto ERP"/);
  assert.match(crmCapi, /event_source:\s*"crm"/);
  assert.match(crmCapi, /userData\.lead_id\s*=\s*String\(attribution\.meta_lead_id\)/);
  assert.match(crmCapi, /disparo_optout/);
  assert.match(crmCapi, /invalid_event_time/);
  assert.doesNotMatch(crmCapi, /event_time\s*:\s*Math\.max/);
  assert.doesNotMatch(crmCapi, /body\.event_time\s*\?\?\s*Date\.now/);
  assert.doesNotMatch(crmCapi, /action_source:\s*"website"/);
  assert.doesNotMatch(crmCapi, /event_source_url:/);
});

test("rollback remove apenas a cobertura inicial e restaura o contrato anterior", () => {
  assert.match(rollback, /drop function if exists private\.enqueue_meta_initial_lead_event/i);
  assert.doesNotMatch(rollback, /drop table/i);
  assert.match(rollback, /p_event_type not in \([^)]*'responded'/is);
  assert.doesNotMatch(rollback, /p_event_type not in \([^)]*'lead'/is);
});
