-- Impede que o CRM Nova Era crie uma segunda carteira em paralelo ao Funil 2.
-- Distribuição/roleta continua independente; somente o destino operacional é F2.
SELECT cron.unschedule('ncrm_reconciliar')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'ncrm_reconciliar');

SELECT cron.unschedule('ncrm_reativar_por_resposta')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'ncrm_reativar_por_resposta');

SELECT cron.unschedule('ncrm_entrada_distribuicao')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'ncrm_entrada_distribuicao');

UPDATE public.ncrm_ingest_config
SET ativo = false, atualizado_em = now()
WHERE id = true AND ativo IS DISTINCT FROM false;

UPDATE public.ncrm_entrada_config
SET escopo = 'nenhum', atualizado_em = now()
WHERE id = true AND escopo IS DISTINCT FROM 'nenhum';

-- O job f2_entrada_distribuicao já promove a carteira a cada minuto. O guardião
-- mantém apenas o resgate independente e a detecção de leads presos.
SELECT cron.alter_job(
  job_id := (SELECT jobid FROM cron.job WHERE jobname = 'guardiao-entrada'),
  command := 'select public.distribuir_leads_orfaos(); select public.ncrm_guardiao_entrada();'
);
