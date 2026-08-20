-- Inteligencia: recortes coerentes, carga historica explicita e conciliacao sem saldo enganoso.
-- Esta migracao substitui as RPCs existentes; nao cria uma segunda camada de leitura.

create or replace function public.intel_visao_ceo(p_days integer default 30)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $function$
declare
  v_ini timestamptz;
  v_res jsonb;
  v_pipeline constant bigint := 6;
begin
  if not (public.is_equipe() or coalesce(auth.jwt()->>'role','') = 'service_role') then
    raise exception 'acesso_negado' using errcode = '42501';
  end if;
  v_ini := now() - make_interval(days => greatest(1, least(p_days, 365)));

  select jsonb_build_object(
    'periodo_dias', greatest(1, least(p_days, 365)),
    'atualizado_em', now(),
    'leads', (select count(*) from public.leads where criado_em >= v_ini),
    'leads_operacionais', (select count(*) from public.leads where criado_em >= v_ini and coalesce(origem,'') <> 'Aquário'),
    'leads_carga_historica', (select count(*) from public.leads where criado_em >= v_ini and origem = 'Aquário'),
    'leads_site', (
      select count(*) from public.leads
      where criado_em >= v_ini
        and (origem ilike '%site%' or coalesce(extras,'{}'::jsonb) ? 'site_last_lead_id')
    ),
    'negocios_f2_abertos', (select count(*) from public.negocios where pipeline_id = v_pipeline and status = 'aberto'),
    'negocios_f2_parados', (
      select count(*) from public.negocios
      where pipeline_id = v_pipeline and status = 'aberto'
        and coalesce(ultima_movimentacao, criado_em) < now() - interval '7 days'
    ),
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
    'vendas', (
      select count(*) from public.vendas
      where data_venda >= v_ini::date and status::text in ('pago','concluido')
    ),
    'vgv', (
      select coalesce(sum(vgv),0) from public.vendas
      where data_venda >= v_ini::date and status::text in ('pago','concluido')
    ),
    'vgv_ano', (
      select coalesce(sum(vgv),0) from public.vendas
      where extract(year from data_venda) = extract(year from now()) and status::text in ('pago','concluido')
    ),
    'meta_vgv_ano', (select coalesce(sum(meta_vgv),0) from public.metas where ano = extract(year from now())::int),
    'comissoes_total', (
      select coalesce(sum(c.valor_final),0)
      from public.comissoes c join public.vendas v on v.id = c.venda_id
      where v.data_venda >= v_ini::date and v.status::text in ('pago','concluido')
    ),
    'vendas_sem_comissao', (
      select count(*) from public.vendas
      where data_venda >= v_ini::date and status::text in ('pago','concluido')
        and (percentual_comissao is null or percentual_comissao = 0)
    ),
    'pipeline_valor', (
      select case when count(*) filter (where valor > 0) = 0 then null else sum(valor) filter (where valor > 0) end
      from public.negocios where pipeline_id = v_pipeline and status = 'aberto'
    ),
    'funil', (
      select coalesce(jsonb_agg(item order by ord), '[]'::jsonb) from (
        select ps.ordem ord, jsonb_build_object('nome',coalesce(ps.rotulo,ps.nome),'volume',count(n.id)) item
        from public.pipeline_stages ps
        left join public.negocios n on n.stage_id=ps.id and n.pipeline_id=v_pipeline and n.status='aberto'
        where ps.pipeline_id=v_pipeline
        group by ps.ordem,ps.rotulo,ps.nome
      ) f
    )
  ) into v_res;
  return v_res;
end;
$function$;

