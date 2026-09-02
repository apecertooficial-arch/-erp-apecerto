-- Staging privado e efemero para importar a exportacao oficial em lotes.
-- A tabela e esvaziada na propria transacao de recuperacao e removida depois.

begin;

create table if not exists private.meta_lead_recovery_stage (
  batch_id text not null,
  meta_lead_id text not null,
  payload jsonb not null,
  created_at timestamptz not null default now(),
  primary key (batch_id, meta_lead_id),
  constraint meta_lead_recovery_stage_batch_valid
    check (batch_id ~ '^[a-z0-9_:-]{8,120}$'),
  constraint meta_lead_recovery_stage_id_valid
    check (meta_lead_id ~ '^[0-9]{15,17}$')
);

alter table private.meta_lead_recovery_stage enable row level security;
revoke all on table private.meta_lead_recovery_stage from public, anon, authenticated;
grant select, insert, delete on table private.meta_lead_recovery_stage to service_role;

comment on table private.meta_lead_recovery_stage is
  'Staging privado efemero para recuperacao administrativa; deve ficar vazio fora da janela.';

commit;
