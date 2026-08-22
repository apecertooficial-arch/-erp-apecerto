-- Tracking 360: leitura gerencial da jornada por lead.
-- Somente leitura. Não grava em private.lead_attribution e não cria trigger/cron.

create or replace function public.tracking_360_lead_search(
  p_query text default null,
  p_limit integer default 20
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_role text;
  v_query text := lower(trim(coalesce(p_query, '')));
  v_limit integer := greatest(1, least(coalesce(p_limit, 20), 50));
  v_result jsonb;
begin
  select u.role::text into v_role
  from public.usuarios u
  where u.id = auth.uid() and coalesce(u.ativo, true)
  limit 1;

  if v_role is null or v_role not in ('admin','gestor','executivo','gestor_comercial','gestor_equipe','diretor') then
    raise exception 'tracking_360_forbidden' using errcode = '42501';
  end if;

  select coalesce(jsonb_agg(to_jsonb(x) - 'ordem' order by x.ordem desc), '[]'::jsonb)
  into v_result
  from (
    select
      l.id,
      coalesce(nullif(l.nome, ''), 'Lead sem nome') as nome,
      right(regexp_replace(coalesce(l.telefone, ''), '[^0-9]', '', 'g'), 4) as telefone_final,
      l.origem,
      coalesce(nullif(l.momento_atual, ''), nullif(l.momento, ''), l.status) as momento,
      l.criado_em,
      a.source,
      a.medium,
      a.campaign,
      a.campaign_id,
      a.meta_lead_id,
      a.updated_at as atribuicao_atualizada_em,
      coalesce(a.updated_at, l.criado_em) as ordem
    from public.leads l
    left join private.lead_attribution a on a.lead_id = l.id
    where v_query = ''
       or l.id::text = v_query
       or lower(coalesce(l.nome, '')) like '%' || v_query || '%'
       or (
         length(regexp_replace(v_query, '[^0-9]', '', 'g')) >= 4
         and regexp_replace(coalesce(l.telefone, ''), '[^0-9]', '', 'g') like '%' || regexp_replace(v_query, '[^0-9]', '', 'g') || '%'
       )
       or lower(coalesce(a.campaign, '')) like '%' || v_query || '%'
       or coalesce(a.campaign_id, '') = v_query
       or coalesce(a.meta_lead_id, '') = v_query
    order by coalesce(a.updated_at, l.criado_em) desc
    limit v_limit
  ) x;

  return v_result;
end;
$function$;

revoke all on function public.tracking_360_lead_search(text, integer) from public, anon;
grant execute on function public.tracking_360_lead_search(text, integer) to authenticated, service_role;

create or replace function public.tracking_360_lead_journey(p_lead_id bigint)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_role text;
  v_lead jsonb;
  v_attribution jsonb;
  v_site_events jsonb;
  v_crm_events jsonb;
  v_deliveries jsonb;
  v_site_leads jsonb;
  v_direct_site_link boolean := false;
begin
  select u.role::text into v_role
  from public.usuarios u
  where u.id = auth.uid() and coalesce(u.ativo, true)
  limit 1;

  if v_role is null or v_role not in ('admin','gestor','executivo','gestor_comercial','gestor_equipe','diretor') then
    raise exception 'tracking_360_forbidden' using errcode = '42501';
  end if;

  select jsonb_build_object(
    'id', l.id,
    'nome', coalesce(nullif(l.nome, ''), 'Lead sem nome'),
    'telefone_final', right(regexp_replace(coalesce(l.telefone, ''), '[^0-9]', '', 'g'), 4),
    'origem', l.origem,
    'status', l.status,
    'momento', coalesce(nullif(l.momento_atual, ''), nullif(l.momento, ''), l.status),
    'criado_em', l.criado_em,
    'atendido_em', l.atendido_em,
    'momento_atualizado_em', coalesce(l.momento_atualizado_em, l.momento_em)
  ) into v_lead
  from public.leads l
  where l.id = p_lead_id;

  if v_lead is null then
    raise exception 'tracking_360_lead_not_found' using errcode = 'P0002';
  end if;

  select jsonb_build_object(
    'source', a.source,
    'medium', a.medium,
    'campaign', a.campaign,
    'campaign_id', a.campaign_id,
    'adset', coalesce(a.last_touch->>'adset', a.first_touch->>'adset'),
    'adset_id', a.adset_id,
    'ad', coalesce(a.last_touch->>'ad', a.first_touch->>'ad'),
    'ad_id', a.ad_id,
    'form_id', coalesce(a.last_touch->>'form_id', a.first_touch->>'form_id'),
    'page_id', coalesce(a.last_touch->>'page_id', a.first_touch->>'page_id'),
    'meta_lead_id', a.meta_lead_id,
    'landing_path', a.landing_path,
    'referrer_host', a.referrer_host,
    'first_touch', a.first_touch,
    'last_touch', a.last_touch,
    'first_seen_at', a.first_seen_at,
    'last_seen_at', a.last_seen_at,
    'last_page_view_id', a.last_page_view_id,
    'last_session_id', a.last_session_id,
    'last_site_lead_id', a.last_site_lead_id
  ) into v_attribution
  from private.lead_attribution a
  where a.lead_id = p_lead_id;

  select coalesce(jsonb_agg(jsonb_build_object(
    'id', sl.id,
    'lead_type', sl.lead_type,
    'page_view_id', sl.page_view_id,
    'session_id', sl.tracking #>> '{identity,session_id}',
    'current_path', sl.tracking->>'current_path',
    'attribution', sl.tracking->'attribution',
    'context', sl.context,
    'criado_em', sl.criado_em
  ) order by sl.criado_em), '[]'::jsonb)
  into v_site_leads
  from public.site_leads sl
  left join private.lead_attribution a on a.lead_id = p_lead_id
  where sl.crm_lead_id = p_lead_id
     or sl.id = a.last_site_lead_id;

  with attribution as (
    select a.last_page_view_id, a.last_session_id, a.last_site_lead_id
    from private.lead_attribution a where a.lead_id = p_lead_id
  ),
  site_links as (
    select sl.page_view_id,
           nullif(sl.tracking #>> '{identity,session_id}', '') as session_id
    from public.site_leads sl
    left join attribution a on true
    where sl.crm_lead_id = p_lead_id or sl.id = a.last_site_lead_id
  ),
  linked_events as (
    select e.*
    from private.site_events_anon e
    left join attribution a on true
    where (a.last_page_view_id is not null and e.page_view_id = a.last_page_view_id)
       or (a.last_session_id is not null and e.session_id = a.last_session_id)
       or exists (
         select 1 from site_links sl
         where (sl.page_view_id is not null and sl.page_view_id = e.page_view_id)
            or (sl.session_id is not null and sl.session_id = e.session_id::text)
       )
  )
  select
    coalesce(jsonb_agg(jsonb_build_object(
      'id', id,
      'occurred_at', occurred_at,
      'event_name', event_name,
      'page_path', page_path,
      'device_category', device_category,
      'consent_level', consent_level,
      'utm_source', utm_source,
      'utm_medium', utm_medium,
      'utm_campaign', utm_campaign,
      'properties', properties
    ) order by occurred_at), '[]'::jsonb),
    count(*) > 0
  into v_site_events, v_direct_site_link
  from (select * from linked_events order by occurred_at limit 500) x;

  select coalesce(jsonb_agg(to_jsonb(x) order by x.occurred_at), '[]'::jsonb)
  into v_crm_events
  from (
    select fe.criado_em as occurred_at,
           'crm'::text as channel,
           fe.tipo as event_name,
           fe.titulo as title,
           fe.detalhe as detail,
           fe.payload as properties
    from public.negocios n
    join public.f2_lead fl on fl.origem_negocio_id = n.id
    join public.f2_evento fe on fe.funil_lead_id = fl.id
    where n.lead_id = p_lead_id
    order by fe.criado_em
    limit 500
  ) x;

  select coalesce(jsonb_agg(to_jsonb(x) order by x.occurred_at), '[]'::jsonb)
  into v_deliveries
  from (
    select d.created_at as occurred_at,
           'meta'::text as channel,
           d.event_type as event_name,
           d.status,
           d.event_id,
           d.attempt_count,
           d.response_status,
           d.fbtrace_id,
           d.error_code,
           d.last_error
    from private.tracking_delivery_logs d
    where d.negocio_id in (select n.id from public.negocios n where n.lead_id = p_lead_id)
    order by d.created_at
    limit 500
  ) x;

  return jsonb_build_object(
    'lead', v_lead,
    'attribution', coalesce(v_attribution, '{}'::jsonb),
    'site_leads', coalesce(v_site_leads, '[]'::jsonb),
    'site_events', coalesce(v_site_events, '[]'::jsonb),
    'crm_events', coalesce(v_crm_events, '[]'::jsonb),
    'meta_deliveries', coalesce(v_deliveries, '[]'::jsonb),
    'integrity', jsonb_build_object(
      'attribution_found', v_attribution is not null,
      'direct_site_link', v_direct_site_link,
      'site_link_explanation', case
        when v_direct_site_link then 'Jornada do site vinculada por identificador first-party persistido.'
        else 'Não há vínculo determinístico entre este lead e uma sessão do site; nenhuma inferência foi apresentada como fato.'
      end
    )
  );
end;
$function$;

revoke all on function public.tracking_360_lead_journey(bigint) from public, anon;
grant execute on function public.tracking_360_lead_journey(bigint) to authenticated, service_role;
