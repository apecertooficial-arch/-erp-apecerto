-- Produtos: aplicação humana, atômica e reversível das sugestões de mídia.
-- A migration não classifica nem altera mídias existentes.

set lock_timeout = '5s';
set statement_timeout = '30s';

create or replace function public.produto_midias_versao(
  p_empreendimento_id uuid,
  p_unidade_id uuid default null
)
returns text
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_corretor_id bigint;
  v_pode boolean := false;
  v_versao text;
begin
  if v_uid is null or p_empreendimento_id is null then
    raise insufficient_privilege using message = 'MEDIA_AI_FORBIDDEN: sessão inválida.';
  end if;

  select c.id into v_corretor_id
  from public.corretores c
  join public.usuarios us on us.id = c.usuario_id
  where c.usuario_id = v_uid and us.ativo
  limit 1;

  select public.is_product_manager() into v_pode;
  if not v_pode and p_unidade_id is null then
    select exists (
      select 1 from public.empreendimentos e
      where e.id = p_empreendimento_id
        and (e.captado_por_usuario = v_uid or (v_corretor_id is not null and e.captador_corretor_id = v_corretor_id))
    ) into v_pode;
  elsif not v_pode then
    select exists (
      select 1 from public.unidades u
      where u.id = p_unidade_id
        and u.empreendimento_id = p_empreendimento_id
        and v_corretor_id is not null
        and u.captador_corretor_id = v_corretor_id
    ) into v_pode;
  end if;
  if not v_pode then
    raise insufficient_privilege using message = 'MEDIA_AI_FORBIDDEN: sem permissão para esta galeria.';
  end if;

  select md5(coalesce(string_agg(
    concat_ws('|', m.id::text, m.storage_path, coalesce(m.categoria, ''),
      coalesce(m.nome, ''), coalesce(m.alt_text, ''), m.is_capa::text,
      m.ordem::text, m.created_at::text), E'\n' order by m.id
  ), 'galeria-vazia')) into v_versao
  from public.midias m
  where m.empreendimento_id = p_empreendimento_id
    and m.unidade_id is not distinct from p_unidade_id
    and m.tipo = 'foto'::public.tipo_midia;

  return v_versao;
end;
$$;

revoke all on function public.produto_midias_versao(uuid, uuid) from public, anon, authenticated;
grant execute on function public.produto_midias_versao(uuid, uuid) to authenticated;

