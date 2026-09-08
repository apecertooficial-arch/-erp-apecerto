-- Fecha a lacuna de cobertura da CAPI para CRM: cada submissao verdadeira do
-- Meta Lead Ads passa a gerar o primeiro estagio `Lead` no mesmo bloco
-- explicito que registra a atribuicao. O leadgen_id e a data originais sao
-- preservados; o outbox existente continua responsavel por idempotencia,
-- entrega e recibo.

begin;

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
       'lead','responded','qualification_started','qualified',
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

create or replace function private.enqueue_meta_initial_lead_event(
  p_lead_id bigint,
  p_negocio_id bigint,
  p_meta_lead_id text
)
returns uuid
language plpgsql
security definer
set search_path=''
as $function$
declare
  v_delivery_id uuid;
  v_event_time timestamptz;
  v_negocio_id bigint;
begin
  if p_lead_id is null
     or coalesce(btrim(p_meta_lead_id),'') !~ '^[0-9]{15,17}$' then
    return null;
  end if;

  select n.id into v_negocio_id
  from public.negocios n
  where n.lead_id=p_lead_id
    and (p_negocio_id is null or n.id=p_negocio_id)
  order by coalesce(n.ultima_movimentacao,n.criado_em) desc nulls last,n.id desc
  limit 1;

  if v_negocio_id is null and p_negocio_id is null then
    select n.id into v_negocio_id
    from public.negocios n
    where n.lead_id=p_lead_id
    order by coalesce(n.ultima_movimentacao,n.criado_em) desc nulls last,n.id desc
    limit 1;
  end if;

  select s.created_time into v_event_time
  from private.meta_lead_submissions s
  join public.leads l on l.id=s.lead_id
  where s.lead_id=p_lead_id
    and s.meta_lead_id=p_meta_lead_id
    and l.disparo_optout is not true
  limit 1;

  if v_negocio_id is null or v_event_time is null then
    return null;
  end if;

  v_delivery_id:=private.enqueue_meta_crm_event(
    'lead','meta_lead_submissions',p_meta_lead_id,v_negocio_id,v_event_time
  );
  return v_delivery_id;
end
$function$;

revoke all on function private.enqueue_meta_initial_lead_event(bigint,bigint,text)
  from public,anon,authenticated;
grant execute on function private.enqueue_meta_initial_lead_event(bigint,bigint,text)
  to service_role;

do $patch_motor$
declare
  v_def text;
  v_new text;
begin
  v_def:=pg_get_functiondef(
    'public.motor_campos_deterministico(bigint,text,text,jsonb,jsonb,bigint,bigint)'::regprocedure
  );
  if position('enqueue_meta_initial_lead_event' in v_def)>0 then
    return;
  end if;

  v_new:=replace(
    v_def,
    $old$      v_sync:=private.motor_atribuicao_meta_por_campos(v_lead_id,v_contexto);$old$,
    $new$      v_sync:=private.motor_atribuicao_meta_por_campos(v_lead_id,v_contexto);
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
      );$new$
  );

  if v_new=v_def or position('enqueue_meta_initial_lead_event' in v_new)=0 then
    raise exception 'META_INITIAL_LEAD_RUNTIME_PATCH_FAILED';
  end if;
  execute v_new;
end
$patch_motor$;

commit;
