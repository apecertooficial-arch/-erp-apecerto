-- Corrige somente o Tempus recém-republicado, sem alterar regras globais de
-- publicação ou edição do ERP.

set lock_timeout = '5s';
set statement_timeout = '30s';

do $$
declare
  v_emp public.empreendimentos%rowtype;
begin
  select e.* into v_emp
  from public.empreendimentos e
  where e.codigo = 'AP0058'
  for update;

  if not found then
    raise exception using
      errcode = 'P0001',
      message = 'MAP_PRODUCT_NOT_FOUND: AP0058 não encontrado.';
  end if;

  if v_emp.latitude is not distinct from -23.612253::numeric
     and v_emp.longitude is not distinct from -46.668321::numeric then
    return;
  end if;

  if v_emp.latitude is not null or v_emp.longitude is not null then
    raise exception using
      errcode = 'P0001',
      message = 'MAP_COORDS_CHANGED: AP0058 possui coordenadas diferentes do preflight.';
  end if;

  update public.empreendimentos
     set latitude = -23.612253,
         longitude = -46.668321
   where id = v_emp.id;

  insert into public.erp_auditoria (
    usuario_nome, acao, modulo, entidade, entidade_id, antes, depois, detalhe
  ) values (
    'Sistema',
    'corrigir_geolocalizacao_mapa',
    'produtos',
    'empreendimento',
    v_emp.id::text,
    jsonb_build_object('codigo', v_emp.codigo, 'latitude', v_emp.latitude, 'longitude', v_emp.longitude),
    jsonb_build_object('codigo', v_emp.codigo, 'latitude', -23.612253, 'longitude', -46.668321),
    'Tempus Moema, Avenida dos Carinás, 156. Coordenada do ponto exato no Google Maps; endereço confirmado por fontes imobiliárias públicas. txid=' || txid_current()::text
  );
end;
$$;
