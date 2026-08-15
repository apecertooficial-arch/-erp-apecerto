-- Resumo oficial da empresa. Mantém totais corporativos independentes do
-- rateio por corretor e evidencia registros que ainda não têm responsável.

create or replace function public.performance_resumo_empresa(
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
autorizacao as (
  select public.can_manage_all() pode
),
origem as (
  select min(data)::date inicio
  from (
    select min(l.criado_em) data from public.leads l
    union all select min(coalesce(w.enviado_em,w.criado_em)) from public.wa_mensagens w
    union all select min(v.data_venda::timestamptz) from public.vendas v
  ) x
),
limites as (
  select greatest(p_inicio,coalesce(o.inicio,p_inicio)) inicio,p_fim fim,
    (greatest(p_inicio,coalesce(o.inicio,p_inicio))::timestamp at time zone 'America/Sao_Paulo') inicio_ts,
    (p_fim::timestamp at time zone 'America/Sao_Paulo') fim_ts
  from origem o cross join autorizacao a
  where a.pode and p_inicio is not null and p_fim is not null and p_fim>p_inicio and p_fim-p_inicio<=36525
),
financeiro as (
  select
    count(*) filter (where v.status in ('concluido','pago'))::integer vendas,
    count(*) filter (where v.status='pago')::integer vendas_pagas,
    count(*) filter (where v.status='concluido')::integer vendas_concluidas,
    count(*) filter (where v.status='pendente')::integer vendas_pendentes,
    coalesce(sum(v.vgv) filter (where v.status in ('concluido','pago')),0) vgv,
    coalesce(sum(v.vgv) filter (where v.status='pendente'),0) vgv_pendente,
    coalesce(sum(v.vgv*coalesce(v.percentual_comissao,0)) filter (where v.status in ('concluido','pago')),0) comissao_bruta,
    coalesce(sum(v.custos) filter (where v.status in ('concluido','pago')),0) custos
  from public.vendas v cross join limites l
  where v.data_venda>=l.inicio and v.data_venda<l.fim
),
comissao as (
  select
    coalesce(sum(coalesce(c.valor_final,c.valor_calculado)) filter (where c.papel='corretor'),0) corretores,
    coalesce(sum(coalesce(c.valor_final,c.valor_calculado)) filter (where c.papel='apecerto'),0) empresa,
    coalesce(sum(coalesce(c.valor_final,c.valor_calculado)) filter (where c.papel='executivo'),0) executivos,
    coalesce(sum(coalesce(c.valor_final,c.valor_calculado)) filter (where c.papel='indicacao'),0) indicacoes
  from public.comissoes c join public.vendas v on v.id=c.venda_id cross join limites l
  where v.data_venda>=l.inicio and v.data_venda<l.fim
),
cadastros as (
  select
    (select count(*) from public.leads x where x.criado_em>=l.inicio_ts and x.criado_em<l.fim_ts)::integer leads,
    (select count(*) from public.leads x where x.criado_em>=l.inicio_ts and x.criado_em<l.fim_ts and x.corretor_id is not null)::integer leads_atribuidos,
    (select count(*) from public.negocios x where x.criado_em>=l.inicio_ts and x.criado_em<l.fim_ts)::integer negocios,
    (select count(*) from public.negocios x where x.criado_em>=l.inicio_ts and x.criado_em<l.fim_ts and x.corretor_id is not null)::integer negocios_atribuidos
  from limites l
),
processos as (
  select count(*)::integer total,count(*) filter (where vp.prazo_em<now())::integer vencidos,
    count(*) filter (where vp.etapa='registrada')::integer registrados,
    count(*) filter (where vp.etapa='doc_vend')::integer documentacao
  from public.venda_processos vp cross join limites l
  where vp.criado_em>=l.inicio_ts and vp.criado_em<l.fim_ts
),
cobertura as (
  select 1 ordem,'D-API · mensagens brutas' fonte,count(*)::bigint registros,
    count(*) filter (where wi.corretor_id is not null)::bigint atribuidos,
    min(coalesce(w.enviado_em,w.criado_em)) primeiro,max(coalesce(w.enviado_em,w.criado_em)) ultimo
  from public.wa_mensagens w left join public.wa_instancias wi on wi.id=w.instancia_id cross join limites l
  where coalesce(w.enviado_em,w.criado_em)>=l.inicio_ts and coalesce(w.enviado_em,w.criado_em)<l.fim_ts
  union all
  select 2,'Eventos semânticos de atendimento',count(*),count(*) filter (where pe.corretor_id is not null),min(pe.ocorrido_em),max(pe.ocorrido_em)
  from public.perf_eventos pe cross join limites l
  where pe.ocorrido_em>=l.inicio_ts and pe.ocorrido_em<l.fim_ts
    and pe.tipo in ('followup','reativacao','lead_recebido','lead_atualizado','proposta_emitida','contrato_assinado','primeira_resposta')
  union all
  select 3,'CRM · ações e respostas',count(*),count(*) filter (where n.corretor_id_no_evento is not null),min(n.criado_em),max(n.criado_em)
  from public.ncrm_evento n cross join limites l where n.criado_em>=l.inicio_ts and n.criado_em<l.fim_ts
  union all
  select 4,'Funil 2.0 · execução',count(*),count(*) filter (where f.corretor_id is not null),min(e.criado_em),max(e.criado_em)
  from public.f2_evento e left join public.f2_lead f on f.id=e.funil_lead_id cross join limites l where e.criado_em>=l.inicio_ts and e.criado_em<l.fim_ts
  union all
  select 5,'Histórico de etapas',count(*),count(*) filter (where h.corretor_id is not null),min(h.movido_em),max(h.movido_em)
  from public.negocio_estagio_historico h cross join limites l where h.movido_em>=l.inicio_ts and h.movido_em<l.fim_ts
  union all
  select 6,'Visitas',count(*),count(*) filter (where v.corretor_id is not null),min(v.criado_em),max(v.criado_em)
  from public.visitas v cross join limites l where v.data>=l.inicio and v.data<l.fim
  union all
  select 7,'Qualidade por IA',count(*),count(*) filter (where n.corretor_id is not null),min(n.avaliado_em),max(n.avaliado_em)
  from public.ia_notas_atendimento n cross join limites l where n.avaliado_em>=l.inicio_ts and n.avaliado_em<l.fim_ts
  union all
  select 8,'Vendas e VGV',count(*),count(*) filter (where v.corretor_id is not null or exists(select 1 from public.venda_corretores vc where vc.venda_id=v.id)),
    min(v.data_venda)::timestamptz,max(v.data_venda)::timestamptz
  from public.vendas v cross join limites l where v.data_venda>=l.inicio and v.data_venda<l.fim
  union all
  select 9,'Atividade visível no ERP',count(*),count(*) filter (where a.corretor_id is not null),min(a.primeiro_em),max(a.ultimo_em)
  from public.performance_atividade_app a cross join limites l where a.bloco_em>=l.inicio_ts and a.bloco_em<l.fim_ts
)
select jsonb_build_object(
  'equipe',jsonb_build_object(
    'leadsCadastrados',cd.leads,'leadsAtribuidos',cd.leads_atribuidos,
    'negociosCadastrados',cd.negocios,'negociosAtribuidos',cd.negocios_atribuidos,
    'vendas',f.vendas,'vendasPagas',f.vendas_pagas,'vendasConcluidas',f.vendas_concluidas,'vendasPendentes',f.vendas_pendentes,
    'vgv',f.vgv,'vgvPendente',f.vgv_pendente,'comissaoBruta',f.comissao_bruta,'custos',f.custos,
    'comissaoCorretores',cm.corretores,'comissaoEmpresa',cm.empresa,'comissaoExecutivos',cm.executivos,'comissaoIndicacoes',cm.indicacoes,
    'processosVenda',p.total,'processosVendaVencidos',p.vencidos,'processosRegistrados',p.registrados,'processosDocumentacao',p.documentacao
  ),
  'cobertura',(select jsonb_agg(jsonb_build_object(
    'fonte',cv.fonte,'registros',cv.registros,'atribuidos',cv.atribuidos,
    'semAtribuicao',cv.registros-cv.atribuidos,'primeiroRegistro',cv.primeiro,'ultimoRegistro',cv.ultimo
  ) order by cv.ordem) from cobertura cv)
)
from financeiro f cross join comissao cm cross join cadastros cd cross join processos p;
$function$;

revoke all on function public.performance_resumo_empresa(date,date) from public,anon;
grant execute on function public.performance_resumo_empresa(date,date) to authenticated,service_role;
