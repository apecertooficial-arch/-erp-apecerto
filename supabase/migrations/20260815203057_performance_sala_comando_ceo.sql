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
    count(*) filter(where f.descartado_em is null and f.etapa='visita')::integer em_visita
  from public.f2_lead f join cor c on c.id=f.corretor_id
  group by f.corretor_id
),
dapi as (
  select wi.corretor_id,count(*)::integer mensagens,count(distinct w.conversa_id)::integer conversas,
    count(distinct (coalesce(w.enviado_em,w.criado_em) at time zone 'America/Sao_Paulo')::date)::integer dias,
    max(coalesce(w.enviado_em,w.criado_em)) ultima_mensagem
  from public.wa_mensagens w join public.wa_instancias wi on wi.id=w.instancia_id
  join cor c on c.id=wi.corretor_id cross join limites l
  where coalesce(w.enviado_em,w.criado_em)>=l.inicio_ts and coalesce(w.enviado_em,w.criado_em)<l.fim_ts
  group by wi.corretor_id
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
  select n.corretor_id,count(*)::integer amostra,round(avg(n.nota_geral),1) nota
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
    'vendas',coalesce(vc.vendas,0),'vgv',coalesce(vc.vgv,0)
  ) order by c.nome),'[]'::jsonb) dados
  from cor c left join carteira k on k.corretor_id=c.id left join dapi d on d.corretor_id=c.id left join uso_erp u on u.corretor_id=c.id
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
