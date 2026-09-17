-- Desfaz 20260917160000_fase2_datas_sp_sql.
-- Restaura, byte a byte, as definições de produção capturadas com pg_get_functiondef
-- em 2026-09-17 (antes da migration), o default original de ia_notas_atendimento.dia
-- e remove public.hoje_operacao().
-- md5(prosrc) originais:
--   admin_dashboard_financeiro 54febe31275b03679fe0722bc9b6a741
--   admin_dashboard_funil      8fe5f900de151848d27e28f85ee4f678
--   admin_dashboard_rodagem    7e926fb91ff9805a58b6d0e3342b3707
--   aprovar_solicitacao        27d9071eea12716a274df9e1e88f18a7
--   dashboard_kpis             66bcc4392bd2901bcb9bd35142d3dfd8
--   ncrm_equipe_online         af72207c38eff1aa87ce5ef3cfbabf9c
--   pj_alerta_atrasadas        427e53a0c1ea66c89fafb89d108b1fe7
--   sync_venda_conclusao       d28688957402457496648c3096214595
-- CREATE OR REPLACE preserva owner, grants e comentários (nenhuma das funções tinha comentário).

CREATE OR REPLACE FUNCTION public.admin_dashboard_financeiro()
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select jsonb_build_object(
    'month_vgv',      (select coalesce(sum(vgv),0) from vendas where data_conclusao is not null and date_trunc('month',data_conclusao)=date_trunc('month',current_date)),
    'month_count',    (select count(*) from vendas where data_conclusao is not null and date_trunc('month',data_conclusao)=date_trunc('month',current_date)),
    'month_comissao', (select coalesce(sum(vgv*percentual_comissao),0) from vendas where data_conclusao is not null and date_trunc('month',data_conclusao)=date_trunc('month',current_date)),
    'total_vgv',      (select coalesce(sum(vgv),0) from vendas where data_conclusao is not null),
    'total_count',    (select count(*) from vendas where data_conclusao is not null),
    'total_comissao', (select coalesce(sum(vgv*percentual_comissao),0) from vendas where data_conclusao is not null),
    'negociacao_vgv',   (select coalesce(sum(vgv),0) from vendas where data_conclusao is null and status <> 'distrato'::status_venda),
    'negociacao_count', (select count(*) from vendas where data_conclusao is null and status <> 'distrato'::status_venda),
    'meta_mes', (select coalesce(max(meta_vgv),0) from metas
                 where corretor_id is null and periodo_tipo='mensal'
                   and ano=extract(year from current_date)::int and periodo=extract(month from current_date)::int),
    'by_month', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'm', to_char(g.m,'YYYY-MM'),
        'vgv', coalesce(v.vgv,0), 'count', coalesce(v.c,0), 'comissao', coalesce(v.com,0)) order by g.m), '[]'::jsonb)
      from generate_series(date_trunc('month',current_date)-interval '5 months', date_trunc('month',current_date), interval '1 month') g(m)
      left join (
        select date_trunc('month',data_conclusao) mm, sum(vgv) vgv, count(*) c, sum(vgv*percentual_comissao) com
        from vendas
        where data_conclusao is not null
          and data_conclusao >= (date_trunc('month',current_date)-interval '5 months')::date
        group by 1
      ) v on v.mm = g.m
    ),
    'ranking', (
      select coalesce(jsonb_agg(jsonb_build_object('k', k, 'vgv', round(vgv), 'n', n) order by vgv desc), '[]'::jsonb)
      from (
        select vc.corretor_nome k,
               sum(v.vgv * coalesce(vc.fracao,0)) vgv,
               count(distinct v.id) n
        from venda_corretores vc
        join vendas v on v.id = vc.venda_id
        where v.data_conclusao is not null
          and v.data_conclusao >= (date_trunc('month',current_date)-interval '5 months')::date
        group by vc.corretor_nome
        having sum(v.vgv * coalesce(vc.fracao,0)) > 0
        order by sum(v.vgv * coalesce(vc.fracao,0)) desc
        limit 8
      ) t
    )
  );
$function$
;

