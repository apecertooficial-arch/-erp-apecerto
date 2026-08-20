create or replace function public.tracking_360_digital_health(p_days integer default 30)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_days integer := greatest(1, least(coalesce(p_days, 30), 365));
  v_since timestamptz := now() - make_interval(days => greatest(1, least(coalesce(p_days, 30), 365)));
  v_result jsonb;
begin
  if not (
    auth.role() = 'service_role'
    or exists (
      select 1 from public.usuarios u
      where u.id = auth.uid() and u.ativo
        and u.role::text in ('admin','gerente','diretor','executivo')
    )
  ) then
    raise exception 'acesso_negado' using errcode = '42501';
  end if;

  with
  base as (
    select *, coalesce(session_id::text, page_view_id::text) as observed_session
    from private.site_events_anon
    where occurred_at >= v_since
  ),
  session_consent as (
    select observed_session,
      max(case consent_level when 'marketing' then 3 when 'analytics' then 2 else 1 end) as consent_rank
    from base where observed_session is not null group by observed_session
  ),
  consent as (
    select count(*)::bigint as total,
      count(*) filter (where consent_rank = 1)::bigint as essential,
      count(*) filter (where consent_rank = 2)::bigint as analytics,
      count(*) filter (where consent_rank = 3)::bigint as marketing
    from session_consent
  ),
  week_base as (
    select date_trunc('week', occurred_at at time zone 'America/Sao_Paulo')::date as week_start,
      coalesce(session_id::text, page_view_id::text) as observed_session,
      max(case consent_level when 'marketing' then 3 when 'analytics' then 2 else 1 end) as consent_rank
    from private.site_events_anon
    where occurred_at >= now() - interval '28 days'
    group by 1,2
  ),
  weeks as (
    select coalesce(jsonb_agg(jsonb_build_object(
      'inicio', week_start,
      'total', total,
      'essential', essential,
      'analytics', analytics,
      'marketing', marketing
    ) order by week_start), '[]'::jsonb) as rows
    from (
      select week_start, count(*)::bigint total,
        count(*) filter (where consent_rank=1)::bigint essential,
        count(*) filter (where consent_rank=2)::bigint analytics,
        count(*) filter (where consent_rank=3)::bigint marketing
      from week_base group by week_start order by week_start desc limit 4
    ) x
  ),
  hours as (
    select coalesce(jsonb_agg(jsonb_build_object('hora',hour_of_day,'eventos',events) order by hour_of_day), '[]'::jsonb) as rows
    from (
      select h as hour_of_day, count(b.id)::bigint as events
      from generate_series(0,23) h
      left join base b on (b.occurred_at at time zone 'America/Sao_Paulo')::date = (now() at time zone 'America/Sao_Paulo')::date
        and extract(hour from b.occurred_at at time zone 'America/Sao_Paulo')::integer = h
      group by h
    ) x
  ),
  quality as (
    select
      count(*) filter (where event_name not in (
        'page_view','consent_update','view_item','view_inventory','generate_lead','whatsapp_click','phone_click','social_click',
        'sara_open','sara_search','sara_results','sara_error','favorite_toggle','gallery_interaction','property_search','cta_click',
        'owner_portal_open','owner_cta_click','form_start','filter_change','scroll_depth'
      ))::bigint as invalid_events,
      max(occurred_at) as last_event_at,
      count(*)::bigint as total_events
    from base
  ),
  duplicates as (
    select coalesce(sum(repetitions - 1),0)::bigint as total
    from (
      select count(*) repetitions from base
      group by page_view_id,event_name,date_trunc('second',occurred_at),properties
      having count(*) > 1
    ) d
  ),
  sync as (
    select count(*) filter (where crm_synced_at is null and crm_sync_error is null)::bigint as pending,
      count(*) filter (where crm_sync_error is not null)::bigint as errors,
      count(*)::bigint as total
    from public.site_leads where criado_em >= v_since
  ),
  attribution as (
    select count(*)::bigint as total,
      count(*) filter (where source is not null)::bigint as with_source,
      count(*) filter (where campaign is not null)::bigint as with_campaign,
      count(*) filter (where coalesce(gclid,gbraid,wbraid,fbclid) is not null)::bigint as with_click_id
    from private.lead_attribution where last_seen_at >= v_since
  ),
  events as (
    select coalesce(jsonb_agg(event_name order by event_name),'[]'::jsonb) as rows
    from (select distinct event_name from base) x
  )
  select jsonb_build_object(
    'consent', to_jsonb(c),
    'weeks', w.rows,
    'hours_today', h.rows,
    'quality', to_jsonb(q) || jsonb_build_object('possible_duplicates', d.total),
    'crm_sync', to_jsonb(s),
    'attribution', to_jsonb(a),
    'events', e.rows,
    'updated_at', now()
  ) into v_result
  from consent c, weeks w, hours h, quality q, duplicates d, sync s, attribution a, events e;

  return v_result;
end;
$$;

revoke all on function public.tracking_360_digital_health(integer) from public, anon, authenticated;
grant execute on function public.tracking_360_digital_health(integer) to authenticated, service_role;

comment on function public.tracking_360_digital_health(integer) is
  'Saúde real da coleta: consentimento observado, atividade, eventos, CRM e atribuição; não consulta painéis externos.';
