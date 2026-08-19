-- 20260819120000_intel_performance_site_crm.sql
-- Inteligência — RPCs de leitura (Performance + Site/CRM) para as 15 telas
-- restantes. Todas SECURITY DEFINER, search_path vazio (nomes qualificados),
-- STABLE, protegidas por public.is_equipe() OR service_role. Só-leitura: não
-- alteram dado. Contrato: número real -> número; zero real -> 0; fonte ausente
-- -> NULL (a UI mostra "—" com motivo). Escopo do funil comercial: pipeline_id = 6
-- (Funil 2.0 / Operação). Complementa 20260819000000_intel_telemetria.sql
-- (intel_privacidade, intel_visao_digital).

CREATE OR REPLACE FUNCTION public.intel_visao_ceo(p_days integer DEFAULT 30)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_ini timestamptz;
  v_res jsonb;
  v_pipeline constant bigint := 6;
begin
  if not (public.is_equipe() or auth.role() = 'service_role') then
    raise exception 'acesso_negado' using errcode = '42501';
  end if;
  v_ini := now() - make_interval(days => greatest(1, least(p_days, 365)));

  select jsonb_build_object(
    'periodo_dias', greatest(1, least(p_days, 365)),
    'atualizado_em', now(),
    'leads', (select count(*) from public.leads where criado_em >= v_ini),
    'leads_site', (select count(*) from public.leads where criado_em >= v_ini and origem ilike '%site%'),
    'negocios_f2_abertos', (select count(*) from public.negocios where pipeline_id = v_pipeline and status = 'aberto'),
    'sla', (
      select jsonb_build_object(
        'aguardando', count(*),
        'mediana_min', round(percentile_cont(0.5) within group (order by extract(epoch from (now()-cliente_ultima))/60)),
        'p90_min', round(percentile_cont(0.9) within group (order by extract(epoch from (now()-cliente_ultima))/60))
      )
      from public.sla_msg_cache
      where cliente_ultima is not null
        and (env_ultima is null or cliente_ultima > env_ultima)
        and cliente_ultima >= now() - interval '7 days'
    ),
    'vendas', (select count(*) from public.vendas where data_venda >= v_ini::date),
    'vgv', (select coalesce(sum(vgv),0) from public.vendas where data_venda >= v_ini::date),
    'vgv_ano', (select coalesce(sum(vgv),0) from public.vendas where extract(year from data_venda) = extract(year from now()) and status::text in ('pago','concluido')),
    'meta_vgv_ano', (select coalesce(sum(meta_vgv),0) from public.metas where ano = extract(year from now())::int),
    'comissoes_total', (select coalesce(sum(valor_final),0) from public.comissoes),
    'vendas_sem_comissao', (select count(*) from public.vendas where percentual_comissao is null or percentual_comissao = 0),
    'pipeline_valor', (select case when count(*) filter (where valor is not null and valor > 0) = 0 then null else sum(valor) end from public.negocios where pipeline_id = v_pipeline and status = 'aberto'),
    'funil', (
      select jsonb_agg(item order by ord) from (
        select ps.ordem as ord, jsonb_build_object('nome', coalesce(ps.rotulo, ps.nome), 'volume', count(n.id)) item
        from public.pipeline_stages ps
        left join public.negocios n on n.stage_id = ps.id and n.pipeline_id = v_pipeline and n.status = 'aberto'
        where ps.pipeline_id = v_pipeline
        group by ps.ordem, ps.rotulo, ps.nome
        union all
        select 90, jsonb_build_object('nome','Ganho', 'volume', (select count(*) from public.negocios where pipeline_id = v_pipeline and status = 'ganho'))
        union all
        select 91, jsonb_build_object('nome','Perdido', 'volume', (select count(*) from public.negocios where pipeline_id = v_pipeline and status = 'perdido'))
      ) f
    )
  ) into v_res;

  return v_res;
end;
$function$;

CREATE OR REPLACE FUNCTION public.intel_atendimento(p_days integer DEFAULT 30)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_ini timestamptz;
  v_res jsonb;
begin
  if not (public.is_equipe() or auth.role() = 'service_role') then
    raise exception 'acesso_negado' using errcode = '42501';
  end if;
  v_ini := now() - make_interval(days => greatest(1, least(p_days, 365)));

  with b as (
    select s.lead_id,
           extract(epoch from (now() - s.cliente_ultima)) / 60.0 as espera_min,
           s.cliente_ultima, s.env_ultima
    from public.sla_msg_cache s
    where s.cliente_ultima is not null
      and s.cliente_ultima >= now() - interval '7 days'
      and (s.env_ultima is null or s.cliente_ultima > s.env_ultima)
  )
  select jsonb_build_object(
    'atualizado_em', now(),
    'periodo_dias', greatest(1, least(p_days, 365)),
    'mediana_min', (select round(percentile_cont(0.5) within group (order by espera_min)) from b),
    'p90_min', (select round(percentile_cont(0.9) within group (order by espera_min)) from b),
    'aguardando', (select count(*) from b),
    'total_leads', (select count(*) from public.leads where criado_em >= v_ini),
    'recebidas', (select coalesce(sum(qtd_recebidas),0) from public.sla_msg_cache),
    'enviadas', (select coalesce(sum(qtd_enviadas),0) from public.sla_msg_cache),
    'baldes', (select jsonb_build_object(
        'ate5', count(*) filter (where espera_min <= 5),
        'b5_15', count(*) filter (where espera_min > 5 and espera_min <= 15),
        'b15_30', count(*) filter (where espera_min > 15 and espera_min <= 30),
        'b30_60', count(*) filter (where espera_min > 30 and espera_min <= 60),
        'acima60', count(*) filter (where espera_min > 60)
      ) from b),
    'filas', jsonb_build_object(
        'sem_resposta', (select count(*) from b where env_ultima is null),
        'acima_sla', (select count(*) from b where espera_min > 5),
        'mensagens', (select count(*) from b),
        'followup_vencidos', (select count(*) from public.leads where proxima_acao_em < now() and coalesce(status,'') not in ('ganho','perdido','descartado','fechado')),
        'sem_proxima', (select count(*) from public.negocios where pipeline_id = 6 and status = 'aberto' and lead_id in (select id from public.leads where proxima_acao is null))
      ),
    'leads', (
      select coalesce(jsonb_agg(item order by ord desc), '[]'::jsonb) from (
        select b.espera_min as ord,
          jsonb_build_object(
            'nome', case when position(' ' in coalesce(l.nome,'')) > 0
                         then split_part(l.nome,' ',1) || ' ' || left(split_part(l.nome,' ',2),1) || '.'
                         else coalesce(l.nome,'—') end,
            'responsavel', c.nome,
            'gerente', g.nome,
            'origem', coalesce(l.origem,'—'),
            'espera_min', round(b.espera_min),
            'ultima', b.cliente_ultima,
            'proxima', coalesce(l.proxima_acao,'—')
          ) item
        from b
        join public.leads l on l.id = b.lead_id
        left join public.corretores c on c.id = l.corretor_id
        left join public.corretores g on g.id = c.gerente_id
        order by b.espera_min desc
        limit 12
      ) q
    )
  ) into v_res;

  return v_res;
