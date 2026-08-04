-- Em caso de rollback, interrompe a agenda. As atribuicoes ja executadas nao
-- sao desfeitas automaticamente para preservar atendimentos iniciados.

do $$
begin
  if exists (select 1 from cron.job where jobname = 'f2-distribuicao-programada-20260805') then
    perform cron.unschedule('f2-distribuicao-programada-20260805');
  end if;
end
$$;

drop function if exists ncrm_private.f2_distribuicao_programada_tick();
drop function if exists ncrm_private.f2_distribuir_programados(integer);
