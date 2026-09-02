-- Identifica cada recuperacao administrativa para permitir auditoria e rollback
-- exatos, sem depender apenas do horario de ingestao.

begin;

alter table private.meta_lead_submissions
  add column if not exists recovery_batch text;

alter table private.meta_lead_submissions
  drop constraint if exists meta_lead_submissions_recovery_batch_valid;

alter table private.meta_lead_submissions
  add constraint meta_lead_submissions_recovery_batch_valid
  check (recovery_batch is null or recovery_batch ~ '^[a-z0-9_:-]{8,120}$');

create index if not exists meta_lead_submissions_recovery_batch_idx
  on private.meta_lead_submissions (recovery_batch)
  where recovery_batch is not null;

comment on column private.meta_lead_submissions.recovery_batch is
  'Identificador tecnico do lote de recuperacao; nulo para ingestao normal.';

commit;
