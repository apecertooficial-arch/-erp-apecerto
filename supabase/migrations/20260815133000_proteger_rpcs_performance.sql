-- A Central de Performance sempre chama estas RPCs com o JWT da sessão.
-- Impede leitura anônima dos indicadores comerciais sem alterar o acesso dos
-- usuários autenticados nem o escopo calculado dentro das próprias funções.
revoke execute on function public.perf_scores_corretores(timestamptz, timestamptz) from anon;
revoke execute on function public.performance_extra(timestamptz, timestamptz) from anon;

grant execute on function public.perf_scores_corretores(timestamptz, timestamptz) to authenticated, service_role;
grant execute on function public.performance_extra(timestamptz, timestamptz) to authenticated, service_role;
