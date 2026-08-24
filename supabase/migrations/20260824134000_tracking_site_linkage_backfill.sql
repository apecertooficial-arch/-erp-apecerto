-- Completa o vinculo canonico site_leads -> leads dentro da operacao explicita
-- e recompõe as entradas historicas que ja haviam passado pelo mesmo bloco.

begin;

do $patch_site_linkage$
declare
  v_def text;
  v_new text;
begin
  v_def:=pg_get_functiondef(
    'private.motor_atribuicao_site_por_campos(bigint,jsonb)'::regprocedure
  );
  if position('set crm_lead_id=p_lead_id' in v_def)=0 then
    v_new:=replace(
      v_def,
      $old$  return jsonb_build_object(
    'ok',true,'aplicado',true,'site_lead_id',v_site_lead_id,
    'page_view_id',v_page_view_id,'session_id',v_session_id
  );$old$,
      $new$  update public.site_leads
     set crm_lead_id=p_lead_id,crm_synced_at=now(),crm_sync_error=null
   where id=v_site_lead_id;

  return jsonb_build_object(
    'ok',true,'aplicado',true,'site_lead_id',v_site_lead_id,
    'page_view_id',v_page_view_id,'session_id',v_session_id
  );$new$
    );
    if v_new=v_def then raise exception 'SITE_LINKAGE_PATCH_FAILED'; end if;
    execute v_new;
  end if;
end
$patch_site_linkage$;

do $backfill_explicit_site_attribution$
declare
  r record;
  v_result jsonb;
begin
  for r in
    select distinct on ((l.extras->>'site_lead_id')::uuid)
      l.id,l.extras->'entrada_payload' payload
      from public.leads l
     where nullif(l.extras->>'site_lead_id','') is not null
       and jsonb_typeof(l.extras->'entrada_payload')='object'
       and jsonb_typeof(l.extras->'entrada_payload'->'tracking')='object'
     order by (l.extras->>'site_lead_id')::uuid,l.id desc
  loop
    v_result:=private.motor_atribuicao_site_por_campos(
      r.id,jsonb_build_object('entrada_payload',r.payload)
    );
    if coalesce((v_result->>'aplicado')::boolean,false) is not true then
      raise exception 'SITE_ATTRIBUTION_BACKFILL_FAILED lead=% result=%',r.id,v_result;
    end if;
  end loop;
end
$backfill_explicit_site_attribution$;

do $verify$
begin
  if position('set crm_lead_id=p_lead_id' in pg_get_functiondef(
    'private.motor_atribuicao_site_por_campos(bigint,jsonb)'::regprocedure
  ))=0 then raise exception 'Vinculo site-CRM ausente da operacao'; end if;
  if exists(
    select 1 from public.site_leads s
     where s.criado_em>=now()-interval '30 days'
       and s.crm_lead_id is null
       and exists(
         select 1 from public.leads l
          where l.extras->>'site_lead_id'=s.id::text
       )
  ) then raise exception 'Entrada do site materializada sem vinculo CRM'; end if;
end
$verify$;

commit;
