-- Central canônica de gestão de corretores.
--
-- Princípios:
--   1. disponibilidade para receber leads não é tempo de uso do ERP;
--   2. ausência de amostra não vira zero;
--   3. execução e resultado comercial são apresentados separadamente;
--   4. o painel lê fatos já existentes e acrescenta apenas a medição de
--      atividade visível no ERP, deduplicada em blocos de cinco minutos.

create table public.performance_atividade_app (
  corretor_id bigint not null references public.corretores(id) on delete cascade,
  usuario_id uuid not null references public.usuarios(id) on delete cascade,
  bloco_em timestamptz not null,
  primeiro_em timestamptz not null default now(),
  ultimo_em timestamptz not null default now(),
  sinais integer not null default 1 check (sinais between 1 and 1000),
  primary key (corretor_id, bloco_em),
  check (ultimo_em >= primeiro_em),
  check (bloco_em = date_bin(interval '5 minutes', bloco_em, '2000-01-01 00:00+00'::timestamptz))
);

comment on table public.performance_atividade_app is
  'Uso real e visível do ERP. Um registro por corretor/bloco de 5 minutos; múltiplas abas não duplicam tempo.';

create index performance_atividade_app_usuario_data_idx
  on public.performance_atividade_app (usuario_id, bloco_em desc);

alter table public.performance_atividade_app enable row level security;
revoke all on table public.performance_atividade_app from public, anon, authenticated;
grant select, insert, update, delete on table public.performance_atividade_app to service_role;

create or replace function public.performance_registrar_atividade()
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_uid uuid := auth.uid();
  v_corretor bigint;
  v_bloco timestamptz := date_bin(interval '5 minutes', now(), '2000-01-01 00:00+00'::timestamptz);
begin
  if v_uid is null then
    raise exception 'nao_autenticado' using errcode = '42501';
  end if;

  select c.id into v_corretor
  from public.corretores c
  where c.usuario_id = v_uid and c.ativo
  limit 1;

  if v_corretor is null then
    return jsonb_build_object('ok', true, 'medido', false);
  end if;

  insert into public.performance_atividade_app
    (corretor_id, usuario_id, bloco_em, primeiro_em, ultimo_em, sinais)
  values (v_corretor, v_uid, v_bloco, now(), now(), 1)
  on conflict (corretor_id, bloco_em) do update set
    ultimo_em = greatest(public.performance_atividade_app.ultimo_em, excluded.ultimo_em),
    sinais = least(1000, public.performance_atividade_app.sinais + 1);

  return jsonb_build_object('ok', true, 'medido', true, 'bloco', v_bloco);
end
$function$;