end;
$function$;

CREATE OR REPLACE FUNCTION public.intel_financeiro(p_days integer DEFAULT 30)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_ini date;
  v_res jsonb;
begin
  if not (public.is_equipe() or auth.role() = 'service_role') then
    raise exception 'acesso_negado' using errcode = '42501';
  end if;
  v_ini := (now() - make_interval(days => greatest(1, least(p_days, 365))))::date;

  with vp as (
    select v.id, v.empreendimento_nome, v.unidade_rotulo, v.vgv, v.percentual_comissao, v.custos, v.status::text status
    from public.vendas v where v.data_venda >= v_ini
  ),
  com as (
    select c.venda_id, c.papel::text papel, c.beneficiario_id, c.valor_final
    from public.comissoes c where c.venda_id in (select id from vp)
  ),
  pag as (
    select p.venda_id, p.beneficiario_id, p.valor
    from public.pagamentos_comissao p where p.status = 'pago' and p.venda_id in (select id from vp)
  )
  select jsonb_build_object(
    'atualizado_em', now(),
    'periodo_dias', greatest(1, least(p_days, 365)),
    'total_vendas', (select count(*) from vp),
    'degraus', jsonb_build_object(
      'vgv', (select coalesce(sum(vgv),0) from vp),
      'receita', (select coalesce(sum(valor_final),0) from com),
      'comissoes_pessoas', (select coalesce(sum(valor_final),0) from com where papel <> 'apecerto'),
      'custos', (select coalesce(sum(custos),0) from vp),
      'contribuicao', (select coalesce(sum(valor_final) filter (where papel = 'apecerto'),0) from com) - (select coalesce(sum(custos),0) from vp),
      'pagas', (select coalesce(sum(valor),0) from pag),
      'pendente', (select coalesce(sum(valor_final),0) from com where papel <> 'apecerto') - (select coalesce(sum(valor),0) from pag)
    ),
    'vendas', (
      select coalesce(jsonb_agg(item order by ord desc nulls last), '[]'::jsonb) from (
        select vp.vgv as ord, jsonb_build_object(
          'nome', coalesce(vp.empreendimento_nome, 'Venda'),
          'codigo', coalesce(vp.unidade_rotulo, '—'),
          'vgv', vp.vgv,
          'percentual', case when vp.percentual_comissao is null then null else round(vp.percentual_comissao * 100, 2) end,
          'receita', (select coalesce(sum(valor_final),0) from com where com.venda_id = vp.id),
          'comissoes', (select coalesce(sum(valor_final),0) from com where com.venda_id = vp.id and papel <> 'apecerto'),
          'custos', vp.custos,
          'contribuicao', (select coalesce(sum(valor_final) filter (where papel='apecerto'),0) from com where com.venda_id = vp.id) - coalesce(vp.custos,0),
          'pagamento', case
            when vp.percentual_comissao is null then 'bloqueado'
            when (select coalesce(sum(valor),0) from pag where pag.venda_id = vp.id) >= (select coalesce(sum(valor_final),0) from com where com.venda_id = vp.id and papel <> 'apecerto')
                 and (select coalesce(sum(valor_final),0) from com where com.venda_id = vp.id and papel <> 'apecerto') > 0
              then 'pago'
            else 'a pagar' end,
          'sem_custo', vp.custos is null
        ) item
        from vp order by vp.vgv desc nulls last limit 8
      ) q
    ),
    'participantes', (
      select coalesce(jsonb_agg(item order by calc desc), '[]'::jsonb) from (
        select sum(com.valor_final) calc, jsonb_build_object(
          'nome', coalesce(cr.nome, initcap(com.papel)),
          'papel', com.papel,
          'calculada', sum(com.valor_final),
          'paga', coalesce((select sum(valor) from pag where pag.beneficiario_id = com.beneficiario_id),0),
          'pendente', sum(com.valor_final) - coalesce((select sum(valor) from pag where pag.beneficiario_id = com.beneficiario_id),0)
        ) item
        from com
        left join public.corretores cr on cr.usuario_id = com.beneficiario_id
        where com.papel <> 'apecerto'
        group by com.beneficiario_id, com.papel, cr.nome
        order by calc desc limit 10
      ) q
    )
  ) into v_res;

  return v_res;
end;
$function$;

CREATE OR REPLACE FUNCTION public.intel_corretores(p_days integer DEFAULT 30)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_ini timestamptz;
  v_res jsonb;
