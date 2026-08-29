-- O dispatcher nao pode parar se o modulo opcional de alertas operacionais
-- ainda nao tiver sido instalado. O processamento comercial continua e os
-- alertas passam a ser chamados automaticamente quando as RPCs existirem.
begin;

set local statement_timeout='60s';
set local lock_timeout='10s';
select pg_advisory_xact_lock(hashtextextended('central_dispatcher_alertas_opcionais',0));

do $patch$
declare v_def text; v_new text;
begin
  select pg_get_functiondef(
    'private.motor_dispatcher_processar_item(bigint,text,uuid,boolean)'::regprocedure
  ) into v_def;
  if md5(v_def)<>'1708a1ff419d274c28592e6420ba367c' then
    raise exception 'DISPATCHER_ALERT_PATCH_BLOCKED: funcao mudou (%)',md5(v_def);
  end if;

  v_new:=replace(v_def,
    $old$    perform public.motor_resolver_alerta_fila(r.id,'automacao_inativa');$old$,
    $new$    if to_regprocedure('public.motor_resolver_alerta_fila(bigint,text)') is not null then
      perform public.motor_resolver_alerta_fila(r.id,'automacao_inativa');
    end if;$new$);
  v_new:=replace(v_new,
    $old$    perform public.motor_resolver_alerta_fila(r.id,'fila_retomada');$old$,
    $new$    if to_regprocedure('public.motor_resolver_alerta_fila(bigint,text)') is not null then
      perform public.motor_resolver_alerta_fila(r.id,'fila_retomada');
    end if;$new$);
  v_new:=replace(v_new,
    $old$      perform public.motor_alertar_fila_sem_elegiveis(
        r.id,r.automacao_id,r.automacao_versao_id,r.bloco_id,
        r.tentativas,v_delay,clock_timestamp()
      );$old$,
    $new$      if to_regprocedure('public.motor_alertar_fila_sem_elegiveis(bigint,bigint,bigint,text,integer,integer,timestamp with time zone)') is not null then
        perform public.motor_alertar_fila_sem_elegiveis(
          r.id,r.automacao_id,r.automacao_versao_id,r.bloco_id,
          r.tentativas,v_delay,clock_timestamp()
        );
      end if;$new$);
  v_new:=replace(v_new,
    $old$      perform public.motor_resolver_alerta_fila(r.id,'fila_encerrada_com_erro');$old$,
    $new$      if to_regprocedure('public.motor_resolver_alerta_fila(bigint,text)') is not null then
        perform public.motor_resolver_alerta_fila(r.id,'fila_encerrada_com_erro');
      end if;$new$);

  if v_new=v_def
     or position('to_regprocedure(''public.motor_resolver_alerta_fila(bigint,text)'')' in v_new)=0
     or position('to_regprocedure(''public.motor_alertar_fila_sem_elegiveis' in v_new)=0 then
    raise exception 'DISPATCHER_ALERT_PATCH_FAILED: ancoras nao aplicadas';
  end if;
  execute v_new;
end
$patch$;

commit;
