-- Reconstrói as duas leituras canônicas da Inteligência.
--
-- Não cria tabela paralela. As mesmas fontes operacionais continuam sendo a
-- verdade; as duas RPCs abaixo apenas organizam o dado em duas perguntas:
-- marketing/site e empresa/operação. Métrica sem coleta confiável volta null
-- com motivo explícito — nunca zero inventado.

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
    coalesce(auth.jwt()->>'role', '') = 'service_role'
    or exists (
      select 1 from public.usuarios u
      where u.id = auth.uid() and u.ativo
        and u.role::text in ('admin','gerente','diretor','executivo')
    )
  ) then
    raise exception 'acesso_negado' using errcode = '42501';
  end if;

  with broker_rows as (
    select
      c.id as corretor_id,
      c.nome,
      c.no_escritorio,
      c.ultima_presenca,
      coalesce((
        select count(*) from public.leads l
        where l.corretor_id = c.id and l.criado_em >= v_since
          and coalesce(l.origem, '') <> 'Aquário'
      ), 0)::bigint as leads_novos,
      coalesce((
        select count(*) from public.negocios n
        where n.corretor_id = c.id and n.pipeline_id = 6 and n.status = 'aberto'
      ), 0)::bigint as carteira_aberta,
      coalesce((
        select count(*) from public.negocios n
        where n.corretor_id = c.id and n.pipeline_id = 6 and n.status = 'aberto'
          and coalesce(n.ultima_movimentacao, n.criado_em) < now() - interval '7 days'
      ), 0)::bigint as carteira_critica,
      coalesce((
        select jsonb_agg(jsonb_build_object(
          'etapa', etapa, 'quantidade', quantidade
        ) order by ordem)
        from (
          select coalesce(ps.rotulo, ps.nome, 'Sem etapa') as etapa,
                 coalesce(ps.ordem, 999) as ordem,
                 count(*)::bigint as quantidade
          from public.negocios n
          left join public.pipeline_stages ps on ps.id = n.stage_id
          where n.corretor_id = c.id and n.pipeline_id = 6 and n.status = 'aberto'
          group by 1,2
        ) stages
      ), '[]'::jsonb) as etapas,
      coalesce((
        select count(*) from public.ncrm_estado e
        join public.negocios n on n.id = e.negocio_id
        join public.leads l on l.id = n.lead_id
        where n.corretor_id = c.id
          and coalesce(e.distribuido_em, l.criado_em) >= v_since
          and coalesce(l.origem, '') <> 'Aquário'
          and e.primeira_resposta_em is null
      ), 0)::bigint as sem_primeira_resposta,
      (
        select round(percentile_cont(0.5) within group (
          order by extract(epoch from (e.primeira_resposta_em - coalesce(e.distribuido_em, l.criado_em))) / 60
        )::numeric, 1)
        from public.ncrm_estado e
        join public.negocios n on n.id = e.negocio_id
        join public.leads l on l.id = n.lead_id
        where n.corretor_id = c.id
          and coalesce(e.distribuido_em, l.criado_em) >= v_since
          and coalesce(l.origem, '') <> 'Aquário'
          and e.primeira_resposta_em >= coalesce(e.distribuido_em, l.criado_em)
      ) as resposta_mediana_min,
      (
        select round(percentile_cont(0.9) within group (
          order by extract(epoch from (e.primeira_resposta_em - coalesce(e.distribuido_em, l.criado_em))) / 60
        )::numeric, 1)
        from public.ncrm_estado e
        join public.negocios n on n.id = e.negocio_id
        join public.leads l on l.id = n.lead_id
        where n.corretor_id = c.id
          and coalesce(e.distribuido_em, l.criado_em) >= v_since
          and coalesce(l.origem, '') <> 'Aquário'
          and e.primeira_resposta_em >= coalesce(e.distribuido_em, l.criado_em)
      ) as resposta_p90_min,
      coalesce((select count(*) from public.visitas v where v.corretor_id=c.id and v.data >= v_since::date and v.status='agendada'),0)::bigint as visitas_agendadas,
      coalesce((select count(*) from public.visitas v where v.corretor_id=c.id and v.data >= v_since::date and v.status='realizada'),0)::bigint as visitas_realizadas,
      coalesce((select count(*) from public.visitas v where v.corretor_id=c.id and v.data >= v_since::date and v.status='cancelada'),0)::bigint as visitas_canceladas,
      coalesce((select count(*) from public.vendas v where v.corretor_id=c.id and v.data_venda >= v_since::date and v.status::text in ('pago','concluido')),0)::bigint as vendas,
      coalesce((select sum(v.vgv) from public.vendas v where v.corretor_id=c.id and v.data_venda >= v_since::date and v.status::text in ('pago','concluido')),0)::numeric as vgv,
      (select round(avg(v.percentual_comissao * 100),2) from public.vendas v where v.corretor_id=c.id and v.data_venda >= v_since::date and v.status::text in ('pago','concluido') and v.percentual_comissao > 0) as comissao_media_pct,
      coalesce((select count(*) from public.corretor_presencas cp where cp.corretor_id=c.id and cp.dia >= v_since::date),0)::bigint as dias_presenca,
      coalesce((
        select count(*) from public.captacoes_portal cap
        join public.site_leads sl on sl.id = cap.site_lead_id
        join public.leads l on l.id = sl.crm_lead_id
        where l.corretor_id = c.id and cap.criado_em >= v_since
      ),0)::bigint as captacoes,
      (select round(avg(ia.nota_geral)::numeric,1) from public.ia_notas_atendimento ia where ia.corretor_id=c.id and ia.avaliado_em >= v_since) as nota_ia,
      coalesce((select count(*) from public.ia_notas_atendimento ia where ia.corretor_id=c.id and ia.avaliado_em >= v_since),0)::bigint as avaliacoes_ia,
      coalesce((select sum(pe.quantidade) from public.perf_eventos pe where pe.corretor_id=c.id and pe.tipo='mensagem_enviada' and pe.ocorrido_em >= v_since),0)::bigint as mensagens_texto,
      coalesce((select sum(pe.quantidade) from public.perf_eventos pe where pe.corretor_id=c.id and pe.tipo='audio_enviado' and pe.ocorrido_em >= v_since),0)::bigint as audios,
      coalesce((select sum(pe.quantidade) from public.perf_eventos pe where pe.corretor_id=c.id and pe.tipo='imagem_enviada' and pe.ocorrido_em >= v_since),0)::bigint as imagens,
      coalesce((select count(*) from public.f2_lead f where f.corretor_id=c.id and f.descartado_em is null and f.proxima_acao_em < now()),0)::bigint as followups_vencidos
    from public.corretores c
    where c.ativo
  ),
  team as (
    select coalesce(jsonb_agg(jsonb_build_object(
      'corretor_id', b.corretor_id,
      'nome', b.nome,
      'leads_novos', b.leads_novos,
      'carteira_aberta', b.carteira_aberta,
      'carteira_critica', b.carteira_critica,
      'etapas', b.etapas,
      'sem_primeira_resposta', b.sem_primeira_resposta,
      'resposta_mediana_min', b.resposta_mediana_min,
      'resposta_p90_min', b.resposta_p90_min,
      'visitas_agendadas', b.visitas_agendadas,
      'visitas_realizadas', b.visitas_realizadas,
      'visitas_canceladas', b.visitas_canceladas,
      'conversao_lead_visita', case when b.leads_novos > 0 then round(100.0*b.visitas_realizadas/b.leads_novos,1) else null end,
      'realizacao_visita', case when b.visitas_realizadas+b.visitas_canceladas > 0 then round(100.0*b.visitas_realizadas/(b.visitas_realizadas+b.visitas_canceladas),1) else null end,
      'vendas', b.vendas,
      'vgv', b.vgv,
      'ticket_medio', case when b.vendas > 0 then round(b.vgv/b.vendas,2) else null end,
      'comissao_media_pct', b.comissao_media_pct,
      'dias_presenca', b.dias_presenca,
      'no_escritorio_agora', b.no_escritorio,
      'ultima_presenca', b.ultima_presenca,
      'captacoes', b.captacoes,
      'nota_ia', b.nota_ia,
      'avaliacoes_ia', b.avaliacoes_ia,
      'mensagens_texto', b.mensagens_texto,
      'audios', b.audios,
      'imagens', b.imagens,
      'followups_vencidos', b.followups_vencidos,
      'horas_erp', null,
      'horas_erp_motivo', 'A coleta atual registra eventos, mas não mede sessão individual confiável.',
      'pulos_distribuicao', null,
      'pulos_distribuicao_motivo', 'A roleta não mantém histórico individual de elegibilidade/pulo.'
    ) order by b.vgv desc, b.visitas_realizadas desc, b.nome), '[]'::jsonb) as rows
    from broker_rows b
  ),
  stages as (
    select coalesce(jsonb_agg(jsonb_build_object('etapa',etapa,'quantidade',quantidade) order by ordem),'[]'::jsonb) as rows
    from (
      select coalesce(ps.rotulo,ps.nome,'Sem etapa') etapa, coalesce(ps.ordem,999) ordem, count(*)::bigint quantidade
      from public.negocios n left join public.pipeline_stages ps on ps.id=n.stage_id
      where n.pipeline_id=6 and n.status='aberto'
      group by 1,2
    ) x
  ),
  summary as (
    select
      count(*)::bigint as corretores_ativos,
      count(*) filter(where no_escritorio)::bigint as no_escritorio_agora,
      sum(leads_novos)::bigint as leads_novos,
      sum(carteira_aberta)::bigint as carteira_aberta,
      sum(carteira_critica)::bigint as carteira_critica,
      sum(sem_primeira_resposta)::bigint as sem_primeira_resposta,
      sum(visitas_agendadas)::bigint as visitas_agendadas,
      sum(visitas_realizadas)::bigint as visitas_realizadas,
      sum(visitas_canceladas)::bigint as visitas_canceladas,
      sum(vendas)::bigint as vendas,
      sum(vgv)::numeric as vgv,
      sum(dias_presenca)::bigint as dias_presenca,
      sum(captacoes)::bigint as captacoes,
      sum(followups_vencidos)::bigint as followups_vencidos
    from broker_rows
  ),
  quality as (
    select round(avg(nota_geral)::numeric,1) as nota_media, count(*)::bigint as avaliacoes
    from public.ia_notas_atendimento where avaliado_em >= v_since
  )
  select jsonb_build_object(
    'periodo', jsonb_build_object('dias',v_days,'inicio',v_since,'fim',now()),
    'operacao', to_jsonb(s) || jsonb_build_object(
      'ticket_medio', case when s.vendas > 0 then round(s.vgv/s.vendas,2) else null end,
      'conversao_lead_visita', case when s.leads_novos > 0 then round(100.0*s.visitas_realizadas/s.leads_novos,1) else null end,
      'realizacao_visita', case when s.visitas_realizadas+s.visitas_canceladas > 0 then round(100.0*s.visitas_realizadas/(s.visitas_realizadas+s.visitas_canceladas),1) else null end,
      'nota_ia', q.nota_media,
      'avaliacoes_ia', q.avaliacoes,
      'horas_erp', null,
      'horas_erp_motivo', 'Sem sessão individual confiável; eventos de atividade não equivalem a jornada de trabalho.',
      'pulos_distribuicao', null,
      'pulos_distribuicao_motivo', 'Sem histórico individual de elegibilidade da roleta.'
    ),
    'funil', st.rows,
    'equipe', t.rows,
    'fontes', jsonb_build_array(
      jsonb_build_object('nome','CRM e Funil 2.0','status','conectado'),
      jsonb_build_object('nome','Visitas e vendas','status','conectado'),
      jsonb_build_object('nome','Qualidade por IA','status','conectado'),
      jsonb_build_object('nome','Presença','status','parcial','motivo','Há confirmações por dia, mas não histórico confiável de ausências.'),
      jsonb_build_object('nome','Horas no ERP','status','ausente','motivo','O sistema ainda não mede início e fim de sessão individual.'),
      jsonb_build_object('nome','Pulos da distribuição','status','ausente','motivo','A roleta ainda não persiste esse histórico por corretor.')
    ),
    'atualizado_em', now()
  ) into v_result
  from summary s, quality q, stages st, team t;

  return v_result;
