-- Desliga o agendamento e remove o que esta migration acrescentou.
-- As notificacoes ja criadas NAO sao apagadas: sao registro de pendencia real.
DO $rb$
BEGIN
  IF to_regclass('cron.job') IS NOT NULL THEN
    PERFORM cron.unschedule('ncrm_notificacoes_sincronizar')
      WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'ncrm_notificacoes_sincronizar');
  END IF;
END $rb$;

DROP FUNCTION IF EXISTS public.ncrm_notificacoes_marcar_todas();
DROP TABLE IF EXISTS public.ncrm_notificacao_silencio;

-- As colunas deep_link/silenciar_ate/repeticoes permanecem: sao aditivas e
-- remove-las apagaria o destino de notificacoes vivas.
