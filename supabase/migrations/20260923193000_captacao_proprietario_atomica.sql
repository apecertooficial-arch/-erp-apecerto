-- A captação precisa persistir condomínio, proprietário, imóvel, unidade e autoria
-- na mesma transação. Uma exceção em qualquer etapa desfaz o conjunto inteiro.

set lock_timeout = '5s';
set statement_timeout = '60s';

create or replace function public.produto_captacao_criar_atomica(p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_corretor_id bigint;
  v_tipo text := p_payload->>'propertyType';
  v_sem_condominio boolean := coalesce((p_payload->>'semCondominio')::boolean, false);
  v_condominio jsonb := coalesce(p_payload->'condominium', '{}'::jsonb);
  v_owner jsonb := coalesce(p_payload->'owner', '{}'::jsonb);
  v_property jsonb := coalesce(p_payload->'property', '{}'::jsonb);
  v_access jsonb := coalesce(p_payload->'access', '{}'::jsonb);
  v_units jsonb := coalesce(p_payload->'units', '[]'::jsonb);
  v_condominio_id uuid;
  v_owner_id uuid;
  v_empreendimento_id uuid;
  v_unidade_id uuid;
  v_unit jsonb;
  v_unit_count integer := 0;
  v_expected_units integer;
  v_existing record;
  v_name_identity text;
  v_address_identity text;
  v_city_identity text;
  v_neighborhood_identity text;
  v_number_identity text;
  v_lock_a text;
  v_lock_b text;
begin
  if v_uid is null then
    raise insufficient_privilege using message = 'CAPTURE_FORBIDDEN: sessão inválida.';
  end if;
  if not exists (select 1 from public.usuarios us where us.id = v_uid and us.ativo) then
    raise insufficient_privilege using message = 'CAPTURE_FORBIDDEN: usuário sem perfil operacional ativo.';
  end if;
  select c.id into v_corretor_id from public.corretores c where c.usuario_id = v_uid limit 1;

  if v_tipo not in ('terceiro', 'construtora') then
    raise check_violation using message = 'CAPTURE_INVALID: tipo de captação inválido.';
  end if;
  if v_tipo = 'terceiro' and v_corretor_id is null then
    raise check_violation using message = 'CAPTURE_CAPTOR_REQUIRED: vincule o usuário a um corretor.';
  end if;
  if nullif(btrim(v_property->>'name'), '') is null
     or nullif(btrim(v_condominio->>'address'), '') is null
     or nullif(btrim(v_condominio->>'city'), '') is null then
    raise check_violation using message = 'CAPTURE_INVALID: imóvel e endereço são obrigatórios.';
  end if;
  if v_tipo = 'terceiro' and (
    nullif(btrim(v_owner->>'name'), '') is null
    or nullif(btrim(v_owner->>'email'), '') is null
    or nullif(btrim(v_owner->>'phone'), '') is null
  ) then
    raise check_violation using message = 'CAPTURE_OWNER_REQUIRED: proprietário completo é obrigatório.';
  end if;

  -- Usa a mesma identidade tolerante a acentos do cliente, mas mantém a
  -- decisão dentro da transação. As duas chaves serializam tanto o critério
  -- nome+bairro quanto endereço+número, em ordem estável para evitar deadlock.
  v_name_identity := pg_catalog.translate(pg_catalog.lower(pg_catalog.regexp_replace(pg_catalog.btrim(v_property->>'name'), '[[:space:]]+', ' ', 'g')), 'áàâãäéèêëíìîïóòôõöúùûüç', 'aaaaaeeeeiiiiooooouuuuc');
  v_address_identity := pg_catalog.translate(pg_catalog.lower(pg_catalog.regexp_replace(pg_catalog.btrim(v_condominio->>'address'), '[[:space:]]+', ' ', 'g')), 'áàâãäéèêëíìîïóòôõöúùûüç', 'aaaaaeeeeiiiiooooouuuuc');
  v_city_identity := pg_catalog.translate(pg_catalog.lower(pg_catalog.regexp_replace(pg_catalog.btrim(v_condominio->>'city'), '[[:space:]]+', ' ', 'g')), 'áàâãäéèêëíìîïóòôõöúùûüç', 'aaaaaeeeeiiiiooooouuuuc');
  v_neighborhood_identity := pg_catalog.translate(pg_catalog.lower(pg_catalog.regexp_replace(pg_catalog.btrim(coalesce(v_condominio->>'neighborhood', '')), '[[:space:]]+', ' ', 'g')), 'áàâãäéèêëíìîïóòôõöúùûüç', 'aaaaaeeeeiiiiooooouuuuc');
  v_number_identity := pg_catalog.lower(pg_catalog.btrim(coalesce(v_condominio->>'number', '')));
  v_lock_a := 'capture-address|' || v_city_identity || '|' || v_address_identity || '|' || v_number_identity;
  v_lock_b := 'capture-name|' || v_city_identity || '|' || v_name_identity || '|' || v_neighborhood_identity;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(least(v_lock_a, v_lock_b), 0));
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(greatest(v_lock_a, v_lock_b), 0));

  select e.id, e.proprietario_id, e.rascunho, e.aprovacao, e.origem,
         e.captado_por_usuario, e.captador_corretor_id
    into v_existing
  from public.empreendimentos e
  where pg_catalog.translate(pg_catalog.lower(pg_catalog.regexp_replace(pg_catalog.btrim(e.cidade), '[[:space:]]+', ' ', 'g')), 'áàâãäéèêëíìîïóòôõöúùûüç', 'aaaaaeeeeiiiiooooouuuuc') = v_city_identity
    and (
      (pg_catalog.translate(pg_catalog.lower(pg_catalog.regexp_replace(pg_catalog.btrim(e.nome), '[[:space:]]+', ' ', 'g')), 'áàâãäéèêëíìîïóòôõöúùûüç', 'aaaaaeeeeiiiiooooouuuuc') = v_name_identity
       and pg_catalog.translate(pg_catalog.lower(pg_catalog.regexp_replace(pg_catalog.btrim(coalesce(e.bairro, '')), '[[:space:]]+', ' ', 'g')), 'áàâãäéèêëíìîïóòôõöúùûüç', 'aaaaaeeeeiiiiooooouuuuc') = v_neighborhood_identity)
      or
      (pg_catalog.translate(pg_catalog.lower(pg_catalog.regexp_replace(pg_catalog.btrim(coalesce(e.endereco, '')), '[[:space:]]+', ' ', 'g')), 'áàâãäéèêëíìîïóòôõöúùûüç', 'aaaaaeeeeiiiiooooouuuuc') = v_address_identity
       and pg_catalog.lower(pg_catalog.btrim(coalesce(e.numero, ''))) = v_number_identity)
    )
  order by e.created_at desc
  limit 1
  for update;

  if found then
    if v_existing.origem = (case when v_tipo = 'terceiro' then 'terceiros' else 'predio' end)
       and (v_existing.captado_por_usuario = v_uid or v_existing.captador_corretor_id = v_corretor_id)
       and (v_existing.rascunho or v_existing.aprovacao <> 'aprovado') then
      if v_tipo = 'terceiro' and (
        v_existing.proprietario_id is null
        or not exists (
          select 1
          from public.unidades u
          join private.unidade_proprietarios p on p.unidade_id = u.id
          where u.empreendimento_id = v_existing.id
            and u.de_terceiros
            and u.captador_corretor_id = v_corretor_id
        )
      ) then
        raise check_violation using message = 'CAPTURE_OWNER_REQUIRED: cadastro anterior sem vínculo completo de proprietário.';
      end if;
      select u.id into v_unidade_id from public.unidades u
      where u.empreendimento_id = v_existing.id and u.de_terceiros and u.captador_corretor_id = v_corretor_id
      order by u.id limit 1;
      return jsonb_build_object('ok', true, 'id', v_existing.id, 'unidadeId', v_unidade_id, 'userId', v_uid, 'draft', v_existing.rascunho, 'resumed', true);
    end if;
    raise unique_violation using message = 'CAPTURE_DUPLICATE: já existe um imóvel semelhante.';
  end if;

  if not v_sem_condominio then
    if nullif(v_condominio->>'id', '') is not null then
      v_condominio_id := (v_condominio->>'id')::uuid;
      if not exists (select 1 from public.condominios c where c.id = v_condominio_id) then
        raise foreign_key_violation using message = 'CAPTURE_INVALID: condomínio não encontrado.';
      end if;
    else
      select c.id into v_condominio_id from public.condominios c
      where lower(btrim(c.nome)) = lower(btrim(v_condominio->>'name'))
        and lower(btrim(c.endereco)) = lower(btrim(v_condominio->>'address'))
        and lower(btrim(c.cidade)) = lower(btrim(v_condominio->>'city'))
      order by c.id limit 1;
      if v_condominio_id is null then
        insert into public.condominios (nome, cep, endereco, numero, complemento, bairro, cidade, uf, created_by)
        values (
          btrim(v_condominio->>'name'), nullif(btrim(v_condominio->>'zipCode'), ''), btrim(v_condominio->>'address'),
          nullif(btrim(v_condominio->>'number'), ''), nullif(btrim(v_condominio->>'complement'), ''),
          nullif(btrim(v_condominio->>'neighborhood'), ''), btrim(v_condominio->>'city'),
          coalesce(nullif(btrim(v_condominio->>'state'), ''), 'SP'), v_uid
        ) returning id into v_condominio_id;
      end if;
    end if;
  end if;

  if v_tipo = 'terceiro' then
    v_owner_id := public.produto_proprietario_captacao_resolver(
      nullif(v_owner->>'id', '')::uuid,
      v_owner->>'name', v_owner->>'email', v_owner->>'phone'
    );
    if v_owner_id is null then
      raise check_violation using message = 'CAPTURE_OWNER_REQUIRED: proprietário não foi confirmado.';
    end if;
  end if;

  insert into public.empreendimentos (
    nome, titulo, slogan, descricao, finalidade, lazer, diferenciais, incorporadora,
    status, origem, condominio_id, proprietario_id, cep, endereco, numero, complemento,
    bairro, cidade, uf, preco, condominio_valor, iptu, outros_custos, area_util,
    dormitorios, suites, banheiros, vagas, acesso_tipo, acesso_codigo,
    acesso_instrucoes, captado_por_usuario, captador_corretor_id,
    captacao_habilitada, rascunho, publicado
  ) values (
    btrim(v_property->>'name'), coalesce(nullif(btrim(v_property->>'title'), ''), btrim(v_property->>'name')),
    nullif(btrim(v_property->>'slogan'), ''), nullif(btrim(v_property->>'description'), ''),
    nullif(btrim(v_property->>'purpose'), ''),
    coalesce(array(select jsonb_array_elements_text(coalesce(v_property->'amenities', '[]'::jsonb))), array[]::text[]),
    coalesce(array(select jsonb_array_elements_text(coalesce(v_property->'differentiators', '[]'::jsonb))), array[]::text[]),
    nullif(btrim(v_property->>'developer'), ''), (v_property->>'status')::public.status_empreend,
    case when v_tipo = 'terceiro' then 'terceiros' else 'predio' end,
    v_condominio_id, v_owner_id, nullif(btrim(v_condominio->>'zipCode'), ''), btrim(v_condominio->>'address'),
    nullif(btrim(v_condominio->>'number'), ''), nullif(btrim(v_condominio->>'complement'), ''),
    nullif(btrim(v_condominio->>'neighborhood'), ''), btrim(v_condominio->>'city'),
    coalesce(nullif(btrim(v_condominio->>'state'), ''), 'SP'), (v_property->>'price')::numeric,
    (v_property->>'condominiumFee')::numeric, (v_property->>'propertyTax')::numeric,
    (v_property->>'otherCosts')::numeric, (v_property->>'area')::numeric,
    (v_property->>'bedrooms')::integer, (v_property->>'suites')::integer,
    (v_property->>'bathrooms')::integer, (v_property->>'parking')::integer,
    v_access->>'type', case when v_access->>'type' = 'chave_digital' then nullif(btrim(v_access->>'code'), '') else null end,
    btrim(v_access->>'instructions'), v_uid, v_corretor_id, true, true, false
  ) returning id into v_empreendimento_id;

  if v_tipo = 'terceiro' then
    v_units := jsonb_build_array(jsonb_build_object(
      'number', case when v_sem_condominio then 'Imóvel único' else coalesce(nullif(v_condominio->>'number', ''), 'Única') end,
      'type', (v_property->>'bedrooms') || ' dorm.', 'area', v_property->'area',
      'parking', v_property->'parking', 'price', v_property->'price', 'promotionalPrice', null,
      'alreadyRented', coalesce((v_property->>'alreadyRented')::boolean, false)
    ));
  end if;
  v_expected_units := jsonb_array_length(v_units);
  if v_expected_units < 1 then
    raise check_violation using message = 'CAPTURE_INVALID: ao menos uma unidade é obrigatória.';
  end if;

  for v_unit in select value from jsonb_array_elements(v_units)
  loop
    insert into public.unidades (
      empreendimento_id, numero, area_m2, tipologia, vagas, valor_tabela, valor_promo,
      valor_m2, compre_ja_alugado, condominio_valor, iptu, outros_custos, disponivel,
      de_terceiros, captador_corretor_id, aprovacao, proprietario_nome,
      proprietario_contato, acesso_tipo, acesso_codigo, acesso_instrucoes
    ) values (
      v_empreendimento_id, btrim(v_unit->>'number'), (v_unit->>'area')::numeric,
      btrim(v_unit->>'type'), (v_unit->>'parking')::integer, (v_unit->>'price')::numeric,
      nullif(v_unit->>'promotionalPrice', '')::numeric,
      case when (v_unit->>'area')::numeric > 0 then coalesce(nullif(v_unit->>'promotionalPrice', '')::numeric, (v_unit->>'price')::numeric) / (v_unit->>'area')::numeric else null end,
      coalesce((v_unit->>'alreadyRented')::boolean, false), (v_property->>'condominiumFee')::numeric,
      (v_property->>'propertyTax')::numeric, (v_property->>'otherCosts')::numeric, true,
      v_tipo = 'terceiro', v_corretor_id, case when v_tipo = 'terceiro' then 'pendente' else 'aprovado' end,
      case when v_tipo = 'terceiro' then btrim(v_owner->>'name') else null end,
      case when v_tipo = 'terceiro' then btrim(v_owner->>'phone') else null end,
      v_access->>'type', case when v_access->>'type' = 'chave_digital' then nullif(btrim(v_access->>'code'), '') else null end,
      btrim(v_access->>'instructions')
    ) returning id into v_unidade_id;
    v_unit_count := v_unit_count + 1;
  end loop;

  if v_unit_count <> v_expected_units
     or not exists (select 1 from public.empreendimentos e where e.id = v_empreendimento_id and e.captado_por_usuario = v_uid and e.captador_corretor_id is not distinct from v_corretor_id and e.proprietario_id is not distinct from v_owner_id)
     or (v_tipo = 'terceiro' and exists (
       select 1 from public.unidades u
       where u.empreendimento_id = v_empreendimento_id
         and (u.captador_corretor_id is distinct from v_corretor_id
           or not exists (select 1 from private.unidade_proprietarios p where p.unidade_id = u.id and p.captador_corretor_id = v_corretor_id))
     )) then
    raise check_violation using message = 'CAPTURE_CONFLICT: vínculo da captação não foi confirmado.';
  end if;

  return jsonb_build_object('ok', true, 'id', v_empreendimento_id, 'unidadeId', case when v_tipo = 'terceiro' then v_unidade_id else null end, 'userId', v_uid, 'draft', true, 'resumed', false);