begin
  if not (public.is_equipe() or auth.role() = 'service_role') then
    raise exception 'acesso_negado' using errcode = '42501';
  end if;
  v_ini := now() - make_interval(days => greatest(1, least(p_days, 365)));

  with base as (
    select c.id, c.nome, coalesce(g.nome, '—') gerente, c.gerente_id, c.limite_carteira limite,
      (select count(*) from public.leads l where l.corretor_id = c.id and l.criado_em >= v_ini) leads,
      (select count(*) from public.negocios n where n.corretor_id = c.id and n.pipeline_id = 6 and n.status = 'aberto') negocios,
      (select count(*) from public.vendas v where v.corretor_id = c.id and v.data_venda >= v_ini::date) vendas,
      (select coalesce(sum(v.vgv),0) from public.vendas v where v.corretor_id = c.id and v.data_venda >= v_ini::date) vgv,
      (select count(*) from public.visitas vi where vi.corretor_id = c.id and vi.criado_em >= v_ini) visitas,
      (select count(*) from public.leads l where l.corretor_id = c.id and l.proxima_acao_em < now() and coalesce(l.status,'') not in ('ganho','perdido','descartado','fechado')) vencidos,
      (select round(percentile_cont(0.5) within group (order by extract(epoch from (now()-s.cliente_ultima))/60))
         from public.sla_msg_cache s join public.leads l on l.id = s.lead_id
         where l.corretor_id = c.id and s.cliente_ultima >= now()-interval '7 days'
           and (s.env_ultima is null or s.cliente_ultima > s.env_ultima)) mediana,
      (select round(percentile_cont(0.9) within group (order by extract(epoch from (now()-s.cliente_ultima))/60))
         from public.sla_msg_cache s join public.leads l on l.id = s.lead_id
         where l.corretor_id = c.id and s.cliente_ultima >= now()-interval '7 days'
           and (s.env_ultima is null or s.cliente_ultima > s.env_ultima)) p90,
      (select count(*)
         from public.sla_msg_cache s join public.leads l on l.id = s.lead_id
         where l.corretor_id = c.id and s.cliente_ultima >= now()-interval '7 days'
           and (s.env_ultima is null or s.cliente_ultima > s.env_ultima)) aguardando
    from public.corretores c
    left join public.corretores g on g.id = c.gerente_id
    where c.ativo
  )
  select jsonb_build_object(
    'atualizado_em', now(),
    'periodo_dias', greatest(1, least(p_days, 365)),
    'totais', jsonb_build_object('leads', (select coalesce(sum(leads),0) from base), 'vendas', (select coalesce(sum(vendas),0) from base)),
    'corretores', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'nome', nome, 'gerente', gerente, 'gerente_id', gerente_id, 'limite', limite,
        'leads', leads, 'negocios', negocios, 'vendas', vendas, 'vgv', vgv, 'visitas', visitas,
        'vencidos', vencidos, 'mediana', mediana, 'p90', p90, 'aguardando', aguardando
      ) order by vendas desc, leads desc), '[]'::jsonb) from base
    )
  ) into v_res;

  return v_res;
end;
$function$;

CREATE OR REPLACE FUNCTION public.intel_equipe(p_days integer DEFAULT 30)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_ini timestamptz;
  v_res jsonb;
begin
  if not (public.is_equipe() or auth.role() = 'service_role') then
    raise exception 'acesso_negado' using errcode = '42501';
  end if;
  v_ini := now() - make_interval(days => greatest(1, least(p_days, 365)));

  with perc as (
    select c.id, coalesce(g.nome, 'sem gerente') equipe,
      (select count(*) from public.leads l where l.corretor_id = c.id and l.criado_em >= v_ini) leads,
      (select count(*) from public.vendas v where v.corretor_id = c.id and v.data_venda >= v_ini::date) vendas,
      (select coalesce(sum(v.vgv),0) from public.vendas v where v.corretor_id = c.id and v.data_venda >= v_ini::date) vgv,
      (select count(*) from public.visitas vi where vi.corretor_id = c.id and vi.criado_em >= v_ini) visitas,
      (select count(*) from public.leads l where l.corretor_id = c.id and l.proxima_acao_em < now() and coalesce(l.status,'') not in ('ganho','perdido','descartado','fechado')) vencidos
    from public.corretores c left join public.corretores g on g.id = c.gerente_id where c.ativo
  ),
  slag as (
    select coalesce(g.nome,'sem gerente') equipe,
      round(percentile_cont(0.5) within group (order by extract(epoch from (now()-s.cliente_ultima))/60)) med,
      round(percentile_cont(0.9) within group (order by extract(epoch from (now()-s.cliente_ultima))/60)) p90
    from public.sla_msg_cache s
    join public.leads l on l.id = s.lead_id
    join public.corretores c on c.id = l.corretor_id
    left join public.corretores g on g.id = c.gerente_id
    where s.cliente_ultima >= now()-interval '7 days' and (s.env_ultima is null or s.cliente_ultima > s.env_ultima)
    group by 1
  )
  select jsonb_build_object(
    'atualizado_em', now(),
    'periodo_dias', greatest(1, least(p_days, 365)),
    'leads', (select coalesce(sum(leads),0) from perc),
    'negocios', (select count(*) from public.negocios where pipeline_id = 6 and status = 'aberto'),
    'visitas', (select coalesce(sum(visitas),0) from perc),
    'vendas', (select coalesce(sum(vendas),0) from perc),
    'vgv', (select coalesce(sum(vgv),0) from perc),
    'sla', (
      select jsonb_build_object(
        'mediana_min', round(percentile_cont(0.5) within group (order by extract(epoch from (now()-cliente_ultima))/60)),
        'p90_min', round(percentile_cont(0.9) within group (order by extract(epoch from (now()-cliente_ultima))/60)))
      from public.sla_msg_cache
      where cliente_ultima >= now()-interval '7 days' and (env_ultima is null or cliente_ultima > env_ultima)
    ),
    'comissao_bruta', (select coalesce(sum(valor_final),0) from public.comissoes c where c.venda_id in (select id from public.vendas where data_venda >= v_ini::date)),
    'comissao_pessoas', (select coalesce(sum(valor_final),0) from public.comissoes c where c.papel::text <> 'apecerto' and c.venda_id in (select id from public.vendas where data_venda >= v_ini::date)),
    'followups_vencidos', (select coalesce(sum(vencidos),0) from perc),
    'negocios_sem_proxima', (select count(*) from public.negocios n where n.pipeline_id = 6 and n.status = 'aberto' and n.lead_id in (select id from public.leads where proxima_acao is null)),
    'visitas_sem_feedback', (select count(*) from public.visitas where criado_em >= v_ini and resultado is null),
    'perdas_sem_motivo', (select count(*) from public.negocios where pipeline_id = 6 and status = 'perdido' and (motivo_perda is null or motivo_perda = '')),
    'equipes', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'nome', 'Equipe ' || a.equipe, 'corretores', a.ncorr, 'leads', a.leads, 'vendas', a.vendas, 'vgv', a.vgv,
        'vencidos', a.vencidos, 'lead_venda', case when a.leads > 0 then round(100.0*a.vendas/a.leads, 1) else null end,
        'mediana', sg.med, 'p90', sg.p90
      ) order by a.leads desc), '[]'::jsonb)
      from (select equipe, count(*) ncorr, sum(leads) leads, sum(vendas) vendas, sum(vgv) vgv, sum(vencidos) vencidos, sum(visitas) visitas from perc group by equipe) a
      left join slag sg on sg.equipe = a.equipe
    )
  ) into v_res;

  return v_res;
