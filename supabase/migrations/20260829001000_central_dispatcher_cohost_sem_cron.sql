-- O dispatcher passa a compartilhar a instância já paga do ERP. Depois do
-- cutover comprovado, manutenção e presença são chamadas pelo mesmo processo;
-- os três agendamentos comerciais substituídos são removidos.
begin;

set local statement_timeout='60s';
set local lock_timeout='10s';
select pg_advisory_xact_lock(hashtextextended('central_dispatcher_cohost_sem_cron',0));

do $preflight$
declare v_estado private.motor_dispatcher_estado%rowtype;
begin
  select * into strict v_estado from private.motor_dispatcher_estado where singleton for update;
  if v_estado.modo<>'worker'
     or v_estado.worker_id<>'apecerto-erp-dispatcher'
     or v_estado.heartbeat_em is null
     or v_estado.heartbeat_em<clock_timestamp()-interval '45 seconds' then
    raise exception 'COHOST_CUTOVER_BLOCKED: worker compartilhado ainda nao esta saudavel';
  end if;
end
$preflight$;

create or replace function public.motor_dispatcher_manutencao_tick(p_worker_id text)
returns jsonb
language plpgsql
security definer
set search_path=''
as $function$
declare v_resultado jsonb:='{}'::jsonb;
begin
  if not exists(
    select 1 from private.motor_dispatcher_estado
     where singleton and modo='worker' and worker_id=p_worker_id
       and heartbeat_em>=clock_timestamp()-interval '45 seconds'
  ) then
    return jsonb_build_object('ok',false,'motivo','worker_nao_primario_ou_sem_heartbeat');
  end if;
  if not pg_try_advisory_xact_lock(hashtextextended('motor_dispatcher_manutencao_tick',0)) then
    return jsonb_build_object('ok',true,'ignorado','manutencao_ja_em_execucao');
  end if;

  begin
    v_resultado:=v_resultado||jsonb_build_object(
      'mensagens_confirmadas',private.motor_reconciliar_mensagens_aceitas(10));
  exception when others then
    v_resultado:=v_resultado||jsonb_build_object('mensagens_confirmadas_erro',sqlstate||': '||sqlerrm);
  end;
  begin
    v_resultado:=v_resultado||jsonb_build_object(
      'mensagens_retentadas',private.motor_reprocessar_mensagens_recusadas(5));
  exception when others then
    v_resultado:=v_resultado||jsonb_build_object('mensagens_retentadas_erro',sqlstate||': '||sqlerrm);
  end;
  begin
    perform public.sla_msg_cache_refresh();
    v_resultado:=v_resultado||jsonb_build_object('cache_mensagens','atualizado');
  exception when others then
    v_resultado:=v_resultado||jsonb_build_object('cache_mensagens_erro',sqlstate||': '||sqlerrm);
  end;
  begin
    v_resultado:=v_resultado||jsonb_build_object(
      'presenca_expirada',public.presenca_derrubar_expirados());
  exception when others then
    v_resultado:=v_resultado||jsonb_build_object('presenca_expirada_erro',sqlstate||': '||sqlerrm);
  end;
  begin
    v_resultado:=v_resultado||jsonb_build_object(
      'presenca_avisos',public.presenca_avisar_pendentes());
  exception when others then
    v_resultado:=v_resultado||jsonb_build_object('presenca_avisos_erro',sqlstate||': '||sqlerrm);
  end;
  return jsonb_build_object('ok',true,'fontes',v_resultado);
end
$function$;

create or replace function public.motor_dispatcher_parar(p_worker_id text)
returns jsonb
language plpgsql
security definer
set search_path=''
as $function$
declare v_modo text; v_changed boolean:=false;
begin
  update private.motor_dispatcher_estado
     set modo=case when modo='shadow' then 'cron' else modo end,
         worker_id=case when modo='shadow' then null else worker_id end,
         shadow_desde=case when modo='shadow' then null else shadow_desde end,
         heartbeat_em=null,
         motivo=case when modo='shadow' then 'shadow_interrompido'
           else 'worker_cohost_aguardando_restart' end,
         atualizado_em=clock_timestamp()
   where singleton and worker_id=p_worker_id
   returning modo,true into v_modo,v_changed;
  return jsonb_build_object('ok',true,'modo',coalesce(v_modo,'inalterado'),
    'alterado',coalesce(v_changed,false));
end
$function$;

revoke all on function public.motor_dispatcher_manutencao_tick(text)
  from public,anon,authenticated;
grant execute on function public.motor_dispatcher_manutencao_tick(text) to service_role;
revoke all on function public.motor_dispatcher_parar(text)
  from public,anon,authenticated;
grant execute on function public.motor_dispatcher_parar(text) to service_role;

select cron.unschedule(jobid) from cron.job
 where jobname in (
   'motor-relogio-central',
   'presenca_derrubar_expirados',
   'presenca_avisar_pendentes'
 );

do $verify$
begin
  if exists(select 1 from cron.job where active and jobname in (
    'motor-relogio-central','presenca_derrubar_expirados','presenca_avisar_pendentes'
  )) then
    raise exception 'COHOST_CUTOVER_FAILED: cron comercial ainda ativo';
  end if;
end
$verify$;

commit;
