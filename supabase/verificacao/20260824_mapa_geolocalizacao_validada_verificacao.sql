do $$
declare
  v_total integer;
  v_def text;
  v_acl aclitem[];
  v_security_definer boolean;
begin
  with coordenadas(codigo, latitude, longitude) as (
    values
      ('AP0001', -23.599535::numeric, -46.660072::numeric),
      ('AP0004', -23.599611::numeric, -46.662762::numeric),
      ('AP0006', -23.613810::numeric, -46.667819::numeric),
      ('AP0010', -23.613441::numeric, -46.666123::numeric),
      ('AP0011', -23.610503::numeric, -46.665011::numeric),
      ('AP0014', -23.624548::numeric, -46.635838::numeric),
      ('AP0015', -23.605469::numeric, -46.665922::numeric),
      ('AP0016', -23.612795::numeric, -46.667360::numeric),
      ('AP0017', -23.611761::numeric, -46.668637::numeric),
      ('AP0019', -23.606011::numeric, -46.660267::numeric),
      ('AP0023', -23.614430::numeric, -46.666523::numeric),
      ('AP0027', -23.607567::numeric, -46.666957::numeric),
      ('AP0031', -23.611486::numeric, -46.667558::numeric),
      ('AP0032', -23.605351::numeric, -46.664072::numeric),
      ('AP0033', -23.614632::numeric, -46.670559::numeric),
      ('AP0038', -23.607567::numeric, -46.668507::numeric),
      ('AP0040', -23.601873::numeric, -46.656959::numeric),
      ('AP0041', -23.612047::numeric, -46.669266::numeric),
      ('AP0042', -23.599753::numeric, -46.661107::numeric),
      ('AP0048', -23.605477::numeric, -46.638712::numeric),
      ('AP0062', -23.608949::numeric, -46.664855::numeric)
  )
  select count(*) into v_total
  from coordenadas c
  join public.empreendimentos e on e.codigo = c.codigo
  where e.latitude is not distinct from c.latitude
    and e.longitude is not distinct from c.longitude;

  if v_total <> 21 then
    raise exception 'FALHA MAP-1: %/21 coordenadas validadas estão instaladas.', v_total;
  end if;

  if exists (
    select 1 from public.empreendimentos
    where latitude = -23.597085 and longitude = -46.662888
  ) then
    raise exception 'FALHA MAP-2: a coordenada genérica de Moema ainda existe.';
  end if;

  if exists (
    select 1 from public.site_produtos
    where latitude is null or longitude is null
       or latitude not between -24.2 and -23.2
       or longitude not between -47.2 and -46.0
  ) then
    raise exception 'FALHA MAP-3: há empreendimento visível sem coordenada válida na região de São Paulo.';
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.empreendimentos'::regclass
      and conname = 'empreendimentos_coordenadas_validas_check'
      and convalidated is true
  ) then
    raise exception 'FALHA MAP-4: constraint de coordenadas ausente ou não validada.';
  end if;

  select pg_get_functiondef(p.oid), p.proacl, p.prosecdef
    into v_def, v_acl, v_security_definer
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.proname = 'set_empreendimento_coords'
    and pg_get_function_identity_arguments(p.oid) = 'p_id uuid, p_lat numeric, p_lon numeric';

  if v_def is null or v_security_definer is true
     or has_function_privilege('anon', 'public.set_empreendimento_coords(uuid,numeric,numeric)', 'EXECUTE')
     or not has_function_privilege('authenticated', 'public.set_empreendimento_coords(uuid,numeric,numeric)', 'EXECUTE') then
    raise exception 'FALHA MAP-5: RPC de coordenadas não está restrita ao usuário autenticado/RLS.';
  end if;

  select count(distinct depois ->> 'codigo') into v_total
  from public.erp_auditoria
  where acao = 'corrigir_geolocalizacao_mapa'
    and entidade = 'empreendimento'
    and depois ->> 'codigo' in (
      'AP0001','AP0004','AP0006','AP0010','AP0011','AP0014','AP0015',
      'AP0016','AP0017','AP0019','AP0023','AP0027','AP0031','AP0032',
      'AP0033','AP0038','AP0040','AP0041','AP0042','AP0048','AP0062'
    );
  if v_total <> 21 then
    raise exception 'FALHA MAP-6: auditoria cobre %/21 empreendimentos.', v_total;
  end if;
end;
$$;

select
  count(*) as empreendimentos_visiveis,
  coalesce(sum(json_array_length(coalesce(unidades_site, '[]'::json))), 0) as unidades_visiveis,
  count(*) filter (where latitude is not null and longitude is not null) as empreendimentos_no_mapa,
  count(distinct (latitude, longitude)) filter (where latitude is not null and longitude is not null) as pontos_distintos,
  now() at time zone 'utc' as verificado_em_utc
from public.site_produtos;