end;
$function$;

CREATE OR REPLACE FUNCTION public.intel_gerentes(p_days integer DEFAULT 30)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_ini timestamptz;
  v_res jsonb;
begin
  if not (public.is_equipe() or auth.role() = 'service_role') then
    raise exception 'acesso_negado' using errcode = '42501';
  end if;
  v_ini := now() - make_interval(days => greatest(1, least(p_days, 365)));

  with sub as (
    select c.gerente_id gid, c.id cid, c.nome cnome, c.limite_carteira lim,
      (select count(*) from public.leads l where l.corretor_id = c.id and l.criado_em >= v_ini) leads,
      (select count(*) from public.vendas v where v.corretor_id = c.id and v.data_venda >= v_ini::date) vendas,
      (select coalesce(sum(v.vgv),0) from public.vendas v where v.corretor_id = c.id and v.data_venda >= v_ini::date) vgv,
      (select count(*) from public.visitas vi where vi.corretor_id = c.id and vi.criado_em >= v_ini) visitas,
      (select count(*) from public.negocios n where n.corretor_id = c.id and n.pipeline_id = 6 and n.status = 'aberto') neg,
      (select count(*) from public.leads l where l.corretor_id = c.id and l.proxima_acao_em < now() and coalesce(l.status,'') not in ('ganho','perdido','descartado','fechado')) vencidos,
      (select round(percentile_cont(0.5) within group (order by extract(epoch from (now()-s.cliente_ultima))/60))
         from public.sla_msg_cache s join public.leads l on l.id = s.lead_id
         where l.corretor_id = c.id and s.cliente_ultima >= now()-interval '7 days' and (s.env_ultima is null or s.cliente_ultima > s.env_ultima)) mediana,
      (select round(percentile_cont(0.9) within group (order by extract(epoch from (now()-s.cliente_ultima))/60))
         from public.sla_msg_cache s join public.leads l on l.id = s.lead_id
         where l.corretor_id = c.id and s.cliente_ultima >= now()-interval '7 days' and (s.env_ultima is null or s.cliente_ultima > s.env_ultima)) p90
    from public.corretores c
    where c.gerente_id is not null and c.ativo
  ),
  agg as (
    select gid, count(*) ncorr, sum(neg) neg, sum(lim) lim, sum(leads) leads, sum(visitas) visitas,
           sum(vendas) vendas, sum(vgv) vgv, sum(vencidos) vencidos, round(avg(mediana)) med, max(p90) p90
    from sub group by gid
  ),
  alvo as (select gid from agg order by leads desc limit 1)
  select jsonb_build_object(
    'atualizado_em', now(),
    'periodo_dias', greatest(1, least(p_days, 365)),
    'lista', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'nome', (select nome from public.corretores where id = a.gid),
        'corretores', a.ncorr, 'neg', a.neg, 'lim', a.lim,
        'leads', a.leads, 'mediana', a.med, 'p90', a.p90,
        'lead_venda', case when a.leads > 0 then round(100.0*a.vendas/a.leads,1) else null end,
        'visitas', a.visitas, 'vendas', a.vendas, 'vgv', a.vgv, 'vencidos', a.vencidos
      ) order by a.leads desc), '[]'::jsonb) from agg a
    ),
    'pagina', jsonb_build_object(
      'nome', (select nome from public.corretores where id = (select gid from alvo)),
      'equipe', (select count(*) from sub where gid = (select gid from alvo)),
      'corretores', (
        select coalesce(jsonb_agg(jsonb_build_object(
          'nome', cnome, 'carga_neg', neg, 'carga_lim', lim, 'leads', leads, 'mediana', mediana, 'p90', p90
        ) order by leads desc), '[]'::jsonb) from sub where gid = (select gid from alvo)
      ),
      'funil', jsonb_build_object(
        'leads', (select coalesce(sum(leads),0) from sub where gid = (select gid from alvo)),
        'negocios', (select coalesce(sum(neg),0) from sub where gid = (select gid from alvo)),
        'visitas', (select coalesce(sum(visitas),0) from sub where gid = (select gid from alvo)),
        'vendas', (select coalesce(sum(vendas),0) from sub where gid = (select gid from alvo))
      ),
      'vgv', (select coalesce(sum(vgv),0) from sub where gid = (select gid from alvo)),
      'meta_vgv', (select coalesce(sum(m.meta_vgv),0) from public.metas m where m.ano = extract(year from now())::int and m.corretor_id in (select cid from sub where gid = (select gid from alvo))),
      'intervencao', jsonb_build_object(
        'vencidos', (select coalesce(sum(vencidos),0) from sub where gid = (select gid from alvo)),
        'aguardando', (select count(*) from public.sla_msg_cache s join public.leads l on l.id = s.lead_id where l.corretor_id in (select cid from sub where gid = (select gid from alvo)) and s.cliente_ultima >= now()-interval '7 days' and (s.env_ultima is null or s.cliente_ultima > s.env_ultima))
      )
    )
  ) into v_res;

  return v_res;
