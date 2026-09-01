import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const migration = readFileSync(
  new URL("../supabase/migrations/20260901150000_meta_lead_submissions_history.sql", import.meta.url),
  "utf8",
);

test("ledger Meta preserva varias submissoes sem PII", () => {
  assert.match(migration, /create table if not exists private\.meta_lead_submissions/i);
  assert.match(migration, /meta_lead_id text primary key/i);
  assert.match(migration, /lead_id bigint not null references public\.leads/i);
  assert.doesNotMatch(migration, /\b(?:email|telefone|phone_number|full_name|nome)\b/i);
  assert.match(migration, /enable row level security/i);
  assert.match(migration, /revoke all on table private\.meta_lead_submissions from public, anon, authenticated/i);
});

test("attribution grava o ledger e nao regride o ultimo toque", () => {
  assert.match(migration, /insert into private\.meta_lead_submissions/i);
  assert.match(migration, /META_LEAD_ID_CONFLICT/i);
  assert.match(migration, /where excluded\.last_seen_at>=private\.lead_attribution\.last_seen_at/i);
  assert.match(migration, /historico_registrado/i);
  assert.match(migration, /atualizou_atribuicao_atual/i);
});

test("IDs publicitarios aceitam somente formato numerico", () => {
  for (const key of ["campaign_id", "adset_id", "ad_id"]) {
    assert.match(migration, new RegExp(`meta_lead_submissions_${key}_valid`));
  }
});
