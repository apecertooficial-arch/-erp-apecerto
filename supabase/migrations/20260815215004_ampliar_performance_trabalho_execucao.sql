-- Sala de comando orientada a decisões executivas.
-- Separa resultado, execução, risco operacional e confiança do dado.
-- Aquário/Bolsão e a etapa Pescado nunca viram mérito de corretor.

create or replace function public.performance_sala_comando(
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
    (p_fim::timestamp at time zone 'America/Sao_Paulo') fim_ts,
    (p_inicio-(p_fim-p_inicio)) anterior_inicio,
    ((p_inicio-(p_fim-p_inicio))::timestamp at time zone 'America/Sao_Paulo') anterior_inicio_ts
  where p_inicio is not null and p_fim is not null and p_fim>p_inicio and p_fim-p_inicio<=36525
),
permissao as (
  select public.can_manage_all() admin,public.current_broker_id() corretor_id
),
cor as (
  select c.id,c.nome,c.usuario_id,c.limite_carteira
  from public.corretores c cross join permissao p
  where c.ativo and (p.admin or c.id=p.corretor_id)
),
vendas_periodo as (
  select count(*) filter(where v.status::text in ('pago','concluido'))::integer vendas,
    count(*) filter(where v.status::text='pendente')::integer pendentes,
    coalesce(sum(v.vgv) filter(where v.status::text in ('pago','concluido')),0) vgv,
    coalesce(sum(v.vgv) filter(where v.status::text='pendente'),0) vgv_pendente,
    coalesce(sum(v.vgv*coalesce(v.percentual_comissao,0)) filter(where v.status::text in ('pago','concluido')),0) receita_bruta,
    coalesce(sum(coalesce(v.custos,0)) filter(where v.status::text in ('pago','concluido')),0) custos
  from public.vendas v cross join limites l cross join permissao p
  where p.admin and v.data_venda>=l.inicio and v.data_venda<l.fim
),
vendas_anterior as (
  select count(*) filter(where v.status::text in ('pago','concluido'))::integer vendas,
    coalesce(sum(v.vgv) filter(where v.status::text in ('pago','concluido')),0) vgv
  from public.vendas v cross join limites l cross join permissao p
  where p.admin and v.data_venda>=l.anterior_inicio and v.data_venda<l.inicio
),
metas as (
  select coalesce(sum(m.meta_vgv),0) meta_vgv,coalesce(sum(m.meta_vendas),0)::integer meta_vendas
  from public.metas m cross join limites l cross join permissao p
  where p.admin and m.periodo_tipo='mensal'
    and make_date(m.ano,m.periodo,1)>=date_trunc('month',l.inicio)::date
    and make_date(m.ano,m.periodo,1)<l.fim
),
fluxo as (
  select
    (select count(*)::integer from public.leads le where le.criado_em>=l.inicio_ts and le.criado_em<l.fim_ts
      and not exists(select 1 from public.negocios n where n.lead_id=le.id and n.stage_id=public.aquario_stage_id())) leads,
    (select count(*)::integer from public.negocios n where n.criado_em>=l.inicio_ts and n.criado_em<l.fim_ts
      and n.stage_id is distinct from public.aquario_stage_id()) negocios,
    (select count(distinct w.conversa_id)::integer from public.wa_mensagens w
      where coalesce(w.enviado_em,w.criado_em)>=l.inicio_ts and coalesce(w.enviado_em,w.criado_em)<l.fim_ts) conversas,
    (select count(*)::integer from public.visitas v where v.data>=l.inicio and v.data<l.fim) visitas_marcadas,
    (select count(*)::integer from public.visitas v where v.data>=l.inicio and v.data<l.fim and v.status='realizada') visitas_realizadas,
    (select count(*)::integer from public.visitas v where v.data>=l.inicio and v.data<l.fim and v.status='cancelada') visitas_canceladas
  from limites l cross join permissao p where p.admin
),
fluxo_anterior as (
  select
    (select count(distinct w.conversa_id)::integer from public.wa_mensagens w
      where coalesce(w.enviado_em,w.criado_em)>=l.anterior_inicio_ts and coalesce(w.enviado_em,w.criado_em)<l.inicio_ts) conversas,
    (select count(*)::integer from public.visitas v where v.data>=l.anterior_inicio and v.data<l.inicio) visitas_marcadas,
    (select count(*)::integer from public.visitas v where v.data>=l.anterior_inicio and v.data<l.inicio and v.status='realizada') visitas_realizadas
  from limites l cross join permissao p where p.admin
),
carteira as (
  select f.corretor_id,
    count(*) filter(where f.descartado_em is null and f.etapa<>'pescado')::integer ativa,
    count(*) filter(where f.descartado_em is null and f.etapa<>'pescado' and f.proxima_acao_em<now())::integer vencidas,
    count(*) filter(where f.descartado_em is null and f.etapa<>'pescado' and f.proxima_acao_em>=now())::integer em_dia,
    count(*) filter(where f.descartado_em is null and f.etapa<>'pescado' and f.proxima_acao_em is null)::integer sem_proxima_acao,
    count(*) filter(where f.descartado_em is null and f.etapa='visita')::integer em_visita,
    count(*) filter(where f.descartado_em is null and f.etapa<>'pescado' and f.atualizado_em>=l.inicio_ts and f.atualizado_em<l.fim_ts)::integer movimentados
  from public.f2_lead f join cor c on c.id=f.corretor_id
  cross join limites l
  group by f.corretor_id
),
dapi as (
  select wi.corretor_id,count(*)::integer mensagens,count(distinct w.conversa_id)::integer conversas,
    count(*) filter(where w.direcao='enviada')::integer enviadas,
    count(*) filter(where w.direcao='recebida')::integer recebidas,
    count(*) filter(where w.direcao='enviada' and w.tipo='texto')::integer textos_enviados,
    count(*) filter(where w.direcao='enviada' and w.tipo='audio')::integer audios_enviados,
    count(*) filter(where w.direcao='enviada' and w.tipo='imagem')::integer imagens_enviadas,
    count(*) filter(where w.direcao='enviada' and w.tipo='video')::integer videos_enviados,
    count(*) filter(where w.direcao='enviada' and w.tipo='documento')::integer documentos_enviados,
    count(*) filter(where w.direcao='enviada' and w.status in ('delivered','entregue','lido'))::integer entregues_confirmadas,
    count(*) filter(where w.direcao='enviada' and w.status='lido')::integer lidas_confirmadas,
    count(distinct (coalesce(w.enviado_em,w.criado_em) at time zone 'America/Sao_Paulo')::date)::integer dias,
    min(coalesce(w.enviado_em,w.criado_em)) primeira_mensagem,
    max(coalesce(w.enviado_em,w.criado_em)) ultima_mensagem
  from public.wa_mensagens w join public.wa_instancias wi on wi.id=w.instancia_id
  join cor c on c.id=wi.corretor_id cross join limites l
  where coalesce(w.enviado_em,w.criado_em)>=l.inicio_ts and coalesce(w.enviado_em,w.criado_em)<l.fim_ts
  group by wi.corretor_id
),
dapi_conversa_raw as (
  select wi.corretor_id,w.conversa_id,
    bool_or(w.direcao='enviada') teve_envio,bool_or(w.direcao='recebida') teve_resposta
  from public.wa_mensagens w join public.wa_instancias wi on wi.id=w.instancia_id
  join cor c on c.id=wi.corretor_id cross join limites l
  where coalesce(w.enviado_em,w.criado_em)>=l.inicio_ts and coalesce(w.enviado_em,w.criado_em)<l.fim_ts
  group by wi.corretor_id,w.conversa_id
),
dapi_conversas as (
  select corretor_id,count(*) filter(where teve_envio)::integer contatos_trabalhados,
    count(*) filter(where teve_envio and teve_resposta)::integer contatos_bilaterais
  from dapi_conversa_raw group by corretor_id
),
mensagens_ordenadas as (
  select wi.corretor_id,w.conversa_id,w.direcao,coalesce(w.enviado_em,w.criado_em) ocorrido_em,
    lag(w.direcao) over(partition by w.conversa_id order by coalesce(w.enviado_em,w.criado_em),w.id) direcao_anterior,
    lag(coalesce(w.enviado_em,w.criado_em)) over(partition by w.conversa_id order by coalesce(w.enviado_em,w.criado_em),w.id) ocorrido_anterior
  from public.wa_mensagens w join public.wa_instancias wi on wi.id=w.instancia_id
  join cor c on c.id=wi.corretor_id cross join limites l
  where coalesce(w.enviado_em,w.criado_em)>=l.inicio_ts and coalesce(w.enviado_em,w.criado_em)<l.fim_ts
),
tempos_resposta as (
  select corretor_id,count(*) filter(where direcao='enviada' and direcao_anterior='recebida')::integer amostra_agente,
    round(percentile_cont(.5) within group(order by extract(epoch from (ocorrido_em-ocorrido_anterior))/60)
      filter(where direcao='enviada' and direcao_anterior='recebida')::numeric,1) agente_p50,
    round(percentile_cont(.75) within group(order by extract(epoch from (ocorrido_em-ocorrido_anterior))/60)
      filter(where direcao='enviada' and direcao_anterior='recebida')::numeric,1) agente_p75,
    round(percentile_cont(.9) within group(order by extract(epoch from (ocorrido_em-ocorrido_anterior))/60)
      filter(where direcao='enviada' and direcao_anterior='recebida')::numeric,1) agente_p90,
    round(100.0*count(*) filter(where direcao='enviada' and direcao_anterior='recebida' and ocorrido_em-ocorrido_anterior<=interval '2 minutes')/nullif(count(*) filter(where direcao='enviada' and direcao_anterior='recebida'),0),1) sla_2,
    round(100.0*count(*) filter(where direcao='enviada' and direcao_anterior='recebida' and ocorrido_em-ocorrido_anterior<=interval '5 minutes')/nullif(count(*) filter(where direcao='enviada' and direcao_anterior='recebida'),0),1) sla_5,
    round(100.0*count(*) filter(where direcao='enviada' and direcao_anterior='recebida' and ocorrido_em-ocorrido_anterior<=interval '15 minutes')/nullif(count(*) filter(where direcao='enviada' and direcao_anterior='recebida'),0),1) sla_15_turno,
    round(100.0*count(*) filter(where direcao='enviada' and direcao_anterior='recebida' and ocorrido_em-ocorrido_anterior<=interval '60 minutes')/nullif(count(*) filter(where direcao='enviada' and direcao_anterior='recebida'),0),1) sla_60,
    count(*) filter(where direcao='recebida' and direcao_anterior='enviada')::integer amostra_cliente,
    round(percentile_cont(.5) within group(order by extract(epoch from (ocorrido_em-ocorrido_anterior))/60)
      filter(where direcao='recebida' and direcao_anterior='enviada')::numeric,1) cliente_p50
  from mensagens_ordenadas group by corretor_id
),
uso_erp as (
  select a.corretor_id,
    round(sum(least(300, greatest(60, extract(epoch from (a.ultimo_em-a.primeiro_em))+60)))/60.0)::integer minutos_ativos,
    count(distinct (a.bloco_em at time zone 'America/Sao_Paulo')::date)::integer dias_com_acesso,
    max(a.ultimo_em) ultimo_acesso
  from public.performance_atividade_app a join cor c on c.id=a.corretor_id cross join limites l
  where a.bloco_em>=l.inicio_ts and a.bloco_em<l.fim_ts
  group by a.corretor_id
),
execucao_dia as (
  select pe.corretor_id,(pe.ocorrido_em at time zone 'America/Sao_Paulo')::date dia,
    min(pe.ocorrido_em) primeira_acao,max(pe.ocorrido_em) ultima_acao,
    count(distinct date_bin(interval '5 minutes',pe.ocorrido_em,'2000-01-01 00:00+00'::timestamptz)) blocos
  from public.perf_eventos pe join cor c on c.id=pe.corretor_id cross join limites l
  where pe.ocorrido_em>=l.inicio_ts and pe.ocorrido_em<l.fim_ts
    and pe.tipo not in ('online','login','lead_recebido','lead_criado','mensagem_recebida','audio_recebido','imagem_recebida','video_recebido','documento_recebido','figurinha_recebida','reacao_recebida')
  group by pe.corretor_id,(pe.ocorrido_em at time zone 'America/Sao_Paulo')::date
),
execucao as (
  select corretor_id,count(*)::integer dias_com_execucao,sum(blocos)::integer blocos_produtivos,
    (sum(blocos)*5)::integer minutos_produtivos_estimados,
    round(avg(extract(epoch from (ultima_acao-primeira_acao))/60)::numeric,1) amplitude_media_dia_min
  from execucao_dia group by corretor_id
),
disponibilidade as (
  select pe.corretor_id,
    count(distinct (pe.ocorrido_em at time zone 'America/Sao_Paulo')::date)::integer dias_disponiveis,
    count(*) filter(where pe.tipo='login')::integer logins
  from public.perf_eventos pe join cor c on c.id=pe.corretor_id cross join limites l
  where pe.ocorrido_em>=l.inicio_ts and pe.ocorrido_em<l.fim_ts and pe.tipo in ('online','login')
  group by pe.corretor_id
),
tarefas as (
  select t.corretor_id,
    count(*) filter(where t.criado_em>=l.inicio_ts and t.criado_em<l.fim_ts)::integer criadas,
    count(*) filter(where t.criado_em>=l.inicio_ts and t.criado_em<l.fim_ts and t.concluida)::integer concluidas_da_coorte,
    count(*) filter(where t.vencimento>=l.inicio_ts and t.vencimento<l.fim_ts)::integer devidas,
    count(*) filter(where not t.concluida and t.vencimento<now())::integer backlog_vencido,
    count(*) filter(where not t.concluida and t.vencimento>=now())::integer backlog_futuro
  from public.crm_tarefas t join cor c on c.id=t.corretor_id cross join limites l group by t.corretor_id
),
ncrm_trabalho as (
  select e.corretor_id_no_evento corretor_id,
    count(*) filter(where e.tipo='acao_comercial')::integer acoes_comerciais,
    count(*) filter(where e.tipo='tentativa')::integer tentativas,
    count(*) filter(where e.tipo='resposta_cliente')::integer respostas_cliente,
    count(*) filter(where e.tipo='mudanca_etapa')::integer mudancas_etapa,
    count(*) filter(where e.tipo='transferencia')::integer transferencias,
    count(distinct e.negocio_id) filter(where e.tipo in ('acao_comercial','tentativa','resposta_cliente','mudanca_etapa'))::integer negocios_trabalhados
  from public.ncrm_evento e join cor c on c.id=e.corretor_id_no_evento cross join limites l
  where e.criado_em>=l.inicio_ts and e.criado_em<l.fim_ts group by e.corretor_id_no_evento
),
f2_trabalho as (
  select c.id corretor_id,
    count(*) filter(where e.tipo='acao_confirmada')::integer acoes_confirmadas,
    count(*) filter(where e.tipo='momento_alterado')::integer momentos_alterados,
    count(*) filter(where e.tipo='nota_adicionada')::integer notas,
    count(*) filter(where e.tipo='lead_descartado')::integer descartes,
    count(distinct e.funil_lead_id) filter(where e.tipo in ('acao_confirmada','momento_alterado','nota_adicionada','lead_descartado'))::integer leads_movimentados
  from public.f2_evento e join cor c on c.usuario_id=e.criado_por cross join limites l
  where e.criado_em>=l.inicio_ts and e.criado_em<l.fim_ts group by c.id
),
leads_corretor as (
  select le.corretor_id,count(*)::integer recebidos
  from public.leads le join cor c on c.id=le.corretor_id cross join limites l
  where le.criado_em>=l.inicio_ts and le.criado_em<l.fim_ts
    and not exists(select 1 from public.negocios aq where aq.lead_id=le.id and aq.stage_id=public.aquario_stage_id())
  group by le.corretor_id
),
visitas_corretor as (
  select v.corretor_id,count(*)::integer marcadas,
    count(*) filter(where v.status='realizada')::integer realizadas,
    count(*) filter(where v.status='cancelada')::integer canceladas,
    count(*) filter(where v.status='realizada' and v.resultado_em is not null)::integer feedbacks
  from public.visitas v join cor c on c.id=v.corretor_id cross join limites l
  where v.data>=l.inicio and v.data<l.fim group by v.corretor_id
),
respostas as (
  select pe.corretor_id,count(*)::integer amostra,
    round(percentile_cont(.5) within group(order by pe.valor)::numeric,1) mediana_min,
    round(100.0*count(*) filter(where pe.valor<=15)/nullif(count(*),0),1) sla_15
  from public.perf_eventos pe join cor c on c.id=pe.corretor_id cross join limites l
  where pe.tipo='primeira_resposta' and pe.valor is not null
    and pe.ocorrido_em>=l.inicio_ts and pe.ocorrido_em<l.fim_ts
  group by pe.corretor_id
),
qualidade_ia as (
  select n.corretor_id,count(*)::integer amostra,round(avg(n.nota_geral),1) nota,
    round(avg(n.clareza),1) clareza,round(avg(n.cordialidade),1) cordialidade,
    round(avg(n.personalizacao),1) personalizacao,round(avg(n.qualificacao),1) qualificacao,
    round(avg(n.conducao),1) conducao,round(avg(n.objecoes),1) objecoes,round(avg(n.escrita),1) escrita,
    coalesce(sum(n.msgs_avaliadas),0)::integer mensagens_avaliadas
  from public.ia_notas_atendimento n join cor c on c.id=n.corretor_id cross join limites l
  where n.avaliado_em>=l.inicio_ts and n.avaliado_em<l.fim_ts group by n.corretor_id
),
venda_corretor_raw as (
  select c.id corretor_id,v.id venda_id,v.status::text status,v.vgv*coalesce(vc.fracao,1) vgv
  from public.vendas v join public.venda_corretores vc on vc.venda_id=v.id
  join cor c on c.usuario_id=vc.corretor_id cross join limites l
  where v.data_venda>=l.inicio and v.data_venda<l.fim
  union all
  select c.id,v.id,v.status::text,v.vgv
  from public.vendas v join cor c on c.id=v.corretor_id cross join limites l
  where v.data_venda>=l.inicio and v.data_venda<l.fim
    and not exists(select 1 from public.venda_corretores vc where vc.venda_id=v.id)
),
vendas_corretor as (
  select corretor_id,count(distinct venda_id) filter(where status in ('pago','concluido'))::integer vendas,
    coalesce(sum(vgv) filter(where status in ('pago','concluido')),0) vgv
  from venda_corretor_raw group by corretor_id
),
corretores_json as (
  select coalesce(jsonb_agg(jsonb_build_object(
    'corretorId',c.id,'nome',c.nome,'limiteCarteira',coalesce(c.limite_carteira,55),
    'carteiraAtiva',coalesce(k.ativa,0),'acoesVencidas',coalesce(k.vencidas,0),'emVisita',coalesce(k.em_visita,0),
    'capacidadePct',round(100.0*coalesce(k.ativa,0)/greatest(1,coalesce(c.limite_carteira,55)),1),
    'vencidasPct',case when coalesce(k.ativa,0)>0 then round(100.0*coalesce(k.vencidas,0)/k.ativa,1) end,
    'mensagens',coalesce(d.mensagens,0),'conversas',coalesce(d.conversas,0),'diasComunicando',coalesce(d.dias,0),'ultimaMensagem',d.ultima_mensagem,
    'minutosErp',coalesce(u.minutos_ativos,0),'diasComAcesso',coalesce(u.dias_com_acesso,0),'ultimoAcesso',u.ultimo_acesso,
    'visitasMarcadas',coalesce(v.marcadas,0),'visitasRealizadas',coalesce(v.realizadas,0),'visitasCanceladas',coalesce(v.canceladas,0),'visitasComFeedback',coalesce(v.feedbacks,0),
    'slaAmostra',coalesce(r.amostra,0),'medianaRespostaMin',r.mediana_min,'sla15Pct',r.sla_15,
    'iaAmostra',coalesce(q.amostra,0),'notaAtendimento',q.nota,
    'vendas',coalesce(vc.vendas,0),'vgv',coalesce(vc.vgv,0),
    'trabalho',jsonb_build_object(
      'diasComSinalDisponibilidade',coalesce(dp.dias_disponiveis,0),'logins',coalesce(dp.logins,0),
      'minutosAtivosErp',coalesce(u.minutos_ativos,0),'diasAtivosErp',coalesce(u.dias_com_acesso,0),'ultimoAcesso',u.ultimo_acesso,
      'minutosProdutivosEstimados',coalesce(ex.minutos_produtivos_estimados,0),'blocosProdutivos',coalesce(ex.blocos_produtivos,0),
      'diasComExecucao',coalesce(ex.dias_com_execucao,0),'amplitudeMediaDiaMin',ex.amplitude_media_dia_min,
      'mensagensEnviadas',coalesce(d.enviadas,0),'mensagensRecebidas',coalesce(d.recebidas,0),
      'mensagensPorDia',case when coalesce(d.dias,0)>0 then round(d.enviadas::numeric/d.dias,1) end,
      'textosEnviados',coalesce(d.textos_enviados,0),'audiosEnviados',coalesce(d.audios_enviados,0),
      'imagensEnviadas',coalesce(d.imagens_enviadas,0),'videosEnviados',coalesce(d.videos_enviados,0),'documentosEnviados',coalesce(d.documentos_enviados,0),
      'primeiraMensagem',d.primeira_mensagem,'ultimaMensagem',d.ultima_mensagem,
      'contatosTrabalhados',coalesce(dc.contatos_trabalhados,0),'contatosBilaterais',coalesce(dc.contatos_bilaterais,0),
      'taxaRespostaPct',case when coalesce(dc.contatos_trabalhados,0)>0 then round(100.0*dc.contatos_bilaterais/dc.contatos_trabalhados,1) end,
      'entreguesConfirmadas',coalesce(d.entregues_confirmadas,0),'lidasConfirmadas',coalesce(d.lidas_confirmadas,0),
      'acoesComerciais',coalesce(nt.acoes_comerciais,0),'tentativas',coalesce(nt.tentativas,0),'respostasCliente',coalesce(nt.respostas_cliente,0),
      'mudancasEtapa',coalesce(nt.mudancas_etapa,0),'transferencias',coalesce(nt.transferencias,0),'negociosTrabalhados',coalesce(nt.negocios_trabalhados,0)
    ),
    'atendimento',jsonb_build_object(
      'amostraTurnos',coalesce(tr.amostra_agente,0),'respostaP50Min',tr.agente_p50,'respostaP75Min',tr.agente_p75,'respostaP90Min',tr.agente_p90,
      'sla2Pct',tr.sla_2,'sla5Pct',tr.sla_5,'sla15Pct',tr.sla_15_turno,'sla60Pct',tr.sla_60,
      'amostraRespostaCliente',coalesce(tr.amostra_cliente,0),'respostaClienteP50Min',tr.cliente_p50,
      'iaAmostra',coalesce(q.amostra,0),'iaMensagensAvaliadas',coalesce(q.mensagens_avaliadas,0),'notaGeral',q.nota,
      'clareza',q.clareza,'cordialidade',q.cordialidade,'personalizacao',q.personalizacao,
      'qualificacao',q.qualificacao,'conducao',q.conducao,'objecoes',q.objecoes,'escrita',q.escrita
    ),
    'meuDia',jsonb_build_object(
      'tarefasCriadas',coalesce(t.criadas,0),'tarefasConcluidasCoorte',coalesce(t.concluidas_da_coorte,0),'tarefasDevidas',coalesce(t.devidas,0),
      'taxaConclusaoCoortePct',case when coalesce(t.criadas,0)>0 then round(100.0*t.concluidas_da_coorte/t.criadas,1) end,
      'backlogVencido',coalesce(t.backlog_vencido,0),'backlogFuturo',coalesce(t.backlog_futuro,0),
      'acoesConfirmadas',coalesce(ft.acoes_confirmadas,0),'momentosAlterados',coalesce(ft.momentos_alterados,0),
      'notasAdicionadas',coalesce(ft.notas,0),'descartes',coalesce(ft.descartes,0),'leadsMovimentados',coalesce(ft.leads_movimentados,0),
      'carteiraAtiva',coalesce(k.ativa,0),'carteiraEmDia',coalesce(k.em_dia,0),'acoesVencidas',coalesce(k.vencidas,0),
      'semProximaAcao',coalesce(k.sem_proxima_acao,0),'carteiraMovimentadaPeriodo',coalesce(k.movimentados,0),
      'coberturaCarteiraPct',case when coalesce(k.ativa,0)>0 then round(100.0*k.em_dia/k.ativa,1) end
    ),
    'producao',jsonb_build_object(
      'leadsRecebidos',coalesce(lc.recebidos,0),'contatosTrabalhados',coalesce(dc.contatos_trabalhados,0),
      'conversasBilaterais',coalesce(dc.contatos_bilaterais,0),'visitasMarcadas',coalesce(v.marcadas,0),
      'visitasRealizadas',coalesce(v.realizadas,0),'visitasCanceladas',coalesce(v.canceladas,0),'visitasComFeedback',coalesce(v.feedbacks,0),
      'vendas',coalesce(vc.vendas,0),'vgv',coalesce(vc.vgv,0)
    )
  ) order by c.nome),'[]'::jsonb) dados
  from cor c left join carteira k on k.corretor_id=c.id left join dapi d on d.corretor_id=c.id left join dapi_conversas dc on dc.corretor_id=c.id
  left join tempos_resposta tr on tr.corretor_id=c.id left join uso_erp u on u.corretor_id=c.id
  left join execucao ex on ex.corretor_id=c.id left join disponibilidade dp on dp.corretor_id=c.id
  left join tarefas t on t.corretor_id=c.id left join ncrm_trabalho nt on nt.corretor_id=c.id
  left join f2_trabalho ft on ft.corretor_id=c.id left join leads_corretor lc on lc.corretor_id=c.id
  left join visitas_corretor v on v.corretor_id=c.id left join respostas r on r.corretor_id=c.id
  left join qualidade_ia q on q.corretor_id=c.id left join vendas_corretor vc on vc.corretor_id=c.id
),
riscos as (
  select coalesce(sum(k.ativa),0)::integer carteira_ativa,coalesce(sum(k.vencidas),0)::integer acoes_vencidas,
    count(*) filter(where coalesce(k.ativa,0)>coalesce(c.limite_carteira,55))::integer corretores_sobrecarregados,
    coalesce(sum(v.realizadas-v.feedbacks),0)::integer visitas_sem_feedback
  from cor c left join carteira k on k.corretor_id=c.id left join visitas_corretor v on v.corretor_id=c.id
),
pipeline_quente as (
  select count(*)::integer oportunidades,
    count(*) filter(where n.valor is not null and n.valor>0)::integer com_valor,
    coalesce(sum(n.valor) filter(where n.valor is not null and n.valor>0),0) valor_informado
  from public.negocios n join public.pipeline_stages ps on ps.id=n.stage_id cross join permissao p
  where p.admin and n.status='aberto' and n.stage_id is distinct from public.aquario_stage_id()
    and (lower(ps.nome) like '%visita%' or lower(ps.nome) like '%negocia%' or lower(ps.nome) like '%comprou%' or lower(ps.nome) like '%fechado%')
),
qualidade_dado as (
  select
    (select count(*)::integer from public.negocios n where n.stage_id is distinct from public.aquario_stage_id()) negocios_operacionais,
    (select count(*)::integer from public.negocios n where n.stage_id is distinct from public.aquario_stage_id() and n.valor is not null and n.valor>0) negocios_com_valor,
    (select count(*)::integer from public.vendas) vendas_total,
    (select count(*)::integer from public.vendas v where exists(select 1 from public.negocios n where n.venda_id=v.id)) vendas_vinculadas,
    (select count(*)::integer from public.visitas where status='realizada') visitas_realizadas,
    (select count(*)::integer from public.visitas where status='realizada' and resultado_em is not null) visitas_com_feedback,
    (select count(*)::integer from public.leads le where not exists(select 1 from public.negocios n where n.lead_id=le.id and n.stage_id=public.aquario_stage_id())) leads_operacionais,
    (select count(*)::integer from public.leads le where nullif(trim(le.origem),'') is not null
      and not exists(select 1 from public.negocios n where n.lead_id=le.id and n.stage_id=public.aquario_stage_id())) leads_com_origem,
    (select count(*)::integer from public.negocios where status='perdido') perdas,
    (select count(*)::integer from public.negocios where status='perdido' and nullif(trim(coalesce(motivo_perda,descarte_motivo)),'') is not null) perdas_com_motivo
  from permissao p where p.admin
),
origens as (
  select coalesce(jsonb_agg(to_jsonb(x) order by x.leads desc),'[]'::jsonb) dados from (
    select coalesce(nullif(trim(le.origem),''),'Sem origem') origem,count(*)::integer leads,
      count(distinct n.id) filter(where n.stage_id is distinct from public.aquario_stage_id())::integer negocios,
      count(distinct v.id) filter(where v.status::text in ('pago','concluido'))::integer vendas_vinculadas,
      coalesce(sum(v.vgv) filter(where v.status::text in ('pago','concluido')),0) vgv_vinculado
    from public.leads le cross join limites l cross join permissao p
    left join public.negocios n on n.lead_id=le.id left join public.vendas v on v.id=n.venda_id
    where p.admin and le.criado_em>=l.inicio_ts and le.criado_em<l.fim_ts
      and not exists(select 1 from public.negocios aq where aq.lead_id=le.id and aq.stage_id=public.aquario_stage_id())
    group by coalesce(nullif(trim(le.origem),''),'Sem origem') order by count(*) desc limit 10
  ) x
)
select jsonb_build_object(
  'periodo',jsonb_build_object('inicio',l.inicio,'fim',l.fim,'anteriorInicio',l.anterior_inicio,'anteriorFim',l.inicio),
  'empresa',case when p.admin then jsonb_build_object(
    'vendas',vp.vendas,'vgv',vp.vgv,'vendasPendentes',vp.pendentes,'vgvPendente',vp.vgv_pendente,
    'receitaBruta',vp.receita_bruta,'custos',vp.custos,'margemContribuicao',vp.receita_bruta-vp.custos,
    'metaVgv',m.meta_vgv,'metaVendas',m.meta_vendas,
    'atingimentoVgvPct',case when m.meta_vgv>0 then round(100.0*vp.vgv/m.meta_vgv,1) end,
    'anterior',jsonb_build_object('vendas',va.vendas,'vgv',va.vgv,'conversas',fa.conversas,'visitasMarcadas',fa.visitas_marcadas,'visitasRealizadas',fa.visitas_realizadas),
    'fluxo',jsonb_build_object('leads',f.leads,'negocios',f.negocios,'conversas',f.conversas,'visitasMarcadas',f.visitas_marcadas,'visitasRealizadas',f.visitas_realizadas,'visitasCanceladas',f.visitas_canceladas),
    'riscos',to_jsonb(ri),'pipelineQuente',to_jsonb(pq)
  ) else null end,
  'corretores',cj.dados,
  'qualidadeDado',case when p.admin then to_jsonb(qd) else null end,
  'origens',case when p.admin then o.dados else '[]'::jsonb end
)
from limites l cross join permissao p cross join corretores_json cj
left join vendas_periodo vp on p.admin left join vendas_anterior va on p.admin left join metas m on p.admin
left join fluxo f on p.admin left join fluxo_anterior fa on p.admin left join riscos ri on true
left join pipeline_quente pq on p.admin left join qualidade_dado qd on p.admin left join origens o on p.admin;
$function$;

revoke all on function public.performance_sala_comando(date,date) from public,anon;
grant execute on function public.performance_sala_comando(date,date) to authenticated,service_role;

-- A Sala de Comando substitui integralmente as três RPCs intermediárias.
-- Se surgir um consumidor não mapeado, a migração falha fechada.
drop function if exists public.performance_painel(date,date);
drop function if exists public.performance_resumo_empresa(date,date);
drop function if exists public.performance_bolsao_ajustes(date,date);
