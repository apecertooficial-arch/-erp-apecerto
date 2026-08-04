-- Distribui, pela roleta oficial da automacao 42, os 99 leads dos pipes
-- antigos que chegaram ao Funil 2.0 sem corretor. O Aquario fica fora.
-- Ritmo autorizado: ate 15 leads por hora em 05/08/2026, das 09:30
-- as 18:30 (America/Sao_Paulo). A rotina se desagenda ao concluir.

create table if not exists ncrm_private.f2_distribuicao_programada (
  programa text not null,
  funil_lead_id uuid not null references public.f2_lead(id) on delete cascade,
  lead_id bigint not null references public.leads(id),
  negocio_id bigint not null references public.negocios(id),
  programado_para timestamptz not null,
  status text not null default 'pendente'
    check (status in ('pendente','distribuido','ignorado')),
  tentativas integer not null default 0 check (tentativas >= 0),
  corretor_id bigint references public.corretores(id),
  ultimo_erro text,
  processado_em timestamptz,
  criado_em timestamptz not null default now(),
  primary key (programa, funil_lead_id),
  unique (programa, lead_id),
  unique (programa, negocio_id)
);

revoke all on table ncrm_private.f2_distribuicao_programada from public, anon, authenticated;

insert into ncrm_private.f2_distribuicao_programada (
  programa, funil_lead_id, lead_id, negocio_id, programado_para
)
select
  'pipes-antigos-20260805',
  x.funil_lead_id,
  x.lead_id,
  x.negocio_id,
  (timestamp '2026-08-05 09:30:00' at time zone 'America/Sao_Paulo')
    + make_interval(hours => ((x.rn - 1) / 15)::integer)
from (
  select
    fl.id as funil_lead_id,
    n.lead_id,
    n.id as negocio_id,
    row_number() over (order by fl.criado_em, fl.id) as rn
  from public.f2_lead fl
  join public.negocios n on n.id = fl.origem_negocio_id
  join public.leads l on l.id = n.lead_id
  join public.ncrm_leads_guardados g on g.lead_id = l.id
  where fl.corretor_id is null
    and n.corretor_id is null
    and l.corretor_id is null
    and n.pipeline_id = 2
    and n.stage_id <> public.aquario_stage_id()
    and not (coalesce(l.tags, '[]'::jsonb) @> '[{"name":"Aquário"}]'::jsonb)
) x
on conflict do nothing;

do $$
declare
  v_total integer;
begin
  select count(*) into v_total
  from ncrm_private.f2_distribuicao_programada
  where programa = 'pipes-antigos-20260805';

  if v_total <> 99 then
    raise exception 'Distribuicao programada esperava 99 leads, encontrou %', v_total;
  end if;
end
$$;

create or replace function ncrm_private.f2_distribuir_programados(p_lote integer default 15)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  r record;
  v_automacao_nome text;
  v_items jsonb;
  v_protecao jsonb;
  v_corretor_id bigint;
  v_corretor_nome text;
  v_distribuidos integer := 0;
  v_aguardando integer := 0;
  v_ignorados integer := 0;
