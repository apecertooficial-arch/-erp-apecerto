BEGIN;
UPDATE public.ncrm_workflow_config SET status='encerrada',vigencia_fim=COALESCE(vigencia_fim,now()) WHERE versao=3;
UPDATE public.ncrm_workflow_config SET status='publicada',vigencia_fim=NULL WHERE versao=2;
DROP TABLE IF EXISTS public.ncrm_acao_padrao;
COMMIT;