end;
$function$;

CREATE OR REPLACE FUNCTION public.intel_vendas(p_days integer DEFAULT 30)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_ini timestamptz;
  v_ano int := extract(year from now())::int;
  v_realizado numeric;
  v_meta numeric;
  v_dias int;
  v_res jsonb;
begin
  if not (public.is_equipe() or auth.role() = 'service_role') then
    raise exception 'acesso_negado' using errcode = '42501';
  end if;
  v_ini := now() - make_interval(days => greatest(1, least(p_days, 365)));

  select coalesce(sum(vgv),0) into v_realizado from public.vendas where extract(year from data_venda) = v_ano and status::text in ('pago','concluido');
  select coalesce(sum(meta_vgv),0) into v_meta from public.metas where ano = v_ano;
  select count(*) into v_dias from generate_series((current_date+1), (date_trunc('month', current_date)+interval '1 month - 1 day')::date, interval '1 day') d where extract(dow from d) between 1 and 5;

  select jsonb_build_object(
    'atualizado_em', now(),
    'periodo_dias', greatest(1, least(p_days, 365)),
    'realizado', v_realizado,
    'meta', v_meta,
    'realizado_pct', case when v_meta > 0 then round(100.0*v_realizado/v_meta) else null end,
    'falta', greatest(0, v_meta - v_realizado),
    'previsao', null,
    'cobertura_previsao', null,
    'concluidas', (select count(*) from public.vendas where extract(year from data_venda) = v_ano and status::text in ('pago','concluido')),
    'ciclo_medio', (select round(avg(data_conclusao - data_venda)) from public.vendas where data_conclusao is not null and data_venda is not null),
    'ritmo', case when v_dias > 0 then round(greatest(0, v_meta - v_realizado)/v_dias) else null end,
    'dias_uteis', v_dias,
    'equipes', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'nome', 'Equipe ' || equipe, 'meta', meta, 'realizado', realizado,
        'pct', case when meta > 0 then round(100.0*realizado/meta) else null end
      ) order by realizado desc), '[]'::jsonb)
      from (
        select coalesce(g.nome,'sem gerente') equipe,
          coalesce(sum((select coalesce(sum(m.meta_vgv),0) from public.metas m where m.corretor_id = c.id and m.ano = v_ano)),0) meta,
          coalesce(sum((select coalesce(sum(v.vgv),0) from public.vendas v where v.corretor_id = c.id and extract(year from v.data_venda) = v_ano and v.status::text in ('pago','concluido'))),0) realizado
        from public.corretores c left join public.corretores g on g.id = c.gerente_id
        where c.ativo group by 1
      ) e
    ),
    'etapas', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'etapa', coalesce(ps.rotulo, ps.nome), 'negocios', (select count(*) from public.negocios n where n.stage_id = ps.id and n.pipeline_id = 6 and n.status = 'aberto'),
        'vgv', null, 'probabilidade', null, 'ponderado', null
      ) order by ps.ordem), '[]'::jsonb)
      from public.pipeline_stages ps where ps.pipeline_id = 6
    ),
    'total_etapas', jsonb_build_object(
      'negocios', (select count(*) from public.negocios where pipeline_id = 6 and status = 'aberto'), 'vgv', null, 'ponderado', null
    ),
    'vendas', (
      select coalesce(jsonb_agg(item order by ord desc nulls last), '[]'::jsonb) from (
        select v.vgv ord, jsonb_build_object(
          'nome', coalesce(v.empreendimento_nome,'Venda') || case when v.unidade_rotulo is not null then ' · '||v.unidade_rotulo else '' end,
          'corretor', coalesce(c.nome,'—'), 'vgv', v.vgv,
          'ciclo', case when v.data_conclusao is not null then v.data_conclusao - v.data_venda else null end,
          'canal', coalesce(v.forma_pgto,'—')
        ) item
        from public.vendas v left join public.corretores c on c.id = v.corretor_id
        where v.data_venda >= v_ini::date order by v.vgv desc nulls last limit 8
      ) q
    ),
    'total_vendas', (select count(*) from public.vendas where data_venda >= v_ini::date),
    'fora_da_lista', (select count(*) from public.vendas where (percentual_comissao is null or percentual_comissao = 0) and data_venda >= v_ini::date)
  ) into v_res;

  return v_res;
end;
$function$;

