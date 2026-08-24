-- Indicadores de qualidade verificaveis do tracking. Nao presume que uma
-- plataforma externa esta saudavel: mede apenas o que o banco consegue provar.

create or replace function public.tracking_360_quality(p_days integer default 30)
returns jsonb
language plpgsql
security definer
set search_path=''
as $function$
declare
  v_days integer:=greatest(1,least(coalesce(p_days,30),365));
  v_role text;
  v_result jsonb;
begin
  select u.role::text into v_role
    from public.usuarios u
   where u.id=auth.uid() and coalesce(u.ativo,true)
   limit 1;
  if v_role is null or v_role not in (
    'admin','gestor','executivo','gestor_comercial','gestor_equipe','diretor'
  ) then
    raise exception 'tracking_360_forbidden' using errcode='42501';
  end if;

  with
  pageviews_24h as (
    select count(*)::bigint raw,
      count(distinct page_view_id)::bigint unique_views,
      max(occurred_at) last_event_at
    from private.site_events_anon
    where event_name='page_view' and occurred_at>=now()-interval '24 hours'
  ),
  meta_scope as (
    select l.id,a.meta_lead_id,a.campaign_id,a.adset_id,a.ad_id
      from public.leads l
      left join private.lead_attribution a on a.lead_id=l.id
     where l.criado_em>=now()-make_interval(days=>v_days)
       and l.origem='meta_lead_ads'
  ),
  meta_quality as (
    select count(*)::bigint eligible,
      count(*) filter(where meta_lead_id is not null)::bigint with_meta_lead_id,
      count(*) filter(where campaign_id is not null and adset_id is not null and ad_id is not null)::bigint with_campaign_hierarchy
    from meta_scope
  ),
  site_quality as (
    select count(*)::bigint total,
      count(*) filter(where crm_lead_id is not null)::bigint linked_to_crm,
      count(*) filter(where crm_sync_error is not null)::bigint sync_errors
    from public.site_leads
    where criado_em>=now()-make_interval(days=>v_days)
  ),
  delivery as (
    select count(*) filter(where status='delivered')::bigint delivered,
      count(*) filter(where status in ('failed','blocked'))::bigint errors,
      max(delivered_at) last_delivery_at
    from private.tracking_delivery_logs
    where channel='meta_crm' and created_at>=now()-make_interval(days=>v_days)
  )
  select jsonb_build_object(
    'measured_at',now(),
    'pageviews_raw_24h',p.raw,
    'pageviews_unique_24h',p.unique_views,
    'pageview_duplicate_excess_24h',greatest(0,p.raw-p.unique_views),
    'pageview_duplicate_rate_24h',case when p.raw>0 then round(100.0*greatest(0,p.raw-p.unique_views)/p.raw,1) else 0 end,
    'last_site_event_at',p.last_event_at,
    'meta_eligible',m.eligible,
    'meta_with_lead_id',m.with_meta_lead_id,
    'meta_with_campaign_hierarchy',m.with_campaign_hierarchy,
    'meta_id_coverage_percent',case when m.eligible>0 then round(100.0*m.with_meta_lead_id/m.eligible,1) else 100 end,
    'campaign_hierarchy_coverage_percent',case when m.eligible>0 then round(100.0*m.with_campaign_hierarchy/m.eligible,1) else 100 end,
    'site_leads',s.total,
    'site_leads_linked_to_crm',s.linked_to_crm,
    'site_crm_linkage_percent',case when s.total>0 then round(100.0*s.linked_to_crm/s.total,1) else 100 end,
    'site_sync_errors',s.sync_errors,
    'meta_delivered',d.delivered,
    'meta_delivery_errors',d.errors,
    'last_meta_delivery_at',d.last_delivery_at
  ) into v_result
  from pageviews_24h p,meta_quality m,site_quality s,delivery d;

  return coalesce(v_result,'{}'::jsonb);
end
$function$;

revoke all on function public.tracking_360_quality(integer) from public,anon;
grant execute on function public.tracking_360_quality(integer) to authenticated;

comment on function public.tracking_360_quality(integer) is
  'Qualidade interna comprovavel: duplicidade, cobertura de IDs, ligacao site-CRM e entrega Meta.';
