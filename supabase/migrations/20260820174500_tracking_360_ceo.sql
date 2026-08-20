-- Camada canônica de leitura para a Inteligência da ApêCerto.
--
-- Não altera os dados comerciais e não cria uma segunda fonte da verdade.
-- Organiza os registros que já existem no site, CRM, Funil 2.0, agenda e
-- financeiro em um único contrato agregado, com diagnóstico explícito de
-- qualidade. Somente a gestão autenticada e service_role podem consultar.

create index if not exists negocios_criado_em_tracking_idx
  on public.negocios (criado_em desc);

create index if not exists leads_criado_em_tracking_idx
  on public.leads (criado_em desc);

create index if not exists visitas_criado_em_tracking_idx
  on public.visitas (criado_em desc);

create index if not exists ncrm_proposta_criada_em_tracking_idx
  on public.ncrm_proposta (criada_em desc);

create index if not exists vendas_created_at_tracking_idx
  on public.vendas (created_at desc);

create index if not exists captacoes_portal_criado_em_tracking_idx
  on public.captacoes_portal (criado_em desc);

create index if not exists f2_lead_proxima_acao_vencida_tracking_idx
  on public.f2_lead (proxima_acao_em, corretor_id)
  where descartado_em is null and proxima_acao_em is not null;

create or replace function public.tracking_360_ceo(p_days integer default 30)
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
  site_events as (
    select
      count(*) filter (where event_name = 'page_view')::bigint as page_views,
      count(distinct page_view_id) filter (where event_name = 'page_view')::bigint as page_view_ids,
      count(distinct page_view_id) filter (where event_name <> 'page_view')::bigint as engaged_page_views,
      count(*) filter (where event_name in ('whatsapp_click', 'phone_click', 'form_start'))::bigint as intent_events,
      count(*) filter (where event_name = 'form_start')::bigint as form_starts,
      count(*) filter (where event_name = 'generate_lead')::bigint as generated_leads,
      count(*) filter (where event_name = 'view_item')::bigint as property_views,
      count(*) filter (where event_name = 'property_search')::bigint as property_searches,
      count(*) filter (where event_name = 'sara_search')::bigint as sara_searches,
      count(*) filter (where event_name = 'sara_results')::bigint as sara_results,
      count(*) filter (where event_name = 'sara_error')::bigint as sara_errors,
      count(*) filter (where event_name = 'owner_cta_click')::bigint as owner_cta_clicks,
      count(*) filter (where consent_level = 'essential')::bigint as essential_events,
      count(*) filter (where consent_level = 'analytics')::bigint as analytics_events,
      count(*) filter (where consent_level = 'marketing')::bigint as marketing_events,
      max(occurred_at) as last_event_at
    from private.site_events_anon
    where occurred_at >= v_since
  ),
  site_leads as (
    select
      count(*)::bigint as total,
      count(*) filter (where lead_type = 'proprietario')::bigint as owners,
      count(*) filter (where lead_type = 'comprador')::bigint as buyers,
      count(*) filter (where crm_synced_at is not null)::bigint as synced,
      count(*) filter (where crm_sync_error is not null)::bigint as sync_errors,
      count(*) filter (where crm_negocio_id is not null)::bigint as deals
    from public.site_leads
    where criado_em >= v_since
  ),
  attribution as (
    select
      count(*)::bigint as total,
      count(*) filter (where source is not null)::bigint as with_source,
      count(*) filter (where campaign is not null)::bigint as with_campaign,
      count(*) filter (where coalesce(gclid, gbraid, wbraid, fbclid) is not null)::bigint as with_click_id
    from private.lead_attribution
    where last_seen_at >= v_since
  ),
  crm as (
    select
      (select count(*)::bigint from public.leads where criado_em >= v_since) as leads,
      count(*)::bigint as deals,
      count(*) filter (where status = 'aberto')::bigint as open_deals,
      count(*) filter (where status = 'ganho')::bigint as won_deals,
      count(*) filter (where status = 'perdido')::bigint as lost_deals,
      count(*) filter (where status = 'aberto' and valor is null)::bigint as open_without_value,
      sum(valor) filter (where status = 'aberto' and valor > 0) as pipeline_value
    from public.negocios
    where criado_em >= v_since
  ),
  sla_base as (
    select
      n.id as deal_id,
      n.corretor_id,
      l.id as lead_id,
      l.criado_em as lead_created_at,
      e.primeira_resposta_em,
      extract(epoch from (e.primeira_resposta_em - l.criado_em)) / 60.0 as response_minutes
    from public.negocios n
    join public.leads l on l.id = n.lead_id
    left join public.ncrm_estado e on e.negocio_id = n.id
    where l.criado_em >= v_since
  ),
  sla as (
    select
      count(*)::bigint as total,
      count(*) filter (where primeira_resposta_em is not null)::bigint as responded,
      count(*) filter (where response_minutes >= 0)::bigint as valid,
      count(*) filter (where response_minutes < 0)::bigint as invalid,
      count(*) filter (where response_minutes between 0 and 5)::bigint as within_5,
      count(*) filter (where response_minutes > 5)::bigint as over_5,
      count(*) filter (where primeira_resposta_em is null)::bigint as unanswered,
      percentile_cont(0.5) within group (order by response_minutes)
        filter (where response_minutes >= 0) as median_minutes,
      percentile_cont(0.9) within group (order by response_minutes)
        filter (where response_minutes >= 0) as p90_minutes
    from sla_base
  ),
  visits as (
    select
      count(*)::bigint as total,
      count(*) filter (where status = 'agendada')::bigint as scheduled,
      count(*) filter (where status = 'realizada')::bigint as completed,
      count(*) filter (where status = 'cancelada')::bigint as cancelled,
      count(*) filter (where resultado is not null)::bigint as with_result,
      count(*) filter (where status = 'realizada' and resultado is null)::bigint as completed_without_result
    from public.visitas
    where criado_em >= v_since
  ),
  proposals as (
    select
      count(*)::bigint as total,
      count(*) filter (where status = 'aceita')::bigint as accepted,
      count(*) filter (where venda_id is not null)::bigint as converted,
      coalesce(sum(valor), 0)::numeric as value
    from public.ncrm_proposta
    where criada_em >= v_since
  ),
  sales as (
    select
      count(*)::bigint as total,
      coalesce(sum(vgv), 0)::numeric as vgv,
      coalesce(sum(vgv * percentual_comissao), 0)::numeric as gross_commission,
      coalesce(sum(custos), 0)::numeric as costs
    from public.vendas
    where created_at >= v_since
  ),
  payouts as (
    select coalesce(sum(coalesce(c.valor_final, c.valor_calculado)), 0)::numeric as value
    from public.comissoes c
    join public.vendas v on v.id = c.venda_id
    where v.created_at >= v_since
  ),
  targets as (
    select
      coalesce(sum(meta_vgv), 0)::numeric as target_vgv,
      coalesce(sum(meta_vendas), 0)::bigint as target_sales
    from public.metas
    where periodo_tipo = 'mensal'
      and ano = extract(year from timezone('America/Sao_Paulo', now()))::integer
      and periodo = extract(month from timezone('America/Sao_Paulo', now()))::integer
  ),
  owners as (
    select
      count(*)::bigint as total,
      count(*) filter (where site_lead_id is not null)::bigint as from_site,
      count(*) filter (where status in ('publicado', 'aprovado'))::bigint as published,
      count(*) filter (where status in ('contatado', 'em_atendimento', 'visita_agendada', 'avaliado'))::bigint as contacted
    from public.captacoes_portal
    where criado_em >= v_since
  ),
  process_health as (
    select
      count(*) filter (where descartado_em is null and proxima_acao_em < now())::bigint as overdue_actions,
      count(*) filter (where descartado_em is null and proxima_acao_em is null)::bigint as without_next_action
    from public.f2_lead
  ),
  team_leads as (
    select
      sb.corretor_id,
      count(distinct sb.deal_id)::bigint as leads,
      count(*) filter (where sb.response_minutes >= 0)::bigint as valid_responses,
      count(*) filter (where sb.response_minutes between 0 and 5)::bigint as within_5,
      percentile_cont(0.5) within group (order by sb.response_minutes)
        filter (where sb.response_minutes >= 0) as median_minutes,
      percentile_cont(0.9) within group (order by sb.response_minutes)
        filter (where sb.response_minutes >= 0) as p90_minutes
    from sla_base sb
    where sb.corretor_id is not null
    group by sb.corretor_id
  ),
  team_visits as (
    select
      corretor_id,
      count(*)::bigint as visits,
      count(*) filter (where status = 'realizada')::bigint as completed_visits,
      count(*) filter (where status = 'realizada' and resultado is null)::bigint as missing_feedback
    from public.visitas
    where criado_em >= v_since and corretor_id is not null
    group by corretor_id
  ),
  team_sales as (
    select
      corretor_id,
      count(*)::bigint as sales,
      coalesce(sum(vgv), 0)::numeric as vgv
    from public.vendas
    where created_at >= v_since and corretor_id is not null
    group by corretor_id
  ),
  team_overdue as (
    select corretor_id, count(*)::bigint as overdue
    from public.f2_lead
    where descartado_em is null and proxima_acao_em < now() and corretor_id is not null
    group by corretor_id
  ),
  team as (
    select coalesce(jsonb_agg(jsonb_build_object(
      'corretor_id', c.id,
      'nome', c.nome,
      'leads', coalesce(tl.leads, 0),
      'respostas_validas', coalesce(tl.valid_responses, 0),
      'sla_5_percentual', case when coalesce(tl.valid_responses, 0) = 0 then null
        else round(100.0 * tl.within_5 / tl.valid_responses, 1) end,
      'mediana_primeira_resposta_min', round(tl.median_minutes::numeric, 1),
      'p90_primeira_resposta_min', round(tl.p90_minutes::numeric, 1),
      'visitas', coalesce(tv.visits, 0),
      'visitas_realizadas', coalesce(tv.completed_visits, 0),
      'visitas_sem_feedback', coalesce(tv.missing_feedback, 0),
      'vendas', coalesce(ts.sales, 0),
      'vgv', coalesce(ts.vgv, 0),
      'followups_vencidos', coalesce(toverdue.overdue, 0)
    ) order by coalesce(ts.vgv, 0) desc, coalesce(tl.leads, 0) desc), '[]'::jsonb) as rows
    from public.corretores c
    left join team_leads tl on tl.corretor_id = c.id
    left join team_visits tv on tv.corretor_id = c.id
    left join team_sales ts on ts.corretor_id = c.id
    left join team_overdue toverdue on toverdue.corretor_id = c.id
    where c.ativo
  )
  select jsonb_build_object(
    'periodo', jsonb_build_object('dias', v_days, 'inicio', v_since, 'fim', now()),
    'digital', jsonb_build_object(
      'page_views', se.page_views,
      'page_view_ids', se.page_view_ids,
      'engaged_page_views', se.engaged_page_views,
      'intent_events', se.intent_events,
      'form_starts', se.form_starts,
      'generated_leads', se.generated_leads,
      'property_views', se.property_views,
      'property_searches', se.property_searches,
      'sara_searches', se.sara_searches,
      'sara_results', se.sara_results,
      'sara_errors', se.sara_errors,
      'owner_cta_clicks', se.owner_cta_clicks,
      'last_event_at', se.last_event_at,
      'consent', jsonb_build_object('essential_events', se.essential_events, 'analytics_events', se.analytics_events, 'marketing_events', se.marketing_events),
      'site_leads', to_jsonb(sl),
      'attribution', to_jsonb(a)
    ),
    'crm', to_jsonb(crm),
    'sla', to_jsonb(sla),
    'visitas', to_jsonb(v),
    'propostas', to_jsonb(pr),
    'vendas', to_jsonb(sa) || jsonb_build_object(
      'payouts', po.value,
      'net_contribution', sa.gross_commission - po.value - sa.costs,
      'target_vgv', ta.target_vgv,
      'target_sales', ta.target_sales,
      'target_coverage_percent', case when ta.target_vgv > 0 then round(100 * sa.vgv / ta.target_vgv, 1) else null end
    ),
    'proprietarios', to_jsonb(ow),
    'processo', to_jsonb(ph),
    'qualidade_dados', jsonb_build_object(
      'sla_timestamp_invalido', sla.invalid,
      'sla_sem_resposta', sla.unanswered,
      'visitas_realizadas_sem_resultado', v.completed_without_result,
      'negocios_abertos_sem_valor', crm.open_without_value,
      'leads_site_com_erro_crm', sl.sync_errors,
      'atribuicoes_sem_origem', greatest(a.total - a.with_source, 0),
      'tracking_atrasado', se.last_event_at is null or se.last_event_at < now() - interval '2 hours'
    ),
    'equipe', team.rows,
    'atualizado_em', now()
  ) into v_result
  from site_events se, site_leads sl, attribution a, crm, sla, visits v,
       proposals pr, sales sa, payouts po, targets ta, owners ow,
       process_health ph, team;

  return v_result;
end;
$$;

revoke all on function public.tracking_360_ceo(integer) from public, anon, authenticated;
grant execute on function public.tracking_360_ceo(integer) to authenticated, service_role;

comment on function public.tracking_360_ceo(integer) is
  'Resumo agregado da operação para a Inteligência: site, atribuição, CRM, SLA, visitas, propostas, vendas, captação, processo, qualidade e equipe. Gestão only.';