CREATE OR REPLACE FUNCTION public.intel_qualidade(p_days integer DEFAULT 30)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v_ini timestamptz; v_res jsonb;
begin
  if not (public.is_equipe() or auth.role() = 'service_role') then raise exception 'acesso_negado' using errcode='42501'; end if;
  v_ini := now() - make_interval(days => greatest(1, least(p_days, 365)));
  with base as (
    select n.corretor_id, n.nota_geral, n.clareza, n.cordialidade, n.personalizacao, n.qualificacao, n.conducao, n.objecoes, n.escrita
    from public.ia_notas_atendimento n where n.avaliado_em >= v_ini
  ),
  perc as (
    select corretor_id, round(avg(nota_geral)/20.0,1) nota, count(*) amostra,
      round(avg(cordialidade)/20.0,1) cordialidade, round(avg(clareza)/20.0,1) clareza, round(avg(escrita)/20.0,1) escrita,
      round(avg(conducao)/20.0,1) conducao, round(avg(personalizacao)/20.0,1) personalizacao,
      round(avg(qualificacao)/20.0,1) qualificacao, round(avg(objecoes)/20.0,1) objecoes
    from base group by corretor_id
  )
  select jsonb_build_object(
    'atualizado_em', now(), 'periodo_dias', greatest(1, least(p_days, 365)),
    'nota_empresa', (select round(avg(nota_geral)/20.0, 1) from base),
    'amostra', (select count(*) from base),
    'criticas', (select count(*) from public.ia_notas_atendimento where avaliado_em >= v_ini and classificacao = 'critica'),
    'criterios', (select jsonb_build_object(
        'Cordialidade', round(avg(cordialidade)/20.0,1), 'Clareza', round(avg(clareza)/20.0,1), 'Escrita', round(avg(escrita)/20.0,1),
        'Condução', round(avg(conducao)/20.0,1), 'Personalização', round(avg(personalizacao)/20.0,1),
        'Qualificação', round(avg(qualificacao)/20.0,1), 'Objeções', round(avg(objecoes)/20.0,1)) from base),
    'pessoas', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'nome', coalesce((select nome from public.corretores where id = p.corretor_id), 'Corretor'),
        'nota', p.nota, 'amostra', p.amostra,
        'criterios', jsonb_build_object('Cordialidade', p.cordialidade, 'Clareza', p.clareza, 'Escrita', p.escrita,
          'Condução', p.conducao, 'Personalização', p.personalizacao, 'Qualificação', p.qualificacao, 'Objeções', p.objecoes)
      ) order by p.nota desc), '[]'::jsonb) from perc p
    )
  ) into v_res;
  return v_res;
end; $function$;

CREATE OR REPLACE FUNCTION public.intel_alertas(p_days integer DEFAULT 30)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v_ini timestamptz; v_res jsonb;
begin
  if not (public.is_equipe() or auth.role() = 'service_role') then raise exception 'acesso_negado' using errcode='42501'; end if;
  v_ini := now() - make_interval(days => greatest(1, least(p_days, 365)));
  select jsonb_build_object(
    'atualizado_em', now(), 'periodo_dias', greatest(1, least(p_days, 365)),
    'tipos', jsonb_build_object(
      'sla', (select count(*) from public.sla_msg_cache s where s.cliente_ultima >= now()-interval '7 days' and (s.env_ultima is null or s.cliente_ultima > s.env_ultima) and extract(epoch from (now()-s.cliente_ultima))/60 > 5),
      'sla_criticos', (select count(*) from public.sla_msg_cache s where s.cliente_ultima >= now()-interval '7 days' and (s.env_ultima is null or s.cliente_ultima > s.env_ultima) and extract(epoch from (now()-s.cliente_ultima))/60 > 60),
      'followup', (select count(*) from public.leads where proxima_acao_em < now() and coalesce(status,'') not in ('ganho','perdido','descartado','fechado')),
      'mensagem', (select count(*) from public.sla_msg_cache s where s.cliente_ultima >= now()-interval '7 days' and (s.env_ultima is null or s.cliente_ultima > s.env_ultima)),
      'negocio_parado', (select count(*) from public.negocios where pipeline_id=6 and status='aberto' and coalesce(ultima_movimentacao, criado_em) < now()-interval '7 days'),
      'visita_sem_feedback', (select count(*) from public.visitas where criado_em >= v_ini and resultado is null),
      'carga', (select count(*) from public.corretores c where c.ativo and c.limite_carteira is not null and (select count(*) from public.negocios n where n.corretor_id=c.id and n.pipeline_id=6 and n.status='aberto') > c.limite_carteira),
      'venda_sem_comissao', (select count(*) from public.vendas where (percentual_comissao is null or percentual_comissao=0) and data_venda >= v_ini::date),
      'meta_sem_cadastro', (select count(*) from public.corretores c where c.ativo and not exists (select 1 from public.metas m where m.corretor_id=c.id and m.ano = extract(year from now())::int)),
      'fonte_parada', (select case when max(occurred_at) < now()-interval '24 hours' then 1 else 0 end from private.site_events_anon)
    ),
    'engine', jsonb_build_object(
      'total', (select count(*) from public.crm_lead_alertas),
      'abertos', (select count(*) from public.crm_lead_alertas where reconhecido_em is null),
      'reconhecidos', (select count(*) from public.crm_lead_alertas where reconhecido_em is not null)
    )
  ) into v_res;
  return v_res;
end; $function$;

CREATE OR REPLACE FUNCTION public.intel_aquisicao(p_days integer DEFAULT 30)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v_ini timestamptz; v_res jsonb;
begin
  if not (public.is_equipe() or auth.role() = 'service_role') then raise exception 'acesso_negado' using errcode='42501'; end if;
  v_ini := now() - make_interval(days => greatest(1, least(p_days, 365)));
  select jsonb_build_object(
    'atualizado_em', now(), 'periodo_dias', greatest(1, least(p_days, 365)),
    'visualizacoes', (select count(distinct page_view_id) from private.site_events_anon where occurred_at >= v_ini),
    'intencao', (select count(*) from private.site_events_anon where occurred_at >= v_ini and event_name in ('whatsapp_click','phone_click','generate_lead','cta_click','owner_cta_click')),
    'leads', (select count(*) from public.leads where criado_em >= v_ini),
    'negocios', (select count(*) from public.negocios where pipeline_id=6 and status='aberto'),
    'visitas', (select count(*) from public.visitas where criado_em >= v_ini),
    'vendas', (select count(*) from public.vendas where data_venda >= v_ini::date),
    'linhas', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'origem', origem, 'leads', leads, 'negocios', negocios,
        'leadNeg', case when leads>0 then round(100.0*negocios/leads) else null end
      ) order by leads desc), '[]'::jsonb)
      from (
        select coalesce(nullif(trim(l.origem),''),'não atribuído') origem, count(*) leads,
          count(*) filter (where exists(select 1 from public.negocios n where n.lead_id=l.id and n.pipeline_id=6)) negocios
        from public.leads l where l.criado_em >= v_ini group by 1 order by 2 desc limit 8
      ) a
    ),
    'nao_atribuido', (select count(*) from public.leads where criado_em >= v_ini and (origem is null or trim(origem)=''))
  ) into v_res;
  return v_res;
