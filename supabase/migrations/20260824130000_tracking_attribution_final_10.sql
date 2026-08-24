-- Tracking 360: fecha a atribuicao site -> CRM e corrige snapshots Meta.
--
-- O contrato continua explicito: nenhuma atribuicao e criada por trigger,
-- cron ou escritor oculto. O bloco Operacoes de campos precisa conter a
-- operacao correspondente para registrar o resultado canonico.

begin;

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

  select a.lead_id into v_existing_lead_id
    from private.lead_attribution a
   where a.meta_lead_id=v_meta_lead_id
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
    -- Snapshot atual: campos ausentes na nova entrada nao podem manter IDs de
    -- outra campanha e produzir uma atribuicao hibrida.
    source=excluded.source,
    medium=excluded.medium,
    campaign=excluded.campaign,
    campaign_id=excluded.campaign_id,
    adset_id=excluded.adset_id,
    ad_id=excluded.ad_id,
    meta_lead_id=excluded.meta_lead_id,
    last_seen_at=greatest(private.lead_attribution.last_seen_at,excluded.last_seen_at),
    updated_at=now();

  return jsonb_build_object('ok',true,'aplicado',true,'meta_lead_id',v_meta_lead_id);
end
$function$;

revoke all on function private.motor_atribuicao_meta_por_campos(bigint,jsonb)
  from public,anon,authenticated;
grant execute on function private.motor_atribuicao_meta_por_campos(bigint,jsonb)
  to service_role;

