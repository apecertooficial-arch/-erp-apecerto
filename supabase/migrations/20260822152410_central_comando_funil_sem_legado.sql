-- Separa entrada comercial nova da carga histórica do Funil 2. A primeira
-- versão contava os 693 cards importados como se fossem leads recebidos no
-- período. Esta camada mantém os demais agregados auditados e corrige apenas
-- a definição da coorte e do funil de fluxo.
create or replace function public.central_comando_dashboard_v2(
  p_days integer default 30
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_days integer := greatest(1, least(coalesce(p_days, 30), 365));
  v_since timestamptz := now() - make_interval(days => greatest(1, least(coalesce(p_days, 30), 365)));
  v_previous_since timestamptz := now() - make_interval(days => greatest(1, least(coalesce(p_days, 30), 365)) * 2);
  v_result jsonb;
  v_flow jsonb;
  v_current bigint;
  v_previous bigint;
begin
  if not (select ncrm_private.central_gestao_autorizada()) then
    raise exception 'acesso_negado' using errcode = '42501';
  end if;

  v_result := public.central_comando_dashboard(v_days);

  with cohort as (
    select f.*, n.venda_id
    from public.f2_lead f
    join public.negocios n on n.id = f.origem_negocio_id
    where f.criado_em >= v_since
      and f.momento_codigo <> 'LEAD_LEGADO'
  )
  select
    count(*)::bigint,
    jsonb_build_array(
      jsonb_build_object('key', 'leads', 'label', 'Leads novos', 'value', count(*)),
      jsonb_build_object('key', 'evaluated', 'label', 'Avaliados pela IA', 'value', count(*) filter (where qualidade_atendimento_nota is not null)),
      jsonb_build_object('key', 'visit_scheduled', 'label', 'Com visita agendada', 'value', (
        select count(distinct v.id) from public.f2_visita v join cohort c2 on c2.id = v.funil_lead_id
        where v.status in ('agendada', 'confirmada', 'realizada')
      )),
      jsonb_build_object('key', 'visit_done', 'label', 'Com visita realizada', 'value', (
        select count(distinct v.id) from public.f2_visita v join cohort c2 on c2.id = v.funil_lead_id
        where v.status = 'realizada'
      )),
      jsonb_build_object('key', 'sales', 'label', 'Com venda concluída', 'value', count(distinct venda_id) filter (where venda_id is not null))
    )
  into v_current, v_flow
  from cohort;

  select count(*)::bigint
  into v_previous
  from public.f2_lead f
  where f.criado_em >= v_previous_since
    and f.criado_em < v_since
    and f.momento_codigo <> 'LEAD_LEGADO';

  v_result := jsonb_set(v_result, '{summary,leads_validos}', to_jsonb(v_current), true);
  v_result := jsonb_set(v_result, '{summary,leads_validos_anterior}', to_jsonb(v_previous), true);
  v_result := jsonb_set(v_result, '{funnel,flow}', v_flow, true);
  v_result := jsonb_set(v_result, '{measurement,lead_definition}', to_jsonb('Lead novo = card que entrou no Funil 2 no período sem o marcador LEAD_LEGADO. Cargas históricas não entram.'::text), true);
  v_result := jsonb_set(v_result, '{measurement,funnel_definition}', to_jsonb('Funil de fluxo = coorte dos leads novos do período. Vendas gerais do período permanecem no Financeiro.'::text), true);

  return v_result;
end;
$$;

revoke all on function public.central_comando_dashboard_v2(integer)
  from public, anon;
grant execute on function public.central_comando_dashboard_v2(integer)
  to authenticated, service_role;

comment on function public.central_comando_dashboard_v2(integer) is
  'Central executiva com coorte nova separada da importação histórica do Funil 2.';
