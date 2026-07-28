-- Rollback: reconciliação/checkpoint (só objetos ncrm_*).
DO $do$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname='pg_cron') THEN PERFORM cron.unschedule('ncrm_reconciliar'); END IF;
EXCEPTION WHEN others THEN NULL; END $do$;
DROP FUNCTION IF EXISTS public.ncrm_reprocessar_ingest(int);
DROP FUNCTION IF EXISTS ncrm_private.reconciliar_mensagens(int,int,interval);
DROP FUNCTION IF EXISTS ncrm_private.resolver_negocio_por_conversa(uuid);
DROP TABLE IF EXISTS public.ncrm_ingest_checkpoint;