create or replace function public.intel_aquisicao(p_days integer default 30)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $function$
declare v_ini timestamptz; v_res jsonb;
begin
  if not (public.is_equipe() or coalesce(auth.jwt()->>'role','') = 'service_role') then raise exception 'acesso_negado' using errcode='42501'; end if;
  v_ini := now() - make_interval(days => greatest(1, least(p_days, 365)));
  select jsonb_build_object(
    'atualizado_em', now(), 'periodo_dias', greatest(1, least(p_days, 365)),
    'visualizacoes', (select count(distinct page_view_id) from private.site_events_anon where occurred_at >= v_ini),
    'intencao', (select count(*) from private.site_events_anon where occurred_at >= v_ini and event_name in ('whatsapp_click','phone_click','generate_lead','cta_click','owner_cta_click')),
    'leads', (select count(*) from public.leads where criado_em >= v_ini),
    'leads_operacionais', (select count(*) from public.leads where criado_em >= v_ini and coalesce(origem,'') <> 'Aquário'),
    'leads_carga_historica', (select count(*) from public.leads where criado_em >= v_ini and origem='Aquário'),
    'negocios', (select count(*) from public.negocios where pipeline_id=6 and criado_em>=v_ini),
    'visitas', (select count(*) from public.visitas where criado_em >= v_ini),
    'vendas', (select count(*) from public.vendas where data_venda >= v_ini::date and status::text in ('pago','concluido')),
    'linhas', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'origem', origem, 'leads', leads, 'negocios', negocios,
        'leadNeg', case when leads>0 then round(100.0*negocios/leads,1) else null end,
        'carga_historica', origem='Aquário'
      ) order by leads desc), '[]'::jsonb)
      from (
        select coalesce(nullif(trim(l.origem),''),'não atribuído') origem, count(*) leads,
          count(*) filter (where exists(
            select 1 from public.negocios n where n.lead_id=l.id and n.pipeline_id=6 and n.criado_em>=v_ini
          )) negocios
        from public.leads l where l.criado_em >= v_ini group by 1 order by 2 desc limit 12
      ) a
    ),
    'nao_atribuido', (select count(*) from public.leads where criado_em >= v_ini and (origem is null or trim(origem)=''))
  ) into v_res;
  return v_res;
end;
$function$;

create or replace function public.intel_conversao(p_days integer default 30)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $function$
declare v timestamptz; r jsonb;
begin
  if not (public.is_equipe() or coalesce(auth.jwt()->>'role','') = 'service_role') then raise exception 'acesso_negado' using errcode='42501'; end if;
  v := now() - make_interval(days => greatest(1, least(p_days,365)));
  select jsonb_build_object(
    'atualizado_em',now(),'periodo_dias',greatest(1,least(p_days,365)),
    'leads',(select count(*) from public.leads where criado_em>=v and coalesce(origem,'')<>'Aquário'),
    'leads_carga_historica',(select count(*) from public.leads where criado_em>=v and origem='Aquário'),
    'negocios',(select count(*) from public.negocios where pipeline_id=6 and criado_em>=v),
    'visitas',(select count(*) from public.visitas where criado_em>=v),
    'vendas',(select count(*) from public.vendas where data_venda>=v::date and status::text in ('pago','concluido')),
    'ganho',(select count(*) from public.negocios where pipeline_id=6 and criado_em>=v and status='ganho'),
    'perdido',(select count(*) from public.negocios where pipeline_id=6 and criado_em>=v and status='perdido'),
    'pipeline_valor',(select case when count(*) filter(where valor>0)=0 then null else sum(valor) filter(where valor>0) end from public.negocios where pipeline_id=6 and status='aberto'),
    'valor_fechado',(select coalesce(sum(vgv),0) from public.vendas where data_venda>=v::date and status::text in ('pago','concluido')),
    'sla_mediana_min',(select round(percentile_cont(0.5) within group (order by extract(epoch from (now()-cliente_ultima))/60)) from public.sla_msg_cache where cliente_ultima>=now()-interval '7 days' and (env_ultima is null or cliente_ultima>env_ultima)),
    'sem_atendimento',(select count(*) from public.sla_msg_cache s where s.cliente_ultima>=now()-interval '7 days' and (s.env_ultima is null or s.cliente_ultima>s.env_ultima)),
    'parados',(select count(*) from public.negocios where pipeline_id=6 and status='aberto' and coalesce(ultima_movimentacao,criado_em)<now()-interval '7 days'),
    'etapas',(select coalesce(jsonb_agg(jsonb_build_object('etapa',coalesce(ps.rotulo,ps.nome),'volume',(select count(*) from public.negocios n where n.stage_id=ps.id and n.pipeline_id=6 and n.criado_em>=v and n.status='aberto'),'taxa',null) order by ps.ordem),'[]'::jsonb) from public.pipeline_stages ps where ps.pipeline_id=6),
    'corretores',(select coalesce(jsonb_agg(jsonb_build_object('nome',nome,'negocios',neg,'vendas',vend,'conv',case when neg>0 then round(100.0*vend/neg,1) else null end) order by neg desc),'[]'::jsonb) from (
      select c.nome,
        (select count(*) from public.negocios n where n.corretor_id=c.id and n.pipeline_id=6 and n.criado_em>=v) neg,
        (select count(*) from public.vendas ve where ve.corretor_id=c.id and ve.data_venda>=v::date and ve.status::text in ('pago','concluido')) vend
      from public.corretores c where c.ativo order by neg desc limit 8
    ) a)
  ) into r;
  return r;
end;
$function$;

