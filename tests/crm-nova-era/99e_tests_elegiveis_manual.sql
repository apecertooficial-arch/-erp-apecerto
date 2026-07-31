-- Elegiveis com prioridade de novidade + Manual Operacional (admin-only).

-- 1. Elegiveis continua fechado a servico.
DO $$
DECLARE v jsonb;
BEGIN
  PERFORM set_config('request.jwt.claims', '{}', true);
  v := public.ncrm_sara_elegiveis(10);
  PERFORM public.test_assert(v->>'ok' = 'false' AND v->>'erro' = 'somente_servico',
    '#em1 elegiveis recusa quem nao e servico');
END $$;

-- 2. A nova versao prioriza novidade e ignora quem saiu do quadro.
SELECT public.test_assert(
  pg_get_functiondef('public.ncrm_sara_elegiveis(integer)'::regprocedure) LIKE '%tem_novidade%'
  AND pg_get_functiondef('public.ncrm_sara_elegiveis(integer)'::regprocedure) LIKE '%saida IS NULL%',
  '#em2 elegiveis prioriza novidade e filtra saidas');

-- 3. Manual: tabela de linha unica, leitura de authenticated, escrita zero.
SELECT public.test_assert(to_regclass('public.ncrm_manual_operacional') IS NOT NULL,
  '#em3 tabela do manual existe');
SELECT public.test_assert(
  (SELECT count(*) FROM public.ncrm_manual_operacional) = 1,
  '#em4 manual nasce com exatamente uma linha');
SELECT public.test_assert(
  has_table_privilege('authenticated','public.ncrm_manual_operacional','SELECT')
  AND NOT has_table_privilege('authenticated','public.ncrm_manual_operacional','UPDATE')
  AND NOT has_table_privilege('anon','public.ncrm_manual_operacional','SELECT'),
  '#em5 authenticated le, nao escreve; anon nada');

-- 4. RPC de salvar: fail-closed sem sessao.
DO $$
DECLARE v jsonb;
BEGIN
  PERFORM set_config('request.jwt.claims', '{}', true);
  v := public.ncrm_manual_salvar('teste');
  PERFORM public.test_assert(v->>'ok' = 'false' AND v->>'erro' = 'nao_autenticado',
    '#em6 salvar manual sem JWT e recusado');
END $$;

SELECT public.test_assert(
  NOT has_function_privilege('anon','public.ncrm_manual_salvar(text)','EXECUTE')
  AND has_function_privilege('authenticated','public.ncrm_manual_salvar(text)','EXECUTE'),
  '#em7 anon nao executa a RPC do manual; authenticated sim');
