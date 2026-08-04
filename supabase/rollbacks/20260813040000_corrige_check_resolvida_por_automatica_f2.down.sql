-- Rollback: volta o CHECK ao conjunto original.
--
-- ATENÇÃO: só é seguro depois de normalizar as linhas já gravadas, senão o
-- ADD CONSTRAINT falha na validação:
--   UPDATE public.ncrm_notificacao SET resolvida_por='automatica'
--    WHERE resolvida_por='automatica_f2';
--
-- E lembre que voltar este CHECK sem também reverter 20260813020000 recria o
-- defeito: a confirmação da primeira abordagem volta a abortar.

BEGIN;

UPDATE public.ncrm_notificacao
   SET resolvida_por = 'automatica'
 WHERE resolvida_por = 'automatica_f2';

ALTER TABLE public.ncrm_notificacao
  DROP CONSTRAINT IF EXISTS ncrm_notificacao_resolvida_por_check;

ALTER TABLE public.ncrm_notificacao
  ADD CONSTRAINT ncrm_notificacao_resolvida_por_check
  CHECK (resolvida_por IS NULL
         OR resolvida_por = ANY (ARRAY['automatica'::text, 'usuario'::text]));

COMMIT;
