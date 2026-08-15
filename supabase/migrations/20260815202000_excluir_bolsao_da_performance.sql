-- O Aquário/Bolsão é estoque de pesca da empresa, não trabalho de corretor.
-- Esta RPC devolve os totais elegíveis e corrige métricas individuais sem
-- apagar mensagens ou ações que de fato foram executadas.

create or replace function public.performance_bolsao_ajustes(
  p_inicio date,
  p_fim date
)
returns jsonb
language sql
stable
security definer
set search_path to ''
as $function$
with
limites as (
  select p_inicio inicio,p_fim fim,
    (p_inicio::timestamp at time zone 'America/Sao_Paulo') inicio_ts,
    (p_fim::timestamp at time zone 'America/Sao_Paulo') fim_ts
  where p_inicio is not null and p_fim is not null and p_fim>p_inicio and p_fim-p_inicio<=36525
),
permissao as (
  select public.can_manage_all() admin,public.current_broker_id() corretor
),
cor as (
  select c.id
  from public.corretores c cross join permissao p
  where c.ativo and (p.admin or c.id=p.corretor)
),
leads_elegiveis as (
  select l.corretor_id,count(*)::integer total
  from public.leads l join cor c on c.id=l.corretor_id cross join limites x
  where l.criado_em>=x.inicio_ts and l.criado_em<x.fim_ts
    and not exists (
      select 1 from public.negocios n
      where n.lead_id=l.id and n.stage_id=public.aquario_stage_id()
    )
  group by l.corretor_id
),
negocios_elegiveis as (
  select n.corretor_id,count(*)::integer total
  from public.negocios n join cor c on c.id=n.corretor_id cross join limites x
  where n.criado_em>=x.inicio_ts and n.criado_em<x.fim_ts
    and n.stage_id is distinct from public.aquario_stage_id()
  group by n.corretor_id
),
avaliacoes_elegiveis as (
  select coalesce(n.corretor_id,l.corretor_id) corretor_id,
    count(*)::integer total,round(avg(a.nota),2) nota_media,
    count(distinct coalesce(a.negocio_id,a.lead_id))::integer entidades
  from public.lead_avaliacoes a
  left join public.negocios n on n.id=a.negocio_id
  left join public.leads l on l.id=a.lead_id
  join cor c on c.id=coalesce(n.corretor_id,l.corretor_id)
  cross join limites x
  where a.criado_em>=x.inicio_ts and a.criado_em<x.fim_ts
    and not exists (
      select 1 from public.negocios nx
      where nx.stage_id=public.aquario_stage_id()
        and (nx.id=a.negocio_id or nx.lead_id=a.lead_id)
    )
  group by coalesce(n.corretor_id,l.corretor_id)
),
carteira_elegivel as (
  select f.corretor_id,
    count(*) filter (where f.descartado_em is null)::integer ativa,
    count(*) filter (where f.descartado_em is null and f.proxima_acao_em<now())::integer vencidas,
    count(*) filter (where f.descartado_em is null and f.proxima_acao_em>=now() and f.proxima_acao_em<now()+interval '2 hours')::integer vencem_2h,
    count(*) filter (where f.descartado_em is null and f.ultima_reavaliacao_sara_em is not null)::integer sara,
    count(*) filter (where f.descartado_em is not null and f.descartado_em>=x.inicio_ts and f.descartado_em<x.fim_ts)::integer descartes
  from public.f2_lead f join cor c on c.id=f.corretor_id cross join limites x
  where f.etapa<>'pescado'
  group by f.corretor_id
),
f2_elegivel as (
  select f.corretor_id,
    count(*) filter (where e.tipo='acao_confirmada')::integer acoes,
    count(*) filter (where e.tipo='momento_alterado')::integer momentos,
    count(*) filter (where e.tipo='sara_reavaliou')::integer sara,
    count(distinct e.funil_lead_id)::integer leads
  from public.f2_evento e join public.f2_lead f on f.id=e.funil_lead_id
  join cor c on c.id=f.corretor_id cross join limites x
  where e.criado_em>=x.inicio_ts and e.criado_em<x.fim_ts and f.etapa<>'pescado'
  group by f.corretor_id
),
ajustes as (
  select c.id,
    coalesce(le.total,0) leads,coalesce(ne.total,0) negocios,
    coalesce(ae.total,0) avaliacoes,ae.nota_media,coalesce(ae.entidades,0) entidades,
    coalesce(ce.ativa,0) carteira_ativa,coalesce(ce.vencidas,0) carteira_vencidas,
    coalesce(ce.vencem_2h,0) vencem_2h,coalesce(ce.sara,0) sara_cobertos,
    coalesce(ce.descartes,0) descartes,
    coalesce(fe.acoes,0) f2_acoes,coalesce(fe.momentos,0) f2_momentos,
    coalesce(fe.sara,0) f2_sara,coalesce(fe.leads,0) f2_leads
  from cor c
  left join leads_elegiveis le on le.corretor_id=c.id
  left join negocios_elegiveis ne on ne.corretor_id=c.id
  left join avaliacoes_elegiveis ae on ae.corretor_id=c.id
  left join carteira_elegivel ce on ce.corretor_id=c.id
  left join f2_elegivel fe on fe.corretor_id=c.id
),
equipe as (
  select
    count(*)::integer leads_total,
    count(*) filter (where exists(
      select 1 from public.negocios n where n.lead_id=l.id and n.stage_id=public.aquario_stage_id()
    ))::integer leads_bolsao,
    count(*) filter (where not exists(
      select 1 from public.negocios n where n.lead_id=l.id and n.stage_id=public.aquario_stage_id()
    ))::integer leads_operacionais
  from public.leads l cross join limites x cross join permissao p
  where p.admin and l.criado_em>=x.inicio_ts and l.criado_em<x.fim_ts
),
equipe_negocios as (
  select count(*)::integer negocios_total,
    count(*) filter (where n.stage_id=public.aquario_stage_id())::integer negocios_bolsao,
    count(*) filter (where n.stage_id is distinct from public.aquario_stage_id())::integer negocios_operacionais
  from public.negocios n cross join limites x cross join permissao p
  where p.admin and n.criado_em>=x.inicio_ts and n.criado_em<x.fim_ts
)
select jsonb_build_object(
  'equipe',case when p.admin then jsonb_build_object(
    'leadsTotais',e.leads_total,'leadsBolsao',e.leads_bolsao,'leadsOperacionais',e.leads_operacionais,
    'negociosTotais',en.negocios_total,'negociosBolsao',en.negocios_bolsao,'negociosOperacionais',en.negocios_operacionais
  ) else null end,
  'corretores',coalesce((select jsonb_agg(jsonb_build_object(
    'corretorId',a.id,'leadsCriados',a.leads,'negociosCriados',a.negocios,
    'avaliacoesLead',a.avaliacoes,'notaMediaLead',a.nota_media,'entidadesAvaliadas',a.entidades,
    'carteiraAtiva',a.carteira_ativa,'acoesVencidas',a.carteira_vencidas,'vencem2h',a.vencem_2h,
    'saraCobertos',a.sara_cobertos,'descartes',a.descartes,
    'f2AcoesConfirmadas',a.f2_acoes,'f2MomentosAlterados',a.f2_momentos,
    'f2SaraReavaliacoes',a.f2_sara,'f2LeadsMovimentados',a.f2_leads
  )) from ajustes a),'[]'::jsonb)
)
from permissao p
left join equipe e on p.admin
left join equipe_negocios en on p.admin;
$function$;

revoke all on function public.performance_bolsao_ajustes(date,date) from public,anon;
grant execute on function public.performance_bolsao_ajustes(date,date) to authenticated,service_role;
