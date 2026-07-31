-- Remove o Web Push por inteiro. Nao ha dado de atendimento aqui: inscricao de
-- dispositivo e fila de aviso se refazem quando o app registra de novo.
DO $rb$
BEGIN
  IF to_regclass('cron.job') IS NOT NULL THEN
    PERFORM cron.unschedule('ncrm_push_enfileirar')
      WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'ncrm_push_enfileirar');
  END IF;
END $rb$;

DROP FUNCTION IF EXISTS public.ncrm_push_meus_dispositivos();
DROP FUNCTION IF EXISTS ncrm_private.push_proximos(int);
DROP FUNCTION IF EXISTS ncrm_private.push_resultado(bigint,boolean,int,text);
DROP FUNCTION IF EXISTS ncrm_private.push_enfileirar(int);
DROP FUNCTION IF EXISTS public.ncrm_push_revogar(text,text);
DROP FUNCTION IF EXISTS public.ncrm_push_registrar(text,text,text,text);
DROP TABLE IF EXISTS public.ncrm_push_fila;
DROP TABLE IF EXISTS public.ncrm_push_subscription;
