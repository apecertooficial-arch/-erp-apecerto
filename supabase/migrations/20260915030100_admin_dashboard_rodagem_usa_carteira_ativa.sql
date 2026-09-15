-- Onda 3.2 (parte 3) — a Rodagem tambem passa a falar de carteira ativa.
--
-- Depois de corrigir admin_dashboard_funil, a MESMA tela do Inicio passou a
-- mostrar dois numeros diferentes para a mesma coisa:
--   "Negocios no funil ..... 1092"   (ja corrigido)
--   "Negocios abertos ..... 14159"   (esta funcao, ainda na definicao antiga)
--   "Negocios parados +7d .. 13951 (99% do pipeline)"
-- Duas verdades na mesma tela e pior do que uma verdade ruim. Esta migracao
-- fecha a inconsistencia.
--
-- open_deals, parados_7d, parados_faixa e open_by_corretor passam a ler
-- crm_carteira_ativa. Acrescento base_importada para o numero antigo continuar
-- visivel e ninguem achar que sumiram 13 mil registros.
--
-- "Parado" tambem muda de regra: passa a ser proxima_acao_em vencida, que e o
-- que o Funil 2.0 realmente cobra, em vez de ultima_movimentacao -- campo que
-- nunca se mexe nos leads importados e por isso dava "99% parados" para sempre.
--
-- CONFERIDO NO ERP EM PRODUCAO depois do deploy:
--   Negocios abertos ........ 14159 -> 1092
--   Negocios parados +7 dias  13951 -> 170  (99% -> 16%)

create or replace function public.admin_dashboard_rodagem()
returns jsonb
language sql
stable
security definer
set search_path to 'public'
as $function$
  select jsonb_build_object(
    'leads_today', (select count(*) from leads where criado_em::date = current_date),
    'leads_week',  (select count(*) from leads where criado_em >= current_date - 6),
    'leads_total', (select count(*) from leads),

    'open_deals',  (select count(*) from crm_carteira_ativa),
    'parados_7d',  (select count(*) from crm_carteira_ativa where proxima_acao_em < now() - interval '7 days'),

    'base_importada', (
      select count(*) from negocios n
      where n.status = 'aberto'
        and not exists (select 1 from f2_lead f where f.origem_negocio_id = n.id and f.descartado_em is null)
    ),

    'leads_per_day', (
      select coalesce(jsonb_agg(jsonb_build_object('d', to_char(g.d::date,'YYYY-MM-DD'), 'n', coalesce(c.n,0)) order by g.d), '[]'::jsonb)
      from generate_series(current_date - 13, current_date, interval '1 day') g(d)
      left join (select criado_em::date dd, count(*) n from leads where criado_em >= current_date - 13 group by 1) c on c.dd = g.d::date
    ),
    'leads_by_origem', (
      select coalesce(jsonb_agg(jsonb_build_object('k', k, 'n', n) order by n desc), '[]'::jsonb)
      from (select coalesce(nullif(origem,''),'Sem origem') k, count(*) n from leads where criado_em >= current_date - 6 group by 1) t
    ),

    'parados_faixa', (
      select jsonb_build_object(
        'f7_14',  count(*) filter (where proxima_acao_em < now() - interval '7 days'  and proxima_acao_em >= now() - interval '14 days'),
        'f14_30', count(*) filter (where proxima_acao_em < now() - interval '14 days' and proxima_acao_em >= now() - interval '30 days'),
        'f30',    count(*) filter (where proxima_acao_em < now() - interval '30 days')
      ) from crm_carteira_ativa
    ),

    'open_by_corretor', (
      select coalesce(jsonb_agg(jsonb_build_object('k', k, 'n', n, 'parados', p) order by n desc), '[]'::jsonb)
      from (
        select coalesce(c.nome,'Sem corretor') k, count(*) n,
               count(*) filter (where ca.proxima_acao_em < now() - interval '7 days') p
        from crm_carteira_ativa ca left join corretores c on c.id = ca.corretor_id
        group by 1 order by count(*) desc limit 8
      ) t
    ),

    -- ATENDIMENTO (inalterado: ja olhava leads, nao negocios)
    'atend_hoje', (
      select jsonb_build_object(
        'recebidos', count(*),
        'atendidos', count(*) filter (where atendido_em is not null),
        'pct', case when count(*)>0 then round(100.0*count(*) filter (where atendido_em is not null)/count(*)) else 0 end
      ) from leads where criado_em::date = current_date
    ),
    'atend_por_dia', (
      select coalesce(jsonb_agg(jsonb_build_object('d', to_char(g.d::date,'YYYY-MM-DD'), 'pct', pct) order by g.d), '[]'::jsonb)
      from generate_series(current_date - 6, current_date, interval '1 day') g(d)
      left join lateral (
        select case when count(*)>0 then round(100.0*count(*) filter (where atendido_em is not null)/count(*)) else 0 end pct
        from leads where criado_em::date = g.d::date
      ) c on true
    ),
    'tempo_resp_min', (
      select coalesce(round(avg(extract(epoch from (atendido_em - criado_em))/60.0)),0)
      from leads where atendido_em is not null and criado_em >= current_date - 6 and atendido_em >= criado_em
    ),
    'aguardando_total', (select count(*) from leads where atendido_em is null and criado_em >= current_date - 30),
    'aguardando_por_corretor', (
      select coalesce(jsonb_agg(jsonb_build_object('k', k, 'n', n) order by n desc), '[]'::jsonb)
      from (
        select coalesce(c.nome,'Sem corretor') k, count(*) n
        from leads l left join corretores c on c.id = l.corretor_id
        where l.atendido_em is null and l.criado_em >= current_date - 30
        group by 1 order by count(*) desc limit 8
      ) t
    )
  );
$function$;

revoke execute on function public.admin_dashboard_rodagem() from public, anon;
grant execute on function public.admin_dashboard_rodagem() to authenticated, service_role;
