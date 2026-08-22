-- Central de Comando: fonte real, única e auditável para o painel executivo.
--
-- O painel nunca recebe linhas de conversa, telefone ou e-mail. A função faz
-- as agregações no Postgres e devolve apenas números de operação. O histórico
-- de atividade começa nesta migração; nenhum tempo anterior é inventado.

begin;

create index if not exists leads_criado_em_central_idx
  on public.leads (criado_em desc);

create index if not exists f2_lead_criado_em_central_idx
  on public.f2_lead (criado_em desc, corretor_id);

create index if not exists vendas_conclusao_corretor_central_idx
  on public.vendas (data_conclusao desc, corretor_id)
  where data_conclusao is not null;

create table if not exists ncrm_private.central_atividade_estado (
  corretor_id bigint primary key references public.corretores(id) on delete cascade,
  ultimo_heartbeat_em timestamptz not null,
  ativo boolean not null default false
);

create table if not exists ncrm_private.central_atividade_diaria (
  corretor_id bigint not null references public.corretores(id) on delete cascade,
  dia date not null,
  segundos_logado bigint not null default 0 check (segundos_logado >= 0),
  segundos_ativo bigint not null default 0 check (segundos_ativo >= 0),
  primeiro_heartbeat_em timestamptz not null,
  ultimo_heartbeat_em timestamptz not null,
  primary key (corretor_id, dia)
);

create index if not exists central_atividade_diaria_periodo_idx
  on ncrm_private.central_atividade_diaria (dia desc, corretor_id);

revoke all on ncrm_private.central_atividade_estado,
  ncrm_private.central_atividade_diaria
  from public, anon, authenticated;
grant select on ncrm_private.central_atividade_estado,
  ncrm_private.central_atividade_diaria
  to service_role;

create or replace function ncrm_private.central_gestao_autorizada()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(auth.jwt()->>'role', '') = 'service_role'
    or exists (
      select 1
      from public.usuarios u
      where u.id = (select auth.uid())
        and u.ativo
        and u.role::text in ('admin', 'gerente', 'gestor', 'diretor', 'executivo')
    );
$$;

revoke all on function ncrm_private.central_gestao_autorizada()
  from public, anon;
grant execute on function ncrm_private.central_gestao_autorizada()
  to authenticated, service_role;

create table if not exists public.central_alerta_acoes (
  alerta_chave text primary key,
  responsavel text,
  prazo date,
  visto boolean not null default false,
  resolvido boolean not null default false,
  atualizado_em timestamptz not null default now(),
  atualizado_por uuid not null references auth.users(id)
);

alter table public.central_alerta_acoes enable row level security;

drop policy if exists central_alerta_acoes_select on public.central_alerta_acoes;
create policy central_alerta_acoes_select
on public.central_alerta_acoes
for select
to authenticated
using ((select ncrm_private.central_gestao_autorizada()));

drop policy if exists central_alerta_acoes_insert on public.central_alerta_acoes;
create policy central_alerta_acoes_insert
on public.central_alerta_acoes
for insert
to authenticated
with check (
  (select ncrm_private.central_gestao_autorizada())
  and atualizado_por = (select auth.uid())
);

drop policy if exists central_alerta_acoes_update on public.central_alerta_acoes;
create policy central_alerta_acoes_update
on public.central_alerta_acoes
for update
to authenticated
using ((select ncrm_private.central_gestao_autorizada()))
with check (
  (select ncrm_private.central_gestao_autorizada())
  and atualizado_por = (select auth.uid())
);

grant select, insert, update on public.central_alerta_acoes to authenticated;

