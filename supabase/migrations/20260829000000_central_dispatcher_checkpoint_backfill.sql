-- Converte os prazos existentes em checkpoints duráveis sem reexecutar IA,
-- reenviar mensagens ou alterar o estado comercial dos leads.
begin;

set local statement_timeout='120s';
set local lock_timeout='10s';
select pg_advisory_xact_lock(hashtextextended('central_dispatcher_checkpoint_backfill',0));

do $preflight$
begin
  if to_regprocedure('public.f2_sara_agendar_checkpoint(uuid,integer,text,text,timestamp with time zone,jsonb)') is null then
    raise exception 'CHECKPOINT_BACKFILL_BLOCKED: f2_sara_agendar_checkpoint ausente';
  end if;
  if not exists(select 1 from public.automacoes where id=49 and ativa and status='publicado' and not coalesce(arquivada,false)) then
    raise exception 'CHECKPOINT_BACKFILL_BLOCKED: Inteligencia de Conversa nao esta publicada';
  end if;
end
$preflight$;

-- Remove somente eventos de prazo pendentes que serão substituídos pelo
-- checkpoint equivalente. Histórico processado e mensagens não são tocados.
update public.motor_fila mf
   set status='cancelado',processado_em=clock_timestamp(),
       ultimo_erro='substituido_por_checkpoint_duravel'
 where mf.status='pendente'
   and coalesce(mf.lead->>'__sara_checkpoint','false')<>'true'
   and mf.lead->>'__sara_event_type' in ('lead.next_action_due','lead.cadence_due')
   and exists(
     select 1 from public.f2_lead f
      where f.id::text=mf.lead->>'__funil_lead_id'
        and public.f2_sara_evento_elegivel(f.id)
        and f.proxima_acao_em is not null
   );

do $backfill$
declare r record;
begin
  for r in
    select f.id,f.versao,f.momento_codigo,f.acao_codigo,f.proxima_acao_em
      from public.f2_lead f
     where public.f2_sara_evento_elegivel(f.id)
       and f.proxima_acao_em is not null
       and not exists(
         select 1 from public.motor_fila mf
          where mf.automacao_id=49 and mf.status='pendente'
            and mf.lead->>'__sara_checkpoint'='true'
            and mf.lead->>'__funil_lead_id'=f.id::text
       )
     order by f.proxima_acao_em,f.id
  loop
    perform public.f2_sara_agendar_checkpoint(
      r.id,
      r.versao,
      case when r.momento_codigo='CADENCIA_SEM_RESPOSTA'
        then 'lead.cadence_due' else 'lead.next_action_due' end,
      'checkpoint-backfill:'||r.id::text||':'||r.versao::text,
      r.proxima_acao_em,
      jsonb_build_object(
        'codigo',r.acao_codigo,
        'tipo',case when r.momento_codigo='CADENCIA_SEM_RESPOSTA'
          then 'cadencia' else 'proxima_acao' end,
        'responsavel','corretor_atual',
        'executar_em',r.proxima_acao_em,
        'origem','checkpoint_backfill_sem_replay'
      )
    );
  end loop;
end
$backfill$;

do $verify$
declare v_faltantes integer;
begin
  select count(*) into v_faltantes
    from public.f2_lead f
   where public.f2_sara_evento_elegivel(f.id)
     and f.proxima_acao_em is not null
     and not exists(
       select 1 from public.motor_fila mf
        where mf.automacao_id=49 and mf.status='pendente'
          and mf.lead->>'__sara_checkpoint'='true'
          and mf.lead->>'__funil_lead_id'=f.id::text
     );
  if v_faltantes<>0 then
    raise exception 'CHECKPOINT_BACKFILL_FAILED: % leads ainda sem checkpoint',v_faltantes;
  end if;
end
$verify$;

commit;
