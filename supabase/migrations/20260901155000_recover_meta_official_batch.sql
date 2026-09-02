-- Executor transacional temporario da recuperacao oficial. Consome somente o
-- staging privado, aborta a chamada inteira se qualquer pre-condicao variar e
-- nao aciona distribuicao, mensagens, notificacoes ou automacoes.

begin;

create or replace function private.recover_meta_official_batch(p_batch text)
returns jsonb
language plpgsql
security definer
set search_path=''
as $function$
declare
  v_new_id bigint;
begin
  if p_batch is null or p_batch !~ '^[a-z0-9_:-]{8,120}$' then
    raise exception 'RECOVERY_BATCH_INVALID';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_batch,0));
  perform set_config('lock_timeout','5s',true);
  perform set_config('statement_timeout','120s',true);

  create temp table tmp_meta_input on commit drop as
  select s.meta_lead_id,s.payload->>'label' label,
    (s.payload->>'created_time')::timestamptz created_time,
    s.payload->>'ad_id' ad_id,s.payload->>'ad_name' ad_name,
    s.payload->>'adset_id' adset_id,s.payload->>'adset_name' adset_name,
    s.payload->>'campaign_id' campaign_id,s.payload->>'campaign_name' campaign_name,
    s.payload->>'form_id' form_id,s.payload->>'form_name' form_name,
    coalesce((s.payload->>'is_organic')::boolean,false) is_organic,
    s.payload->>'platform' platform,s.payload->>'nome' nome,
    s.payload->>'telefone' telefone,s.payload->>'email' email
  from private.meta_lead_recovery_stage s where s.batch_id=p_batch;

  if (select count(*) from pg_temp.tmp_meta_input)<>203
     or (select count(distinct meta_lead_id) from pg_temp.tmp_meta_input)<>203
     or (select count(*) from pg_temp.tmp_meta_input where label='miruna')<>173
     or (select count(*) from pg_temp.tmp_meta_input where label='aratans')<>30 then
    raise exception 'RECOVERY_INPUT_COUNT_CHANGED';
  end if;
  if exists(select 1 from private.meta_lead_submissions s join pg_temp.tmp_meta_input i using(meta_lead_id)) then
    raise exception 'RECOVERY_BATCH_ALREADY_PRESENT';
  end if;
  if exists(select 1 from private.lead_attribution_patch_audit where batch_id=p_batch) then
    raise exception 'RECOVERY_AUDIT_BATCH_ALREADY_PRESENT';
  end if;

  create temp table tmp_direct on commit drop as
  select i.meta_lead_id,min(a.lead_id) lead_id
  from pg_temp.tmp_meta_input i join private.lead_attribution a on a.meta_lead_id=i.meta_lead_id
  group by i.meta_lead_id;

  if exists(
    select i.meta_lead_id from pg_temp.tmp_meta_input i
    join private.lead_attribution a on a.meta_lead_id=i.meta_lead_id
    group by i.meta_lead_id having count(distinct a.lead_id)<>1
  ) then raise exception 'RECOVERY_DIRECT_COLLISION'; end if;

  create temp table tmp_candidates on commit drop as
  select i.meta_lead_id,l.id lead_id,
    ((lower(btrim(coalesce(l.email,'')))=lower(btrim(i.email)) and btrim(i.email)<>'')::int*4+
     (right(regexp_replace(coalesce(l.telefone,''),'[^0-9]','','g'),11)=right(regexp_replace(i.telefone,'[^0-9]','','g'),11)
       and length(regexp_replace(i.telefone,'[^0-9]','','g'))>=10)::int*4+
     (lower(regexp_replace(btrim(coalesce(l.nome,'')),'[[:space:]]+',' ','g'))=
       lower(regexp_replace(btrim(i.nome),'[[:space:]]+',' ','g')) and btrim(i.nome)<>'')::int) score
  from pg_temp.tmp_meta_input i cross join public.leads l
  where not exists(select 1 from pg_temp.tmp_direct d where d.meta_lead_id=i.meta_lead_id)
    and ((lower(btrim(coalesce(l.email,'')))=lower(btrim(i.email)) and btrim(i.email)<>'')
      or (right(regexp_replace(coalesce(l.telefone,''),'[^0-9]','','g'),11)=right(regexp_replace(i.telefone,'[^0-9]','','g'),11)
        and length(regexp_replace(i.telefone,'[^0-9]','','g'))>=10));

  create temp table tmp_candidate_ranked on commit drop as
  select c.*,max(score) over(partition by meta_lead_id) best_score from pg_temp.tmp_candidates c;
  create temp table tmp_resolved on commit drop as
  select meta_lead_id,min(lead_id) lead_id from pg_temp.tmp_candidate_ranked
  where score=best_score group by meta_lead_id having count(*)=1;
  create temp table tmp_ambiguous on commit drop as
  select meta_lead_id from pg_temp.tmp_candidate_ranked
  where score=best_score group by meta_lead_id having count(*)>1;
  create temp table tmp_map on commit drop as
  select i.meta_lead_id,coalesce(d.lead_id,r.lead_id) lead_id,
    case when d.lead_id is not null then 'direct'
         when r.lead_id is not null then 'resolved'
         when a.meta_lead_id is not null then 'ambiguous' else 'unmatched' end method
  from pg_temp.tmp_meta_input i left join pg_temp.tmp_direct d using(meta_lead_id)
  left join pg_temp.tmp_resolved r using(meta_lead_id)
  left join pg_temp.tmp_ambiguous a using(meta_lead_id);

  if (select count(*) from pg_temp.tmp_map where method='direct')<>188
     or (select count(*) from pg_temp.tmp_map where method='resolved')<>14
     or (select count(*) from pg_temp.tmp_map where method='ambiguous')<>0
     or (select count(*) from pg_temp.tmp_map where method='unmatched')<>1
     or (select count(distinct lead_id) from pg_temp.tmp_map where method='resolved')<>14 then
    raise exception 'RECOVERY_MATCHING_PRECONDITION_CHANGED';
  end if;

  insert into public.leads(nome,telefone,email,corretor_id,pipeline_id,criado_em,status,origem,tags,atualizado_em,extras,disparo_optout)
  select i.nome,i.telefone,i.email,null,null,i.created_time,'novo','meta_lead_ads',null,now(),
    jsonb_build_object('recovery_batch',p_batch,'recuperacao_retroativa_sem_acionamento',true,
      'entrada_payload',jsonb_strip_nulls(jsonb_build_object(
        'event_id','meta-lead-'||i.meta_lead_id,'leadgen_id',i.meta_lead_id,'meta_lead_id',i.meta_lead_id,
        'source','facebook','medium','lead_ads','platform',nullif(i.platform,''),
        'meta_form_id',nullif(i.form_id,''),'meta_page_id','102797067866879',
        'meta_created_time',i.created_time,'meta_is_organic',i.is_organic,
        'meta_campaign_id',nullif(i.campaign_id,''),'meta_campaign_name',nullif(i.campaign_name,''),
        'meta_adset_id',nullif(i.adset_id,''),'meta_adset_name',nullif(i.adset_name,''),
        'meta_ad_id',nullif(i.ad_id,''),'meta_ad_name',nullif(i.ad_name,''),
        'automacao_origem',case when i.label='aratans' then 'Entrada Adelmo' else 'Entrada Miruna' end))),false
  from pg_temp.tmp_meta_input i join pg_temp.tmp_map m using(meta_lead_id)
  where m.method='unmatched' returning id into v_new_id;
  if v_new_id is null then raise exception 'RECOVERY_NEW_LEAD_COUNT_INVALID'; end if;
  update pg_temp.tmp_map set lead_id=v_new_id where method='unmatched';

  perform l.id from public.leads l
  where l.id in (select lead_id from pg_temp.tmp_map where method<>'unmatched')
  for update;

  create temp table tmp_before on commit drop as
  select m.lead_id,bool_or(m.method='unmatched') created_by_recovery,
    l.extras previous_extras,to_jsonb(a) previous_attribution,
    jsonb_agg(m.meta_lead_id order by m.meta_lead_id) recovered_meta_lead_ids
  from pg_temp.tmp_map m join public.leads l on l.id=m.lead_id
  left join private.lead_attribution a on a.lead_id=m.lead_id
  where m.method<>'direct' group by m.lead_id,l.extras,to_jsonb(a);
  if (select count(*) from pg_temp.tmp_before)<>15 then
    raise exception 'RECOVERY_SNAPSHOT_TARGET_COUNT_INVALID';
  end if;

  insert into private.lead_attribution_patch_audit(batch_id,lead_id,reason,before_snapshot)
  select p_batch,b.lead_id,'Meta official lead submissions recovery',jsonb_build_object(
    'created_by_recovery',b.created_by_recovery,'previous_extras',b.previous_extras,
    'previous_attribution',b.previous_attribution,'recovered_meta_lead_ids',b.recovered_meta_lead_ids,
    'snapshot_checksum',encode(extensions.digest(coalesce(b.previous_extras,'{}'::jsonb)::text||'|'||
      coalesce(b.previous_attribution,'{}'::jsonb)::text,'sha256'),'hex'))
  from pg_temp.tmp_before b;

  create temp table tmp_no_attr on commit drop as
  select m.meta_lead_id,m.lead_id from pg_temp.tmp_map m where m.method<>'direct'
    and not exists(select 1 from pg_temp.tmp_before b where b.lead_id=m.lead_id and b.previous_attribution is not null);
  if (select count(*) from pg_temp.tmp_no_attr)<>9 then raise exception 'RECOVERY_NO_ATTR_COUNT_INVALID'; end if;

  insert into private.meta_lead_submissions(
    meta_lead_id,lead_id,created_time,source,medium,platform,page_id,form_id,
    campaign_name,campaign_id,adset_name,adset_id,ad_name,ad_id,is_organic,
    recovered,recovery_batch,ingested_at,updated_at)
  select i.meta_lead_id,m.lead_id,i.created_time,'facebook','lead_ads',nullif(i.platform,''),
    '102797067866879',nullif(i.form_id,''),nullif(i.campaign_name,''),nullif(i.campaign_id,''),
    nullif(i.adset_name,''),nullif(i.adset_id,''),nullif(i.ad_name,''),nullif(i.ad_id,''),
    i.is_organic,true,p_batch,now(),now()
  from pg_temp.tmp_meta_input i join pg_temp.tmp_map m using(meta_lead_id);

  update public.leads l set extras=jsonb_set(coalesce(l.extras,'{}'::jsonb),'{entrada_payload}',
    coalesce(l.extras->'entrada_payload','{}'::jsonb)||jsonb_strip_nulls(jsonb_build_object(
      'event_id','meta-lead-'||i.meta_lead_id,'leadgen_id',i.meta_lead_id,'meta_lead_id',i.meta_lead_id,
      'source','facebook','medium','lead_ads','platform',nullif(i.platform,''),
      'meta_form_id',nullif(i.form_id,''),'meta_page_id','102797067866879',
      'meta_created_time',i.created_time,'meta_is_organic',i.is_organic,
      'meta_campaign_id',nullif(i.campaign_id,''),'meta_campaign_name',nullif(i.campaign_name,''),
      'meta_adset_id',nullif(i.adset_id,''),'meta_adset_name',nullif(i.adset_name,''),
      'meta_ad_id',nullif(i.ad_id,''),'meta_ad_name',nullif(i.ad_name,''),
      'automacao_origem',case when i.label='aratans' then 'Entrada Adelmo' else 'Entrada Miruna' end)),true)
      ||jsonb_build_object('recovery_batch',p_batch,'recuperacao_retroativa_sem_acionamento',true),
    atualizado_em=now()
  from pg_temp.tmp_no_attr n join pg_temp.tmp_meta_input i using(meta_lead_id) where l.id=n.lead_id;

  perform private.motor_atribuicao_meta_por_campos(n.lead_id,
    jsonb_build_object('entrada_payload',jsonb_strip_nulls(jsonb_build_object(
      'meta_lead_id',i.meta_lead_id,'leadgen_id',i.meta_lead_id,'source','facebook','medium','lead_ads',
      'platform',nullif(i.platform,''),'meta_campaign_name',nullif(i.campaign_name,''),
      'meta_campaign_id',nullif(i.campaign_id,''),'meta_adset_name',nullif(i.adset_name,''),
      'meta_adset_id',nullif(i.adset_id,''),'meta_ad_name',nullif(i.ad_name,''),
      'meta_ad_id',nullif(i.ad_id,''),'meta_form_id',nullif(i.form_id,''),
      'meta_page_id','102797067866879','meta_created_time',i.created_time,'meta_is_organic',i.is_organic))))
  from pg_temp.tmp_no_attr n join pg_temp.tmp_meta_input i using(meta_lead_id);

  if (select count(*) from private.meta_lead_submissions where recovery_batch=p_batch)<>203
     or (select count(*) from private.lead_attribution a join pg_temp.tmp_meta_input i on i.meta_lead_id=a.meta_lead_id)<>197
     or exists(select 1 from private.meta_lead_submissions s join pg_temp.tmp_meta_input i using(meta_lead_id)
       where coalesce(s.campaign_id,'')<>coalesce(nullif(i.campaign_id,''),'')
          or coalesce(s.adset_id,'')<>coalesce(nullif(i.adset_id,''),'')
          or coalesce(s.ad_id,'')<>coalesce(nullif(i.ad_id,''),'')) then
    raise exception 'RECOVERY_POST_VALIDATION_FAILED';
  end if;
  if not exists(select 1 from public.leads where id=v_new_id and corretor_id is null and pipeline_id is null)
     or exists(select 1 from public.negocios where lead_id=v_new_id)
     or exists(select 1 from public.lead_produtos where lead_id=v_new_id)
     or exists(select 1 from public.crm_atividades where lead_id=v_new_id)
     or exists(select 1 from public.crm_tarefas where lead_id=v_new_id)
     or exists(select 1 from public.mensagens_agendadas where lead_id=v_new_id)
     or exists(select 1 from public.f2_carga_lead where lead_id=v_new_id)
     or exists(select 1 from public.motor_fila where lead @> jsonb_build_object('id',v_new_id)) then
    raise exception 'RECOVERY_NEW_LEAD_SIDE_EFFECT_DETECTED';
  end if;

  delete from private.meta_lead_recovery_stage where batch_id=p_batch;
  return jsonb_build_object('batch_id',p_batch,'input_total',203,'already_linked',188,
    'matched_existing',14,'new_leads',1,'ledger_rows',203,'current_attribution_added',9,
    'audit_snapshots',15,'hierarchy_mismatches',0,'new_without_broker_or_pipeline',1,
    'new_business_rows',0,'new_queue_rows',0);
end
$function$;

revoke all on function private.recover_meta_official_batch(text) from public,anon,authenticated;
grant execute on function private.recover_meta_official_batch(text) to service_role;

commit;
