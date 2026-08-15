-- Amplia a Central de Performance para usar todo o histórico real disponível.
-- Mensagens vêm da fonte bruta do D-API; perf_eventos fica restrita aos eventos
-- semânticos derivados, evitando contar a mesma mensagem duas vezes.

create or replace function public.performance_painel(
  p_inicio date,
  p_fim date
)
returns jsonb
language sql
stable
security definer
set search_path to 'public', 'extensions'
as $function$
with
origem_dados as (
  select min(data)::date inicio_disponivel
  from (
    select min(l.criado_em) data from public.leads l
    union all select min(coalesce(w.enviado_em, w.criado_em)) from public.wa_mensagens w
    union all select min(pe.ocorrido_em) from public.perf_eventos pe
    union all select min(n.criado_em) from public.negocios n
    union all select min(v.data_venda::timestamptz) from public.vendas v
  ) x
),
limites as (
  select
    greatest(p_inicio, coalesce(o.inicio_disponivel, p_inicio)) as inicio,
    p_fim as fim,
    (greatest(p_inicio, coalesce(o.inicio_disponivel, p_inicio))::timestamp at time zone 'America/Sao_Paulo') as inicio_ts,
    (p_fim::timestamp at time zone 'America/Sao_Paulo') as fim_ts,
    least(p_fim, timezone('America/Sao_Paulo', now())::date + 1) as fim_observado
  from origem_dados o
  where p_inicio is not null and p_fim is not null and p_fim > p_inicio
    and p_fim - p_inicio <= 36525
),
dias as (
  select count(*) filter (where extract(isodow from d)::int between 1 and 5)::integer dias_uteis
  from limites l
  left join lateral generate_series(l.inicio, l.fim_observado - 1, interval '1 day') d on true
),
cor as (
  select c.id, c.nome, c.usuario_id, c.limite_carteira, c.online
  from public.corretores c
  where c.ativo and (public.can_manage_all() or c.id = public.current_broker_id())
),
atividade_global as (
  select min(a.bloco_em) rastreando_desde from public.performance_atividade_app a
),
dias_atividade as (
  select count(*) filter (where extract(isodow from d)::int between 1 and 5)::integer dias_uteis
  from limites l cross join atividade_global ag
  left join lateral generate_series(
    greatest(l.inicio, coalesce((ag.rastreando_desde at time zone 'America/Sao_Paulo')::date, l.fim_observado)),
    l.fim_observado - 1, interval '1 day'
  ) d on true
),
atividade as (
  select a.corretor_id,
    round(sum(least(300, greatest(60, extract(epoch from (a.ultimo_em - a.primeiro_em)) + 60))) / 60.0)::integer minutos_ativos,
    count(distinct (a.bloco_em at time zone 'America/Sao_Paulo')::date)::integer dias_com_acesso,
    min(a.primeiro_em) primeiro_acesso, max(a.ultimo_em) ultimo_acesso,
    count(*)::integer registros_fonte
  from public.performance_atividade_app a join cor c on c.id = a.corretor_id cross join limites l
  where a.bloco_em >= l.inicio_ts and a.bloco_em < l.fim_ts
  group by a.corretor_id
),
dapi as (
  select wi.corretor_id,
    count(*)::integer registros_fonte,
    count(*) filter (where w.direcao = 'enviada')::integer mensagens_enviadas,
    count(*) filter (where w.direcao = 'recebida')::integer mensagens_recebidas,
    count(*) filter (where w.direcao = 'enviada' and w.tipo = 'audio')::integer audios_enviados,
    count(*) filter (where w.direcao = 'enviada' and w.tipo = 'imagem')::integer imagens_enviadas,
    count(*) filter (where w.direcao = 'enviada' and w.tipo = 'video')::integer videos_enviados,
    count(*) filter (where w.direcao = 'enviada' and w.tipo = 'documento')::integer documentos_enviados,
    count(distinct w.conversa_id)::integer conversas,
    count(distinct (w.conversa_id, (coalesce(w.enviado_em, w.criado_em) at time zone 'America/Sao_Paulo')::date))::integer contatos_dia,
    count(distinct (coalesce(w.enviado_em, w.criado_em) at time zone 'America/Sao_Paulo')::date)::integer dias_com_comunicacao,
    min(coalesce(w.enviado_em, w.criado_em)) primeira_mensagem,
    max(coalesce(w.enviado_em, w.criado_em)) ultima_mensagem
  from public.wa_mensagens w
  join public.wa_instancias wi on wi.id = w.instancia_id
  join cor c on c.id = wi.corretor_id
  cross join limites l
  where coalesce(w.enviado_em, w.criado_em) >= l.inicio_ts
    and coalesce(w.enviado_em, w.criado_em) < l.fim_ts
  group by wi.corretor_id
),
dias_dapi as (
  select c.id corretor_id,
    count(d)::integer dias_fonte
  from cor c cross join limites l
  left join dapi w on w.corretor_id = c.id
  left join lateral generate_series(
    greatest(l.inicio, coalesce((w.primeira_mensagem at time zone 'America/Sao_Paulo')::date, l.fim_observado)),
    l.fim_observado - 1, interval '1 day'
  ) d on extract(isodow from d)::int between 1 and 5
  group by c.id
),
eventos as (
  select pe.corretor_id,
    count(*)::integer registros_fonte,
    count(*) filter (where pe.tipo = 'followup')::integer followups,
    count(*) filter (where pe.tipo = 'reativacao')::integer reativacoes,
    count(*) filter (where pe.tipo = 'lead_recebido')::integer leads_recebidos,
    count(*) filter (where pe.tipo = 'lead_atualizado')::integer leads_atualizados,
    count(*) filter (where pe.tipo = 'proposta_emitida')::integer propostas,
    count(*) filter (where pe.tipo = 'contrato_assinado')::integer contratos,
    count(distinct right(regexp_replace(coalesce(pe.meta->>'telefone', pe.meta->>'destino', ''), '[^0-9]', '', 'g'), 8))
      filter (where pe.tipo = 'primeira_resposta')::integer contatos_respondidos,
    min(pe.ocorrido_em) primeira_ocorrencia, max(pe.ocorrido_em) ultima_ocorrencia
  from public.perf_eventos pe join cor c on c.id = pe.corretor_id cross join limites l
  where pe.ocorrido_em >= l.inicio_ts and pe.ocorrido_em < l.fim_ts
    and pe.tipo in ('followup','reativacao','lead_recebido','lead_atualizado','proposta_emitida','contrato_assinado','primeira_resposta')
  group by pe.corretor_id
),
respostas as (
  select x.corretor_id, count(*)::integer amostra,
    round(percentile_cont(0.5) within group (order by x.valor)::numeric, 1) mediana_min,
    round(100.0 * count(*) filter (where x.valor <= 15) / nullif(count(*), 0), 1) sla_pct
  from (
    select pe.corretor_id, pe.valor,
      coalesce((pe.meta->>'recebida_em')::timestamptz, pe.ocorrido_em) at time zone 'America/Sao_Paulo' recebida_local
    from public.perf_eventos pe join cor c on c.id = pe.corretor_id cross join limites l
    where pe.tipo = 'primeira_resposta' and pe.valor is not null
      and pe.ocorrido_em >= l.inicio_ts and pe.ocorrido_em < l.fim_ts
  ) x
  where extract(isodow from x.recebida_local)::int between 1 and 5
    and x.recebida_local::time between time '09:30' and time '18:00'
  group by x.corretor_id
),
ncrm as (
  select n.corretor_id_no_evento corretor_id,
    count(*)::integer registros_fonte,
    count(*) filter (where n.tipo = 'acao_comercial')::integer acoes_comerciais,
    count(*) filter (where n.tipo = 'tentativa')::integer tentativas,
    count(*) filter (where n.tipo = 'resposta_cliente')::integer respostas_cliente,
    count(*) filter (where n.tipo = 'mudanca_etapa')::integer mudancas_etapa,
    count(*) filter (where n.tipo = 'transferencia')::integer transferencias,
    count(*) filter (where n.tipo = 'correcao_manual')::integer correcoes_manuais,
    count(distinct coalesce(n.negocio_id, n.lead_id))::integer entidades_trabalhadas,
    min(n.criado_em) primeira_ocorrencia, max(n.criado_em) ultima_ocorrencia
  from public.ncrm_evento n join cor c on c.id = n.corretor_id_no_evento cross join limites l
  where n.criado_em >= l.inicio_ts and n.criado_em < l.fim_ts
  group by n.corretor_id_no_evento
),
f2 as (
  select f.corretor_id,
    count(*)::integer registros_fonte,
    count(*) filter (where e.tipo = 'acao_confirmada')::integer acoes_confirmadas,
    count(*) filter (where e.tipo = 'momento_alterado')::integer momentos_alterados,
    count(*) filter (where e.tipo = 'sara_reavaliou')::integer sara_reavaliacoes,
    count(*) filter (where e.tipo = 'lead_descartado')::integer descartes_evento,
    count(distinct e.funil_lead_id)::integer leads_movimentados,
    min(e.criado_em) primeira_ocorrencia, max(e.criado_em) ultima_ocorrencia
  from public.f2_evento e join public.f2_lead f on f.id = e.funil_lead_id
  join cor c on c.id = f.corretor_id cross join limites l
  where e.criado_em >= l.inicio_ts and e.criado_em < l.fim_ts
  group by f.corretor_id
),
estagios as (
  select h.corretor_id, count(*)::integer movimentacoes,
    count(distinct h.negocio_id)::integer negocios_movimentados,
    min(h.movido_em) primeira_ocorrencia, max(h.movido_em) ultima_ocorrencia
  from public.negocio_estagio_historico h join cor c on c.id = h.corretor_id cross join limites l
  where h.movido_em >= l.inicio_ts and h.movido_em < l.fim_ts
  group by h.corretor_id
),
leads_periodo as (
  select le.corretor_id, count(*)::integer leads_criados,
    min(le.criado_em) primeira_ocorrencia, max(le.criado_em) ultima_ocorrencia
  from public.leads le join cor c on c.id = le.corretor_id cross join limites l
  where le.criado_em >= l.inicio_ts and le.criado_em < l.fim_ts
  group by le.corretor_id
),
negocios_periodo as (
  select n.corretor_id, count(*)::integer negocios_criados,
    min(n.criado_em) primeira_ocorrencia, max(n.criado_em) ultima_ocorrencia
  from public.negocios n join cor c on c.id = n.corretor_id cross join limites l
  where n.criado_em >= l.inicio_ts and n.criado_em < l.fim_ts
  group by n.corretor_id
),
avaliacoes_lead as (
  select coalesce(n.corretor_id, le.corretor_id) corretor_id,
    count(*)::integer avaliacoes, round(avg(a.nota), 2) nota_media,
    count(distinct coalesce(a.negocio_id, a.lead_id))::integer entidades_avaliadas,
    min(a.criado_em) primeira_ocorrencia, max(a.criado_em) ultima_ocorrencia
  from public.lead_avaliacoes a
  left join public.negocios n on n.id = a.negocio_id
  left join public.leads le on le.id = a.lead_id
  join cor c on c.id = coalesce(n.corretor_id, le.corretor_id)
  cross join limites l
  where a.criado_em >= l.inicio_ts and a.criado_em < l.fim_ts
  group by coalesce(n.corretor_id, le.corretor_id)
),
carteira as (
  select f.corretor_id,
    count(*) filter (where f.descartado_em is null)::integer carteira_ativa,
    count(*) filter (where f.descartado_em is null and f.proxima_acao_em < now())::integer acoes_vencidas,
    count(*) filter (where f.descartado_em is null and f.proxima_acao_em >= now() and f.proxima_acao_em < now() + interval '2 hours')::integer vencem_2h,
    count(*) filter (where f.descartado_em is null and f.ultima_reavaliacao_sara_em is not null)::integer sara_cobertos,
    count(*) filter (where f.descartado_em is not null and f.descartado_em >= l.inicio_ts and f.descartado_em < l.fim_ts)::integer descartes
  from public.f2_lead f join cor c on c.id = f.corretor_id cross join limites l
  group by f.corretor_id
),
visitas as (
  select v.corretor_id, count(*)::integer visitas_marcadas,
    count(*) filter (where v.status = 'realizada')::integer visitas_realizadas,
    count(*) filter (where v.status = 'cancelada')::integer visitas_canceladas,
    count(*) filter (where v.status = 'realizada' and v.resultado_em is not null)::integer visitas_feedback,
    min(v.criado_em) primeira_ocorrencia, max(v.criado_em) ultima_ocorrencia
  from public.visitas v join cor c on c.id = v.corretor_id cross join limites l
  where v.data >= l.inicio and v.data < l.fim
  group by v.corretor_id
),
visitas_global as (
  select min(v.data) primeira_data from public.visitas v cross join limites l
  where v.data >= l.inicio and v.data < l.fim
),
qualidade as (
  select n.corretor_id, count(*)::integer avaliacoes, count(distinct n.telefone)::integer conversas_avaliadas,
    round(avg(n.nota_geral), 1) nota_geral, round(avg(n.clareza), 1) clareza,
    round(avg(n.cordialidade), 1) cordialidade, round(avg(n.personalizacao), 1) personalizacao,
    round(avg(n.qualificacao), 1) qualificacao, round(avg(n.conducao), 1) conducao,
    round(avg(n.objecoes), 1) objecoes, round(avg(n.escrita), 1) escrita,
    min(n.avaliado_em) primeira_ocorrencia, max(n.avaliado_em) ultima_ocorrencia
  from public.ia_notas_atendimento n join cor c on c.id = n.corretor_id cross join limites l
  where n.avaliado_em >= l.inicio_ts and n.avaliado_em < l.fim_ts
  group by n.corretor_id
),
tarefas as (
  select t.corretor_id, count(*)::integer tarefas_total,
    count(*) filter (where t.concluida)::integer tarefas_concluidas,
    count(*) filter (where not t.concluida and t.vencimento < now())::integer tarefas_vencidas
  from public.crm_tarefas t join cor c on c.id = t.corretor_id cross join limites l
  where coalesce(t.vencimento, t.criado_em) >= l.inicio_ts and coalesce(t.vencimento, t.criado_em) < l.fim_ts
  group by t.corretor_id
),
venda_raw as (
  select c.id corretor_id, v.id venda_id, v.status::text status,
    v.vgv * coalesce(vc.fracao, 1) vgv,
    v.vgv * coalesce(v.percentual_comissao, 0) * coalesce(vc.fracao, 1) comissao_bruta,
    coalesce(v.custos, 0) * coalesce(vc.fracao, 1) custos, v.data_venda
  from public.vendas v join public.venda_corretores vc on vc.venda_id = v.id
  join cor c on c.usuario_id = vc.corretor_id cross join limites l
  where v.data_venda >= l.inicio and v.data_venda < l.fim
  union all
  select c.id, v.id, v.status::text, v.vgv,
    v.vgv * coalesce(v.percentual_comissao, 0), coalesce(v.custos, 0), v.data_venda
  from public.vendas v join cor c on c.id = v.corretor_id cross join limites l
  where v.data_venda >= l.inicio and v.data_venda < l.fim
    and not exists (select 1 from public.venda_corretores vc where vc.venda_id = v.id)
),
vendas as (
  select corretor_id, count(distinct venda_id)::integer registros_fonte,
    count(distinct venda_id) filter (where status in ('concluido','pago'))::integer vendas,
    count(distinct venda_id) filter (where status = 'pago')::integer vendas_pagas,
    count(distinct venda_id) filter (where status = 'concluido')::integer vendas_concluidas,
    count(distinct venda_id) filter (where status = 'pendente')::integer vendas_pendentes,
    coalesce(sum(vgv) filter (where status in ('concluido','pago')), 0) vgv,
    coalesce(sum(vgv) filter (where status = 'pendente'), 0) vgv_pendente,
    coalesce(sum(comissao_bruta) filter (where status in ('concluido','pago')), 0) comissao_bruta,
    coalesce(sum(custos) filter (where status in ('concluido','pago')), 0) custos,
    min(data_venda) primeira_ocorrencia, max(data_venda) ultima_ocorrencia
  from venda_raw group by corretor_id
),
comissoes as (
  select c.id corretor_id, count(*)::integer registros_fonte,
    coalesce(sum(coalesce(co.valor_final, co.valor_calculado)), 0) comissao_final
  from public.comissoes co join public.vendas v on v.id = co.venda_id
  join cor c on c.usuario_id = co.beneficiario_id cross join limites l
  where co.papel = 'corretor' and v.data_venda >= l.inicio and v.data_venda < l.fim
  group by c.id
),
processos_venda as (
  select c.id corretor_id, count(*)::integer processos,
    count(*) filter (where vp.prazo_em < now())::integer processos_vencidos,
    count(*) filter (where vp.etapa = 'registrada')::integer etapa_registrada,
    count(*) filter (where vp.etapa = 'doc_vend')::integer etapa_documentacao
  from public.venda_processos vp join cor c on c.usuario_id = vp.responsavel_usuario_id
  cross join limites l
  where vp.criado_em >= l.inicio_ts and vp.criado_em < l.fim_ts
  group by c.id
),
metas as (
  select m.corretor_id, sum(m.meta_vgv) meta_vgv, sum(m.meta_vendas) meta_vendas
  from public.metas m cross join limites l
  where m.periodo_tipo = 'mensal'
    and make_date(m.ano, m.periodo, 1) >= date_trunc('month', l.inicio)::date
    and make_date(m.ano, m.periodo, 1) < l.fim
  group by m.corretor_id
),
fontes as (
  select
    exists(select 1 from atividade) atividade_app,
    exists(select 1 from respostas) primeira_resposta,
    exists(select 1 from qualidade) qualidade_ia,
    exists(select 1 from eventos where propostas > 0 or contratos > 0) propostas,
    exists(select 1 from public.perf_eventos pe cross join limites l where pe.tipo in ('ligacao','ligacao_atendida') and pe.ocorrido_em >= l.inicio_ts and pe.ocorrido_em < l.fim_ts) ligacoes,
    exists(select 1 from dapi) dapi,
    exists(select 1 from ncrm) crm,
    exists(select 1 from f2) funil2,
    exists(select 1 from visitas) visitas
),
base as (
  select c.*, greatest(1, d.dias_uteis) dias_uteis, greatest(1, da.dias_uteis) dias_atividade,
    greatest(1, dd.dias_fonte) dias_dapi,
    coalesce(a.minutos_ativos,0) minutos_ativos, coalesce(a.dias_com_acesso,0) dias_com_acesso,
    a.primeiro_acesso, a.ultimo_acesso,
    coalesce(w.registros_fonte,0) dapi_registros, coalesce(w.mensagens_enviadas,0) mensagens_enviadas,
    coalesce(w.mensagens_recebidas,0) mensagens_recebidas, coalesce(w.audios_enviados,0) audios_enviados,
    coalesce(w.imagens_enviadas,0) imagens_enviadas, coalesce(w.videos_enviados,0) videos_enviados,
    coalesce(w.documentos_enviados,0) documentos_enviados, coalesce(w.conversas,0) conversas,
    coalesce(w.contatos_dia,0) contatos_dia, coalesce(w.dias_com_comunicacao,0) dias_com_comunicacao,
    w.primeira_mensagem, w.ultima_mensagem,
    coalesce(e.followups,0) followups, coalesce(e.reativacoes,0) reativacoes,
    coalesce(e.leads_recebidos,0) leads_recebidos, coalesce(e.leads_atualizados,0) leads_atualizados,
    coalesce(e.contatos_respondidos,0) contatos_respondidos, coalesce(e.propostas,0) propostas,
    coalesce(e.contratos,0) contratos,
    coalesce(r.amostra,0) resposta_amostra, r.mediana_min resposta_mediana_min, r.sla_pct,
    coalesce(nc.acoes_comerciais,0) acoes_comerciais, coalesce(nc.tentativas,0) tentativas,
    coalesce(nc.respostas_cliente,0) respostas_cliente, coalesce(nc.mudancas_etapa,0) mudancas_etapa,
    coalesce(nc.transferencias,0) transferencias, coalesce(nc.correcoes_manuais,0) correcoes_manuais,
    coalesce(nc.entidades_trabalhadas,0) entidades_crm,
    coalesce(fx.acoes_confirmadas,0) f2_acoes_confirmadas, coalesce(fx.momentos_alterados,0) f2_momentos_alterados,
    coalesce(fx.sara_reavaliacoes,0) f2_sara_reavaliacoes, coalesce(fx.leads_movimentados,0) f2_leads_movimentados,
    coalesce(es.movimentacoes,0) movimentacoes_estagio, coalesce(es.negocios_movimentados,0) negocios_movimentados,
    coalesce(lp.leads_criados,0) leads_criados, coalesce(np.negocios_criados,0) negocios_criados,
    coalesce(al.avaliacoes,0) avaliacoes_lead, al.nota_media nota_lead, coalesce(al.entidades_avaliadas,0) entidades_avaliadas,
    coalesce(k.carteira_ativa,0) carteira_ativa, coalesce(k.acoes_vencidas,0) acoes_vencidas,
    coalesce(k.vencem_2h,0) vencem_2h, coalesce(k.sara_cobertos,0) sara_cobertos, coalesce(k.descartes,0) descartes,
    coalesce(vi.visitas_marcadas,0) visitas_marcadas, coalesce(vi.visitas_realizadas,0) visitas_realizadas,
    coalesce(vi.visitas_canceladas,0) visitas_canceladas, coalesce(vi.visitas_feedback,0) visitas_feedback,
    coalesce(q.avaliacoes,0) ia_avaliacoes, coalesce(q.conversas_avaliadas,0) ia_conversas,
    q.nota_geral ia_nota, q.clareza, q.cordialidade, q.personalizacao, q.qualificacao, q.conducao, q.objecoes, q.escrita,
    coalesce(t.tarefas_total,0) tarefas_total, coalesce(t.tarefas_concluidas,0) tarefas_concluidas,
    coalesce(t.tarefas_vencidas,0) tarefas_vencidas,
    coalesce(v.vendas,0) vendas, coalesce(v.vendas_pagas,0) vendas_pagas,
    coalesce(v.vendas_concluidas,0) vendas_concluidas, coalesce(v.vendas_pendentes,0) vendas_pendentes,
    coalesce(v.vgv,0) vgv, coalesce(v.vgv_pendente,0) vgv_pendente,
    coalesce(v.comissao_bruta,0) comissao_bruta, coalesce(v.custos,0) custos,
    coalesce(cm.comissao_final,0) comissao_final, coalesce(pv.processos,0) processos_venda,
    coalesce(pv.processos_vencidos,0) processos_venda_vencidos,
    coalesce(pv.etapa_registrada,0) processos_registrados, coalesce(pv.etapa_documentacao,0) processos_documentacao,
    m.meta_vgv, m.meta_vendas,
    case when coalesce(k.carteira_ativa,0)>0 then round(100.0*(k.carteira_ativa-k.acoes_vencidas)/k.carteira_ativa,1) end carteira_em_dia_pct,
    case when coalesce(vi.visitas_marcadas,0)>0 then round(100.0*vi.visitas_realizadas/vi.visitas_marcadas,1) end comparecimento_pct
  from cor c cross join dias d cross join dias_atividade da
  join dias_dapi dd on dd.corretor_id=c.id
  left join atividade a on a.corretor_id=c.id left join dapi w on w.corretor_id=c.id
  left join eventos e on e.corretor_id=c.id left join respostas r on r.corretor_id=c.id
  left join ncrm nc on nc.corretor_id=c.id left join f2 fx on fx.corretor_id=c.id
  left join estagios es on es.corretor_id=c.id left join leads_periodo lp on lp.corretor_id=c.id
  left join negocios_periodo np on np.corretor_id=c.id left join avaliacoes_lead al on al.corretor_id=c.id
  left join carteira k on k.corretor_id=c.id left join visitas vi on vi.corretor_id=c.id
  left join qualidade q on q.corretor_id=c.id left join tarefas t on t.corretor_id=c.id
  left join vendas v on v.corretor_id=c.id left join comissoes cm on cm.corretor_id=c.id
  left join processos_venda pv on pv.corretor_id=c.id left join metas m on m.corretor_id=c.id
),
notas as (
  select b.*,
    case when b.carteira_ativa>0 then least(100,round(coalesce(b.carteira_em_dia_pct,0)/85.0*100))::integer end nota_carteira,
    case when b.resposta_amostra>=5 then least(100,round(coalesce(b.sla_pct,0)/85.0*100))::integer end nota_sla,
    case when b.dapi_registros>0 then least(100,round(
      least(100,(b.contatos_dia::numeric/b.dias_dapi)/20*100)*.65 +
      least(100,(b.followups::numeric/b.dias_dapi)/10*100)*.35))::integer end nota_trabalho,
    case when f.visitas then least(100,round(b.visitas_realizadas::numeric /
      greatest(1,15*greatest(1,p_fim-greatest(p_inicio,vg.primeira_data))/30.44)*100))::integer end nota_visitas,
    case when b.ia_avaliacoes>=5 then least(100,round(coalesce(b.ia_nota,0)/75.0*100))::integer end nota_qualidade,
    case when f.atividade_app then least(100,round(b.minutos_ativos::numeric/greatest(1,b.dias_atividade*360)*100))::integer end nota_atividade
  from base b cross join fontes f cross join visitas_global vg
),
pontuado as (
  select n.*,
    ((case when nota_carteira is not null then 25 else 0 end)+(case when nota_sla is not null then 20 else 0 end)+
     (case when nota_trabalho is not null then 20 else 0 end)+(case when nota_visitas is not null then 15 else 0 end)+
     (case when nota_qualidade is not null then 10 else 0 end)+(case when nota_atividade is not null then 10 else 0 end))::integer cobertura_peso,
    round((coalesce(nota_carteira*25,0)+coalesce(nota_sla*20,0)+coalesce(nota_trabalho*20,0)+
      coalesce(nota_visitas*15,0)+coalesce(nota_qualidade*10,0)+coalesce(nota_atividade*10,0))::numeric /
      nullif((case when nota_carteira is not null then 25 else 0 end)+(case when nota_sla is not null then 20 else 0 end)+
      (case when nota_trabalho is not null then 20 else 0 end)+(case when nota_visitas is not null then 15 else 0 end)+
      (case when nota_qualidade is not null then 10 else 0 end)+(case when nota_atividade is not null then 10 else 0 end),0))::integer nota_execucao
  from notas n
),
linhas as (
  select p.nome, jsonb_build_object(
    'corretorId',p.id,'nome',p.nome,'notaExecucao',p.nota_execucao,'coberturaNotaPct',p.cobertura_peso,
    'pilares',jsonb_build_object('carteira',p.nota_carteira,'sla',p.nota_sla,'trabalho',p.nota_trabalho,'visitas',p.nota_visitas,'qualidade',p.nota_qualidade,'atividade',p.nota_atividade),
    'atividade',jsonb_build_object('minutosAtivos',p.minutos_ativos,'diasComAcesso',p.dias_com_acesso,'primeiroAcesso',p.primeiro_acesso,'ultimoAcesso',p.ultimo_acesso,'disponivelDistribuicaoAgora',p.online,
      'diasComComunicacao',p.dias_com_comunicacao,'primeiraComunicacao',p.primeira_mensagem,'ultimaComunicacao',p.ultima_mensagem),
    'trabalho',jsonb_build_object('mensagensEnviadas',p.mensagens_enviadas,'mensagensRecebidas',p.mensagens_recebidas,'audiosEnviados',p.audios_enviados,
      'imagensEnviadas',p.imagens_enviadas,'videosEnviados',p.videos_enviados,'documentosEnviados',p.documentos_enviados,
      'conversas',p.conversas,'contatosTrabalhados',p.contatos_dia,'contatosRespondidos',p.contatos_respondidos,
      'followups',p.followups,'reativacoes',p.reativacoes,'leadsRecebidos',p.leads_recebidos,'leadsAtualizados',p.leads_atualizados,
      'acoesComerciaisCrm',p.acoes_comerciais,'tentativasCrm',p.tentativas,'respostasClienteCrm',p.respostas_cliente,
      'mudancasEtapaCrm',p.mudancas_etapa,'transferenciasCrm',p.transferencias,'correcoesManuaisCrm',p.correcoes_manuais,'entidadesTrabalhadasCrm',p.entidades_crm),
    'atendimento',jsonb_build_object('amostraPrimeiraResposta',p.resposta_amostra,'medianaPrimeiraRespostaMin',p.resposta_mediana_min,'sla15Pct',p.sla_pct,
      'avaliacoesIa',p.ia_avaliacoes,'conversasAvaliadasIa',p.ia_conversas,'notaIa',p.ia_nota,'clareza',p.clareza,'cordialidade',p.cordialidade,
      'personalizacao',p.personalizacao,'qualificacao',p.qualificacao,'conducao',p.conducao,'objecoes',p.objecoes,'escrita',p.escrita),
    'carteira',jsonb_build_object('ativa',p.carteira_ativa,'limite',p.limite_carteira,'acoesVencidas',p.acoes_vencidas,'vencem2h',p.vencem_2h,
      'emDiaPct',p.carteira_em_dia_pct,'saraCobertos',p.sara_cobertos,'descartes',p.descartes),
    'visitas',jsonb_build_object('marcadas',p.visitas_marcadas,'realizadas',p.visitas_realizadas,'canceladas',p.visitas_canceladas,'comFeedback',p.visitas_feedback,'comparecimentoPct',p.comparecimento_pct),
    'processo',jsonb_build_object('propostas',case when f.propostas then p.propostas else null end,'contratos',case when f.propostas then p.contratos else null end,
      'tarefasTotal',p.tarefas_total,'tarefasConcluidas',p.tarefas_concluidas,'tarefasVencidas',p.tarefas_vencidas,
      'leadsCriados',p.leads_criados,'negociosCriados',p.negocios_criados,'movimentacoesEstagio',p.movimentacoes_estagio,'negociosMovimentados',p.negocios_movimentados,
      'f2AcoesConfirmadas',p.f2_acoes_confirmadas,'f2MomentosAlterados',p.f2_momentos_alterados,'f2SaraReavaliacoes',p.f2_sara_reavaliacoes,'f2LeadsMovimentados',p.f2_leads_movimentados,
      'avaliacoesLead',p.avaliacoes_lead,'notaMediaLead',p.nota_lead,'entidadesAvaliadas',p.entidades_avaliadas),
    'resultado',jsonb_build_object('vendas',p.vendas,'vendasPagas',p.vendas_pagas,'vendasConcluidas',p.vendas_concluidas,'vendasPendentes',p.vendas_pendentes,
      'vgv',p.vgv,'vgvPendente',p.vgv_pendente,'comissao',p.comissao_bruta,'comissaoFinal',p.comissao_final,'custos',p.custos,
      'processosVenda',p.processos_venda,'processosVendaVencidos',p.processos_venda_vencidos,'processosRegistrados',p.processos_registrados,'processosDocumentacao',p.processos_documentacao,
      'metaVgv',p.meta_vgv,'metaVendas',p.meta_vendas,'atingimentoPct',case when coalesce(p.meta_vgv,0)>0 then round(100.0*p.vgv/p.meta_vgv,1) end)
  ) item from pontuado p cross join fontes f
),
cobertura as (
  select 1 ordem,'D-API · mensagens brutas' fonte,coalesce(sum(registros_fonte),0)::bigint registros,min(primeira_mensagem) primeiro,max(ultima_mensagem) ultimo from dapi
  union all select 2,'Eventos semânticos de atendimento',coalesce(sum(registros_fonte),0),min(primeira_ocorrencia),max(ultima_ocorrencia) from eventos
  union all select 3,'CRM · ações e respostas',coalesce(sum(registros_fonte),0),min(primeira_ocorrencia),max(ultima_ocorrencia) from ncrm
  union all select 4,'Funil 2.0 · execução',coalesce(sum(registros_fonte),0),min(primeira_ocorrencia),max(ultima_ocorrencia) from f2
  union all select 5,'Histórico de etapas',coalesce(sum(movimentacoes),0),min(primeira_ocorrencia),max(ultima_ocorrencia) from estagios
  union all select 6,'Visitas',coalesce(sum(visitas_marcadas),0),min(primeira_ocorrencia),max(ultima_ocorrencia) from visitas
  union all select 7,'Qualidade por IA',coalesce(sum(avaliacoes),0),min(primeira_ocorrencia),max(ultima_ocorrencia) from qualidade
  union all select 8,'Vendas e VGV',coalesce(sum(registros_fonte),0),min(primeira_ocorrencia)::timestamptz,max(ultima_ocorrencia)::timestamptz from vendas
  union all select 9,'Atividade visível no ERP',coalesce(sum(registros_fonte),0),min(primeiro_acesso),max(ultimo_acesso) from atividade
),
meta_equipe as (
  select sum(m.meta_vgv) meta_vgv,sum(m.meta_vendas) meta_vendas from metas m where m.corretor_id is null
)
select jsonb_build_object(
  'periodo',jsonb_build_object('inicio',l.inicio,'fim',l.fim,'diasUteisObservados',d.dias_uteis,'historicoCompleto',p_inicio<l.inicio),
  'geradoEm',now(),
  'fontes',jsonb_build_object('atividadeApp',f.atividade_app,'atividadeRastreadaDesde',ag.rastreando_desde,'primeiraResposta',f.primeira_resposta,
    'qualidadeIa',f.qualidade_ia,'propostas',f.propostas,'ligacoes',f.ligacoes,'dapi',f.dapi,'crm',f.crm,'funil2',f.funil2,
    'cobertura',(select jsonb_agg(jsonb_build_object('fonte',cv.fonte,'registros',cv.registros,'primeiroRegistro',cv.primeiro,'ultimoRegistro',cv.ultimo) order by cv.ordem) from cobertura cv),
    'observacao','Mensagens são contadas uma única vez na fonte bruta do D-API. Login histórico não existia; dias com comunicação são exibidos como evidência, sem fingir horas de acesso.'),
  'metaEquipe',(select to_jsonb(me) from meta_equipe me),
  'corretores',coalesce((select jsonb_agg(item order by nome) from linhas),'[]'::jsonb)
)
from limites l cross join dias d cross join fontes f cross join atividade_global ag;
$function$;

revoke all on function public.performance_painel(date,date) from public,anon;
grant execute on function public.performance_painel(date,date) to authenticated,service_role;