end;
$$;

revoke all on function public.tracking_360_ceo(integer) from public, anon, authenticated;
grant execute on function public.tracking_360_ceo(integer) to authenticated, service_role;

comment on function public.tracking_360_ceo(integer) is
  'Leitura única de empresa/operação: esforço observável, carteira, atendimento, visitas, vendas, presença e qualidade por corretor.';

create or replace function public.tracking_360_jornada_digital(p_days integer default 30)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_days integer := greatest(1, least(coalesce(p_days,30),365));
  v_since timestamptz := now() - make_interval(days => greatest(1, least(coalesce(p_days,30),365)));
  v_result jsonb;
begin
  if not (
    coalesce(auth.jwt()->>'role','') = 'service_role'
    or exists (
      select 1 from public.usuarios u where u.id=auth.uid() and u.ativo
        and u.role::text in ('admin','gerente','diretor','executivo')
    )
  ) then
    raise exception 'acesso_negado' using errcode='42501';
  end if;

  with events as (
    select e.*
    from private.site_events_anon e
    where e.occurred_at >= v_since
      and coalesce(e.utm_source,'') not in ('codex','codex_qa')
      and coalesce(e.utm_medium,'') <> 'test'
  ),
  page_journeys as (
    select page_view_id,
      min(occurred_at) started_at, max(occurred_at) last_at,
      bool_or(event_name <> 'page_view') interacted,
      bool_or(event_name='view_item') viewed_property,
      bool_or(event_name='whatsapp_click') clicked_whatsapp,
      bool_or(event_name='form_start') started_form,
      bool_or(event_name='generate_lead') generated_lead,
      max(case when event_name='scroll_depth' then nullif(regexp_replace(coalesce(properties->>'percent_scrolled',''),'[^0-9.]','','g'),'')::numeric end) max_scroll
    from events group by page_view_id
  ),
  overview as (
    select count(*) filter(where event_name='page_view')::bigint page_views,
      count(distinct page_view_id)::bigint visitas_rastreadas,
      count(distinct page_view_id) filter(where event_name<>'page_view')::bigint visitas_engajadas,
      count(*) filter(where event_name='view_item')::bigint visualizacoes_imovel,
      count(*) filter(where event_name in ('whatsapp_click','phone_click','cta_click','owner_cta_click'))::bigint cliques_cta,
      count(distinct page_view_id) filter(where event_name='form_start')::bigint formularios_iniciados,
      count(distinct page_view_id) filter(where event_name='generate_lead')::bigint leads_gerados,
      max(occurred_at) ultimo_evento_em
    from events
  ),
  behavior as (
    select round(avg(extract(epoch from (last_at-started_at))) filter(where last_at>started_at and last_at-started_at<interval '1 hour')::numeric,0) tempo_engajamento_medio_seg,
      round(100.0*count(*) filter(where not interacted and last_at-started_at<interval '10 seconds')/nullif(count(*),0),1) saida_rapida_pct,
      count(*) filter(where started_form and not generated_lead)::bigint abandono_formulario,
      count(*) filter(where max_scroll>=50)::bigint chegou_metade,
      count(*) filter(where max_scroll>=90)::bigint chegou_final
    from page_journeys
  ),
  event_rows as (
    select coalesce(jsonb_agg(jsonb_build_object('evento',event_name,'quantidade',quantidade) order by quantidade desc),'[]'::jsonb) rows
    from (select event_name,count(*)::bigint quantidade from events group by event_name order by 2 desc limit 12) x
  ),
  campaign_events as (
    select coalesce(nullif(utm_source,''),'Direto / sem UTM') source,
      coalesce(nullif(utm_medium,''),'Sem mídia') medium,
      coalesce(nullif(utm_campaign,''),'Sem campanha') campaign,
      count(*) filter(where event_name='page_view')::bigint page_views,
      count(*) filter(where event_name in ('whatsapp_click','phone_click','cta_click','owner_cta_click'))::bigint cta_clicks,
      count(distinct page_view_id) filter(where event_name='generate_lead')::bigint tracked_leads
    from events group by 1,2,3
  ),
  lead_campaign as (
    select sl.id, sl.crm_negocio_id,
      coalesce(nullif(sl.tracking#>>'{last_touch,utm_source}',''),nullif(sl.tracking->>'utm_source',''),'Direto / sem UTM') source,
      coalesce(nullif(sl.tracking#>>'{last_touch,utm_medium}',''),nullif(sl.tracking->>'utm_medium',''),'Sem mídia') medium,
      coalesce(nullif(sl.tracking#>>'{last_touch,utm_campaign}',''),nullif(sl.tracking->>'utm_campaign',''),'Sem campanha') campaign
    from public.site_leads sl where sl.criado_em >= v_since
  ),
  campaign_outcomes as (
    select lc.source,lc.medium,lc.campaign,
      count(*)::bigint crm_leads,
      count(*) filter(where lc.crm_negocio_id is not null)::bigint negocios,
      coalesce(sum((select count(*) from public.visitas v where v.negocio_id=lc.crm_negocio_id and v.data>=v_since::date and v.status='agendada')),0)::bigint visitas_agendadas,
      coalesce(sum((select count(*) from public.visitas v where v.negocio_id=lc.crm_negocio_id and v.data>=v_since::date and v.status='realizada')),0)::bigint visitas_realizadas,
      coalesce(sum((select count(*) from public.visitas v where v.negocio_id=lc.crm_negocio_id and v.data>=v_since::date and v.status='cancelada')),0)::bigint visitas_canceladas,
      count(*) filter(where exists(select 1 from public.negocios n join public.vendas ve on ve.id=n.venda_id where n.id=lc.crm_negocio_id and ve.data_venda>=v_since::date and ve.status::text in ('pago','concluido')))::bigint vendas,
      coalesce(sum((select ve.vgv from public.negocios n join public.vendas ve on ve.id=n.venda_id where n.id=lc.crm_negocio_id and ve.data_venda>=v_since::date and ve.status::text in ('pago','concluido') limit 1)),0)::numeric vgv
    from lead_campaign lc group by 1,2,3
  ),
  campaign_rows as (
    select coalesce(ce.source,co.source) source, coalesce(ce.medium,co.medium) medium, coalesce(ce.campaign,co.campaign) campaign,
      coalesce(ce.page_views,0)::bigint page_views, coalesce(ce.cta_clicks,0)::bigint cta_clicks,
      coalesce(co.crm_leads,ce.tracked_leads,0)::bigint leads,
      coalesce(co.negocios,0)::bigint negocios,
      coalesce(co.visitas_agendadas,0)::bigint visitas_agendadas,
      coalesce(co.visitas_realizadas,0)::bigint visitas_realizadas,
      coalesce(co.visitas_canceladas,0)::bigint visitas_canceladas,
      coalesce(co.vendas,0)::bigint vendas, coalesce(co.vgv,0)::numeric vgv,
      null::numeric investimento, null::bigint impressoes, null::bigint cliques_midia,
      null::numeric ctr, null::numeric cpc, null::numeric cpl, null::numeric roas
    from campaign_events ce full join campaign_outcomes co using(source,medium,campaign)
  ),
  campaigns as (
    select coalesce(jsonb_agg(to_jsonb(r) order by r.visitas_realizadas desc,r.leads desc,r.page_views desc),'[]'::jsonb) rows
    from campaign_rows r where r.page_views>0 or r.leads>0 or r.visitas_realizadas>0
  ),
  page_rows as (
    select page_path,count(*) filter(where event_name='page_view')::bigint visualizacoes,
      count(*) filter(where event_name in ('whatsapp_click','phone_click','cta_click','owner_cta_click'))::bigint cliques_cta,
      count(distinct page_view_id) filter(where event_name='generate_lead')::bigint leads
    from events group by page_path
  ),
  pages as (
    select coalesce(jsonb_agg(to_jsonb(r) order by r.visualizacoes desc),'[]'::jsonb) rows from (select * from page_rows order by visualizacoes desc limit 10) r
  ),
  product_rows as (
    select nullif(properties->>'item_id','') item_id,
      coalesce(nullif(properties->>'item_name',''),'Imóvel sem nome') imovel,
      nullif(properties->>'bairro','') bairro,
      count(*)::bigint visualizacoes,
      count(distinct page_view_id)::bigint visitas
    from events where event_name='view_item' and nullif(properties->>'item_id','') is not null
    group by 1,2,3
  ),
  products as (
    select coalesce(jsonb_agg(to_jsonb(r) order by r.visualizacoes desc),'[]'::jsonb) rows from (select * from product_rows order by visualizacoes desc limit 10) r
  ),
  tracking as (
    select count(*)::bigint total_eventos,max(occurred_at) ultimo_evento_em,
      count(*) filter(where event_name not in ('page_view','consent_update','view_item','view_inventory','generate_lead','whatsapp_click','phone_click','social_click','sara_open','sara_search','sara_results','sara_error','favorite_toggle','gallery_interaction','property_search','cta_click','owner_portal_open','owner_cta_click','form_start','filter_change','scroll_depth'))::bigint eventos_invalidos
    from events
  ),
  attribution as (
    select count(*)::bigint total,
      count(*) filter(where source is not null)::bigint com_origem,
      count(*) filter(where campaign is not null)::bigint com_campanha,
      count(*) filter(where coalesce(gclid,gbraid,wbraid,fbclid) is not null)::bigint com_click_id
    from private.lead_attribution where last_seen_at>=v_since
  ),
  sync as (
    select count(*)::bigint total,count(*) filter(where crm_synced_at is not null)::bigint sincronizados,
      count(*) filter(where crm_sync_error is not null)::bigint erros
    from public.site_leads where criado_em>=v_since
  ),
  delivery as (
    select count(*)::bigint total,count(*) filter(where status='delivered')::bigint entregues,
      count(*) filter(where status in ('pending','dispatched','sending'))::bigint pendentes,
      count(*) filter(where status in ('failed','blocked'))::bigint falhas,
      max(delivered_at) ultima_entrega_em
    from private.tracking_delivery_logs where created_at>=v_since
  )
  select jsonb_build_object(
    'periodo',jsonb_build_object('dias',v_days,'inicio',v_since,'fim',now()),
    'resumo',to_jsonb(o),
    'comportamento',to_jsonb(b),
    'campanhas',c.rows,
    'eventos',er.rows,
    'paginas',p.rows,
    'imoveis',pr.rows,
    'saude',to_jsonb(t) || jsonb_build_object(
      'tracking_atrasado',t.ultimo_evento_em is null or t.ultimo_evento_em<now()-interval '2 hours',
      'atribuicao',to_jsonb(a),'crm',to_jsonb(s),'entrega_midia',to_jsonb(d),
      'meta_ads_conectado',d.total>0,
      'google_ads_conectado',false,
      'gtm_containers',null,
      'gtm_motivo','O ERP ainda não recebe inventário de containers e tags do Google Tag Manager.'
    ),
    'atualizado_em',now()
  ) into v_result
  from overview o,behavior b,campaigns c,event_rows er,pages p,products pr,tracking t,attribution a,sync s,delivery d;

  return v_result;
end;
$$;

revoke all on function public.tracking_360_jornada_digital(integer) from public, anon, authenticated;
grant execute on function public.tracking_360_jornada_digital(integer) to authenticated, service_role;

comment on function public.tracking_360_jornada_digital(integer) is
  'Leitura única de marketing/site: campanha, comportamento, eventos, imóvel, lead, visita, venda e saúde das integrações.';
