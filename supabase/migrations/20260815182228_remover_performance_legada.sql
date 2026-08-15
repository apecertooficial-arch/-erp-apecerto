-- A Central canônica já está ativa. Removemos a segunda arquitetura sem
-- remoção em cadeia: se algum objeto ainda depender dela, a migração falha fechada.

do $do$
declare v_jobid bigint;
begin
  select jobid into v_jobid from cron.job where jobname = 'perf_snapshot_diario';
  if v_jobid is not null then perform cron.unschedule(v_jobid); end if;
end
$do$;

drop function if exists public.performance_corretores(timestamptz, timestamptz);
drop function if exists public.performance_operacional(timestamptz, timestamptz);
drop function if exists public.performance_extra(timestamptz, timestamptz);
drop function if exists public.perf_snapshot_diario();
drop function if exists public.perf_scores_corretores(timestamptz, timestamptz);
drop function if exists public.perf_metricas_base(timestamptz, timestamptz);
drop function if exists public.performance_corretores_base(timestamptz, timestamptz);
drop function if exists public.perf_amostrar_online();

drop table if exists public.perf_snapshots;
