-- Jornada digital unificada para a gestão da ApêCerto.
--
-- Expõe somente agregados e identificadores efêmeros/mascarados. A pessoa só
-- aparece como identificada depois de enviar voluntariamente um formulário.
-- A função não substitui GA4, Meta Ads ou Clarity: ela reconcilia a telemetria
-- própria com leads e a caixa de WhatsApp e deixa lacunas de atribuição claras.

create or replace function public.tracking_360_jornada_digital(p_days integer default 30)
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
      select 1
      from public.usuarios u
      where u.id = auth.uid()
        and u.ativo
        and u.role::text in ('admin', 'gerente', 'diretor', 'executivo')
    )
  ) then
    raise exception 'acesso_negado' using errcode = '42501';
  end if;

  with
  all_events as (
    select e.*
    from private.site_events_anon e
    where e.occurred_at >= v_since
  ),
  qa as (
    select count(*)::bigint as events
    from all_events
    where coalesce(utm_source, '') in ('codex', 'codex_qa')
       or coalesce(utm_medium, '') = 'test'
  ),
  events as (
    select e.*
    from all_events e
    where coalesce(e.utm_source, '') not in ('codex', 'codex_qa')
      and coalesce(e.utm_medium, '') <> 'test'
  ),
  page_journeys as (
    select
      e.page_view_id,
      min(e.occurred_at) as started_at,
      max(e.occurred_at) as last_at,
      max(e.page_path) filter (where e.event_name = 'page_view') as landing_page,
      coalesce(max(e.page_path) filter (where e.event_name = 'page_view'), max(e.page_path)) as page_path,
      max(e.device_category) as device,
      max(e.utm_source) as source,
      max(e.utm_medium) as medium,
      max(e.utm_campaign) as campaign,
      bool_or(e.event_name = 'view_item') as viewed_property,
      bool_or(e.event_name = 'whatsapp_click') as clicked_whatsapp,
      bool_or(e.event_name = 'phone_click') as clicked_phone,
      bool_or(e.event_name = 'form_start') as started_form,
      bool_or(e.event_name = 'generate_lead') as generated_lead,
      coalesce(max(
        case when e.event_name = 'scroll_depth'
          then nullif(regexp_replace(coalesce(e.properties ->> 'percent_scrolled', ''), '[^0-9.]', '', 'g'), '')::numeric
        end
      ), 0) as max_scroll,
      array_remove(array_agg(distinct nullif(e.properties ->> 'item_name', '')), null) as products,
      array_agg(e.event_name order by e.occurred_at) as event_names
    from events e
    group by e.page_view_id
  ),
  overview as (
    select
      count(*) filter (where event_name = 'page_view')::bigint as page_views,
      count(distinct page_view_id)::bigint as tracked_page_visits,
      count(distinct page_view_id) filter (where event_name <> 'page_view')::bigint as engaged_page_visits,
      count(*) filter (where event_name = 'view_item')::bigint as property_views,
      count(distinct nullif(properties ->> 'item_id', '')) filter (where event_name = 'view_item')::bigint as unique_properties,
      count(*) filter (where event_name = 'whatsapp_click')::bigint as whatsapp_clicks,
      count(*) filter (where event_name = 'phone_click')::bigint as phone_clicks,
      count(*) filter (where event_name in ('whatsapp_click', 'phone_click', 'owner_cta_click', 'cta_click'))::bigint as intent_clicks,
      count(distinct page_view_id) filter (where event_name = 'form_start')::bigint as form_starts,
      count(distinct page_view_id) filter (where event_name = 'generate_lead')::bigint as generated_leads,
      count(distinct page_view_id) filter (
        where event_name = 'page_view'
          and (utm_source is not null or utm_campaign is not null)
      )::bigint as attributed_page_visits,
      max(occurred_at) as last_event_at
    from events
  ),
  behavior as (
    select
      count(*) filter (where started_form and not generated_lead)::bigint as form_abandonments,
      count(*) filter (where max_scroll >= 25)::bigint as scroll_25,
      count(*) filter (where max_scroll >= 50)::bigint as scroll_50,
      count(*) filter (where max_scroll >= 75)::bigint as scroll_75,
      count(*) filter (where max_scroll >= 90)::bigint as scroll_90,
      count(*) filter (where clicked_whatsapp)::bigint as page_visits_with_whatsapp,
      count(*) filter (where viewed_property)::bigint as page_visits_with_property
    from page_journeys
  ),
  channel_rows as (
    select
      coalesce(nullif(utm_source, ''), '(direto / sem UTM)') as source,
      coalesce(nullif(utm_medium, ''), '(sem mídia)') as medium,
      coalesce(nullif(utm_campaign, ''), '(sem campanha)') as campaign,
      count(*) filter (where event_name = 'page_view')::bigint as page_views,
      count(distinct page_view_id)::bigint as tracked_page_visits,
      count(*) filter (where event_name = 'view_item')::bigint as property_views,
      count(*) filter (where event_name = 'whatsapp_click')::bigint as whatsapp_clicks,
      count(distinct page_view_id) filter (where event_name = 'form_start')::bigint as form_starts,
      count(distinct page_view_id) filter (where event_name = 'generate_lead')::bigint as leads
    from events
    group by 1, 2, 3
  ),
  channels as (
    select coalesce(jsonb_agg(to_jsonb(r) order by r.page_views desc, r.whatsapp_clicks desc), '[]'::jsonb) as rows
    from channel_rows r
    where r.page_views > 0 or r.whatsapp_clicks > 0 or r.form_starts > 0 or r.leads > 0
  ),
  campaign_rows as (
    select * from channel_rows where campaign <> '(sem campanha)'
  ),
  campaigns as (
    select coalesce(jsonb_agg(to_jsonb(r) order by r.page_views desc, r.whatsapp_clicks desc), '[]'::jsonb) as rows
    from campaign_rows r
  ),
  page_rows as (
    select
      page_path,
      count(*) filter (where event_name = 'page_view')::bigint as page_views,
      count(distinct page_view_id)::bigint as tracked_page_visits,
      count(*) filter (where event_name = 'view_item')::bigint as property_views,
      count(*) filter (where event_name = 'whatsapp_click')::bigint as whatsapp_clicks,
      count(distinct page_view_id) filter (where event_name = 'form_start')::bigint as form_starts,
      count(distinct page_view_id) filter (where event_name = 'generate_lead')::bigint as leads
    from events
    group by page_path
  ),
  pages as (
    select coalesce(jsonb_agg(to_jsonb(r) order by r.page_views desc, r.property_views desc), '[]'::jsonb) as rows
    from page_rows r
    where r.page_views > 0 or r.property_views > 0 or r.whatsapp_clicks > 0 or r.form_starts > 0
  ),
  product_rows as (
    select
      nullif(properties ->> 'item_id', '') as item_id,
      coalesce(nullif(properties ->> 'item_name', ''), 'Imóvel sem nome') as item_name,
      nullif(properties ->> 'bairro', '') as neighborhood,
      max(nullif(regexp_replace(coalesce(properties ->> 'value', ''), '[^0-9.]', '', 'g'), '')::numeric) as value,
      count(*)::bigint as views,
      count(distinct page_view_id)::bigint as tracked_page_visits
    from events
    where event_name = 'view_item'
      and nullif(properties ->> 'item_id', '') is not null
    group by 1, 2, 3
  ),
  products as (
    select coalesce(jsonb_agg(to_jsonb(r) order by r.views desc, r.item_name), '[]'::jsonb) as rows
    from product_rows r
  ),
  daily_rows as (
    select
      timezone('America/Sao_Paulo', occurred_at)::date as day,
      count(*) filter (where event_name = 'page_view')::bigint as page_views,
      count(*) filter (where event_name = 'view_item')::bigint as property_views,
      count(*) filter (where event_name in ('whatsapp_click', 'phone_click', 'owner_cta_click', 'cta_click'))::bigint as intent_clicks,
      count(distinct page_view_id) filter (where event_name = 'generate_lead')::bigint as leads
    from events
    group by 1
  ),
  daily as (
    select coalesce(jsonb_agg(to_jsonb(r) order by r.day), '[]'::jsonb) as rows
    from daily_rows r
  ),
  recent_rows as (
    select
      left(pj.page_view_id::text, 8) as visit_ref,
      pj.started_at,
      pj.last_at,
      pj.page_path,
      pj.device,
      coalesce(nullif(pj.source, ''), '(direto / sem UTM)') as source,
      coalesce(nullif(pj.medium, ''), '(sem mídia)') as medium,
      coalesce(nullif(pj.campaign, ''), '(sem campanha)') as campaign,
      pj.max_scroll,
      pj.products,
      pj.clicked_whatsapp,
      pj.clicked_phone,
      pj.started_form,
      pj.generated_lead,
      case when sl.id is not null then true else false end as identified,
      case
        when sl.nome is null or btrim(sl.nome) = '' then null
        else split_part(btrim(sl.nome), ' ', 1)
      end as identified_first_name,
      case
        when sl.telefone is null then null
        else '***' || right(regexp_replace(sl.telefone, '[^0-9]', '', 'g'), 4)
      end as masked_phone,
      sl.crm_lead_id,
      sl.crm_negocio_id,
      pj.event_names
    from page_journeys pj
    left join public.site_leads sl on sl.page_view_id = pj.page_view_id
    where pj.clicked_whatsapp or pj.clicked_phone or pj.started_form or pj.generated_lead or pj.viewed_property
    order by pj.last_at desc
    limit 40
  ),
  recent as (
    select coalesce(jsonb_agg(to_jsonb(r) order by r.last_at desc), '[]'::jsonb) as rows
    from recent_rows r
  ),
  lead_rows as (
    select
      sl.id,
      sl.criado_em,
      sl.lead_type,
      split_part(btrim(sl.nome), ' ', 1) as first_name,
      '***' || right(regexp_replace(sl.telefone, '[^0-9]', '', 'g'), 4) as masked_phone,
      sl.empreendimento_nome,
      coalesce(nullif(sl.tracking #>> '{last_touch,utm_source}', ''), nullif(sl.tracking ->> 'utm_source', ''), '(direto / sem UTM)') as source,
      coalesce(nullif(sl.tracking #>> '{last_touch,utm_campaign}', ''), nullif(sl.tracking ->> 'utm_campaign', ''), '(sem campanha)') as campaign,
      sl.crm_lead_id,
      sl.crm_negocio_id,
      sl.crm_synced_at,
      sl.crm_sync_error
    from public.site_leads sl
    where sl.criado_em >= v_since
    order by sl.criado_em desc
    limit 40
  ),
  identified_leads as (
    select coalesce(jsonb_agg(to_jsonb(r) order by r.criado_em desc), '[]'::jsonb) as rows
    from lead_rows r
  ),
  whatsapp as (
    select
      count(*)::bigint as new_conversations,
      count(*) filter (where ad_source_id is not null)::bigint as with_ad_source,
      count(*) filter (where ad_ctwa_clid is not null)::bigint as with_ctwa_click_id,
      max(criado_em) as last_conversation_at
    from public.wa_conversas
    where criado_em >= v_since
  )
  select jsonb_build_object(
    'period', jsonb_build_object('days', v_days, 'since', v_since, 'until', now()),
    'overview', to_jsonb(o),
    'behavior', to_jsonb(b),
    'channels', c.rows,
    'campaigns', cp.rows,
    'pages', p.rows,
    'products', pr.rows,
    'daily', d.rows,
    'recent_journeys', r.rows,
    'identified_leads', il.rows,
    'whatsapp', to_jsonb(w),
    'quality', jsonb_build_object(
      'qa_events_excluded', q.events,
      'site_clicks_without_identity', greatest(0, coalesce(o.whatsapp_clicks, 0) - coalesce(o.generated_leads, 0)),
      'whatsapp_attribution_gap', greatest(0, coalesce(w.new_conversations, 0) - coalesce(w.with_ad_source, 0)),
      'session_scope', 'page_view_id sem consentimento; session_id somente com Analytics'
    ),
    'updated_at', now()
  ) into v_result
  from overview o, behavior b, channels c, campaigns cp, pages p, products pr,
       daily d, recent r, identified_leads il, whatsapp w, qa q;

  return v_result;
end;
$$;

revoke all on function public.tracking_360_jornada_digital(integer) from public, anon, authenticated;
grant execute on function public.tracking_360_jornada_digital(integer) to authenticated, service_role;

comment on function public.tracking_360_jornada_digital(integer) is
  'Painel unificado da jornada digital: canais, campanhas, páginas, imóveis, comportamento, leads identificados e lacunas de atribuição do WhatsApp.';
