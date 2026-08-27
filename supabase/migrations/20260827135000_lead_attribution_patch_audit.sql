create table if not exists private.lead_attribution_patch_audit (
  batch_id text not null,
  lead_id bigint not null,
  reason text not null,
  before_snapshot jsonb not null,
  created_at timestamptz not null default now(),
  rolled_back_at timestamptz,
  primary key (batch_id, lead_id),
  constraint lead_attribution_patch_audit_batch_nonempty
    check (btrim(batch_id) <> ''),
  constraint lead_attribution_patch_audit_reason_nonempty
    check (btrim(reason) <> '')
);

comment on table private.lead_attribution_patch_audit is
  'Snapshot privado e reversível de correções determinísticas em lead_attribution; não armazena contato ou PII.';

revoke all on table private.lead_attribution_patch_audit from public, anon, authenticated;
grant select, insert, update on table private.lead_attribution_patch_audit to service_role;
