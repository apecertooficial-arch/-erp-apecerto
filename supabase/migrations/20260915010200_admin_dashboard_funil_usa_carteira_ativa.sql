-- Onda 3.2 (parte 2) — o Inicio passa a mostrar a carteira ativa, nao a base importada.
--
-- ANTES: open_deals = count(negocios where status='aberto') = 14.159, dos quais
-- 11.045 sem corretor. A tela dizia "13.909 parados (98%)" -- numero correto e
-- inutil, porque quase tudo era base do Aquario nunca trabalhada.
--
-- DEPOIS: open_deals = crm_carteira_ativa = 1.092 (todos com dono).
-- O funil deixa de ser inferido por LIKE no nome da etapa do pipeline antigo e
-- passa a usar f2_lead.etapa, que e a estrutura real do Funil 2.0.
--
-- NADA E ESCONDIDO: acrescentei 'base_importada' com o que ficou de fora, para
-- ninguem achar que o numero sumiu.
--
-- Chaves preservadas para nao quebrar o front: open_deals, macro_fases,
-- em_risco_total, em_risco_por_corretor, conv_por_mes.

create or replace function public.admin_dashboard_funil()
returns jsonb
language sql
stable
security definer
set search_path to 'public'
as $function$
  with base as (
    select id, corretor_id, ultima_movimentacao, proxima_acao_em, f2_etapa,
      case f2_etapa
        when 'novo'             then '1 · Novo'
        when 'tentando_contato' then '2 · Tentando contato'
        when 'pescado'          then '2 · Tentando contato'
        when 'em_atendimento'   then '3 · Em atendimento'
        when 'visita'           then '4 · Visita'
        when 'pos_visita'       then '5 · Pós-visita'
        when 'negociacao'       then '6 · Negociação'
        when 'legado'           then '0 · Carteira antiga'
        else '9 · Outros'
      end as fase
    from crm_carteira_ativa
  )
  select jsonb_build_object(
    'open_deals', (select count(*) from base),

    -- Transparencia: o que ficou de fora da carteira ativa e por que.
    'base_importada', (
      select count(*) from negocios n
      where n.status = 'aberto'
        and not exists (select 1 from f2_lead f where f.origem_negocio_id = n.id and f.descartado_em is null)
    ),

    'macro_fases', (
      select coalesce(jsonb_agg(jsonb_build_object('k', fase, 'n', n) order by fase), '[]'::jsonb)
      from (select fase, count(*) n from base group by fase) t
    ),

    -- "Em risco" passa a ser o que tem proxima acao vencida, que e a regra que o
    -- Funil 2.0 realmente usa, em vez de "parado ha 7 dias" por ultima_movimentacao.
    'em_risco_total', (select count(*) from base where proxima_acao_em < now()),

    'em_risco_por_corretor', (
      select coalesce(jsonb_agg(jsonb_build_object('k', k, 'n', n) order by n desc), '[]'::jsonb)
      from (select coalesce(c.nome,'Sem corretor') k, count(*) n
            from base b left join corretores c on c.id = b.corretor_id
            where b.proxima_acao_em < now()
            group by 1 order by count(*) desc limit 8) t
    ),

    'conv_por_mes', (
      select coalesce(jsonb_agg(jsonb_build_object('m', to_char(g.m,'YYYY-MM'),
        'leads', coalesce(l.n,0), 'vendas', coalesce(v.n,0),
        'pct', case when coalesce(l.n,0)>0 then round(100.0*coalesce(v.n,0)/l.n,1) else 0 end) order by g.m), '[]'::jsonb)
      from generate_series(date_trunc('month',current_date)-interval '5 months', date_trunc('month',current_date), interval '1 month') g(m)
      left join (select date_trunc('month',criado_em) mm, count(*) n from leads where criado_em >= (date_trunc('month',current_date)-interval '5 months') group by 1) l on l.mm = g.m
      left join (select date_trunc('month',data_venda) mm, count(*) n from vendas where data_venda >= (date_trunc('month',current_date)-interval '5 months')::date group by 1) v on v.mm = g.m
    )
  );
$function$;

revoke execute on function public.admin_dashboard_funil() from public, anon;
grant execute on function public.admin_dashboard_funil() to authenticated, service_role;
