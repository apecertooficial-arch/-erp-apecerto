-- Remove os recursos efemeros depois da recuperacao confirmada. O ledger,
-- snapshots e rollback permanecem; nenhum dado de contato fica no staging.

begin;

drop function if exists private.recover_meta_official_batch(text);
drop table if exists private.meta_lead_recovery_stage;

commit;
