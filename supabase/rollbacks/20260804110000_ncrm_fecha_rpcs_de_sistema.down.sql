-- Restaura o estado anterior. Nao deve ser executado em producao: as concessoes
-- que ele devolve sao exatamente a exposicao que a migration corrigiu.
GRANT EXECUTE ON FUNCTION public.ncrm_registrar_primeira_humana(bigint, text, timestamptz) TO authenticated;
GRANT EXECUTE ON FUNCTION public.ncrm_sara_organizar(bigint, bigint) TO authenticated;
