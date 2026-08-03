SELECT public.test_assert(
  (SELECT relrowsecurity
     FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname='public' AND c.relname='ncrm_sla_redistribuicao_config'),
  '#rls1 configuração de redistribuição tem RLS ligada');

SELECT public.test_assert(
  EXISTS (
    SELECT 1 FROM pg_policies
     WHERE schemaname='public'
       AND tablename='ncrm_sla_redistribuicao_config'
       AND policyname='ncrm_sla_config_authenticated_select'
       AND cmd='SELECT'
       AND 'authenticated'=ANY(roles)
  ),
  '#rls2 policy de leitura autenticada existe');

SELECT public.test_assert(
  has_table_privilege('authenticated','public.ncrm_sla_redistribuicao_config','SELECT')
  AND NOT has_table_privilege('authenticated','public.ncrm_sla_redistribuicao_config','INSERT')
  AND NOT has_table_privilege('authenticated','public.ncrm_sla_redistribuicao_config','UPDATE')
  AND NOT has_table_privilege('authenticated','public.ncrm_sla_redistribuicao_config','DELETE'),
  '#rls3 authenticated pode ler e não pode alterar');

SELECT public.test_assert(
  NOT has_table_privilege('anon','public.ncrm_sla_redistribuicao_config','SELECT')
  AND NOT has_table_privilege('anon','public.ncrm_sla_redistribuicao_config','INSERT')
  AND NOT has_table_privilege('anon','public.ncrm_sla_redistribuicao_config','UPDATE')
  AND NOT has_table_privilege('anon','public.ncrm_sla_redistribuicao_config','DELETE'),
  '#rls4 anon não acessa a configuração');

SET ROLE authenticated;
SELECT public.test_assert(
  (SELECT count(*) FROM public.ncrm_sla_redistribuicao_config)=1,
  '#rls5 authenticated lê a linha sob RLS');
RESET ROLE;
