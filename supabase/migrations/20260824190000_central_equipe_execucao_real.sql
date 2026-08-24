-- Corrige a semântica operacional da equipe na Central de Comando.
--
-- Uma movimentação é um evento, não um lead. Por isso, movimentações ÷ leads
-- recebidos pode ultrapassar 100%. Esta função mede a execução corretamente:
-- leads distintos da carteira ativa com atividade no período ÷ carteira ativa.

create or replace function public.central_comando_equipe_execucao(
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
  v_result jsonb;
begin
  if not (select ncrm_private.central_gestao_autorizada()) then
    raise exception 'acesso_negado' using errcode = '42501';
  end if;

  with
  carteira_ativa as (
    select
      f.corretor_id,
      n.lead_id
    from public.f2_lead f
    join public.negocios n on n.id = f.origem_negocio_id
    where f.descartado_em is null
      and f.corretor_id is not null
  ),
  carteira_por_corretor as (
    select
      ca.corretor_id,
      count(distinct ca.lead_id)::bigint as carteira_ativa
    from carteira_ativa ca
    group by ca.corretor_id
  ),
  carteira_trabalhada as (
    select
      ca.corretor_id,
      count(distinct ca.lead_id)::bigint as carteira_trabalhada
    from carteira_ativa ca
    join public.perf_eventos p
      on p.lead_id = ca.lead_id
     and p.corretor_id = ca.corretor_id
     and p.ocorrido_em >= v_since
     and p.tipo in (
       'movimentacao',
       'mensagem_enviada',
       'audio_enviado',
       'imagem_enviada',
       'video_enviado',
       'documento_enviado'
     )
    group by ca.corretor_id
  ),
  resposta_por_corretor as (
    select
      p.corretor_id,
      round((percentile_cont(0.9) within group (order by p.valor))::numeric, 1) as primeira_resposta_p90_min,
      round(
        100.0 * count(*) filter (where p.valor <= 15) / nullif(count(*), 0),
        1
      ) as sla_15_pct
    from public.perf_eventos p
    where p.ocorrido_em >= v_since
      and p.corretor_id is not null
      and p.tipo = 'primeira_resposta'
      and p.valor is not null
    group by p.corretor_id
  )
  select coalesce(jsonb_agg(
    jsonb_build_object(
      'corretor_id', c.id,
      'carteira_ativa', coalesce(cp.carteira_ativa, 0),
      'carteira_trabalhada', coalesce(ct.carteira_trabalhada, 0),
      'pct_carteira_trabalhada', case
        when coalesce(cp.carteira_ativa, 0) = 0 then null
        else round(100.0 * coalesce(ct.carteira_trabalhada, 0) / cp.carteira_ativa, 1)
      end,
      'primeira_resposta_p90_min', rp.primeira_resposta_p90_min,
      'sla_15_pct', rp.sla_15_pct
    )
    order by c.nome
  ), '[]'::jsonb)
  into v_result
  from public.corretores c
  left join carteira_por_corretor cp on cp.corretor_id = c.id
  left join carteira_trabalhada ct on ct.corretor_id = c.id
  left join resposta_por_corretor rp on rp.corretor_id = c.id
  where c.ativo;

  return v_result;
end;
$$;

revoke all on function public.central_comando_equipe_execucao(integer)
  from public, anon;
grant execute on function public.central_comando_equipe_execucao(integer)
  to authenticated, service_role;

comment on function public.central_comando_equipe_execucao(integer) is
  'Execução real por corretor: carteira ativa distinta trabalhada, P90 de primeira resposta e SLA de 15 minutos.';