revoke all on function public.performance_registrar_atividade() from public, anon;
grant execute on function public.performance_registrar_atividade() to authenticated, service_role;

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
limites as (
  select
    p_inicio as inicio,
    p_fim as fim,
    (p_inicio::timestamp at time zone 'America/Sao_Paulo') as inicio_ts,
    (p_fim::timestamp at time zone 'America/Sao_Paulo') as fim_ts,
    least(p_fim, (timezone('America/Sao_Paulo', now())::date + 1)) as fim_observado
  where p_inicio is not null
    and p_fim is not null
    and p_fim > p_inicio
    and p_fim - p_inicio <= 370
),
dias as (
  select count(*) filter (where extract(isodow from d)::int between 1 and 5)::integer dias_uteis
  from limites l
  cross join lateral generate_series(l.inicio, l.fim_observado - 1, interval '1 day') d
),
cor as (
  select c.id, c.nome, c.usuario_id, c.limite_carteira
  from public.corretores c
  where c.ativo
    and (public.can_manage_all() or c.id = public.current_broker_id())
),
atividade_global as (
  select min(bloco_em) rastreando_desde
  from public.performance_atividade_app
),
dias_atividade as (
  select count(*) filter (where extract(isodow from d)::int between 1 and 5)::integer dias_uteis
  from limites l
  cross join atividade_global ag
  cross join lateral generate_series(
    greatest(l.inicio, (ag.rastreando_desde at time zone 'America/Sao_Paulo')::date),
    l.fim_observado - 1,
    interval '1 day'
  ) d
),
atividade as (
  select a.corretor_id,
    round(sum(least(300, greatest(60, extract(epoch from (a.ultimo_em - a.primeiro_em)) + 60))) / 60.0)::integer minutos_ativos,
    count(distinct (a.bloco_em at time zone 'America/Sao_Paulo')::date)::integer dias_com_acesso,
    min(a.primeiro_em) primeiro_acesso,
    max(a.ultimo_em) ultimo_acesso
  from public.performance_atividade_app a
  join cor c on c.id = a.corretor_id
  cross join limites l
  where a.bloco_em >= l.inicio_ts and a.bloco_em < l.fim_ts
  group by a.corretor_id
),
eventos as (
  select pe.corretor_id,
    coalesce(sum(pe.quantidade) filter (where pe.tipo = 'mensagem_enviada'), 0)::integer mensagens_enviadas,
    coalesce(sum(pe.quantidade) filter (where pe.tipo = 'mensagem_recebida'), 0)::integer mensagens_recebidas,
    coalesce(sum(pe.quantidade) filter (where pe.tipo = 'audio_enviado'), 0)::integer audios_enviados,
    count(*) filter (where pe.tipo = 'followup')::integer followups,
    count(*) filter (where pe.tipo = 'reativacao')::integer reativacoes,
    count(*) filter (where pe.tipo = 'lead_recebido')::integer leads_recebidos,
    count(*) filter (where pe.tipo = 'lead_atualizado')::integer leads_atualizados,
    count(*) filter (where pe.tipo = 'proposta_emitida')::integer propostas,
    count(*) filter (where pe.tipo = 'contrato_assinado')::integer contratos,
    count(distinct right(regexp_replace(coalesce(pe.meta->>'telefone', pe.meta->>'destino', ''), '\\D', '', 'g'), 8))
      filter (where pe.tipo in ('mensagem_enviada','audio_enviado','imagem_enviada','video_enviado','documento_enviado')
              and coalesce(pe.meta->>'telefone', pe.meta->>'destino') is not null)::integer contatos_trabalhados,
    count(distinct right(regexp_replace(coalesce(pe.meta->>'telefone', pe.meta->>'destino', ''), '\\D', '', 'g'), 8))
      filter (where pe.tipo = 'primeira_resposta')::integer contatos_respondidos
  from public.perf_eventos pe
  join cor c on c.id = pe.corretor_id
  cross join limites l
  where pe.ocorrido_em >= l.inicio_ts and pe.ocorrido_em < l.fim_ts
  group by pe.corretor_id
),
respostas as (
  select x.corretor_id,
    count(*)::integer amostra,
    round(percentile_cont(0.5) within group (order by x.valor)::numeric, 1) mediana_min,
    round(100.0 * count(*) filter (where x.valor <= 15) / nullif(count(*), 0), 1) sla_pct
  from (
    select pe.corretor_id, pe.valor,
      coalesce((pe.meta->>'recebida_em')::timestamptz, pe.ocorrido_em) at time zone 'America/Sao_Paulo' recebida_local
    from public.perf_eventos pe
    join cor c on c.id = pe.corretor_id
    cross join limites l
    where pe.tipo = 'primeira_resposta'
      and pe.valor is not null
      and pe.ocorrido_em >= l.inicio_ts and pe.ocorrido_em < l.fim_ts
  ) x
  where extract(isodow from x.recebida_local)::int between 1 and 5
    and x.recebida_local::time between time '09:30' and time '18:00'
  group by x.corretor_id
),
carteira as (
  select f.corretor_id,
    count(*) filter (where f.descartado_em is null)::integer carteira_ativa,
    count(*) filter (where f.descartado_em is null and f.proxima_acao_em < now())::integer acoes_vencidas,
    count(*) filter (where f.descartado_em is null and f.proxima_acao_em >= now() and f.proxima_acao_em < now() + interval '2 hours')::integer vencem_2h,
    count(*) filter (where f.descartado_em is null and f.ultima_reavaliacao_sara_em is not null)::integer sara_cobertos,
    count(*) filter (where f.descartado_em is not null and f.descartado_em >= l.inicio_ts and f.descartado_em < l.fim_ts)::integer descartes
  from public.f2_lead f
  join cor c on c.id = f.corretor_id
  cross join limites l
  group by f.corretor_id
),
visitas as (
  select v.corretor_id,
    count(*)::integer visitas_marcadas,
    count(*) filter (where v.status = 'realizada')::integer visitas_realizadas,
    count(*) filter (where v.status = 'cancelada')::integer visitas_canceladas,
    count(*) filter (where v.status = 'realizada' and v.resultado_em is not null)::integer visitas_feedback
  from public.visitas v
  join cor c on c.id = v.corretor_id
  cross join limites l
  where v.data >= l.inicio and v.data < l.fim
  group by v.corretor_id
),
qualidade as (
  select n.corretor_id,
    count(*)::integer avaliacoes,
    count(distinct n.telefone)::integer conversas_avaliadas,
    round(avg(n.nota_geral), 1) nota_geral,
    round(avg(n.clareza), 1) clareza,
    round(avg(n.cordialidade), 1) cordialidade,
    round(avg(n.personalizacao), 1) personalizacao,
    round(avg(n.qualificacao), 1) qualificacao,
    round(avg(n.conducao), 1) conducao,
    round(avg(n.objecoes), 1) objecoes,
    round(avg(n.escrita), 1) escrita
  from public.ia_notas_atendimento n
  join cor c on c.id = n.corretor_id
  cross join limites l
  where n.avaliado_em >= l.inicio_ts and n.avaliado_em < l.fim_ts
  group by n.corretor_id
),
tarefas as (
  select t.corretor_id,
    count(*)::integer tarefas_total,
    count(*) filter (where t.concluida)::integer tarefas_concluidas,
    count(*) filter (where not t.concluida and t.vencimento < now())::integer tarefas_vencidas
  from public.crm_tarefas t
  join cor c on c.id = t.corretor_id
  cross join limites l
  where coalesce(t.vencimento, t.criado_em) >= l.inicio_ts
    and coalesce(t.vencimento, t.criado_em) < l.fim_ts
  group by t.corretor_id
),
venda_raw as (
  select c.id corretor_id, v.id venda_id,
    v.vgv * coalesce(vc.fracao, 1) vgv,
    v.vgv * coalesce(v.percentual_comissao, 0) * coalesce(vc.fracao, 1) comissao
  from public.vendas v
  join public.venda_corretores vc on vc.venda_id = v.id
  join cor c on c.usuario_id = vc.corretor_id
  cross join limites l
  where v.status in ('concluido','pago') and v.data_venda >= l.inicio and v.data_venda < l.fim
  union all
  select c.id, v.id, v.vgv, v.vgv * coalesce(v.percentual_comissao, 0)
  from public.vendas v
  join cor c on c.id = v.corretor_id
  cross join limites l
  where v.status in ('concluido','pago') and v.data_venda >= l.inicio and v.data_venda < l.fim
    and not exists (select 1 from public.venda_corretores vc where vc.venda_id = v.id)
),
vendas as (
  select corretor_id, count(distinct venda_id)::integer vendas,
    coalesce(sum(vgv), 0) vgv, coalesce(sum(comissao), 0) comissao
  from venda_raw group by corretor_id
),
metas as (
  select m.corretor_id, sum(m.meta_vgv) meta_vgv, sum(m.meta_vendas) meta_vendas
  from public.metas m
  cross join limites l
  where m.periodo_tipo = 'mensal'
    and make_date(m.ano, m.periodo, 1) >= date_trunc('month', l.inicio)::date
    and make_date(m.ano, m.periodo, 1) < l.fim
  group by m.corretor_id
),
fontes as (
  select
    exists(select 1 from public.performance_atividade_app) atividade_app,
    exists(select 1 from public.perf_eventos where tipo = 'primeira_resposta') primeira_resposta,
    exists(select 1 from public.perf_eventos where tipo = 'proposta_emitida') propostas,
    exists(select 1 from public.perf_eventos where tipo in ('ligacao','ligacao_atendida')) ligacoes,
    exists(select 1 from public.ia_notas_atendimento) qualidade_ia
),
base as (
  select c.*,
    greatest(1, d.dias_uteis) dias_uteis,
    greatest(1, da.dias_uteis) dias_atividade,
    coalesce(a.minutos_ativos, 0) minutos_ativos,
    coalesce(a.dias_com_acesso, 0) dias_com_acesso,
    a.primeiro_acesso, a.ultimo_acesso,
    coalesce(e.mensagens_enviadas, 0) mensagens_enviadas,
    coalesce(e.mensagens_recebidas, 0) mensagens_recebidas,
    coalesce(e.audios_enviados, 0) audios_enviados,
    coalesce(e.followups, 0) followups,
    coalesce(e.reativacoes, 0) reativacoes,
    coalesce(e.leads_recebidos, 0) leads_recebidos,
    coalesce(e.leads_atualizados, 0) leads_atualizados,
    coalesce(e.contatos_trabalhados, 0) contatos_trabalhados,
    coalesce(e.contatos_respondidos, 0) contatos_respondidos,
    coalesce(e.propostas, 0) propostas,
    coalesce(e.contratos, 0) contratos,
    coalesce(r.amostra, 0) resposta_amostra,
    r.mediana_min resposta_mediana_min, r.sla_pct,
    coalesce(k.carteira_ativa, 0) carteira_ativa,
    coalesce(k.acoes_vencidas, 0) acoes_vencidas,
    coalesce(k.vencem_2h, 0) vencem_2h,
    coalesce(k.sara_cobertos, 0) sara_cobertos,
    coalesce(k.descartes, 0) descartes,
    coalesce(vi.visitas_marcadas, 0) visitas_marcadas,
    coalesce(vi.visitas_realizadas, 0) visitas_realizadas,
    coalesce(vi.visitas_canceladas, 0) visitas_canceladas,
    coalesce(vi.visitas_feedback, 0) visitas_feedback,
    coalesce(q.avaliacoes, 0) ia_avaliacoes,
    coalesce(q.conversas_avaliadas, 0) ia_conversas,
    q.nota_geral ia_nota, q.clareza, q.cordialidade, q.personalizacao,
    q.qualificacao, q.conducao, q.objecoes, q.escrita,
    coalesce(t.tarefas_total, 0) tarefas_total,
    coalesce(t.tarefas_concluidas, 0) tarefas_concluidas,
    coalesce(t.tarefas_vencidas, 0) tarefas_vencidas,
    coalesce(v.vendas, 0) vendas,
    coalesce(v.vgv, 0) vgv,
    coalesce(v.comissao, 0) comissao,
    m.meta_vgv, m.meta_vendas,
    case when coalesce(k.carteira_ativa, 0) > 0
      then round(100.0 * (k.carteira_ativa - k.acoes_vencidas) / k.carteira_ativa, 1) end carteira_em_dia_pct,
    case when coalesce(vi.visitas_marcadas, 0) > 0
      then round(100.0 * vi.visitas_realizadas / vi.visitas_marcadas, 1) end comparecimento_pct
  from cor c cross join dias d cross join dias_atividade da
  left join atividade a on a.corretor_id = c.id
  left join eventos e on e.corretor_id = c.id
  left join respostas r on r.corretor_id = c.id
  left join carteira k on k.corretor_id = c.id
  left join visitas vi on vi.corretor_id = c.id
  left join qualidade q on q.corretor_id = c.id
  left join tarefas t on t.corretor_id = c.id
  left join vendas v on v.corretor_id = c.id
  left join metas m on m.corretor_id = c.id
),
notas as (
  select b.*,
    case when b.carteira_ativa > 0 then least(100, round(coalesce(b.carteira_em_dia_pct, 0) / 85.0 * 100))::integer end nota_carteira,
    case when b.resposta_amostra >= 5 then least(100, round(coalesce(b.sla_pct, 0) / 85.0 * 100))::integer end nota_sla,
    least(100, round((least(100, (b.contatos_trabalhados::numeric / b.dias_uteis) / 20 * 100) * .65)
      + (least(100, (b.followups::numeric / b.dias_uteis) / 10 * 100) * .35)))::integer nota_trabalho,
    least(100, round(b.visitas_realizadas::numeric / greatest(1, 15 * greatest(1, p_fim - p_inicio) / 30.44) * 100))::integer nota_visitas,
    case when b.ia_avaliacoes >= 5 then least(100, round(coalesce(b.ia_nota, 0) / 75.0 * 100))::integer end nota_qualidade,
    case when f.atividade_app then least(100, round(b.minutos_ativos::numeric / greatest(1, b.dias_atividade * 360) * 100))::integer end nota_atividade
  from base b cross join fontes f
),
pontuado as (
  select n.*,
    ((case when nota_carteira is not null then 25 else 0 end)
      + (case when nota_sla is not null then 20 else 0 end)
      + 20 + 15
      + (case when nota_qualidade is not null then 10 else 0 end)
      + (case when nota_atividade is not null then 10 else 0 end))::integer cobertura_peso,
    round((
      coalesce(nota_carteira * 25, 0)
      + coalesce(nota_sla * 20, 0)
      + nota_trabalho * 20
      + nota_visitas * 15
      + coalesce(nota_qualidade * 10, 0)
      + coalesce(nota_atividade * 10, 0)
    )::numeric / nullif(
      (case when nota_carteira is not null then 25 else 0 end)
      + (case when nota_sla is not null then 20 else 0 end)
      + 20 + 15
      + (case when nota_qualidade is not null then 10 else 0 end)
      + (case when nota_atividade is not null then 10 else 0 end), 0
    ))::integer nota_execucao
  from notas n
),
linhas as (
  select p.nome,
    jsonb_build_object(
      'corretorId', p.id, 'nome', p.nome,
      'notaExecucao', p.nota_execucao, 'coberturaNotaPct', p.cobertura_peso,
      'pilares', jsonb_build_object(
        'carteira', p.nota_carteira, 'sla', p.nota_sla, 'trabalho', p.nota_trabalho,
        'visitas', p.nota_visitas, 'qualidade', p.nota_qualidade, 'atividade', p.nota_atividade
      ),
      'atividade', jsonb_build_object(
        'minutosAtivos', p.minutos_ativos, 'diasComAcesso', p.dias_com_acesso,
        'primeiroAcesso', p.primeiro_acesso, 'ultimoAcesso', p.ultimo_acesso,
        'disponivelDistribuicaoAgora', coalesce((select cx.online from public.corretores cx where cx.id = p.id), false)
      ),
      'trabalho', jsonb_build_object(
        'mensagensEnviadas', p.mensagens_enviadas, 'mensagensRecebidas', p.mensagens_recebidas,
        'audiosEnviados', p.audios_enviados, 'followups', p.followups, 'reativacoes', p.reativacoes,
        'leadsRecebidos', p.leads_recebidos, 'leadsAtualizados', p.leads_atualizados,
        'contatosTrabalhados', p.contatos_trabalhados, 'contatosRespondidos', p.contatos_respondidos
      ),
      'atendimento', jsonb_build_object(
        'amostraPrimeiraResposta', p.resposta_amostra, 'medianaPrimeiraRespostaMin', p.resposta_mediana_min,
        'sla15Pct', p.sla_pct, 'avaliacoesIa', p.ia_avaliacoes, 'conversasAvaliadasIa', p.ia_conversas,
        'notaIa', p.ia_nota, 'clareza', p.clareza, 'cordialidade', p.cordialidade,
        'personalizacao', p.personalizacao, 'qualificacao', p.qualificacao,
        'conducao', p.conducao, 'objecoes', p.objecoes, 'escrita', p.escrita
      ),
      'carteira', jsonb_build_object(
        'ativa', p.carteira_ativa, 'limite', p.limite_carteira, 'acoesVencidas', p.acoes_vencidas,
        'vencem2h', p.vencem_2h, 'emDiaPct', p.carteira_em_dia_pct,
        'saraCobertos', p.sara_cobertos, 'descartes', p.descartes
      ),
      'visitas', jsonb_build_object(
        'marcadas', p.visitas_marcadas, 'realizadas', p.visitas_realizadas,
        'canceladas', p.visitas_canceladas, 'comFeedback', p.visitas_feedback,
        'comparecimentoPct', p.comparecimento_pct
      ),
      'processo', jsonb_build_object(
        'propostas', case when f.propostas then p.propostas else null end,
        'contratos', case when f.propostas then p.contratos else null end,
        'tarefasTotal', p.tarefas_total, 'tarefasConcluidas', p.tarefas_concluidas,
        'tarefasVencidas', p.tarefas_vencidas
      ),
      'resultado', jsonb_build_object(
        'vendas', p.vendas, 'vgv', p.vgv, 'comissao', p.comissao,
        'metaVgv', p.meta_vgv, 'metaVendas', p.meta_vendas,
        'atingimentoPct', case when coalesce(p.meta_vgv, 0) > 0 then round(100.0 * p.vgv / p.meta_vgv, 1) end
      )
    ) item
  from pontuado p cross join fontes f
),
meta_equipe as (
  select sum(m.meta_vgv) meta_vgv, sum(m.meta_vendas) meta_vendas
  from metas m where m.corretor_id is null
)
select jsonb_build_object(
  'periodo', jsonb_build_object('inicio', l.inicio, 'fim', l.fim, 'diasUteisObservados', d.dias_uteis),
  'geradoEm', now(),
  'fontes', jsonb_build_object(
    'atividadeApp', f.atividade_app, 'atividadeRastreadaDesde', ag.rastreando_desde,
    'primeiraResposta', f.primeira_resposta, 'qualidadeIa', f.qualidade_ia,
    'propostas', f.propostas, 'ligacoes', f.ligacoes,
    'observacao', 'Disponibilidade para distribuição e atividade no ERP são métricas independentes.'
  ),
  'metaEquipe', (select to_jsonb(me) from meta_equipe me),
  'corretores', coalesce((select jsonb_agg(item order by nome) from linhas), '[]'::jsonb)
)
from limites l cross join dias d cross join fontes f cross join atividade_global ag;
$function$;

revoke all on function public.performance_painel(date, date) from public, anon;
grant execute on function public.performance_painel(date, date) to authenticated, service_role;

-- O amostrador antigo media o botão "online" da distribuição, não uso do ERP.
-- Interrompê-lo evita continuar produzindo a métrica enganosa. Os eventos
-- históricos ficam preservados apenas como trilha, e o painel novo os ignora.
do $do$
declare v_jobid bigint;
begin
  select jobid into v_jobid from cron.job where jobname = 'perf_amostrar_online';
  if v_jobid is not null then perform cron.unschedule(v_jobid); end if;
end
$do$;