create or replace function public.central_atividade_heartbeat(
  p_ativo boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_corretor_id bigint;
  v_agora timestamptz := clock_timestamp();
  v_dia date := (v_agora at time zone 'America/Sao_Paulo')::date;
  v_anterior ncrm_private.central_atividade_estado%rowtype;
  v_delta integer := 0;
begin
  select c.id
  into v_corretor_id
  from public.corretores c
  where c.usuario_id = (select auth.uid())
    and c.ativo
  limit 1;

  if v_corretor_id is null then
    return jsonb_build_object('ok', false, 'motivo', 'usuario_sem_corretor_ativo');
  end if;

  perform pg_advisory_xact_lock(hashtextextended('central_atividade:' || v_corretor_id, 0));

  select *
  into v_anterior
  from ncrm_private.central_atividade_estado e
  where e.corretor_id = v_corretor_id
  for update;

  if v_anterior.corretor_id is not null then
    -- O navegador envia a cada 30 s. Intervalos acima de 65 s significam aba
    -- suspensa ou rede perdida e não são vendidos como hora trabalhada.
    v_delta := greatest(
      0,
      least(65, floor(extract(epoch from (v_agora - v_anterior.ultimo_heartbeat_em)))::integer)
    );
  end if;

  insert into ncrm_private.central_atividade_diaria (
    corretor_id,
    dia,
    segundos_logado,
    segundos_ativo,
    primeiro_heartbeat_em,
    ultimo_heartbeat_em
  ) values (
    v_corretor_id,
    v_dia,
    v_delta,
    case when coalesce(v_anterior.ativo, p_ativo) then v_delta else 0 end,
    v_agora,
    v_agora
  )
  on conflict (corretor_id, dia) do update set
    segundos_logado = ncrm_private.central_atividade_diaria.segundos_logado + excluded.segundos_logado,
    segundos_ativo = ncrm_private.central_atividade_diaria.segundos_ativo + excluded.segundos_ativo,
    ultimo_heartbeat_em = excluded.ultimo_heartbeat_em;

  insert into ncrm_private.central_atividade_estado (
    corretor_id,
    ultimo_heartbeat_em,
    ativo
  ) values (
    v_corretor_id,
    v_agora,
    coalesce(p_ativo, false)
  )
  on conflict (corretor_id) do update set
    ultimo_heartbeat_em = excluded.ultimo_heartbeat_em,
    ativo = excluded.ativo;

  return jsonb_build_object(
    'ok', true,
    'corretor_id', v_corretor_id,
    'segundos_somados', v_delta
  );
end;
$$;

revoke all on function public.central_atividade_heartbeat(boolean)
  from public, anon;
grant execute on function public.central_atividade_heartbeat(boolean)
  to authenticated, service_role;

create or replace function public.central_comando_dashboard(
  p_days integer default 30
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_days integer := greatest(1, least(coalesce(p_days, 30), 365));
  v_since timestamptz := now() - make_interval(days => greatest(1, least(coalesce(p_days, 30), 365)));
  v_previous_since timestamptz := now() - make_interval(days => greatest(1, least(coalesce(p_days, 30), 365)) * 2);
  v_result jsonb;
begin
  if not (select ncrm_private.central_gestao_autorizada()) then
    raise exception 'acesso_negado' using errcode = '42501';
  end if;

  with
  f2_base as (
    select
      f.id,
      f.origem_negocio_id,
      n.lead_id,
      n.venda_id,
      f.corretor_id,
      f.corretor_nome,
      f.etapa,
      f.momento_codigo,
      f.proxima_acao_em,
      f.ultima_interacao_em,
      f.qualidade_atendimento_nota,
      f.qualidade_atendimento_resumo,
      f.criado_em,
      f.descartado_em
    from public.f2_lead f
    join public.negocios n on n.id = f.origem_negocio_id
  ),
  f2_active as (
    select * from f2_base where descartado_em is null
  ),
  f2_cohort as (
    select * from f2_base where criado_em >= v_since
  ),
  f2_previous as (
    select * from f2_base where criado_em >= v_previous_since and criado_em < v_since
  ),
  perf_period as (
    select p.*
    from public.perf_eventos p
    where p.ocorrido_em >= v_since
  ),
  perf_previous as (
    select p.*
    from public.perf_eventos p
    where p.ocorrido_em >= v_previous_since
      and p.ocorrido_em < v_since
  ),
  waiting as (
    select
      f.corretor_id,
      f.lead_id,
      extract(epoch from (now() - s.cliente_ultima)) / 60.0 as espera_min
    from f2_active f
    join public.sla_msg_cache s on s.lead_id = f.lead_id
    where s.cliente_ultima is not null
      and (s.env_ultima is null or s.cliente_ultima > s.env_ultima)
  ),
  perf_broker as (
    select
      p.corretor_id,
      count(*) filter (where p.tipo = 'lead_recebido')::bigint as leads_recebidos,
      count(*) filter (where p.tipo in ('mensagem_enviada', 'audio_enviado', 'imagem_enviada', 'video_enviado', 'documento_enviado'))::bigint as mensagens_enviadas,
      count(*) filter (where p.tipo = 'movimentacao')::bigint as movimentacoes,
      count(*) filter (where p.tipo = 'visita_marcada')::bigint as visitas_agendadas,
      count(*) filter (where p.tipo = 'visita_realizada')::bigint as visitas_realizadas,
      count(*) filter (where p.tipo = 'visita_cancelada')::bigint as visitas_canceladas,
      round((percentile_cont(0.5) within group (order by p.valor)
        filter (where p.tipo = 'primeira_resposta' and p.valor is not null))::numeric, 1) as primeira_resposta_mediana_min,
      round((percentile_cont(0.5) within group (order by p.valor)
        filter (where p.tipo = 'resposta' and p.valor is not null))::numeric, 1) as resposta_mediana_min,
      max(p.ocorrido_em) as ultima_atividade_em
    from perf_period p
    where p.corretor_id is not null
    group by p.corretor_id
  ),
  quality_broker as (
    select
      f.corretor_id,
      round(avg(f.qualidade_atendimento_nota)::numeric, 1) as nota_media,
      count(*) filter (where f.qualidade_atendimento_nota is not null)::bigint as avaliacoes
    from f2_active f
    group by f.corretor_id
  ),
  presence_broker as (
    select
      cp.corretor_id,
      count(*)::bigint as dias_presenca
    from public.corretor_presencas cp
    where cp.dia >= (v_since at time zone 'America/Sao_Paulo')::date
    group by cp.corretor_id
  ),
  activity_broker as (
    select
      a.corretor_id,
      round(sum(a.segundos_logado)::numeric / 3600, 2) as horas_logado,
      round(sum(a.segundos_ativo)::numeric / 3600, 2) as horas_ativas,
      min(a.primeiro_heartbeat_em) as medido_desde,
      max(a.ultimo_heartbeat_em) as ultimo_heartbeat_em
    from ncrm_private.central_atividade_diaria a
    where a.dia >= (v_since at time zone 'America/Sao_Paulo')::date
    group by a.corretor_id
  ),
  sales_broker as (
    select
      v.corretor_id,
      count(*)::bigint as vendas,
      coalesce(sum(v.vgv), 0)::numeric as vgv
    from public.vendas v
    where v.data_conclusao >= (v_since at time zone 'America/Sao_Paulo')::date
      and v.status::text in ('concluido', 'pago')
      and v.corretor_id is not null
    group by v.corretor_id
  ),
  team_rows as (
    select coalesce(jsonb_agg(
      jsonb_build_object(
        'corretor_id', c.id,
        'nome', c.nome,
        'online', c.online,
        'no_escritorio', c.no_escritorio,
        'ultima_presenca', c.ultima_presenca,
        'carteira_ativa', (select count(*) from f2_active f where f.corretor_id = c.id),
        'leads_novos', (select count(*) from f2_cohort f where f.corretor_id = c.id),
        'acoes_vencidas', (select count(*) from f2_active f where f.corretor_id = c.id and f.etapa <> 'pescado' and f.proxima_acao_em < now()),
        'clientes_aguardando', (select count(*) from waiting w where w.corretor_id = c.id),
        'clientes_criticos', (select count(*) from waiting w where w.corretor_id = c.id and w.espera_min >= 30),
        'leads_recebidos', coalesce(pb.leads_recebidos, 0),
        'mensagens_enviadas', coalesce(pb.mensagens_enviadas, 0),
        'movimentacoes', coalesce(pb.movimentacoes, 0),
        'primeira_resposta_mediana_min', pb.primeira_resposta_mediana_min,
        'resposta_mediana_min', pb.resposta_mediana_min,
        'visitas_agendadas', coalesce(pb.visitas_agendadas, 0),
        'visitas_realizadas', coalesce(pb.visitas_realizadas, 0),
        'visitas_canceladas', coalesce(pb.visitas_canceladas, 0),
        'nota_media', qb.nota_media,
        'avaliacoes', coalesce(qb.avaliacoes, 0),
        'vendas', coalesce(sb.vendas, 0),
        'vgv', coalesce(sb.vgv, 0),
        'dias_presenca', coalesce(pr.dias_presenca, 0),
        'horas_logado', ab.horas_logado,
        'horas_ativas', ab.horas_ativas,
        'horas_medidas_desde', ab.medido_desde,
        'ultima_atividade_em', greatest(pb.ultima_atividade_em, ab.ultimo_heartbeat_em)
      )
      order by coalesce(sb.vgv, 0) desc, coalesce(pb.visitas_realizadas, 0) desc, c.nome
    ), '[]'::jsonb) as rows
    from public.corretores c
    left join perf_broker pb on pb.corretor_id = c.id
    left join quality_broker qb on qb.corretor_id = c.id
    left join presence_broker pr on pr.corretor_id = c.id
    left join activity_broker ab on ab.corretor_id = c.id
    left join sales_broker sb on sb.corretor_id = c.id
    where c.ativo
  ),
  funnel_flow as (
    select jsonb_build_array(
      jsonb_build_object('key', 'leads', 'label', 'Leads recebidos', 'value', (select count(*) from f2_cohort)),
      jsonb_build_object('key', 'sla', 'label', 'Atendidos em até 30 min', 'value', (
        select count(distinct p.lead_id)
        from perf_period p
        join f2_cohort f on f.lead_id = p.lead_id
        where p.tipo = 'primeira_resposta' and p.valor <= 30
      )),
      jsonb_build_object('key', 'contact', 'label', 'Contato estabelecido', 'value', (
        select count(distinct p.lead_id)
        from perf_period p
        join f2_cohort f on f.lead_id = p.lead_id
        where p.tipo = 'resposta'
      )),
      jsonb_build_object('key', 'qualified', 'label', 'Qualificados pela IA', 'value', (
        select count(*) from f2_cohort f where f.qualidade_atendimento_nota is not null
      )),
      jsonb_build_object('key', 'visit_scheduled', 'label', 'Visitas agendadas', 'value', (
        select count(distinct coalesce(p.meta->>'visita_id', p.id::text))
        from perf_period p
        join f2_cohort f on f.lead_id = p.lead_id
        where p.tipo = 'visita_marcada'
      )),
      jsonb_build_object('key', 'visit_done', 'label', 'Visitas realizadas', 'value', (
        select count(distinct coalesce(p.meta->>'visita_id', p.id::text))
        from perf_period p
        join f2_cohort f on f.lead_id = p.lead_id
        where p.tipo = 'visita_realizada'
      )),
      jsonb_build_object('key', 'sales', 'label', 'Vendas', 'value', (
        select count(distinct f.venda_id) from f2_cohort f where f.venda_id is not null
      ))
    ) as rows
  ),
  funnel_stock as (
    select coalesce(jsonb_agg(
      jsonb_build_object(
        'key', x.etapa,
        'label', initcap(replace(x.etapa, '_', ' ')),
        'value', x.quantidade
      ) order by x.quantidade desc
    ), '[]'::jsonb) as rows
    from (
      select f.etapa, count(*)::bigint as quantidade
      from f2_active f
      group by f.etapa
    ) x
  ),
  finance_current as (
    select
      count(*)::bigint as vendas,
      coalesce(sum(v.vgv), 0)::numeric as vgv,
      coalesce(sum(v.vgv * coalesce(v.percentual_comissao, 0)), 0)::numeric as comissao_prevista
    from public.vendas v
    where v.data_conclusao >= (v_since at time zone 'America/Sao_Paulo')::date
      and v.status::text in ('concluido', 'pago')
  ),
  finance_previous as (
    select
      count(*)::bigint as vendas,
      coalesce(sum(v.vgv), 0)::numeric as vgv,
      coalesce(sum(v.vgv * coalesce(v.percentual_comissao, 0)), 0)::numeric as comissao_prevista
    from public.vendas v
    where v.data_conclusao >= (v_previous_since at time zone 'America/Sao_Paulo')::date
      and v.data_conclusao < (v_since at time zone 'America/Sao_Paulo')::date
      and v.status::text in ('concluido', 'pago')
  ),
  finance_received as (
    select coalesce(sum(r.valor_total), 0)::numeric as recebido
    from public.recebimentos r
    where r.status = 'recebido'
      and r.data_recebimento >= (v_since at time zone 'America/Sao_Paulo')::date
  ),
  trend as (
    select coalesce(jsonb_agg(jsonb_build_object(
      'day', d.dia,
      'leads', (select count(*) from f2_base f where f.criado_em >= d.dia and f.criado_em < d.dia + interval '1 day'),
      'visits', (select count(*) from perf_period p where p.tipo = 'visita_realizada' and p.ocorrido_em >= d.dia and p.ocorrido_em < d.dia + interval '1 day'),
      'sales', (select count(*) from public.vendas v where v.data_conclusao = d.dia::date and v.status::text in ('concluido', 'pago'))
    ) order by d.dia), '[]'::jsonb) as rows
    from generate_series(
      (v_since at time zone 'America/Sao_Paulo')::date,
      (now() at time zone 'America/Sao_Paulo')::date,
      interval '1 day'
    ) d(dia)
  ),
  totals as (
    select
      (select count(*) from f2_cohort)::bigint as leads_validos,
      (select count(*) from f2_previous)::bigint as leads_validos_anterior,
      (select count(*) from f2_active)::bigint as carteira_ativa,
      (select count(*) from f2_active where etapa <> 'pescado' and proxima_acao_em < now())::bigint as acoes_vencidas,
      (select count(*) from waiting)::bigint as clientes_aguardando,
      (select count(*) from waiting where espera_min >= 30)::bigint as clientes_criticos,
      (select count(*) from public.f2_visita where status = 'realizada' and feedback_em is null and inicio_em < now() - interval '48 hours')::bigint as visitas_sem_feedback,
      (select round(avg(qualidade_atendimento_nota)::numeric, 1) from f2_active where qualidade_atendimento_nota is not null) as nota_ia,
      (select count(*) from public.corretores where ativo)::bigint as corretores_ativos,
      (select count(*) from public.corretores where ativo and no_escritorio)::bigint as no_escritorio_agora,
      (select count(*) from perf_period where tipo = 'visita_realizada')::bigint as visitas_realizadas,
      (select count(*) from perf_previous where tipo = 'visita_realizada')::bigint as visitas_realizadas_anterior,
      (select round((percentile_cont(0.5) within group (order by valor) filter (where tipo = 'primeira_resposta' and valor is not null))::numeric, 1) from perf_period) as primeira_resposta_mediana_min,
      (select round((percentile_cont(0.5) within group (order by valor) filter (where tipo = 'primeira_resposta' and valor is not null))::numeric, 1) from perf_previous) as primeira_resposta_mediana_anterior_min
  )
  select jsonb_build_object(
    'generated_at', now(),
    'period_days', v_days,
    'period', jsonb_build_object('start', v_since, 'end', now(), 'previous_start', v_previous_since),
    'summary', jsonb_build_object(
      'leads_validos', t.leads_validos,
      'leads_validos_anterior', t.leads_validos_anterior,
      'carteira_ativa', t.carteira_ativa,
      'acoes_vencidas', t.acoes_vencidas,
      'clientes_aguardando', t.clientes_aguardando,
      'clientes_criticos', t.clientes_criticos,
      'visitas_sem_feedback', t.visitas_sem_feedback,
      'nota_ia', t.nota_ia,
      'corretores_ativos', t.corretores_ativos,
      'no_escritorio_agora', t.no_escritorio_agora,
      'visitas_realizadas', t.visitas_realizadas,
      'visitas_realizadas_anterior', t.visitas_realizadas_anterior,
      'primeira_resposta_mediana_min', t.primeira_resposta_mediana_min,
      'primeira_resposta_mediana_anterior_min', t.primeira_resposta_mediana_anterior_min
    ),
    'finance', jsonb_build_object(
      'vendas', fc.vendas,
      'vendas_anterior', fp.vendas,
      'vgv', fc.vgv,
      'vgv_anterior', fp.vgv,
      'comissao_prevista', fc.comissao_prevista,
      'comissao_prevista_anterior', fp.comissao_prevista,
      'comissao_recebida', fr.recebido
    ),
    'funnel', jsonb_build_object('flow', ff.rows, 'stock', fs.rows),
    'team', tr.rows,
    'trend', td.rows,
    'measurement', jsonb_build_object(
      'activity_started_at', (select min(primeiro_heartbeat_em) from ncrm_private.central_atividade_diaria),
      'activity_definition', 'Logado = ERP respondendo ao heartbeat. Ativo = aba visível e interação recente. Intervalos suspensos não entram.'
    )
  )
  into v_result
  from totals t, finance_current fc, finance_previous fp, finance_received fr,
    funnel_flow ff, funnel_stock fs, team_rows tr, trend td;

  return v_result;
end;
$$;

revoke all on function public.central_comando_dashboard(integer)
  from public, anon;
grant execute on function public.central_comando_dashboard(integer)
  to authenticated, service_role;

comment on function public.central_comando_dashboard(integer) is
  'Resumo executivo real do CRM, equipe e financeiro. Não devolve PII nem reconstrói telemetria anterior.';

comment on function public.central_atividade_heartbeat(boolean) is
  'Acumula tempo real do ERP por corretor; intervalos suspensos são descartados.';

comment on table public.central_alerta_acoes is
  'Atribuição, prazo e resolução dos alertas derivados da Central de Comando.';

commit;