begin
  if p_lote < 1 or p_lote > 15 then
    raise exception 'O lote deve estar entre 1 e 15';
  end if;

  select
    a.nome,
    b.bloco->'options'->'distribuicao'->'items',
    coalesce(b.bloco->'options'->'distribuicao'->'protecao', '[]'::jsonb)
  into v_automacao_nome, v_items, v_protecao
  from public.automacoes a
  cross join lateral jsonb_array_elements(a.mapa->'automation'->'blocks') b(bloco)
  where a.id = 42
    and a.ativa is true
    and a.status = 'publicado'
    and b.bloco->>'type' = 'distribution'
  limit 1;

  if v_items is null or jsonb_array_length(v_items) = 0 then
    raise exception 'Automacao 42 nao possui bloco de distribuicao publicado';
  end if;

  for r in
    select
      q.programa,
      q.funil_lead_id,
      q.lead_id,
      q.negocio_id,
      l.nome,
      l.telefone,
      l.corretor_id as lead_corretor_id,
      n.corretor_id as negocio_corretor_id,
      fl.corretor_id as f2_corretor_id,
      n.stage_id,
      l.tags
    from ncrm_private.f2_distribuicao_programada q
    join public.f2_lead fl on fl.id = q.funil_lead_id
    join public.negocios n on n.id = q.negocio_id and n.lead_id = q.lead_id
    join public.leads l on l.id = q.lead_id
    where q.programa = 'pipes-antigos-20260805'
      and q.status = 'pendente'
      and q.programado_para <= now()
    order by q.programado_para, q.funil_lead_id
    for update of q skip locked
    limit p_lote
  loop
    if r.stage_id = public.aquario_stage_id()
       or coalesce(r.tags, '[]'::jsonb) @> '[{"name":"Aquário"}]'::jsonb then
      update ncrm_private.f2_distribuicao_programada
      set status = 'ignorado', ultimo_erro = 'aquario_excluido', processado_em = now()
      where programa = r.programa and funil_lead_id = r.funil_lead_id;
      v_ignorados := v_ignorados + 1;
      continue;
    end if;

    if r.lead_corretor_id is not null
       or r.negocio_corretor_id is not null
       or r.f2_corretor_id is not null then
      update ncrm_private.f2_distribuicao_programada
      set status = 'ignorado', ultimo_erro = 'lead_ja_possui_corretor', processado_em = now()
      where programa = r.programa and funil_lead_id = r.funil_lead_id;
      v_ignorados := v_ignorados + 1;
      continue;
    end if;

    v_corretor_id := public.motor_roleta(
      42,
      coalesce(v_automacao_nome, 'Distribuicao funil 2.0'),
      'F2_BACKLOG_20260805',
      jsonb_build_object('nome', r.nome, 'telefone', r.telefone),
      r.lead_id,
      r.negocio_id,
      v_items,
      true,
      true,
      v_protecao
    );

    if v_corretor_id is null then
      update ncrm_private.f2_distribuicao_programada
      set tentativas = tentativas + 1,
          ultimo_erro = 'nenhum_corretor_elegivel_no_horario'
      where programa = r.programa and funil_lead_id = r.funil_lead_id;
      v_aguardando := v_aguardando + 1;
      continue;
    end if;

    select c.nome into v_corretor_nome
    from public.corretores c where c.id = v_corretor_id;

    update public.f2_lead
    set corretor_id = v_corretor_id,
        corretor_nome = v_corretor_nome,
        atualizado_em = now(),
        versao = versao + 1
    where id = r.funil_lead_id and corretor_id is null;

    if not found then
      raise exception 'Falha ao sincronizar corretor no Funil 2.0 para %', r.funil_lead_id;
    end if;

    delete from public.ncrm_leads_guardados where lead_id = r.lead_id;

    update ncrm_private.f2_distribuicao_programada
    set status = 'distribuido',
        tentativas = tentativas + 1,
        corretor_id = v_corretor_id,
        ultimo_erro = null,
        processado_em = now()
    where programa = r.programa and funil_lead_id = r.funil_lead_id;

    v_distribuidos := v_distribuidos + 1;
  end loop;

  return jsonb_build_object(
    'ok', true,
    'distribuidos', v_distribuidos,
    'aguardando_elegivel', v_aguardando,
    'ignorados', v_ignorados,
    'pendentes', (
      select count(*) from ncrm_private.f2_distribuicao_programada
      where programa = 'pipes-antigos-20260805' and status = 'pendente'
    )
  );
end
$$;

revoke all on function ncrm_private.f2_distribuir_programados(integer) from public, anon, authenticated;
grant execute on function ncrm_private.f2_distribuir_programados(integer) to service_role;

create or replace function ncrm_private.f2_distribuicao_programada_tick()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_local timestamp := now() at time zone 'America/Sao_Paulo';
  v_resultado jsonb;
  v_pendentes integer;
begin
  if v_local::date < date '2026-08-05'
     or (v_local::date = date '2026-08-05' and v_local::time < time '09:30') then
    return jsonb_build_object('ok', true, 'status', 'aguardando_inicio', 'inicio', '2026-08-05 09:30 America/Sao_Paulo');
  end if;

  if v_local::date > date '2026-08-05'
     or v_local::time > time '18:30' then
    if exists (select 1 from cron.job where jobname = 'f2-distribuicao-programada-20260805') then
      perform cron.unschedule('f2-distribuicao-programada-20260805');
    end if;
    return jsonb_build_object('ok', true, 'status', 'janela_encerrada');
  end if;

  v_resultado := ncrm_private.f2_distribuir_programados(15);

  select count(*) into v_pendentes
  from ncrm_private.f2_distribuicao_programada
  where programa = 'pipes-antigos-20260805' and status = 'pendente';

  if v_pendentes = 0
     and exists (select 1 from cron.job where jobname = 'f2-distribuicao-programada-20260805') then
    perform cron.unschedule('f2-distribuicao-programada-20260805');
  end if;

  return v_resultado || jsonb_build_object('status', 'executado');
end
$$;

revoke all on function ncrm_private.f2_distribuicao_programada_tick() from public, anon, authenticated;
grant execute on function ncrm_private.f2_distribuicao_programada_tick() to service_role;

do $$
begin
  if exists (select 1 from cron.job where jobname = 'f2-distribuicao-programada-20260805') then
    perform cron.unschedule('f2-distribuicao-programada-20260805');
  end if;
end
$$;

select cron.schedule(
  'f2-distribuicao-programada-20260805',
  '30 * * * *',
  $cron$select ncrm_private.f2_distribuicao_programada_tick();$cron$
);

