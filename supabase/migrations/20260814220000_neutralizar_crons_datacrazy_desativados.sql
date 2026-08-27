-- A Edge datacrazy-sync já é um stub desativado. Estes quatro jobs continuavam
-- fazendo HTTP sem produzir sincronização e ainda guardavam um token antigo no
-- texto do comando. Mantemos nome e agenda para rastreabilidade, mas inativos.

do $$
declare
  v_job record;
  v_encontrados integer := 0;
  v_restantes integer;
begin
  for v_job in
    select jobid
      from cron.job
     where jobname in (
       'datacrazy_sync_atividades',
       'datacrazy_sync_leads',
       'datacrazy_sync_negocios',
       'datacrazy_sync_stages'
     )
  loop
    v_encontrados := v_encontrados + 1;
    perform cron.alter_job(
      job_id := v_job.jobid,
      command := 'select 1 /* datacrazy-sync aposentado em 2026-08-14 */',
      active := false
    );
  end loop;

  if v_encontrados <> 4
     and not (v_encontrados = 0 and to_regclass('public.apecerto_baseline_metadata') is not null) then
    raise exception 'cron_datacrazy_quantidade_inesperada:%', v_encontrados;
  end if;

  select count(*) into v_restantes
    from cron.job
   where jobname like 'datacrazy_sync_%'
     and (active or command ilike '%functions/v1/datacrazy-sync%');

  if v_restantes <> 0 then
    raise exception 'cron_datacrazy_ainda_ativo:%', v_restantes;
  end if;
end
$$;
