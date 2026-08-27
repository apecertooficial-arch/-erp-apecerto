-- Versão reconciliada com a migration registrada no projeto de produção.
set lock_timeout = '5s';
set statement_timeout = '30s';

-- Corrige apenas coordenadas conferidas pelo endereço público do edifício.
-- A publicação, aprovação, disponibilidade e mídias permanecem intocadas.
do $$
declare
  v_alvo record;
  v_total integer := 0;
begin
  if to_regclass('public.apecerto_baseline_metadata') is not null
     and not exists (select 1 from public.empreendimentos where codigo='AP0001') then
    return;
  end if;

  if (select count(*) from public.empreendimentos where codigo in (
    'AP0001','AP0004','AP0006','AP0010','AP0011','AP0014','AP0015',
    'AP0016','AP0017','AP0019','AP0023','AP0027','AP0031','AP0032',
    'AP0033','AP0038','AP0040','AP0041','AP0042','AP0048','AP0062'
  )) <> 21 then
    raise exception using
      errcode = 'P0001',
      message = 'MAP_TARGETS_CHANGED: esperados exatamente 21 empreendimentos por código.';
  end if;

  for v_alvo in
    with coordenadas(codigo, latitude, longitude, latitude_anterior, longitude_anterior, fonte) as (
      values
        ('AP0001', -23.599535::numeric, -46.660072::numeric, null::numeric, null::numeric, 'Park Avenue — endereço público do edifício'),
        ('AP0004', -23.599611::numeric, -46.662762::numeric, null::numeric, null::numeric, 'Park Lane — endereço público do condomínio'),
        ('AP0006', -23.613810::numeric, -46.667819::numeric, null::numeric, null::numeric, 'Rua dos Chanés, 310 — geocodificação exata'),
        ('AP0010', -23.613441::numeric, -46.666123::numeric, -23.597085::numeric, -46.662888::numeric, 'AP Moema — edifício nomeado no número 407'),
        ('AP0011', -23.610503::numeric, -46.665011::numeric, null::numeric, null::numeric, 'Avenida Moaci, 292 — geocodificação exata'),
        ('AP0014', -23.624548::numeric, -46.635838::numeric, null::numeric, null::numeric, 'Rua Professor Aprígio Gonzaga, 486 — geocodificação exata'),
        ('AP0015', -23.605469::numeric, -46.665922::numeric, null::numeric, null::numeric, 'Alameda dos Arapanés, 918 — geocodificação exata'),
        ('AP0016', -23.612795::numeric, -46.667360::numeric, null::numeric, null::numeric, 'Avenida das Carinas, 268 — geocodificação exata'),
        ('AP0017', -23.611761::numeric, -46.668637::numeric, -23.597085::numeric, -46.662888::numeric, 'Avenida das Carinás, 92 — geocodificação exata'),
        ('AP0019', -23.606011::numeric, -46.660267::numeric, null::numeric, null::numeric, 'Avenida Jamaris, 326 — geocodificação exata'),
        ('AP0023', -23.614430::numeric, -46.666523::numeric, null::numeric, null::numeric, 'Nex One Nhambiquaras, 1990 — edifício nomeado'),
        ('AP0027', -23.607567::numeric, -46.666957::numeric, null::numeric, null::numeric, 'Avenida Pavão, 986 — geocodificação exata'),
        ('AP0031', -23.611486::numeric, -46.667558::numeric, null::numeric, null::numeric, 'Key Moema, 160 — edifício nomeado'),
        ('AP0032', -23.605351::numeric, -46.664072::numeric, -23.597085::numeric, -46.662888::numeric, 'Avenida Ibirapuera, 2480 — geocodificação exata'),
        ('AP0033', -23.614632::numeric, -46.670559::numeric, null::numeric, null::numeric, 'Bothanic, número 155 — página pública do condomínio'),
        ('AP0038', -23.607567::numeric, -46.668507::numeric, null::numeric, null::numeric, 'Bem Moema, número 221 — incorporadora e condomínio'),
        ('AP0040', -23.601873::numeric, -46.656959::numeric, null::numeric, null::numeric, 'Le Jardin, 272 — edifício nomeado'),
        ('AP0041', -23.612047::numeric, -46.669266::numeric, -23.597085::numeric, -46.662888::numeric, 'Composite, número 64 — edifício nomeado'),
        ('AP0042', -23.599753::numeric, -46.661107::numeric, -23.597085::numeric, -46.662888::numeric, 'Agami, número 220 — geocodificação exata e incorporadora'),
        ('AP0048', -23.605477::numeric, -46.638712::numeric, null::numeric, null::numeric, 'Join Vila Mariana, número 250 — mapa do site oficial'),
        ('AP0062', -23.608949::numeric, -46.664855::numeric, null::numeric, null::numeric, 'Edifício Nova York, Avenida Iraí, 175 — edifício nomeado')
    )
    select e.id, e.codigo, e.latitude, e.longitude,
           c.latitude as nova_latitude, c.longitude as nova_longitude,
           c.latitude_anterior, c.longitude_anterior, c.fonte
    from coordenadas c
    join public.empreendimentos e on e.codigo = c.codigo
    order by e.codigo
    for update of e
  loop
    if v_alvo.latitude is not distinct from v_alvo.nova_latitude
       and v_alvo.longitude is not distinct from v_alvo.nova_longitude then
      continue;
    end if;

    if v_alvo.latitude is distinct from v_alvo.latitude_anterior
       or v_alvo.longitude is distinct from v_alvo.longitude_anterior then
      raise exception using
        errcode = 'P0001',
        message = 'MAP_COORDS_CHANGED: ' || v_alvo.codigo || ' possui coordenadas diferentes do preflight.';
    end if;

    update public.empreendimentos
       set latitude = v_alvo.nova_latitude,
           longitude = v_alvo.nova_longitude
     where id = v_alvo.id;

    insert into public.erp_auditoria (
      usuario_nome, acao, modulo, entidade, entidade_id, antes, depois, detalhe
    ) values (
      'Sistema',
      'corrigir_geolocalizacao_mapa',
      'produtos',
      'empreendimento',
      v_alvo.id::text,
      jsonb_build_object('codigo', v_alvo.codigo, 'latitude', v_alvo.latitude, 'longitude', v_alvo.longitude),
      jsonb_build_object('codigo', v_alvo.codigo, 'latitude', v_alvo.nova_latitude, 'longitude', v_alvo.nova_longitude),
      'Coordenada validada pelo endereço público do edifício. Fonte: ' || v_alvo.fonte || '. txid=' || txid_current()::text
    );
    v_total := v_total + 1;
  end loop;

  if v_total not in (0, 21) then
    raise exception using
      errcode = 'P0001',
      message = 'MAP_PARTIAL_UPDATE: a atualização seria parcial (' || v_total::text || '/21).';
  end if;