end; $function$;

CREATE OR REPLACE FUNCTION public.intel_comportamento(p_days integer DEFAULT 30)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v timestamptz; r jsonb; begin
  if not (public.is_equipe() or auth.role()='service_role') then raise exception 'acesso_negado' using errcode='42501'; end if;
  v := now() - make_interval(days => greatest(1, least(p_days,365)));
  select jsonb_build_object('atualizado_em',now(),'periodo_dias',greatest(1,least(p_days,365)),
    'total_pageviews',(select count(distinct page_view_id) from private.site_events_anon where occurred_at>=v),
    'total_eventos',(select count(*) from private.site_events_anon where occurred_at>=v),
    'scroll_depth',(select count(*) from private.site_events_anon where occurred_at>=v and event_name='scroll_depth'),
    'paginas',(select coalesce(jsonb_agg(jsonb_build_object('pagina',pagina,'pageviews',pv,'eventos',ev) order by pv desc),'[]'::jsonb) from (select page_path pagina,count(distinct page_view_id) pv,count(*) ev from private.site_events_anon where occurred_at>=v and page_path is not null group by 1 order by pv desc limit 12) a),
    'eventos',(select coalesce(jsonb_agg(jsonb_build_object('evento',evento,'total',t) order by t desc),'[]'::jsonb) from (select event_name evento,count(*) t from private.site_events_anon where occurred_at>=v group by 1 order by 2 desc limit 12) b),
    'dispositivos',(select coalesce(jsonb_agg(jsonb_build_object('dispositivo',device_category,'pageviews',pv) order by pv desc),'[]'::jsonb) from (select device_category,count(distinct page_view_id) pv from private.site_events_anon where occurred_at>=v group by 1) c)
  ) into r; return r; end; $function$;

CREATE OR REPLACE FUNCTION public.intel_imoveis(p_days integer DEFAULT 30)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v timestamptz; r jsonb; begin
  if not (public.is_equipe() or auth.role()='service_role') then raise exception 'acesso_negado' using errcode='42501'; end if;
  v := now() - make_interval(days => greatest(1, least(p_days,365)));
  select jsonb_build_object('atualizado_em',now(),'periodo_dias',greatest(1,least(p_days,365)),
    'view_item',(select count(*) from private.site_events_anon where occurred_at>=v and event_name='view_item'),
    'property_search',(select count(*) from private.site_events_anon where occurred_at>=v and event_name='property_search'),
    'filter_change',(select count(*) from private.site_events_anon where occurred_at>=v and event_name='filter_change'),
    'paginas',(select coalesce(jsonb_agg(jsonb_build_object('pagina',pagina,'pageviews',pv,'view_item',vi) order by vi desc, pv desc),'[]'::jsonb) from (select page_path pagina,count(distinct page_view_id) pv,count(*) filter (where event_name='view_item') vi from private.site_events_anon where occurred_at>=v and page_path is not null group by 1 order by vi desc, pv desc limit 12) a)
  ) into r; return r; end; $function$;

CREATE OR REPLACE FUNCTION public.intel_conversao(p_days integer DEFAULT 30)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v timestamptz; r jsonb; begin
  if not (public.is_equipe() or auth.role()='service_role') then raise exception 'acesso_negado' using errcode='42501'; end if;
  v := now() - make_interval(days => greatest(1, least(p_days,365)));
  select jsonb_build_object('atualizado_em',now(),'periodo_dias',greatest(1,least(p_days,365)),
    'leads',(select count(*) from public.leads where criado_em>=v),
    'negocios',(select count(*) from public.negocios where pipeline_id=6 and status='aberto'),
    'visitas',(select count(*) from public.visitas where criado_em>=v),
    'vendas',(select count(*) from public.vendas where data_venda>=v::date),
    'ganho',(select count(*) from public.negocios where pipeline_id=6 and status='ganho'),
    'perdido',(select count(*) from public.negocios where pipeline_id=6 and status='perdido'),
    'sla_mediana_min',(select round(percentile_cont(0.5) within group (order by extract(epoch from (now()-cliente_ultima))/60)) from public.sla_msg_cache where cliente_ultima>=now()-interval '7 days' and (env_ultima is null or cliente_ultima>env_ultima)),
    'sem_atendimento',(select count(*) from public.sla_msg_cache s where s.cliente_ultima>=now()-interval '7 days' and (s.env_ultima is null or s.cliente_ultima>s.env_ultima)),
    'parados',(select count(*) from public.negocios where pipeline_id=6 and status='aberto' and coalesce(ultima_movimentacao,criado_em)<now()-interval '7 days'),
    'etapas',(select coalesce(jsonb_agg(jsonb_build_object('etapa',coalesce(ps.rotulo,ps.nome),'volume',(select count(*) from public.negocios n where n.stage_id=ps.id and n.pipeline_id=6 and n.status='aberto'),'taxa',null) order by ps.ordem),'[]'::jsonb) from public.pipeline_stages ps where ps.pipeline_id=6),
    'corretores',(select coalesce(jsonb_agg(jsonb_build_object('nome',nome,'negocios',neg,'vendas',vend,'conv',case when neg>0 then round(100.0*vend/neg,1) else null end) order by neg desc),'[]'::jsonb) from (
        select c.nome, (select count(*) from public.negocios n where n.corretor_id=c.id and n.pipeline_id=6 and n.status='aberto') neg,
               (select count(*) from public.vendas ve where ve.corretor_id=c.id and ve.data_venda>=v::date) vend
        from public.corretores c where c.ativo order by neg desc limit 8) a)
  ) into r; return r; end; $function$;