create or replace function public.intel_vendas(p_days integer default 30)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $function$
declare v_ini timestamptz; v_ano int := extract(year from now())::int; v_realizado numeric; v_meta numeric; v_res jsonb;
begin
  if not (public.is_equipe() or coalesce(auth.jwt()->>'role','') = 'service_role') then raise exception 'acesso_negado' using errcode='42501'; end if;
  v_ini := now() - make_interval(days => greatest(1, least(p_days,365)));
  select coalesce(sum(vgv),0) into v_realizado from public.vendas where extract(year from data_venda)=v_ano and status::text in ('pago','concluido');
  select coalesce(sum(meta_vgv),0) into v_meta from public.metas where ano=v_ano;
  select jsonb_build_object(
    'atualizado_em',now(),'periodo_dias',greatest(1,least(p_days,365)),
    'realizado',v_realizado,'meta',v_meta,
    'realizado_pct',case when v_meta>0 then round(100.0*v_realizado/v_meta) else null end,
    'falta',greatest(0,v_meta-v_realizado),'previsao',null,'cobertura_previsao',null,
    'concluidas',(select count(*) from public.vendas where data_venda>=v_ini::date and status::text in ('pago','concluido')),
    'ciclo_medio',(select round(avg(data_conclusao-data_venda)) from public.vendas where data_venda>=v_ini::date and data_conclusao is not null and status::text in ('pago','concluido')),
    'ritmo',null,'dias_uteis',null,
    'equipes',(select coalesce(jsonb_agg(jsonb_build_object('nome','Equipe '||equipe,'meta',meta,'realizado',realizado,'pct',case when meta>0 then round(100.0*realizado/meta) else null end) order by realizado desc),'[]'::jsonb) from (
      select coalesce(g.nome,'sem gerente') equipe,
        coalesce(sum((select coalesce(sum(m.meta_vgv),0) from public.metas m where m.corretor_id=c.id and m.ano=v_ano)),0) meta,
        coalesce(sum((select coalesce(sum(v.vgv),0) from public.vendas v where v.corretor_id=c.id and extract(year from v.data_venda)=v_ano and v.status::text in ('pago','concluido'))),0) realizado
      from public.corretores c left join public.corretores g on g.id=c.gerente_id where c.ativo group by 1
    ) e),
    'etapas',(select coalesce(jsonb_agg(jsonb_build_object('etapa',coalesce(ps.rotulo,ps.nome),'negocios',(select count(*) from public.negocios n where n.stage_id=ps.id and n.pipeline_id=6 and n.status='aberto'),'vgv',null,'probabilidade',null,'ponderado',null) order by ps.ordem),'[]'::jsonb) from public.pipeline_stages ps where ps.pipeline_id=6),
    'total_etapas',jsonb_build_object('negocios',(select count(*) from public.negocios where pipeline_id=6 and status='aberto'),'vgv',null,'ponderado',null),
    'vendas',(select coalesce(jsonb_agg(item order by ord desc nulls last),'[]'::jsonb) from (
      select ve.vgv ord,jsonb_build_object('nome',coalesce(ve.empreendimento_nome,'Venda')||case when ve.unidade_rotulo is not null then ' · '||ve.unidade_rotulo else '' end,'corretor',coalesce(c.nome,'—'),'vgv',ve.vgv,'ciclo',case when ve.data_conclusao is not null then ve.data_conclusao-ve.data_venda else null end,'canal',coalesce(ve.forma_pgto,'—')) item
      from public.vendas ve left join public.corretores c on c.id=ve.corretor_id
      where ve.data_venda>=v_ini::date and ve.status::text in ('pago','concluido') order by ve.vgv desc nulls last limit 8
    ) q),
    'total_vendas',(select count(*) from public.vendas where data_venda>=v_ini::date and status::text in ('pago','concluido')),
    'fora_da_lista',(select count(*) from public.vendas where data_venda>=v_ini::date and status::text in ('pago','concluido') and (percentual_comissao is null or percentual_comissao=0))
  ) into v_res;
  return v_res;
end;
$function$;

