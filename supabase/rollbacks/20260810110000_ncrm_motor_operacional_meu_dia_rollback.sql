-- Kill switch da aplicação automática. Preserva dados e devolve o catálogo
-- anterior; não apaga histórico de classificação da Sara.
BEGIN;
REVOKE ALL ON FUNCTION public.ncrm_sara_aplicar_proxima_acao(bigint,bigint,text) FROM authenticated;
DROP FUNCTION IF EXISTS public.ncrm_sara_aplicar_proxima_acao(bigint,bigint,text);
UPDATE public.ncrm_acao_padrao SET ativa=true;
DROP POLICY IF EXISTS ncrm_momento_padrao_leitura ON public.ncrm_momento_padrao;
REVOKE ALL ON public.ncrm_momento_padrao FROM authenticated;
COMMIT;
