-- Corrige a execucao da distribuicao programada sem depender do search_path
-- implicito da funcao legada motor_roleta. A lista de participantes e pesos
-- continua vindo do bloco de distribuicao publicado da automacao 42; a
-- elegibilidade e os contadores continuam sendo os oficiais da roleta.

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
    b.bloco->'options'->'distribuicao'->'items'
  into v_automacao_nome, v_items
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
    for update of q, fl, n, l skip locked
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

    insert into public.motor_roleta_contadores (
      automacao_id, bloco_id, corretor_id, peso
    )
    select
      42,
      'F2_BACKLOG_20260805',
      c.id,
      (i.item->>'peso')::numeric
    from jsonb_array_elements(v_items) i(item)
    join public.corretores c
      on public.nome_normalizado(c.nome) = public.nome_normalizado(i.item->>'corretor')
    where coalesce((i.item->>'on')::boolean, true)
      and coalesce(nullif(i.item->>'peso', '')::numeric, 0) > 0
      and coalesce(c.ativo, false)
      and public.corretor_pode_receber(c.id)
      and public.instancia_saudavel(c.id)
    on conflict (automacao_id, bloco_id, corretor_id)
    do update set peso = excluded.peso;

    select rc.corretor_id
    into v_corretor_id
    from public.motor_roleta_contadores rc
    join public.corretores c on c.id = rc.corretor_id
    join jsonb_array_elements(v_items) i(item)
      on public.nome_normalizado(c.nome) = public.nome_normalizado(i.item->>'corretor')
    where rc.automacao_id = 42
      and rc.bloco_id = 'F2_BACKLOG_20260805'
      and coalesce((i.item->>'on')::boolean, true)
      and coalesce(nullif(i.item->>'peso', '')::numeric, 0) > 0
      and coalesce(c.ativo, false)
      and public.corretor_pode_receber(c.id)
      and public.instancia_saudavel(c.id)
    order by rc.atualizado_em asc nulls first, rc.corretor_id asc
    limit 1;

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

    update public.leads
    set corretor_id = v_corretor_id
    where id = r.lead_id and corretor_id is null;
    if not found then
      raise exception 'Falha ao atribuir o lead %', r.lead_id;
    end if;

    update public.negocios
    set corretor_id = v_corretor_id,
        ultima_movimentacao = now()
    where id = r.negocio_id and corretor_id is null;
    if not found then
      raise exception 'Falha ao atribuir o negocio %', r.negocio_id;
    end if;

    update public.f2_lead
    set corretor_id = v_corretor_id,
        corretor_nome = v_corretor_nome,
        atualizado_em = now(),
        versao = versao + 1
    where id = r.funil_lead_id and corretor_id is null;
    if not found then
      raise exception 'Falha ao sincronizar corretor no Funil 2.0 para %', r.funil_lead_id;
    end if;

    update public.motor_roleta_contadores
    set recebidos = recebidos + 1,
        atualizado_em = now()
    where automacao_id = 42
      and bloco_id = 'F2_BACKLOG_20260805'
      and corretor_id = v_corretor_id;

    insert into public.motor_execucoes (
      automacao_id, automacao_nome, bloco_id, evento, status,
      lead_nome, lead_telefone, detalhe
    ) values (
      42,
      coalesce(v_automacao_nome, 'Distribuicao funil 2.0'),
      'F2_BACKLOG_20260805',
      'distribuicao',
      'ok',
      r.nome,
      r.telefone,
      'Backlog dos pipes antigos distribuido para ' || coalesce(v_corretor_nome, '#' || v_corretor_id)
    );

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

