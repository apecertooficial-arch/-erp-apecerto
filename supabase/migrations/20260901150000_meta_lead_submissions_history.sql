-- Preserva cada submissao do Meta Lead Ads sem transformar o cadastro da
-- pessoa em uma lista duplicada. private.lead_attribution continua sendo o
-- snapshot comercial atual; esta tabela e o ledger imutavel por leadgen_id.

begin;

create table if not exists private.meta_lead_submissions (
  meta_lead_id text primary key,
  lead_id bigint not null references public.leads(id) on delete restrict,
  created_time timestamptz not null,
  source text,
  medium text,
  platform text,
  page_id text,
  form_id text,
  campaign_name text,
  campaign_id text,
  adset_name text,
  adset_id text,
  ad_name text,
  ad_id text,
  is_organic boolean,
  recovered boolean not null default false,
  ingested_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint meta_lead_submissions_id_valid
    check (meta_lead_id ~ '^[0-9]{15,17}$'),
  constraint meta_lead_submissions_campaign_id_valid
    check (campaign_id is null or campaign_id ~ '^[0-9]{15,20}$'),
  constraint meta_lead_submissions_adset_id_valid
    check (adset_id is null or adset_id ~ '^[0-9]{15,20}$'),
  constraint meta_lead_submissions_ad_id_valid
    check (ad_id is null or ad_id ~ '^[0-9]{15,20}$')
);

create index if not exists meta_lead_submissions_lead_time_idx
  on private.meta_lead_submissions (lead_id, created_time desc);
create index if not exists meta_lead_submissions_campaign_time_idx
  on private.meta_lead_submissions (campaign_id, created_time desc);

comment on table private.meta_lead_submissions is
  'Ledger sem PII: uma linha por submissao Meta Lead Ads, inclusive repeticoes da mesma pessoa.';

alter table private.meta_lead_submissions enable row level security;
revoke all on table private.meta_lead_submissions from public, anon, authenticated;
grant select, insert, update on table private.meta_lead_submissions to service_role;

create or replace function private.motor_atribuicao_meta_por_campos(
  p_lead_id bigint,
  p_contexto jsonb
)
returns jsonb
language plpgsql
security definer
set search_path=''
as $function$
declare
  v_payload jsonb:=coalesce(p_contexto->'entrada_payload',p_contexto,'{}'::jsonb);
  v_meta_lead_id text:=btrim(coalesce(v_payload->>'meta_lead_id',v_payload->>'leadgen_id',''));
  v_existing_lead_id bigint;
  v_touch jsonb;
  v_seen_at timestamptz:=now();
  v_updated_current_count integer:=0;
