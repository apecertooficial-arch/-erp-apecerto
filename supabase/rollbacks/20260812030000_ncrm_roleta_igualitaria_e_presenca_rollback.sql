-- Rollback estrutural. Atribuições já realizadas são preservadas: desfazer
-- propriedade de lead automaticamente seria destrutivo e não auditável.
BEGIN;
DO $cron$
BEGIN
  IF EXISTS(SELECT 1 FROM cron.job WHERE jobname='ncrm-roleta-igualitaria-novos') THEN
    PERFORM cron.unschedule('ncrm-roleta-igualitaria-novos');
  END IF;
END
$cron$;
DROP FUNCTION IF EXISTS public.ncrm_distribuir_lead_novo(bigint);
DROP FUNCTION IF EXISTS ncrm_private.ncrm_distribuir_novos_pendentes(integer);
DROP FUNCTION IF EXISTS ncrm_private.ncrm_distribuir_negocio_igualitario(bigint);
DROP TABLE IF EXISTS ncrm_private.ncrm_distribuicao_novo_pendente;
DROP TABLE IF EXISTS ncrm_private.ncrm_roleta_igual_estado;
COMMIT;