end;
$$;

-- Nenhuma escrita futura pode salvar somente metade do par ou Null Island.
alter table public.empreendimentos
  add constraint empreendimentos_coordenadas_validas_check
  check (
    (latitude is null and longitude is null)
    or (
      latitude between -90 and 90
      and longitude between -180 and 180
      and not (latitude = 0 and longitude = 0)
    )
  ) not valid;

alter table public.empreendimentos
  validate constraint empreendimentos_coordenadas_validas_check;

-- A função antiga era SECURITY DEFINER e anon podia preencher qualquer registro
-- ainda sem coordenada. Ela passa a respeitar o usuário autenticado, grants e RLS.
create or replace function public.set_empreendimento_coords(
  p_id uuid,
  p_lat numeric,
  p_lon numeric
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise insufficient_privilege using message = 'AUTH_REQUIRED: autenticação obrigatória.';
  end if;
  if p_lat is null or p_lon is null
     or p_lat not between -90 and 90
     or p_lon not between -180 and 180
     or (p_lat = 0 and p_lon = 0) then
    raise check_violation using message = 'INVALID_COORDINATES: latitude/longitude inválidas.';
  end if;

  update public.empreendimentos
     set latitude = p_lat,
         longitude = p_lon
   where id = p_id
     and latitude is null
     and longitude is null;
end;
$$;

revoke all on function public.set_empreendimento_coords(uuid, numeric, numeric)
  from public, anon, authenticated, service_role;
grant execute on function public.set_empreendimento_coords(uuid, numeric, numeric)
  to authenticated;

comment on function public.set_empreendimento_coords(uuid, numeric, numeric) is
  'Cache de geocodificação: exige usuário autenticado e respeita grants/RLS do empreendimento.';
