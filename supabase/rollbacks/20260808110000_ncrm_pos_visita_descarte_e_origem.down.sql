-- Rollback: pós-visita, motivos de descarte e origem da próxima ação.
-- Volta a whitelist de descarte para os seis originais e remove o que foi
-- acrescentado. Linhas que já usavam os motivos novos passam a violar o CHECK
-- antigo: por isso o rollback normaliza esses casos para 'outro' antes.
BEGIN;

DROP FUNCTION IF EXISTS public.ncrm_visitas_sem_resultado(int);
DROP FUNCTION IF EXISTS public.ncrm_registrar_resultado_visita(uuid,bigint,int,text,text,text);

DROP INDEX IF EXISTS public.visitas_sem_resultado_idx;
ALTER TABLE public.visitas DROP CONSTRAINT IF EXISTS visitas_resultado_check;
ALTER TABLE public.visitas
  DROP COLUMN IF EXISTS resultado,
  DROP COLUMN IF EXISTS resultado_em,
  DROP COLUMN IF EXISTS resultado_por;

ALTER TABLE public.ncrm_estado DROP CONSTRAINT IF EXISTS ncrm_estado_proxima_acao_origem_check;
ALTER TABLE public.ncrm_estado
  DROP COLUMN IF EXISTS proxima_acao_motivo,
  DROP COLUMN IF EXISTS proxima_acao_origem;

UPDATE public.ncrm_estado
   SET descarte_detalhe = coalesce(descarte_detalhe, '') || ' [motivo original: ' || descarte_motivo || ']',
       descarte_motivo = 'outro'
 WHERE descarte_motivo IN ('sem_resposta','fora_da_regiao','desistiu','nao_quer_contato','produto_incompativel');

ALTER TABLE public.ncrm_estado DROP CONSTRAINT IF EXISTS ncrm_estado_descarte_motivo_check;
ALTER TABLE public.ncrm_estado ADD CONSTRAINT ncrm_estado_descarte_motivo_check CHECK (
  descarte_motivo IS NULL OR descarte_motivo IN (
    'sem_interesse','sem_perfil_financeiro','numero_invalido','ja_comprou_concorrente','duplicado','outro')
);

COMMIT;
