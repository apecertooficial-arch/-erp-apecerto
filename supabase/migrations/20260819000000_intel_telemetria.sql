-- Inteligência · Fase 1 · leitura agregada e SÓ-LEITURA da telemetria anônima.
-- Duas funções SECURITY DEFINER, sem PII, protegidas por is_equipe() OU service_role.
-- O endpoint do ERP chama com o token do usuário logado (is_equipe garante equipe);
-- o escopo fino (admin/gestor/marketing) é aplicado na camada do ERP.
-- Aditivo: cria funções novas, não altera nada existente. Rollback ao final.

create or replace function public.intel_privacidade(
  p_days integer default 30,
  p_consent text default null,
  p_device text default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path to ''
as $function$
declare
  v_ini timestamptz;
  v_hoje date;
  v_res jsonb;
begin
  if not (public.is_equipe() or auth.role() = 'service_role') then
    raise exception 'acesso_negado' using errcode = '42501';
  end if;

  v_ini := now() - make_interval(days => greatest(1, least(p_days, 365)));
  v_hoje := timezone('America/Sao_Paulo', now())::date;

  select jsonb_build_object(
    'periodo_dias', greatest(1, least(p_days, 365)),
    'filtros', jsonb_build_object('consentimento', p_consent, 'dispositivo', p_device),
    'atualizado_em', now(),
    'total_eventos', (
      select count(*) from private.site_events_anon e
      where e.occurred_at >= v_ini
        and (p_consent is null or e.consent_level = p_consent)
        and (p_device is null or e.device_category = p_device)
    ),
    'total_pageviews', (
      select count(distinct page_view_id) from private.site_events_anon e
      where e.occurred_at >= v_ini
        and (p_consent is null or e.consent_level = p_consent)
        and (p_device is null or e.device_category = p_device)
    ),
    'consentimento', (
      select coalesce(jsonb_agg(jsonb_build_object('nivel', consent_level, 'eventos', ev, 'pageviews', pv) order by pv desc), '[]'::jsonb)
      from (
        select consent_level, count(*) ev, count(distinct page_view_id) pv
        from private.site_events_anon e
        where e.occurred_at >= v_ini
          and (p_consent is null or e.consent_level = p_consent)
          and (p_device is null or e.device_category = p_device)
        group by consent_level
      ) c
    ),
    'dispositivos', (
      select coalesce(jsonb_agg(jsonb_build_object('dispositivo', device_category, 'eventos', ev, 'pageviews', pv) order by pv desc), '[]'::jsonb)
      from (
        select device_category, count(*) ev, count(distinct page_view_id) pv
        from private.site_events_anon e
        where e.occurred_at >= v_ini
          and (p_consent is null or e.consent_level = p_consent)
          and (p_device is null or e.device_category = p_device)
        group by device_category
      ) d
    ),
    'eventos_por_tipo', (
      select coalesce(jsonb_agg(jsonb_build_object('evento', event_name, 'total', ev) order by ev desc), '[]'::jsonb)
      from (
        select event_name, count(*) ev
        from private.site_events_anon e
        where e.occurred_at >= v_ini
          and (p_consent is null or e.consent_level = p_consent)
          and (p_device is null or e.device_category = p_device)
        group by event_name
      ) x
    ),
    'eventos_por_hora_hoje', (
      select coalesce(jsonb_agg(jsonb_build_object('hora', hora, 'eventos', ev) order by hora), '[]'::jsonb)
      from (
        select date_part('hour', timezone('America/Sao_Paulo', occurred_at))::int hora, count(*) ev
        from private.site_events_anon e
        where timezone('America/Sao_Paulo', e.occurred_at)::date = v_hoje
          and (p_consent is null or e.consent_level = p_consent)
          and (p_device is null or e.device_category = p_device)
        group by 1
      ) h
    ),
    'semanas', (
      select coalesce(jsonb_agg(jsonb_build_object(
          'semana_inicio', semana, 'essenciais', essenciais, 'analytics', analytics, 'marketing', marketing
        ) order by semana), '[]'::jsonb)
      from (
        select
          date_trunc('week', timezone('America/Sao_Paulo', occurred_at))::date semana,
          count(distinct page_view_id) filter (where consent_level = 'essential') essenciais,
          count(distinct page_view_id) filter (where consent_level = 'analytics') analytics,
          count(distinct page_view_id) filter (where consent_level = 'marketing') marketing
        from private.site_events_anon e
        where e.occurred_at >= now() - interval '28 days'
          and (p_device is null or e.device_category = p_device)
        group by 1
      ) s
    ),
    'cobertura_utm', (
      select case when count(distinct page_view_id) = 0 then null
        else round(100.0 * count(distinct page_view_id) filter (where utm_source is not null) / count(distinct page_view_id), 1) end
      from private.site_events_anon e
      where e.occurred_at >= v_ini
        and (p_consent is null or e.consent_level = p_consent)
        and (p_device is null or e.device_category = p_device)
    ),
    'ultimo_evento_em', (select max(occurred_at) from private.site_events_anon)
  ) into v_res;

  return v_res;
end;
$function$;

create or replace function public.intel_visao_digital(p_days integer default 30)
returns jsonb
language plpgsql
stable
security definer
set search_path to ''
as $function$
declare
  v_ini timestamptz;
  v_res jsonb;
begin
  if not (public.is_equipe() or auth.role() = 'service_role') then
    raise exception 'acesso_negado' using errcode = '42501';
  end if;

  v_ini := now() - make_interval(days => greatest(1, least(p_days, 365)));

  select jsonb_build_object(
    'periodo_dias', greatest(1, least(p_days, 365)),
    'atualizado_em', now(),
    'total_eventos', (select count(*) from private.site_events_anon where occurred_at >= v_ini),
    'total_pageviews', (select count(distinct page_view_id) from private.site_events_anon where occurred_at >= v_ini),
    'visualizacoes_item', (select count(*) from private.site_events_anon where occurred_at >= v_ini and event_name = 'view_item'),
    'intencao', (select count(*) from private.site_events_anon where occurred_at >= v_ini and event_name in ('whatsapp_click','phone_click','generate_lead','owner_cta_click','cta_click')),
    'leads_site', (select count(*) from private.site_events_anon where occurred_at >= v_ini and event_name = 'generate_lead'),
    'paginas', (
      select coalesce(jsonb_agg(jsonb_build_object('pagina', page_path, 'pageviews', pv, 'eventos', ev) order by pv desc), '[]'::jsonb)
      from (
        select page_path, count(distinct page_view_id) pv, count(*) ev
        from private.site_events_anon
        where occurred_at >= v_ini and page_path is not null
        group by page_path order by pv desc limit 12
      ) p
    ),
    'origens', (
      select coalesce(jsonb_agg(jsonb_build_object('origem', origem, 'pageviews', pv, 'eventos', ev) order by pv desc), '[]'::jsonb)
      from (
        select coalesce(nullif(utm_source, ''), nullif(referrer_host, ''), 'direto') origem,
               count(distinct page_view_id) pv, count(*) ev
        from private.site_events_anon
        where occurred_at >= v_ini
        group by 1 order by pv desc limit 12
      ) o
    ),
    'dispositivos', (
      select coalesce(jsonb_agg(jsonb_build_object('dispositivo', device_category, 'pageviews', pv) order by pv desc), '[]'::jsonb)
      from (
        select device_category, count(distinct page_view_id) pv
        from private.site_events_anon where occurred_at >= v_ini group by device_category
      ) d
    ),
    'consentimento', (
      select coalesce(jsonb_agg(jsonb_build_object('nivel', consent_level, 'pageviews', pv) order by pv desc), '[]'::jsonb)
      from (
        select consent_level, count(distinct page_view_id) pv
        from private.site_events_anon where occurred_at >= v_ini group by consent_level
      ) c
    ),
    'cobertura_utm', (
      select case when count(distinct page_view_id) = 0 then null
        else round(100.0 * count(distinct page_view_id) filter (where utm_source is not null) / count(distinct page_view_id), 1) end
      from private.site_events_anon where occurred_at >= v_ini
    ),
    'ultimo_evento_em', (select max(occurred_at) from private.site_events_anon)
  ) into v_res;

  return v_res;
end;
$function$;

revoke all on function public.intel_privacidade(integer, text, text) from public, anon;
revoke all on function public.intel_visao_digital(integer) from public, anon;
grant execute on function public.intel_privacidade(integer, text, text) to authenticated, service_role;
grant execute on function public.intel_visao_digital(integer) to authenticated, service_role;

-- ROLLBACK:
--   drop function if exists public.intel_privacidade(integer, text, text);
--   drop function if exists public.intel_visao_digital(integer);