create or replace function public.intel_financeiro(p_days integer default 30)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $function$
declare v_ini date; v_res jsonb;
begin
  if not (public.is_equipe() or coalesce(auth.jwt()->>'role','') = 'service_role') then raise exception 'acesso_negado' using errcode='42501'; end if;
  v_ini := (now()-make_interval(days=>greatest(1,least(p_days,365))))::date;
  with vp as (
    select v.id,v.empreendimento_nome,v.unidade_rotulo,v.vgv,v.percentual_comissao,v.custos
    from public.vendas v where v.data_venda>=v_ini and v.status::text in ('pago','concluido')
  ), com as (
    select c.venda_id,c.papel::text papel,c.beneficiario_id,c.valor_final from public.comissoes c where c.venda_id in(select id from vp)
  ), pag as (
    select p.venda_id,p.beneficiario_id,p.valor from public.pagamentos_comissao p where p.status='pago' and p.venda_id in(select id from vp)
  ), tot as (
    select coalesce((select sum(valor_final) from com where papel<>'apecerto'),0) calculada,
      coalesce((select sum(valor) from pag),0) paga
  )
  select jsonb_build_object(
    'atualizado_em',now(),'periodo_dias',greatest(1,least(p_days,365)),'total_vendas',(select count(*) from vp),
    'vendas_divergentes',(select count(*) from vp where (select coalesce(sum(valor),0) from pag where pag.venda_id=vp.id)>(select coalesce(sum(valor_final),0) from com where com.venda_id=vp.id and papel<>'apecerto')),
    'degraus',jsonb_build_object(
      'vgv',(select coalesce(sum(vgv),0) from vp),'receita',(select coalesce(sum(valor_final),0) from com),
      'comissoes_pessoas',(select calculada from tot),'custos',(select coalesce(sum(custos),0) from vp),
      'contribuicao',(select coalesce(sum(valor_final) filter(where papel='apecerto'),0) from com)-(select coalesce(sum(custos),0) from vp),
      'pagas',(select paga from tot),'pendente',(select greatest(calculada-paga,0) from tot),'excedente',(select greatest(paga-calculada,0) from tot)
    ),
    'vendas',(select coalesce(jsonb_agg(item order by ord desc nulls last),'[]'::jsonb) from (
      select vp.vgv ord,jsonb_build_object(
        'nome',coalesce(vp.empreendimento_nome,'Venda'),'codigo',coalesce(vp.unidade_rotulo,'—'),'vgv',vp.vgv,
        'percentual',case when vp.percentual_comissao is null then null else round(vp.percentual_comissao*100,2) end,
        'receita',(select coalesce(sum(valor_final),0) from com where com.venda_id=vp.id),
        'comissoes',(select coalesce(sum(valor_final),0) from com where com.venda_id=vp.id and papel<>'apecerto'),
        'custos',vp.custos,'contribuicao',(select coalesce(sum(valor_final) filter(where papel='apecerto'),0) from com where com.venda_id=vp.id)-coalesce(vp.custos,0),
        'pagamento',case
          when vp.percentual_comissao is null or vp.percentual_comissao=0 then 'bloqueado'
          when (select coalesce(sum(valor),0) from pag where pag.venda_id=vp.id)>(select coalesce(sum(valor_final),0) from com where com.venda_id=vp.id and papel<>'apecerto') then 'divergente'
          when (select coalesce(sum(valor_final),0) from com where com.venda_id=vp.id and papel<>'apecerto')>0 and (select coalesce(sum(valor),0) from pag where pag.venda_id=vp.id)>=(select coalesce(sum(valor_final),0) from com where com.venda_id=vp.id and papel<>'apecerto') then 'pago'
          else 'a pagar' end,
        'sem_custo',vp.custos is null
      ) item from vp order by vp.vgv desc nulls last limit 8
    ) q),
    'participantes',(select coalesce(jsonb_agg(item order by calc desc),'[]'::jsonb) from (
      select sum(com.valor_final) calc,jsonb_build_object(
        'nome',coalesce(cr.nome,initcap(com.papel)),'papel',com.papel,'calculada',sum(com.valor_final),
        'paga',coalesce((select sum(valor) from pag where pag.beneficiario_id=com.beneficiario_id),0),
        'pendente',greatest(sum(com.valor_final)-coalesce((select sum(valor) from pag where pag.beneficiario_id=com.beneficiario_id),0),0),
        'excedente',greatest(coalesce((select sum(valor) from pag where pag.beneficiario_id=com.beneficiario_id),0)-sum(com.valor_final),0)
      ) item from com left join public.corretores cr on cr.usuario_id=com.beneficiario_id
      where com.papel<>'apecerto' group by com.beneficiario_id,com.papel,cr.nome order by calc desc limit 10
    ) q)
  ) into v_res;
  return v_res;
end;
$function$;

revoke all on function public.intel_visao_ceo(integer) from public, anon;
revoke all on function public.intel_aquisicao(integer) from public, anon;
revoke all on function public.intel_conversao(integer) from public, anon;
revoke all on function public.intel_vendas(integer) from public, anon;
revoke all on function public.intel_financeiro(integer) from public, anon;
grant execute on function public.intel_visao_ceo(integer) to authenticated, service_role;
grant execute on function public.intel_aquisicao(integer) to authenticated, service_role;
grant execute on function public.intel_conversao(integer) to authenticated, service_role;
grant execute on function public.intel_vendas(integer) to authenticated, service_role;
grant execute on function public.intel_financeiro(integer) to authenticated, service_role;