end;
$$;

create or replace function public.produto_captacao_finalizar_atomica(p_empreendimento_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_corretor_id bigint;
  v_capture record;
  v_aprovacao text;
begin
  if v_uid is null or not exists (select 1 from public.usuarios us where us.id = v_uid and us.ativo) then
    raise insufficient_privilege using message = 'CAPTURE_FORBIDDEN: usuário sem perfil operacional ativo.';
  end if;
  select c.id into v_corretor_id from public.corretores c where c.usuario_id = v_uid limit 1;
  if v_corretor_id is null then
    raise check_violation using message = 'CAPTURE_CAPTOR_REQUIRED: vincule o usuário a um corretor.';
  end if;

  select e.id, e.origem, e.proprietario_id, e.aprovacao, e.captado_por_usuario, e.captador_corretor_id
    into v_capture
  from public.empreendimentos e where e.id = p_empreendimento_id for update;
  if not found then raise no_data_found using message = 'CAPTURE_NOT_FOUND: captação não encontrada.'; end if;
  if (v_capture.captado_por_usuario is not null and v_capture.captado_por_usuario <> v_uid)
     or (v_capture.captador_corretor_id is not null and v_capture.captador_corretor_id <> v_corretor_id) then
    raise insufficient_privilege using message = 'CAPTURE_FORBIDDEN: captação pertence a outro corretor.';
  end if;
  if not exists (select 1 from public.midias m where m.empreendimento_id = p_empreendimento_id and m.tipo = 'foto'::public.tipo_midia) then
    raise check_violation using message = 'CAPTURE_PHOTO_REQUIRED: envie ao menos uma foto.';
  end if;
  if v_capture.origem = 'terceiros' and (
    v_capture.proprietario_id is null
    or exists (
      select 1 from public.unidades u
      where u.empreendimento_id = p_empreendimento_id and u.de_terceiros
        and not exists (select 1 from private.unidade_proprietarios p where p.unidade_id = u.id and p.captador_corretor_id = v_corretor_id)
    )
  ) then
    raise check_violation using message = 'CAPTURE_OWNER_REQUIRED: proprietário completo é obrigatório antes de finalizar.';
  end if;

  update public.unidades u set captador_corretor_id = v_corretor_id
  where u.empreendimento_id = p_empreendimento_id and u.captador_corretor_id is null;
  if exists (select 1 from public.unidades u where u.empreendimento_id = p_empreendimento_id and u.de_terceiros and u.captador_corretor_id is distinct from v_corretor_id) then
    raise check_violation using message = 'CAPTURE_CONFLICT: unidade vinculada a outro captador.';
  end if;

  v_aprovacao := case when v_capture.aprovacao = 'aprovado' then 'aprovado' else 'pendente' end;
  update public.empreendimentos e
  set rascunho = false,
      aprovacao = v_aprovacao,
      reprovacao_motivo = case when v_aprovacao = 'pendente' then null else e.reprovacao_motivo end,
      captado_por_usuario = v_uid,
      captador_corretor_id = v_corretor_id
  where e.id = p_empreendimento_id;

  return jsonb_build_object('ok', true, 'id', p_empreendimento_id, 'aprovacao', v_aprovacao);
end;
$$;

revoke all on function public.produto_captacao_criar_atomica(jsonb) from public, anon, authenticated, service_role;
grant execute on function public.produto_captacao_criar_atomica(jsonb) to authenticated;
revoke all on function public.produto_captacao_finalizar_atomica(uuid) from public, anon, authenticated, service_role;
grant execute on function public.produto_captacao_finalizar_atomica(uuid) to authenticated;

comment on function public.produto_captacao_criar_atomica(jsonb) is
  'Cria condomínio, proprietário, imóvel e unidades em uma transação, fixando autoria e captador da sessão.';
comment on function public.produto_captacao_finalizar_atomica(uuid) is
  'Finaliza a captação somente quando autoria, captador, proprietário e foto estão confirmados.';
