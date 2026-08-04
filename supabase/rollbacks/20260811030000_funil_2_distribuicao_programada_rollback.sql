-- Remove somente a agenda e os objetos de controle.
-- Distribuicoes que ja aconteceram nao sao revertidas automaticamente para
-- evitar retirar leads de corretores que ja tenham iniciado atendimento.

do $$
begin
  if exists (select 1 from cron.job where jobname = 'f2-distribuicao-programada-20260805') then
    perform cron.unschedule('f2-distribuicao-programada-20260805');
  end if;
end
$$;

drop function if exists ncrm_private.f2_distribuicao_programada_tick();
drop function if exists ncrm_private.f2_distribuir_programados(integer);
drop table if exists ncrm_private.f2_distribuicao_programada;