CREATE OR REPLACE FUNCTION public.admin_dashboard_funil()
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
$function$
;

CREATE OR REPLACE FUNCTION public.admin_dashboard_rodagem()
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
$function$
;

CREATE OR REPLACE FUNCTION public.aprovar_solicitacao(p_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare s public.venda_solicitacoes; v_prod record; v_venda uuid; v_resp uuid; v_tipo text;
begin
  if not public.can_manage_all() then return jsonb_build_object('ok', false, 'erro', 'sem_permissao'); end if;
  select * into s from venda_solicitacoes where id = p_id;
  if s.id is null then return jsonb_build_object('ok', false, 'erro', 'nao_encontrada'); end if;
  if s.status <> 'pendente' then return jsonb_build_object('ok', false, 'erro', 'ja_decidida'); end if;
  select id, nome, origem into v_prod from empreendimentos where id = s.produto_id;
  v_tipo := case when v_prod.origem = 'terceiros' then 'revenda' else 'construtora' end;
  select usuario_id into v_resp from corretores where id = s.corretor_id;
  insert into vendas(data_venda, empreendimento_id, empreendimento_nome, vgv, forma_pgto, status, obs, corretor_id)
  values (now()::date, v_prod.id, v_prod.nome, s.vgv, s.forma_pgto, 'pendente', s.obs, s.corretor_id)
  returning id into v_venda;
  -- CORREÇÃO: marcar o negócio como 'ganho' ao fechar a venda (sai do funil, alimenta conversão)
  update negocios set venda_id = v_venda, status = 'ganho', ultima_movimentacao = now() where id = s.negocio_id;
  insert into venda_processos(venda_id, negocio_id, etapa, tipo_venda, responsavel_usuario_id, criado_por)
  values (v_venda, s.negocio_id, 'inicio', v_tipo, v_resp, auth.uid());
  update venda_solicitacoes set status='aprovada', venda_id=v_venda, decidido_por=auth.uid(), decidido_em=now() where id=p_id;
  return jsonb_build_object('ok', true, 'venda_id', v_venda);
end $function$
;

CREATE OR REPLACE FUNCTION public.dashboard_kpis()
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
  with scope as (
    select public.can_manage_all() as all_access,
           public.current_broker_id() as broker_id,
           (select auth.uid()) as user_id
  ), v as (
    select
      (select count(*) from public.leads l, scope s where s.all_access or l.corretor_id=s.broker_id) as total_leads,
      (select count(*) from public.negocios n, scope s where n.status='aberto' and (s.all_access or n.corretor_id=s.broker_id)) as neg_abertos,
      (select count(*) from public.negocios n, scope s where n.status='ganho' and (s.all_access or n.corretor_id=s.broker_id)
         and date_trunc('month',coalesce(n.ultima_movimentacao,n.criado_em))=date_trunc('month',current_date)) as ganhos_mes,
      (select count(distinct ve.id) from public.vendas ve, scope s
         where s.all_access or exists (select 1 from public.venda_corretores vc where vc.venda_id=ve.id and vc.corretor_id=s.user_id)) as vendas_fechadas,
      (select coalesce(sum(ve.vgv*coalesce(vc.fracao,1)),0)
         from public.vendas ve join public.venda_corretores vc on vc.venda_id=ve.id, scope s
         where s.all_access or vc.corretor_id=s.user_id) as vgv_total,
      (select coalesce(sum(c.valor_final),0) from public.comissoes c, scope s
         where s.all_access or c.beneficiario_id=s.user_id) as comissao_prev,
      (select coalesce(sum(case when lc.tipo='entrada' then lc.valor else -lc.valor end),0)
         from public.lancamentos_caixa lc, scope s
         where s.all_access or exists (select 1 from public.venda_corretores vc where vc.venda_id=lc.venda_id and vc.corretor_id=s.user_id)) as saldo,
      (select count(distinct ve.id) from public.vendas ve, scope s where ve.status::text='pendente'
         and (s.all_access or exists (select 1 from public.venda_corretores vc where vc.venda_id=ve.id and vc.corretor_id=s.user_id))) as pend
  )
  select jsonb_build_object(
    'total_leads', total_leads::text,
    'negocios_abertos', neg_abertos::text,
    'ganhos_mes', ganhos_mes::text,
    'vendas_fechadas', vendas_fechadas::text,
    'vgv_total', public.fmt_brl_compact(vgv_total),
    'comissao_prevista', public.fmt_brl_compact(comissao_prev),
    'saldo_caixa', public.fmt_brl_compact(saldo),
    'atividades_pendentes', pend::text
  ) from v;
$function$
;

CREATE OR REPLACE FUNCTION public.ncrm_equipe_online()
 RETURNS TABLE(corretor_id bigint, nome text, online boolean)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select c.id::bigint,
         c.nome,
         coalesce(a.ultimo_em > now() - interval '15 minutes', false) as online
  from public.corretores c
  left join lateral (
    select max(ultimo_em) as ultimo_em
    from public.ncrm_acesso na
    where na.usuario_id = c.usuario_id
      and na.dia >= current_date - 1
  ) a on true
  where c.ativo = true
  order by c.nome;
$function$
;

CREATE OR REPLACE FUNCTION public.pj_alerta_atrasadas()
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare n int := 0; r record;
begin
  for r in
    select t.id, t.titulo, t.projeto_id, p.nome as projeto, u.nome as resp
    from projeto_tarefas t
    join projetos p on p.id = t.projeto_id and p.status = 'ativo'
    left join usuarios u on u.id = t.responsavel_id
    where t.prazo < current_date and not t.concluida and not t.arquivada
      and not exists (
        select 1 from projeto_atividades a
        where a.tarefa_id = t.id and a.acao = 'tarefa_atrasada' and a.criado_em::date = current_date
      )
  loop
    insert into projeto_atividades (projeto_id, tarefa_id, acao, detalhe)
    values (r.projeto_id, r.id, 'tarefa_atrasada', 'Tarefa "'||r.titulo||'" do projeto "'||r.projeto||'" está atrasada'||coalesce(' (resp.: '||r.resp||')','')||'.');
    insert into erp_auditoria (acao, modulo, entidade, entidade_id, detalhe)
    values ('tarefa_atrasada', 'Projetos e Tarefas', 'projeto_tarefas', r.id::text,
            'Tarefa "'||r.titulo||'" do projeto "'||r.projeto||'" está atrasada'||coalesce(' (resp.: '||r.resp||')','')||'.');
    n := n + 1;
  end loop;
  return n;
end $function$
;

CREATE OR REPLACE FUNCTION public.sync_venda_conclusao()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_conclui_novo boolean := false;
  v_conclui_velho boolean := false;
  v_status text;
  v_valor numeric;
begin
  select coalesce(bool_or(conclui_venda), false) into v_conclui_novo
    from esteira_etapas where slug = new.etapa;

  if tg_op = 'UPDATE' then
    select coalesce(bool_or(conclui_venda), false) into v_conclui_velho
      from esteira_etapas where slug = old.etapa;
    if old.etapa is not distinct from new.etapa then
      return new;
    end if;
  end if;

  if new.venda_id is null then
    return new;
  end if;

  select status::text into v_status from vendas where id = new.venda_id;

  if v_conclui_novo and not v_conclui_velho then
    -- Valor oficial da venda = o que foi fechado nas condições comerciais.
    select valor_total into v_valor from venda_condicoes where processo_ref = new.id;

    update vendas
       set status = case when v_status in ('pago','distrato') then status else 'concluido'::status_venda end,
           data_conclusao = coalesce(data_conclusao, current_date),
           vgv = coalesce(v_valor, vgv, 0)
     where id = new.venda_id;

  elsif v_conclui_velho and not v_conclui_novo then
    if v_status = 'concluido' then
      update vendas set status = 'pendente'::status_venda, data_conclusao = null where id = new.venda_id;
    end if;
  end if;

  return new;
end;
$function$
;

alter table public.ia_notas_atendimento alter column dia set default CURRENT_DATE;

drop function if exists public.hoje_operacao();

notify pgrst, 'reload schema';