begin
  if p_lead_id is null then
    raise exception using errcode='22023',message='META_ATTRIBUTION_LEAD_REQUIRED';
  end if;
  if v_meta_lead_id='' then
    return jsonb_build_object('ok',true,'aplicado',false,'motivo','meta_lead_id_ausente');
  end if;
  if v_meta_lead_id !~ '^[0-9]{15,17}$' then
    raise exception using errcode='22023',message='META_LEAD_ID_INVALID';
  end if;

  if nullif(v_payload->>'meta_created_time','') is not null then
    begin
      v_seen_at:=(v_payload->>'meta_created_time')::timestamptz;
    exception when others then
      raise exception using errcode='22007',message='META_CREATED_TIME_INVALID';
    end;
  end if;

  select q.lead_id into v_existing_lead_id
  from (
    select a.lead_id
    from private.lead_attribution a
    where a.meta_lead_id=v_meta_lead_id
    union all
    select s.lead_id
    from private.meta_lead_submissions s
    where s.meta_lead_id=v_meta_lead_id
  ) q
  limit 1;
  if v_existing_lead_id is not null and v_existing_lead_id<>p_lead_id then
    raise exception using errcode='23505',message='META_LEAD_ID_CONFLICT';
  end if;

  v_touch:=jsonb_strip_nulls(jsonb_build_object(
    'source',nullif(v_payload->>'source',''),
    'medium',nullif(v_payload->>'medium',''),
    'platform',nullif(v_payload->>'platform',''),
    'campaign',nullif(v_payload->>'meta_campaign_name',''),
    'campaign_id',nullif(v_payload->>'meta_campaign_id',''),
    'adset',nullif(v_payload->>'meta_adset_name',''),
    'adset_id',nullif(v_payload->>'meta_adset_id',''),
    'ad',nullif(v_payload->>'meta_ad_name',''),
    'ad_id',nullif(v_payload->>'meta_ad_id',''),
    'form_id',nullif(v_payload->>'meta_form_id',''),
    'page_id',nullif(v_payload->>'meta_page_id',''),
    'leadgen_id',v_meta_lead_id,
    'is_organic',nullif(v_payload->>'meta_is_organic',''),
    'created_time',v_seen_at
  ));

  insert into private.meta_lead_submissions(
    meta_lead_id,lead_id,created_time,source,medium,platform,page_id,form_id,
    campaign_name,campaign_id,adset_name,adset_id,ad_name,ad_id,is_organic,
    recovered,updated_at
  ) values (
    v_meta_lead_id,p_lead_id,v_seen_at,
    nullif(v_payload->>'source',''),nullif(v_payload->>'medium',''),
    nullif(v_payload->>'platform',''),nullif(v_payload->>'meta_page_id',''),
    nullif(v_payload->>'meta_form_id',''),nullif(v_payload->>'meta_campaign_name',''),
    nullif(v_payload->>'meta_campaign_id',''),nullif(v_payload->>'meta_adset_name',''),
    nullif(v_payload->>'meta_adset_id',''),nullif(v_payload->>'meta_ad_name',''),
    nullif(v_payload->>'meta_ad_id',''),
    case lower(nullif(v_payload->>'meta_is_organic',''))
      when 'true' then true when 'false' then false else null end,
    false,now()
  )
  on conflict (meta_lead_id) do update set
    source=coalesce(excluded.source,private.meta_lead_submissions.source),
    medium=coalesce(excluded.medium,private.meta_lead_submissions.medium),
    platform=coalesce(excluded.platform,private.meta_lead_submissions.platform),
    page_id=coalesce(excluded.page_id,private.meta_lead_submissions.page_id),
    form_id=coalesce(excluded.form_id,private.meta_lead_submissions.form_id),
    campaign_name=coalesce(excluded.campaign_name,private.meta_lead_submissions.campaign_name),
    campaign_id=coalesce(excluded.campaign_id,private.meta_lead_submissions.campaign_id),
    adset_name=coalesce(excluded.adset_name,private.meta_lead_submissions.adset_name),
    adset_id=coalesce(excluded.adset_id,private.meta_lead_submissions.adset_id),
    ad_name=coalesce(excluded.ad_name,private.meta_lead_submissions.ad_name),
    ad_id=coalesce(excluded.ad_id,private.meta_lead_submissions.ad_id),
    is_organic=coalesce(excluded.is_organic,private.meta_lead_submissions.is_organic),
    updated_at=now()
  where private.meta_lead_submissions.lead_id=excluded.lead_id;

  insert into private.lead_attribution(
    lead_id,first_touch,last_touch,source,medium,campaign,campaign_id,
    adset_id,ad_id,meta_lead_id,first_seen_at,last_seen_at,updated_at
  ) values (
    p_lead_id,v_touch,v_touch,
    nullif(v_payload->>'source',''),nullif(v_payload->>'medium',''),
    nullif(v_payload->>'meta_campaign_name',''),
    nullif(v_payload->>'meta_campaign_id',''),
    nullif(v_payload->>'meta_adset_id',''),nullif(v_payload->>'meta_ad_id',''),
    v_meta_lead_id,v_seen_at,v_seen_at,now()
  )
  on conflict (lead_id) do update set
    first_touch=case
      when private.lead_attribution.first_touch='{}'::jsonb then excluded.first_touch
      else private.lead_attribution.first_touch
    end,
    last_touch=excluded.last_touch,
    source=excluded.source,
    medium=excluded.medium,
    campaign=excluded.campaign,
    campaign_id=excluded.campaign_id,
    adset_id=excluded.adset_id,
    ad_id=excluded.ad_id,
    meta_lead_id=excluded.meta_lead_id,
    last_seen_at=excluded.last_seen_at,
    updated_at=now()
  where excluded.last_seen_at>=private.lead_attribution.last_seen_at;

  get diagnostics v_updated_current_count=row_count;
  return jsonb_build_object(
    'ok',true,
    'aplicado',true,
    'meta_lead_id',v_meta_lead_id,
    'historico_registrado',true,
    'atualizou_atribuicao_atual',(v_updated_current_count=1)
  );
end
$function$;

revoke all on function private.motor_atribuicao_meta_por_campos(bigint,jsonb)
  from public,anon,authenticated;
grant execute on function private.motor_atribuicao_meta_por_campos(bigint,jsonb)
  to service_role;

commit;