CREATE OR REPLACE FUNCTION public.intel_proprietarios(p_days integer DEFAULT 30)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v timestamptz; r jsonb; begin
  if not (public.is_equipe() or auth.role()='service_role') then raise exception 'acesso_negado' using errcode='42501'; end if;
  v := now() - make_interval(days => greatest(1, least(p_days,365)));
  select jsonb_build_object('atualizado_em',now(),'periodo_dias',greatest(1,least(p_days,365)),
    'owner_events',(select count(*) from private.site_events_anon where occurred_at>=v and event_name in ('owner_cta_click','owner_portal_open')),
    'vendas_com_proprietario',(select count(*) from public.vendas where data_venda>=v::date and proprietario_nome is not null and trim(proprietario_nome)<>''),
    'proprietarios_distintos',(select count(distinct proprietario_nome) from public.vendas where proprietario_nome is not null and trim(proprietario_nome)<>''),
    'empreendimentos',(select coalesce(jsonb_agg(jsonb_build_object('nome',nome,'vendas',n,'vgv',vgv) order by vgv desc),'[]'::jsonb) from (select coalesce(empreendimento_nome,'—') nome,count(*) n,coalesce(sum(vgv),0) vgv from public.vendas where data_venda>=v::date group by 1 order by vgv desc limit 8) a)
  ) into r; return r; end; $function$;

CREATE OR REPLACE FUNCTION public.intel_sara(p_days integer DEFAULT 30)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v timestamptz; r jsonb; begin
  if not (public.is_equipe() or auth.role()='service_role') then raise exception 'acesso_negado' using errcode='42501'; end if;
  v := now() - make_interval(days => greatest(1, least(p_days,365)));
  select jsonb_build_object('atualizado_em',now(),'periodo_dias',greatest(1,least(p_days,365)),
    'sara_open',(select count(*) from private.site_events_anon where occurred_at>=v and event_name='sara_open'),
    'sara_search',(select count(*) from private.site_events_anon where occurred_at>=v and event_name='sara_search'),
    'sara_results',(select count(*) from private.site_events_anon where occurred_at>=v and event_name='sara_results'),
    'sara_error',(select count(*) from private.site_events_anon where occurred_at>=v and event_name='sara_error'),
    'eventos',(select coalesce(jsonb_agg(jsonb_build_object('evento',evento,'total',t) order by t desc),'[]'::jsonb) from (select event_name evento,count(*) t from private.site_events_anon where occurred_at>=v and event_name like 'sara%' group by 1) a)
  ) into r; return r; end; $function$;

revoke all on function public.intel_visao_ceo(integer) from public, anon;
grant execute on function public.intel_visao_ceo(integer) to authenticated, service_role;
revoke all on function public.intel_atendimento(integer) from public, anon;
grant execute on function public.intel_atendimento(integer) to authenticated, service_role;
revoke all on function public.intel_financeiro(integer) from public, anon;
grant execute on function public.intel_financeiro(integer) to authenticated, service_role;
revoke all on function public.intel_corretores(integer) from public, anon;
grant execute on function public.intel_corretores(integer) to authenticated, service_role;
revoke all on function public.intel_equipe(integer) from public, anon;
grant execute on function public.intel_equipe(integer) to authenticated, service_role;
revoke all on function public.intel_gerentes(integer) from public, anon;
grant execute on function public.intel_gerentes(integer) to authenticated, service_role;
revoke all on function public.intel_vendas(integer) from public, anon;
grant execute on function public.intel_vendas(integer) to authenticated, service_role;
revoke all on function public.intel_qualidade(integer) from public, anon;
grant execute on function public.intel_qualidade(integer) to authenticated, service_role;
revoke all on function public.intel_alertas(integer) from public, anon;
grant execute on function public.intel_alertas(integer) to authenticated, service_role;
revoke all on function public.intel_aquisicao(integer) from public, anon;
grant execute on function public.intel_aquisicao(integer) to authenticated, service_role;
revoke all on function public.intel_comportamento(integer) from public, anon;
grant execute on function public.intel_comportamento(integer) to authenticated, service_role;
revoke all on function public.intel_imoveis(integer) from public, anon;
grant execute on function public.intel_imoveis(integer) to authenticated, service_role;
revoke all on function public.intel_conversao(integer) from public, anon;
grant execute on function public.intel_conversao(integer) to authenticated, service_role;
revoke all on function public.intel_proprietarios(integer) from public, anon;
grant execute on function public.intel_proprietarios(integer) to authenticated, service_role;
revoke all on function public.intel_sara(integer) from public, anon;
grant execute on function public.intel_sara(integer) to authenticated, service_role;

-- ROLLBACK (reverter esta migração — funções são só-leitura, nenhum dado é tocado):
-- drop function if exists public.intel_visao_ceo(integer);
-- drop function if exists public.intel_atendimento(integer);
-- drop function if exists public.intel_financeiro(integer);
-- drop function if exists public.intel_corretores(integer);
-- drop function if exists public.intel_equipe(integer);
-- drop function if exists public.intel_gerentes(integer);
-- drop function if exists public.intel_vendas(integer);
-- drop function if exists public.intel_qualidade(integer);
-- drop function if exists public.intel_alertas(integer);
-- drop function if exists public.intel_aquisicao(integer);
-- drop function if exists public.intel_comportamento(integer);
-- drop function if exists public.intel_imoveis(integer);
-- drop function if exists public.intel_conversao(integer);
-- drop function if exists public.intel_proprietarios(integer);
-- drop function if exists public.intel_sara(integer);