create or replace function private.motor_atribuicao_site_por_campos(
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
  v_tracking jsonb:=coalesce(
    p_contexto->'tracking',
    p_contexto->'entrada_payload'->'tracking',
    p_contexto->'entrada_payload'->'context'->'tracking',
    '{}'::jsonb
  );
  v_identity jsonb;
  v_first jsonb;
  v_last jsonb;
  v_site_lead_id uuid;
  v_page_view_id uuid;
  v_session_id uuid;
  v_first_seen_at timestamptz:=now();
  v_source text;
begin
  if p_lead_id is null then
    raise exception using errcode='22023',message='SITE_ATTRIBUTION_LEAD_REQUIRED';
  end if;
  if jsonb_typeof(v_tracking) is distinct from 'object' or v_tracking='{}'::jsonb then
    return jsonb_build_object('ok',true,'aplicado',false,'motivo','tracking_site_ausente');
  end if;

  v_identity:=coalesce(v_tracking->'identity','{}'::jsonb);
  v_first:=coalesce(v_tracking#>'{attribution,first}','{}'::jsonb);
  v_last:=coalesce(
    v_tracking#>'{attribution,last}',
    v_tracking#>'{attribution,current}',
    v_first,
    '{}'::jsonb
  );
  if jsonb_typeof(v_identity) is distinct from 'object'
     or jsonb_typeof(v_first) is distinct from 'object'
     or jsonb_typeof(v_last) is distinct from 'object' then
    raise exception using errcode='22023',message='SITE_TRACKING_INVALID';
  end if;

  begin
    v_site_lead_id:=nullif(coalesce(v_payload->>'site_lead_id',p_contexto->>'site_lead_id'),'')::uuid;
    v_page_view_id:=nullif(coalesce(v_identity->>'page_view_id',v_tracking->>'page_view_id'),'')::uuid;
    v_session_id:=nullif(coalesce(v_identity->>'session_id',v_tracking->>'session_id'),'')::uuid;
  exception when invalid_text_representation then
    raise exception using errcode='22023',message='SITE_TRACKING_ID_INVALID';
  end;

  begin
    if nullif(v_first->>'captured_at','') is not null then
      v_first_seen_at:=(v_first->>'captured_at')::timestamptz;
    end if;
  exception when invalid_datetime_format or datetime_field_overflow then
    raise exception using errcode='22007',message='SITE_TRACKING_DATE_INVALID';
  end;

  v_source:=coalesce(
    nullif(v_last->>'utm_source',''),
    case when nullif(v_last->>'gclid','') is not null then 'google' end,
    case when nullif(v_last->>'fbclid','') is not null then 'meta' end,
    nullif(v_payload->>'origem',''),
    'site'
  );

  insert into private.lead_attribution(
    lead_id,first_touch,last_touch,last_site_lead_id,last_page_view_id,
    last_session_id,ga_client_id,ga_session_id,source,medium,campaign,
    campaign_id,adset_id,ad_group_id,ad_id,creative_id,utm_content,
    utm_term,gclid,gbraid,wbraid,fbclid,fbp,fbc,landing_path,
    referrer_host,first_seen_at,last_seen_at,updated_at
  ) values (
    p_lead_id,v_first,v_last,v_site_lead_id,v_page_view_id,v_session_id,
    left(nullif(v_identity->>'ga_client_id',''),120),
    left(nullif(v_identity->>'ga_session_id',''),120),v_source,
    left(nullif(v_last->>'utm_medium',''),120),
    left(nullif(v_last->>'utm_campaign',''),200),
    left(nullif(v_last->>'campaign_id',''),200),
    left(nullif(v_last->>'adset_id',''),200),
    left(nullif(v_last->>'ad_group_id',''),200),
    left(nullif(v_last->>'ad_id',''),200),
    left(nullif(v_last->>'creative_id',''),200),
    left(nullif(v_last->>'utm_content',''),200),
    left(nullif(v_last->>'utm_term',''),200),
    left(nullif(v_last->>'gclid',''),500),
    left(nullif(v_last->>'gbraid',''),500),
    left(nullif(v_last->>'wbraid',''),500),
    left(nullif(v_last->>'fbclid',''),500),
    left(nullif(v_identity->>'fbp',''),500),
    left(nullif(v_identity->>'fbc',''),500),
    left(coalesce(nullif(v_first->>'landing_path',''),v_tracking->>'landing_path'),500),
    left(coalesce(nullif(v_first->>'referrer_host',''),v_tracking->>'referrer_host'),200),
    v_first_seen_at,now(),now()
  )
  on conflict (lead_id) do update set
    first_touch=case
      when private.lead_attribution.first_touch='{}'::jsonb then excluded.first_touch
      else private.lead_attribution.first_touch
    end,
    last_touch=excluded.last_touch,
    last_site_lead_id=excluded.last_site_lead_id,
    last_page_view_id=excluded.last_page_view_id,
    last_session_id=excluded.last_session_id,
    ga_client_id=coalesce(excluded.ga_client_id,private.lead_attribution.ga_client_id),
    ga_session_id=coalesce(excluded.ga_session_id,private.lead_attribution.ga_session_id),
    source=excluded.source,
    medium=excluded.medium,
    campaign=coalesce(excluded.campaign,private.lead_attribution.campaign),
    campaign_id=coalesce(excluded.campaign_id,private.lead_attribution.campaign_id),
    adset_id=coalesce(excluded.adset_id,private.lead_attribution.adset_id),
    ad_group_id=coalesce(excluded.ad_group_id,private.lead_attribution.ad_group_id),
    ad_id=coalesce(excluded.ad_id,private.lead_attribution.ad_id),
    creative_id=coalesce(excluded.creative_id,private.lead_attribution.creative_id),
    utm_content=coalesce(excluded.utm_content,private.lead_attribution.utm_content),
    utm_term=coalesce(excluded.utm_term,private.lead_attribution.utm_term),
    gclid=coalesce(excluded.gclid,private.lead_attribution.gclid),
    gbraid=coalesce(excluded.gbraid,private.lead_attribution.gbraid),
    wbraid=coalesce(excluded.wbraid,private.lead_attribution.wbraid),
    fbclid=coalesce(excluded.fbclid,private.lead_attribution.fbclid),
    fbp=coalesce(excluded.fbp,private.lead_attribution.fbp),
    fbc=coalesce(excluded.fbc,private.lead_attribution.fbc),
    landing_path=coalesce(private.lead_attribution.landing_path,excluded.landing_path),
    referrer_host=coalesce(private.lead_attribution.referrer_host,excluded.referrer_host),
    last_seen_at=now(),updated_at=now();

  return jsonb_build_object(
    'ok',true,'aplicado',true,'site_lead_id',v_site_lead_id,
    'page_view_id',v_page_view_id,'session_id',v_session_id
  );
end
$function$;

revoke all on function private.motor_atribuicao_site_por_campos(bigint,jsonb)
  from public,anon,authenticated;
grant execute on function private.motor_atribuicao_site_por_campos(bigint,jsonb)
  to service_role;

-- Acrescenta a operacao ao validador e ao runtime sem alterar as demais
-- regras do motor, que podem evoluir independentemente desta migracao.
do $patch_contract$
declare
  v_def text;
  v_new text;
begin
  v_def:=pg_get_functiondef('public.automacao_validar_mapa(jsonb)'::regprocedure);
  if position('sync-site-attribution-field-operation' in v_def)=0 then
    v_new:=replace(
      v_def,
      E'''sync-meta-attribution-field-operation''\n  ];',
      E'''sync-meta-attribution-field-operation'',\n    ''sync-site-attribution-field-operation''\n  ];'
    );
    if v_new=v_def then raise exception 'SITE_ATTRIBUTION_VALIDATOR_PATCH_FAILED'; end if;
    execute v_new;
  end if;

  v_def:=pg_get_functiondef(
    'public.motor_campos_deterministico(bigint,text,text,jsonb,jsonb,bigint,bigint)'::regprocedure
  );
  if position('sync-site-attribution-field-operation' in v_def)=0 then
    v_new:=replace(
      v_def,
      $site_old$    elsif v_name='parse-phone-field-operation' then$site_old$,
      $site_new$    elsif v_name='sync-site-attribution-field-operation' then
      v_sync := private.motor_atribuicao_site_por_campos(v_lead_id, v_contexto);
      insert into public.motor_execucoes(automacao_id,automacao_nome,bloco_id,evento,status,lead_nome,lead_telefone,detalhe) values (p_auto,p_nome,p_bloco,'acao','ok',p_lead->>'nome',p_lead->>'telefone',case when coalesce((v_sync->>'aplicado')::boolean,false) then 'Rastreamento do site registrado pelo modulo de campos' else 'Rastreamento do site nao aplicado: '||coalesce(v_sync->>'motivo','sem dados') end);
      continue;
    elsif v_name='parse-phone-field-operation' then$site_new$
    );
    if v_new=v_def then raise exception 'SITE_ATTRIBUTION_RUNTIME_PATCH_FAILED'; end if;
    execute v_new;
  end if;
end
$patch_contract$;

-- Publica a operacao somente no fluxo de entrada do site. Nao executa lead,
-- nao distribui, nao envia mensagem e nao altera campanha.
do $publish_site_operation$
declare
  r record;
  v_map jsonb;
  v_draft jsonb;
  v_blocks jsonb;
  v_draft_blocks jsonb;
  v_valid jsonb;
  v_version integer;
  v_version_id bigint;
  v_operation jsonb:=jsonb_build_object(
    'name','sync-site-attribution-field-operation','group','field',
    'stepId','site-attribution','options','{}'::jsonb
  );
begin
  for r in
    select a.id,a.nome,a.mapa_rascunho,v.mapa
      from public.automacoes a
      join public.automacao_versoes v on v.id=a.versao_publicada_id
     where a.id=42 and a.ativa is true and a.status='publicado'
     for update of a
  loop
    v_map:=r.mapa;
    select jsonb_agg(
      case when b->>'type'='field-operation' and not exists(
        select 1 from jsonb_array_elements(coalesce(b#>'{options,fieldOperations}','[]'::jsonb)) op
         where op->>'name'='sync-site-attribution-field-operation'
      ) then jsonb_set(
        b,'{options,fieldOperations}',
        coalesce(b#>'{options,fieldOperations}','[]'::jsonb)||jsonb_build_array(v_operation),true
      ) else b end order by ord
    ) into v_blocks
    from jsonb_array_elements(v_map->'automation'->'blocks') with ordinality x(b,ord);
    v_map:=jsonb_set(v_map,'{automation,blocks}',v_blocks,true);

    v_valid:=public.automacao_validar_mapa(v_map);
    if coalesce((v_valid->>'ok')::boolean,false) is not true then
      raise exception 'Automacao 42 invalida: %',v_valid->'erros';
    end if;

    v_draft:=coalesce(r.mapa_rascunho,v_map);
    select jsonb_agg(
      case when b->>'type'='field-operation' and not exists(
        select 1 from jsonb_array_elements(coalesce(b#>'{options,fieldOperations}','[]'::jsonb)) op
         where op->>'name'='sync-site-attribution-field-operation'
      ) then jsonb_set(
        b,'{options,fieldOperations}',
        coalesce(b#>'{options,fieldOperations}','[]'::jsonb)||jsonb_build_array(v_operation),true
      ) else b end order by ord
    ) into v_draft_blocks
    from jsonb_array_elements(v_draft->'automation'->'blocks') with ordinality x(b,ord);
    v_draft:=jsonb_set(v_draft,'{automation,blocks}',v_draft_blocks,true);

    select coalesce(max(versao),0)+1 into v_version
      from public.automacao_versoes where automacao_id=r.id;
    insert into public.automacao_versoes(
      automacao_id,versao,nome,mapa,observacao,criado_por
    ) values (
      r.id,v_version,r.nome,v_map,
      'Atribuicao do site executada somente pelo bloco de Campos','migration'
    ) returning id into v_version_id;
    update public.automacoes
       set mapa=v_map,mapa_rascunho=v_draft,versao_publicada_id=v_version_id,
           status='publicado',publicado_em=now(),atualizada_em=now()
     where id=r.id;
  end loop;
end
$publish_site_operation$;

-- Corrige os snapshots Aratans que chegaram do Make com IDs de campanha e
-- conjunto vazios. A hierarquia foi verificada em entradas completas do mesmo
-- anuncio; o first touch so e alterado quando ele proprio e de Aratans.
update private.lead_attribution
set campaign='APECERTO |  |  ARATANS ADELMO | 2100  | FORM LEAD  | 08/26',
    campaign_id='120253551407260616',
    adset_id='120253551407250616',
    ad_id='120253551407240616',
    last_touch=coalesce(last_touch,'{}'::jsonb)||jsonb_build_object(
      'campaign','APECERTO |  |  ARATANS ADELMO | 2100  | FORM LEAD  | 08/26',
      'campaign_id','120253551407260616',
      'adset_id','120253551407250616','ad_id','120253551407240616'
    ),
    first_touch=case
      when first_touch->>'ad_id'='120253551407240616' then
        first_touch||jsonb_build_object(
          'campaign','APECERTO |  |  ARATANS ADELMO | 2100  | FORM LEAD  | 08/26',
          'campaign_id','120253551407260616',
          'adset_id','120253551407250616','ad_id','120253551407240616'
        )
      else first_touch
    end,
    updated_at=now()
where ad_id='120253551407240616'
   or last_touch->>'ad_id'='120253551407240616';

do $verify$
declare
  v_test jsonb;
begin
  if position('sync-site-attribution-field-operation' in
    pg_get_functiondef('public.automacao_validar_mapa(jsonb)'::regprocedure))=0 then
    raise exception 'Operacao site ausente do validador';
  end if;
  if position('sync-site-attribution-field-operation' in pg_get_functiondef(
    'public.motor_campos_deterministico(bigint,text,text,jsonb,jsonb,bigint,bigint)'::regprocedure
  ))=0 then raise exception 'Operacao site ausente do runtime'; end if;
  if exists(
    select 1 from pg_trigger t
     where t.tgrelid='public.motor_fila'::regclass
       and t.tgname='trg_motor_fila_meta_attribution' and not t.tgisinternal
  ) then raise exception 'Gatilho oculto Meta reapareceu'; end if;
  if not exists(
    select 1 from public.automacoes a,
      lateral jsonb_array_elements(a.mapa->'automation'->'blocks') b,
      lateral jsonb_array_elements(coalesce(b#>'{options,fieldOperations}','[]'::jsonb)) op
     where a.id=42 and op->>'name'='sync-site-attribution-field-operation'
  ) then raise exception 'Automacao 42 sem operacao explicita do site'; end if;

  v_test:=private.motor_atribuicao_site_por_campos(
    -1,jsonb_build_object('entrada_payload',jsonb_build_object('tracking','{}'::jsonb))
  );
  if v_test->>'motivo' is distinct from 'tracking_site_ausente' then
    raise exception 'Retorno seguro sem tracking divergente: %',v_test;
  end if;
end
$verify$;

commit;
