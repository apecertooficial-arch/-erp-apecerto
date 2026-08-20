-- Inteligência: Funil 2.0 é a única carteira operacional.
-- Qualquer lead sem card ativo em f2_lead pertence ao Bolsão/Pesca e nunca
-- contamina SLA, criticidade, produtividade ou conversão da equipe.

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
      select 1 from public.usuarios u where u.id=auth.uid() and u.ativo
        and u.role::text in ('admin','gerente','diretor','executivo')
    )
  ) then
    raise exception 'acesso_negado' using errcode='42501';
  end if;

  with
  f2_all as (
    select f.id card_id, f.origem_negocio_id negocio_id, n.lead_id,
      f.corretor_id, f.corretor_nome, f.etapa, f.momento_codigo,
      f.proxima_acao_em, f.criado_em, f.descartado_em, n.venda_id
    from public.f2_lead f
    join public.negocios n on n.id=f.origem_negocio_id
  ),
  f2_active as (select * from f2_all where descartado_em is null),
  f2_cohort as (select * from f2_all where criado_em>=v_since),
  waiting as (
    select f.corretor_id,f.lead_id,s.cliente_ultima,
      extract(epoch from (now()-s.cliente_ultima))/60 as espera_min
    from f2_active f join public.sla_msg_cache s on s.lead_id=f.lead_id
    where s.cliente_ultima is not null and (s.env_ultima is null or s.cliente_ultima>s.env_ultima)
  ),
  scoped_messages as (
    select f.corretor_id,f.lead_id,m.conversa_id,m.enviado_em,m.direcao,m.tipo,
      lag(m.direcao) over(partition by m.conversa_id order by m.enviado_em,m.id) anterior
    from f2_active f
    join public.wa_contatos ct on ct.lead_id=f.lead_id
    join public.wa_conversas cv on cv.contato_id=ct.id
    join public.wa_mensagens m on m.conversa_id=cv.id and not coalesce(m.is_grupo,false)
    where m.enviado_em>=v_since and m.enviado_em<now()+interval '1 minute'
  ),
  client_turns as (
    select * from scoped_messages where direcao='recebida' and coalesce(anterior,'')<>'recebida'
  ),
  response_samples as (
    select t.corretor_id,t.lead_id,t.enviado_em cliente_em,
      (select min(m.enviado_em) from public.wa_mensagens m
        where m.conversa_id=t.conversa_id and m.direcao='enviada'
          and not coalesce(m.is_grupo,false) and m.enviado_em>t.enviado_em
          and m.enviado_em<=t.enviado_em+interval '7 days') resposta_em
    from client_turns t
  ),
  response_by_broker as (
    select corretor_id,
      round(percentile_cont(.5) within group(order by extract(epoch from(resposta_em-cliente_em))/60)::numeric,1) resposta_mediana_min,
      round(percentile_cont(.9) within group(order by extract(epoch from(resposta_em-cliente_em))/60)::numeric,1) resposta_p90_min,
      count(*) filter(where resposta_em is not null)::bigint conversas_respondidas,
      count(*) filter(where resposta_em is null)::bigint conversas_sem_resposta
    from response_samples group by corretor_id
  ),
  business_days as (
    select count(*)::integer qtd from generate_series(v_since::date,current_date,interval '1 day') d
    where extract(isodow from d)<6
  ),
  broker_rows as (
    select c.id corretor_id,c.nome,c.no_escritorio,c.ultima_presenca,
      (select count(*) from f2_cohort f where f.corretor_id=c.id)::bigint leads_novos,
      (select count(*) from f2_active f where f.corretor_id=c.id)::bigint carteira_ativa,
      (select count(*) from f2_active f where f.corretor_id=c.id and f.etapa='pescado')::bigint pescados_na_carteira,
      (select count(*) from waiting w where w.corretor_id=c.id)::bigint clientes_aguardando,
      (select count(*) from waiting w where w.corretor_id=c.id and w.espera_min>60)::bigint clientes_criticos,
      (select count(*) from f2_active f where f.corretor_id=c.id and f.etapa<>'pescado' and f.proxima_acao_em<now())::bigint followups_vencidos,
      coalesce(rb.resposta_mediana_min,null) resposta_mediana_min,
      coalesce(rb.resposta_p90_min,null) resposta_p90_min,
      coalesce(rb.conversas_respondidas,0)::bigint conversas_respondidas,
      coalesce(rb.conversas_sem_resposta,0)::bigint conversas_sem_resposta,
      (select coalesce(jsonb_agg(jsonb_build_object('etapa',x.etapa,'quantidade',x.qtd) order by x.qtd desc),'[]'::jsonb)
       from (select f.etapa,count(*)::bigint qtd from f2_active f where f.corretor_id=c.id group by f.etapa) x) etapas,
      (select count(*) from public.visitas v join f2_all f on f.negocio_id=v.negocio_id
        where f.corretor_id=c.id and v.data>=v_since::date and v.status='agendada')::bigint visitas_agendadas,
      (select count(*) from public.visitas v join f2_all f on f.negocio_id=v.negocio_id
        where f.corretor_id=c.id and v.data>=v_since::date and v.status='realizada')::bigint visitas_realizadas,
      (select count(*) from public.visitas v join f2_all f on f.negocio_id=v.negocio_id
        where f.corretor_id=c.id and v.data>=v_since::date and v.status='cancelada')::bigint visitas_canceladas,
      (select count(*) from f2_cohort f where f.corretor_id=c.id and exists(
        select 1 from public.visitas v where v.negocio_id=f.negocio_id and v.status='realizada' and v.criado_em>=f.criado_em))::bigint cohort_com_visita,
      (select count(distinct ve.id) from f2_all f join public.vendas ve on ve.id=f.venda_id
        where f.corretor_id=c.id and ve.data_venda>=v_since::date and ve.status::text in('pago','concluido'))::bigint vendas,
      coalesce((select sum(distinct ve.vgv) from f2_all f join public.vendas ve on ve.id=f.venda_id
        where f.corretor_id=c.id and ve.data_venda>=v_since::date and ve.status::text in('pago','concluido')),0)::numeric vgv,
      (select round(avg(ve.percentual_comissao*100),2) from f2_all f join public.vendas ve on ve.id=f.venda_id
        where f.corretor_id=c.id and ve.data_venda>=v_since::date and ve.status::text in('pago','concluido') and ve.percentual_comissao>0) comissao_media_pct,
      (select round(avg(ia.nota_geral)::numeric,1) from public.ia_notas_atendimento ia
        where ia.corretor_id=c.id and ia.avaliado_em>=v_since and exists(select 1 from f2_active f where f.lead_id=ia.lead_id)) nota_ia,
      (select count(*) from public.ia_notas_atendimento ia
        where ia.corretor_id=c.id and ia.avaliado_em>=v_since and exists(select 1 from f2_active f where f.lead_id=ia.lead_id))::bigint avaliacoes_ia,
      (select count(*) from scoped_messages m where m.corretor_id=c.id and m.direcao='enviada' and m.tipo in('texto','text','conversation'))::bigint mensagens_texto,
      (select count(*) from scoped_messages m where m.corretor_id=c.id and m.direcao='enviada' and m.tipo in('audio','ptt'))::bigint audios,
      (select count(*) from scoped_messages m where m.corretor_id=c.id and m.direcao='enviada' and m.tipo in('imagem','image'))::bigint imagens,
      (select count(*) from public.corretor_presencas cp where cp.corretor_id=c.id and cp.dia>=v_since::date)::bigint dias_presenca,
      greatest(0,(select qtd from business_days)-(select count(*) from public.corretor_presencas cp where cp.corretor_id=c.id and cp.dia>=v_since::date))::bigint dias_uteis_sem_confirmacao,
      ((select count(*) from public.empreendimentos e where e.captador_corretor_id=c.id and coalesce(e.captado_em,e.created_at)>=v_since)
       +(select count(*) from public.unidades u join public.empreendimentos e on e.id=u.empreendimento_id
          where u.captador_corretor_id=c.id and e.created_at>=v_since))::bigint captacoes
    from public.corretores c left join response_by_broker rb on rb.corretor_id=c.id
    where c.ativo
  ),
  team as (
    select coalesce(jsonb_agg(to_jsonb(b)||jsonb_build_object(
      'conversao_coorte_visita',case when b.leads_novos>0 then round(100.0*b.cohort_com_visita/b.leads_novos,1) end,
      'realizacao_visita',case when b.visitas_realizadas+b.visitas_canceladas>0 then round(100.0*b.visitas_realizadas/(b.visitas_realizadas+b.visitas_canceladas),1) end,
      'ticket_medio',case when b.vendas>0 then round(b.vgv/b.vendas,2) end,
      'horas_erp',null,'horas_erp_motivo','O ERP ainda não registra início e fim de sessão individual.',
      'pulos_distribuicao',null,'pulos_distribuicao_motivo','A roleta ainda não persiste cada pulo por corretor.'
    ) order by b.vgv desc,b.visitas_realizadas desc,b.nome),'[]'::jsonb) rows from broker_rows b
  ),
  stages as (
    select coalesce(jsonb_agg(to_jsonb(x) order by x.qtd desc),'[]'::jsonb) rows
    from (select etapa,count(*)::bigint quantidade,count(*)::bigint qtd from f2_active group by etapa) x
  ),
  actions as (
    select coalesce(jsonb_agg(to_jsonb(x) order by x.prioridade,x.espera_min desc nulls last),'[]'::jsonb) rows from (
      select f.card_id::text id,l.nome lead,c.nome corretor,f.etapa,
        case when w.espera_min>60 then 1 when f.proxima_acao_em<now() and f.etapa<>'pescado' then 2 else 3 end prioridade,
        round(w.espera_min)::bigint espera_min,
        case when w.espera_min>60 then 'Cliente aguardando há mais de 1 hora'
             when f.proxima_acao_em<now() and f.etapa<>'pescado' then 'Próxima ação vencida'
             else 'Cliente aguardando resposta' end motivo
      from f2_active f join public.leads l on l.id=f.lead_id join public.corretores c on c.id=f.corretor_id
      left join waiting w on w.lead_id=f.lead_id
      where w.lead_id is not null or (f.proxima_acao_em<now() and f.etapa<>'pescado')
      order by prioridade,w.espera_min desc nulls last limit 30
    ) x
  ),
  fishing as (
    select coalesce(jsonb_agg(to_jsonb(x) order by x.ultima_interacao desc nulls last,x.criado_em desc),'[]'::jsonb) rows from (
      select l.id,l.nome,coalesce(l.origem,'Não informada') origem,n.id negocio_id,
        s.ultima_interacao,s.qtd_recebidas,s.qtd_enviadas,l.criado_em
      from public.negocios n join public.leads l on l.id=n.lead_id
      left join public.sla_msg_cache s on s.lead_id=l.id
      where n.status='aberto' and n.stage_id=public.aquario_stage_id()
        and not exists(select 1 from f2_active f where f.lead_id=l.id)
      order by s.ultima_interacao desc nulls last,l.criado_em desc limit 30
    ) x
  ),
  sources_bolsao as (
    select coalesce(jsonb_agg(to_jsonb(x) order by x.quantidade desc),'[]'::jsonb) rows from (
      select coalesce(l.origem,'Não informada') origem,count(*)::bigint quantidade
      from public.leads l where not exists(select 1 from f2_active f where f.lead_id=l.id)
      group by 1 order by 2 desc limit 12
    ) x
  ),
  summary as (select
    (select count(*) from f2_active)::bigint leads_funil_ativos,
    (select count(*) from f2_cohort)::bigint leads_entraram_periodo,
    (select count(*) from f2_active where etapa='pescado')::bigint pescados_na_carteira,
    (select count(*) from public.leads l where not exists(select 1 from f2_active f where f.lead_id=l.id))::bigint leads_bolsao,
    (select count(*) from public.negocios n where n.status='aberto' and n.stage_id=public.aquario_stage_id() and not exists(select 1 from f2_active f where f.lead_id=n.lead_id))::bigint disponiveis_pesca,
    (select count(*) from waiting)::bigint clientes_aguardando,
    (select count(*) from waiting where espera_min>60)::bigint clientes_criticos,
    (select count(*) from f2_active where etapa<>'pescado' and proxima_acao_em<now())::bigint followups_vencidos,
    (select count(*) from public.visitas v join f2_all f on f.negocio_id=v.negocio_id where v.data>=v_since::date and v.status='agendada')::bigint visitas_agendadas,
    (select count(*) from public.visitas v join f2_all f on f.negocio_id=v.negocio_id where v.data>=v_since::date and v.status='realizada')::bigint visitas_realizadas,
    (select count(*) from public.visitas v join f2_all f on f.negocio_id=v.negocio_id where v.data>=v_since::date and v.status='cancelada')::bigint visitas_canceladas,
    (select count(distinct ve.id) from f2_all f join public.vendas ve on ve.id=f.venda_id where ve.data_venda>=v_since::date and ve.status::text in('pago','concluido'))::bigint vendas,
    coalesce((select sum(distinct ve.vgv) from f2_all f join public.vendas ve on ve.id=f.venda_id where ve.data_venda>=v_since::date and ve.status::text in('pago','concluido')),0)::numeric vgv,
    (select round(avg(nota_ia)::numeric,1) from broker_rows where nota_ia is not null) nota_ia,
    (select count(*) from public.corretores where ativo)::bigint corretores_ativos,
    (select count(*) from public.corretores where ativo and no_escritorio)::bigint no_escritorio_agora
  )
  select jsonb_build_object(
    'periodo',jsonb_build_object('dias',v_days,'inicio',v_since,'fim',now()),
    'regra_escopo',jsonb_build_object('fonte','f2_lead','criterio','descartado_em é nulo','bolsao','todo lead sem card ativo'),
    'operacao',to_jsonb(s)||jsonb_build_object(
      'ticket_medio',case when s.vendas>0 then round(s.vgv/s.vendas,2) end,
      'realizacao_visita',case when s.visitas_realizadas+s.visitas_canceladas>0 then round(100.0*s.visitas_realizadas/(s.visitas_realizadas+s.visitas_canceladas),1) end
    ),
    'funil',st.rows,'equipe',t.rows,'acoes',a.rows,
    'bolsao',jsonb_build_object('origens',bo.rows,'oportunidades',fi.rows),
    'fontes',jsonb_build_array(
      jsonb_build_object('nome','Funil 2.0','status','conectado','motivo','Somente cards ativos entram na operação.'),
      jsonb_build_object('nome','D-API e WhatsApp','status','conectado','motivo','SLA mede o tempo desde a última mensagem do cliente.'),
      jsonb_build_object('nome','Visitas, vendas e IA','status','conectado'),
      jsonb_build_object('nome','Presença','status','parcial','motivo','Mede confirmações e dias úteis sem confirmação; não mede horas.'),
      jsonb_build_object('nome','Horas no ERP','status','ausente','motivo','Ainda não existe sessão individual confiável.'),
      jsonb_build_object('nome','Pulos da distribuição','status','ausente','motivo','A roleta não grava o histórico de cada pulo.')
    ),
    'atualizado_em',now()
  ) into v_result from summary s,team t,stages st,actions a,fishing fi,sources_bolsao bo;
  return v_result;
end;
$$;

revoke all on function public.tracking_360_ceo(integer) from public,anon,authenticated;
grant execute on function public.tracking_360_ceo(integer) to authenticated,service_role;

comment on function public.tracking_360_ceo(integer) is
  'Inteligência operacional canônica: somente f2_lead ativo; demais leads ficam isolados no Bolsão/Pesca.';
