-- Corte guardado shadow -> worker.
-- Esta migration NAO deve ser aplicada junto da instalacao: exige heartbeat
-- recente, dois minutos de shadow e fila dentro do SLA antes de retirar os
-- consumidores diretos do relogio. O relogio permanece apenas como fallback.

do $preflight_cutover$
declare
  v_estado private.motor_dispatcher_estado%rowtype;
  v_clock text;
  v_sem_checkpoint integer;
begin
  select * into strict v_estado
    from private.motor_dispatcher_estado where singleton for update;
  if v_estado.modo<>'shadow' then
    raise exception 'CUTOVER_BLOCKED: modo precisa ser shadow, atual=%',v_estado.modo;
  end if;
  if v_estado.worker_id is null
     or v_estado.heartbeat_em is null
     or v_estado.heartbeat_em<clock_timestamp()-interval '45 seconds' then
    raise exception 'CUTOVER_BLOCKED: heartbeat do worker ausente ou expirado';
  end if;
  if v_estado.shadow_desde is null
     or v_estado.shadow_desde>clock_timestamp()-interval '2 minutes' then
    raise exception 'CUTOVER_BLOCKED: shadow ainda nao completou dois minutos';
  end if;
  if coalesce(v_estado.lag_seconds,0)>60 then
    raise exception 'CUTOVER_BLOCKED: lag %.3fs excede SLA de 60s',v_estado.lag_seconds;
  end if;
  if exists(
    select 1 from public.motor_fila
     where status='processando' and worker_id is not null
  ) then
    raise exception 'CUTOVER_BLOCKED: item do worker ja esta em processamento durante shadow';
  end if;
  select count(*) into v_sem_checkpoint
    from public.f2_lead f
   where public.f2_sara_evento_elegivel(f.id)
     and not exists(
       select 1 from public.motor_fila mf
        where mf.automacao_id=49
          and mf.status='pendente'
          and mf.lead->>'__sara_checkpoint'='true'
          and mf.lead->>'__funil_lead_id'=f.id::text
     );
  if v_sem_checkpoint>0 then
    raise exception
      'CUTOVER_BLOCKED: % leads ativos ainda nao possuem checkpoint duravel',
      v_sem_checkpoint;
  end if;

  select pg_get_functiondef('public.motor_relogio_central()'::regprocedure) into v_clock;
  if position('compatibilidade_cron_due_at' in v_clock)=0
     or position('dispatcher_externo_pendente' in v_clock)=0
     or position('public.motor_processar_fila()' in v_clock)=0
     or position('public.motor_evento_prazo(150)' in v_clock)=0 then
    raise exception 'FUNCTION_STALE_VERSION: motor_relogio_central nao e a versao de transicao esperada';
  end if;

  update private.motor_dispatcher_estado
     set modo='worker',worker_desde=clock_timestamp(),
         motivo='worker_persistente_ativo',atualizado_em=clock_timestamp()
   where singleton;
end
$preflight_cutover$;

create or replace function public.motor_relogio_central()
returns jsonb
language plpgsql
security definer
set search_path=''
as $function$
declare v_resultado jsonb:='{}'::jsonb;
begin
  if not pg_try_advisory_xact_lock(hashtext('motor_relogio_central')) then
    return jsonb_build_object('ok',true,'ignorado','relogio_ja_em_execucao');
  end if;
  begin
    v_resultado:=v_resultado||jsonb_build_object(
      'dispatcher',public.motor_dispatcher_cron_tick()
    );
  exception when others then
    v_resultado:=v_resultado||jsonb_build_object(
      'dispatcher_erro',sqlstate||': '||sqlerrm
    );
  end;
  begin
    v_resultado:=v_resultado||jsonb_build_object(
      'mensagens_confirmadas',private.motor_reconciliar_mensagens_aceitas(10)
    );
  exception when others then
    v_resultado:=v_resultado||jsonb_build_object(
      'mensagens_confirmadas_erro',sqlstate||': '||sqlerrm
    );
  end;
  begin
    v_resultado:=v_resultado||jsonb_build_object(
      'mensagens_retentadas',private.motor_reprocessar_mensagens_recusadas(5)
    );
  exception when others then
    v_resultado:=v_resultado||jsonb_build_object(
      'mensagens_retentadas_erro',sqlstate||': '||sqlerrm
    );
  end;
  begin
    perform public.sla_msg_cache_refresh();
    v_resultado:=v_resultado||jsonb_build_object('cache_mensagens','atualizado');
  exception when others then
    v_resultado:=v_resultado||jsonb_build_object(
      'cache_mensagens_erro',sqlstate||': '||sqlerrm
    );
  end;
  v_resultado:=v_resultado||jsonb_build_object(
    'mensagem','event_driven_trigger',
    'due_at_executor','worker_persistente_com_fallback',
    'sara_cron_comercial',false,
    'checagem_diaria','desativada_event_driven'
  );
  return jsonb_build_object('ok',true,'fontes',v_resultado);
end
$function$;

revoke all on function public.motor_relogio_central()
  from public,anon,authenticated;
grant execute on function public.motor_relogio_central() to service_role;