create or replace function public.produto_midias_aplicar_ia(
  p_empreendimento_id uuid,
  p_unidade_id uuid,
  p_versao_esperada text,
  p_sugestoes jsonb,
  p_restaurar boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_corretor_id bigint;
  v_pode boolean := false;
  v_total integer;
  v_quantidade integer;
  v_versao text;
  v_nova_versao text;
  v_capas integer;
  v_antes jsonb;
begin
  if v_uid is null or p_empreendimento_id is null
     or jsonb_typeof(p_sugestoes) is distinct from 'array' then
    raise insufficient_privilege using message = 'MEDIA_AI_FORBIDDEN: sessão ou payload inválido.';
  end if;

  select c.id into v_corretor_id
  from public.corretores c
  join public.usuarios us on us.id = c.usuario_id
  where c.usuario_id = v_uid and us.ativo
  limit 1;

  select public.is_product_manager() into v_pode;
  if not v_pode and p_unidade_id is null then
    select exists (
      select 1 from public.empreendimentos e
      where e.id = p_empreendimento_id
        and (e.captado_por_usuario = v_uid or (v_corretor_id is not null and e.captador_corretor_id = v_corretor_id))
    ) into v_pode;
  elsif not v_pode then
    select exists (
      select 1 from public.unidades u
      where u.id = p_unidade_id
        and u.empreendimento_id = p_empreendimento_id
        and v_corretor_id is not null
        and u.captador_corretor_id = v_corretor_id
    ) into v_pode;
  end if;
  if not v_pode then
    raise insufficient_privilege using message = 'MEDIA_AI_FORBIDDEN: sem permissão para aplicar sugestões.';
  end if;

  perform 1 from public.midias m
  where m.empreendimento_id = p_empreendimento_id
    and m.unidade_id is not distinct from p_unidade_id
    and m.tipo = 'foto'::public.tipo_midia
  for update;

  select count(*) into v_total
  from public.midias m
  where m.empreendimento_id = p_empreendimento_id
    and m.unidade_id is not distinct from p_unidade_id
    and m.tipo = 'foto'::public.tipo_midia;
  v_quantidade := jsonb_array_length(p_sugestoes);
  if v_quantidade < 1 or (not p_restaurar and v_quantidade > 20)
     or (p_restaurar and v_quantidade <> v_total) then
    raise check_violation using message = 'MEDIA_AI_INVALID: quantidade de sugestões inválida.';
  end if;

  select md5(coalesce(string_agg(
    concat_ws('|', m.id::text, m.storage_path, coalesce(m.categoria, ''),
      coalesce(m.nome, ''), coalesce(m.alt_text, ''), m.is_capa::text,
      m.ordem::text, m.created_at::text), E'\n' order by m.id
  ), 'galeria-vazia')) into v_versao
  from public.midias m
  where m.empreendimento_id = p_empreendimento_id
    and m.unidade_id is not distinct from p_unidade_id
    and m.tipo = 'foto'::public.tipo_midia;
  if v_versao is distinct from p_versao_esperada then
    raise serialization_failure using message = 'MEDIA_AI_CONFLICT: a galeria mudou. Analise novamente antes de aplicar.';
  end if;

  with payload as (
    select value as item from jsonb_array_elements(p_sugestoes)
  )
  select count(distinct (item->>'media_id')::uuid),
         count(*) filter (where coalesce((item->>'is_cover')::boolean, false))
  into v_quantidade, v_capas
  from payload;
  if v_quantidade <> jsonb_array_length(p_sugestoes) or v_capas > 1 then
    raise check_violation using message = 'MEDIA_AI_INVALID: IDs duplicados ou mais de uma capa.';
  end if;

  if exists (
    select 1 from jsonb_array_elements(p_sugestoes) item
    where not exists (
      select 1 from public.midias m
      where m.id = (item->>'media_id')::uuid
        and m.empreendimento_id = p_empreendimento_id
        and m.unidade_id is not distinct from p_unidade_id
        and m.tipo = 'foto'::public.tipo_midia
    )
  ) then
    raise check_violation using message = 'MEDIA_AI_INVALID: mídia externa à galeria.';
  end if;

  select jsonb_agg(jsonb_build_object(
    'media_id', m.id,
    'category', m.categoria,
    'display_name', m.nome,
    'alt_text', m.alt_text,
    'is_cover', m.is_capa,
    'sort_order', m.ordem,
    'confidence', m.ia_confianca,
    'ia_category', m.ia_categoria_sugerida,
    'ia_reviewed_at', m.ia_revisado_em
  ) order by m.ordem, m.created_at, m.id) into v_antes
  from public.midias m
  where m.empreendimento_id = p_empreendimento_id
    and m.unidade_id is not distinct from p_unidade_id
    and m.tipo = 'foto'::public.tipo_midia;

  if p_restaurar then
    if exists (
      select 1 from jsonb_array_elements(p_sugestoes) item
      where char_length(btrim(coalesce(item->>'category', ''))) > 80
         or char_length(btrim(coalesce(item->>'display_name', ''))) > 120
         or (item->>'alt_text' is not null and char_length(btrim(item->>'alt_text')) not between 3 and 220)
         or (item->>'sort_order')::integer not between 0 and 10000
    ) then
      raise check_violation using message = 'MEDIA_AI_INVALID: snapshot de restauração inválido.';
    end if;
    if exists (
      select 1 from public.midias m
      where m.empreendimento_id = p_empreendimento_id
        and m.unidade_id is not distinct from p_unidade_id
        and m.tipo = 'foto'::public.tipo_midia
        and not exists (select 1 from jsonb_array_elements(p_sugestoes) item where (item->>'media_id')::uuid = m.id)
    ) then
      raise check_violation using message = 'MEDIA_AI_INVALID: snapshot incompleto.';
    end if;

    update public.midias m
    set categoria = nullif(btrim(item.value->>'category'), ''),
        nome = nullif(btrim(item.value->>'display_name'), ''),
        alt_text = nullif(btrim(item.value->>'alt_text'), ''),
        is_capa = coalesce((item.value->>'is_cover')::boolean, false),
        ordem = (item.value->>'sort_order')::integer,
        ia_categoria_sugerida = nullif(btrim(item.value->>'ia_category'), ''),
        ia_confianca = nullif(item.value->>'confidence', '')::numeric,
        ia_revisado_em = nullif(item.value->>'ia_reviewed_at', '')::timestamptz
    from jsonb_array_elements(p_sugestoes) item(value)
    where m.id = (item.value->>'media_id')::uuid;
  else
    if exists (
      select 1 from jsonb_array_elements(p_sugestoes) item
      where btrim(coalesce(item->>'category', '')) not in (
        'Fachada','Sala','Cozinha','Dormitório','Suíte','Banheiro','Varanda','Piscina','Lazer','Planta','Vista','Outros'
      )
         or char_length(btrim(coalesce(item->>'display_name', ''))) not between 3 and 120
         or char_length(btrim(coalesce(item->>'alt_text', ''))) not between 3 and 220
         or (item->>'sort_order')::integer not between 0 and 19
         or nullif(item->>'confidence', '')::numeric not between 0 and 1
    ) then
      raise check_violation using message = 'MEDIA_AI_INVALID: conteúdo de sugestão inválido.';
    end if;
    if (
      select count(distinct (item->>'sort_order')::integer)
      from jsonb_array_elements(p_sugestoes) item
    ) <> jsonb_array_length(p_sugestoes) then
      raise check_violation using message = 'MEDIA_AI_INVALID: ordem duplicada.';
    end if;

    with chosen as (
      select (item->>'media_id')::uuid as id,
             row_number() over (order by (item->>'sort_order')::integer) - 1 as nova_ordem
      from jsonb_array_elements(p_sugestoes) item
    ), remaining as (
      select m.id,
             jsonb_array_length(p_sugestoes) + row_number() over (order by m.ordem, m.created_at, m.id) - 1 as nova_ordem
      from public.midias m
      where m.empreendimento_id = p_empreendimento_id
        and m.unidade_id is not distinct from p_unidade_id
        and m.tipo = 'foto'::public.tipo_midia
        and not exists (select 1 from chosen c where c.id = m.id)
    ), ordered as (
      select * from chosen union all select * from remaining
    )
    update public.midias m set ordem = ordered.nova_ordem
    from ordered where m.id = ordered.id;

    update public.midias m
    set categoria = btrim(item.value->>'category'),
        nome = btrim(item.value->>'display_name'),
        alt_text = btrim(item.value->>'alt_text'),
        ia_categoria_sugerida = btrim(item.value->>'category'),
        ia_confianca = (item.value->>'confidence')::numeric,
        ia_revisado_em = now()
    from jsonb_array_elements(p_sugestoes) item(value)
    where m.id = (item.value->>'media_id')::uuid;

    if v_capas = 1 then
      update public.midias m
      set is_capa = exists (
        select 1 from jsonb_array_elements(p_sugestoes) item
        where coalesce((item->>'is_cover')::boolean, false)
          and (item->>'media_id')::uuid = m.id
      )
      where m.empreendimento_id = p_empreendimento_id
        and m.unidade_id is not distinct from p_unidade_id
        and m.tipo = 'foto'::public.tipo_midia;
    end if;
  end if;

  select md5(coalesce(string_agg(
    concat_ws('|', m.id::text, m.storage_path, coalesce(m.categoria, ''),
      coalesce(m.nome, ''), coalesce(m.alt_text, ''), m.is_capa::text,
      m.ordem::text, m.created_at::text), E'\n' order by m.id
  ), 'galeria-vazia')) into v_nova_versao
  from public.midias m
  where m.empreendimento_id = p_empreendimento_id
    and m.unidade_id is not distinct from p_unidade_id
    and m.tipo = 'foto'::public.tipo_midia;

  return jsonb_build_object(
    'ok', true,
    'quantidade', jsonb_array_length(p_sugestoes),
    'versao', v_nova_versao,
    'desfazer', v_antes,
    'restaurado', p_restaurar
  );
end;
$$;

revoke all on function public.produto_midias_aplicar_ia(uuid, uuid, text, jsonb, boolean) from public, anon, authenticated;
grant execute on function public.produto_midias_aplicar_ia(uuid, uuid, text, jsonb, boolean) to authenticated;

comment on function public.produto_midias_aplicar_ia(uuid, uuid, text, jsonb, boolean) is
  'Aplica ou desfaz, com revisão humana e controle otimista, metadados editoriais de fotos. Não chama IA.';
