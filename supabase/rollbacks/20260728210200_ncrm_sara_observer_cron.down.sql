-- Rollback: cron do runner observer (só objetos ncrm_*).
DO $do$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname='pg_cron') THEN PERFORM cron.unschedule('ncrm_sara_observer'); END IF;
EXCEPTION WHEN others THEN NULL; END $do$;
DROP FUNCTION IF EXISTS ncrm_private.sara_runner_tick();
DROP TABLE IF EXISTS public.ncrm_sara_runner_config;
