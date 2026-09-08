begin;

do $unpatch_motor$
declare
  v_def text;
  v_new text;
begin
  v_def:=pg_get_functiondef(
    'public.motor_campos_deterministico(bigint,text,text,jsonb,jsonb,bigint,bigint)'::regprocedure
  );
  v_new:=replace(
    v_def,
    $with_initial$      v_sync:=private.motor_atribuicao_meta_por_campos(v_lead_id,v_contexto);
      perform private.enqueue_meta_initial_lead_event(
        v_lead_id,
        p_neg_id,
        btrim(coalesce(
          v_contexto->'entrada_payload'->>'meta_lead_id',
          v_contexto->'entrada_payload'->>'leadgen_id',
          v_contexto->>'meta_lead_id',
          v_contexto->>'leadgen_id',
          ''
        ))
      );$with_initial$,
    $without_initial$      v_sync:=private.motor_atribuicao_meta_por_campos(v_lead_id,v_contexto);$without_initial$
  );
  if v_new<>v_def then execute v_new; end if;
end
$unpatch_motor$;

create or replace function private.enqueue_meta_crm_event(
  p_event_type text,
  p_source_table text,
  p_source_id text,
  p_negocio_id bigint,
  p_event_time timestamptz default now()
)
returns uuid
language plpgsql
security definer
set search_path=''
as $function$
declare
  v_delivery_id uuid;
  v_event_id text := p_event_type || '-' || p_source_id;
begin
  if p_event_type not in (
       'responded','qualification_started','qualified',
       'visit_scheduled','visit','proposal','purchase'
     )
     or coalesce(p_source_table, '') = ''
     or coalesce(p_source_id, '') = ''
     or p_negocio_id is null then
    return null;
  end if;

  insert into private.tracking_delivery_logs
    (channel,event_id,event_type,source_table,source_id,negocio_id,payload)
  values
    ('meta_crm',v_event_id,p_event_type,p_source_table,p_source_id,p_negocio_id,
     jsonb_build_object(
       'event_type',p_event_type,
       'source_table',p_source_table,
       'source_id',p_source_id,
       'negocio_id',p_negocio_id,
       'event_time',coalesce(p_event_time, now())
     ))
  on conflict (channel,event_id) do nothing
  returning id into v_delivery_id;

  if v_delivery_id is not null then
    perform private.dispatch_tracking_delivery(v_delivery_id);
  end if;
  return v_delivery_id;
end
$function$;

revoke all on function private.enqueue_meta_crm_event(text,text,text,bigint,timestamptz)
  from public,anon,authenticated;
grant execute on function private.enqueue_meta_crm_event(text,text,text,bigint,timestamptz)
  to service_role;

drop function if exists private.enqueue_meta_initial_lead_event(bigint,bigint,text);

commit;
