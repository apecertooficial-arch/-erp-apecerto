-- Rollback: entrada automática por distribuição do Funil 2.0.
--
-- Para desligar SEM rollback (preferível em incidente, é reversível na hora):
--   UPDATE public.f2_entrada_config SET ativo = false;

BEGIN;

DO $cron$
BEGIN
  PERFORM cron.unschedule('f2_entrada_distribuicao');
EXCEPTION WHEN OTHERS THEN NULL;
END
$cron$;

DROP FUNCTION IF EXISTS public.f2_entrada_por_distribuicao(integer);

DROP POLICY IF EXISTS f2_entrada_config_admin_select ON public.f2_entrada_config;
DROP TABLE IF EXISTS public.f2_entrada_config;

COMMIT;
