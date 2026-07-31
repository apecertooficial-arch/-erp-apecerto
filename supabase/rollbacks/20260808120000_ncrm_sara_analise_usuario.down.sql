-- Rollback: remove a RPC e devolve o CHECK exclusivo do motor. As análises de
-- origem 'usuario' são recomputáveis (basta pedir de novo na ficha): saem antes
-- de reapertar a restrição.
BEGIN;
REVOKE SELECT (prazo_sugerido, confianca, etapa_sugerida) ON public.ncrm_sara_analise FROM authenticated;
DROP FUNCTION IF EXISTS public.ncrm_sara_analise_usuario(bigint,text,text,text,timestamptz,text,jsonb,numeric,text);
DELETE FROM public.ncrm_sara_analise WHERE origem = 'usuario';
ALTER TABLE public.ncrm_sara_analise DROP CONSTRAINT IF EXISTS ncrm_sara_analise_origem_check;
ALTER TABLE public.ncrm_sara_analise ADD CONSTRAINT ncrm_sara_analise_origem_check
  CHECK (origem = 'sara_runner');
COMMIT;
