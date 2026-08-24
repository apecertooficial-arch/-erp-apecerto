-- Rollback controlado. Não permite tornar invisível imóvel ainda publicado.
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
    raise exception 'ROLLBACK_MAP_TEMPUS_NOT_FOUND: AP0058 não encontrado.';
  end if;

  if exists (
    select 1 from public.unidades u
    where u.empreendimento_id = v_emp.id
      and u.publicado is true
  ) then
    raise exception 'ROLLBACK_MAP_TEMPUS_BLOCKED: AP0058 possui unidade publicada.';
  end if;

  if v_emp.latitude is distinct from -23.612253::numeric
     or v_emp.longitude is distinct from -46.668321::numeric then
    raise exception 'ROLLBACK_MAP_TEMPUS_CHANGED: AP0058 foi editado depois do rollout.';
  end if;

  update public.empreendimentos
     set latitude = null,
         longitude = null
   where id = v_emp.id;

  insert into public.erp_auditoria (
    usuario_nome, acao, modulo, entidade, entidade_id, antes, depois, detalhe
  ) values (
    'Sistema', 'rollback_geolocalizacao_mapa', 'produtos', 'empreendimento', v_emp.id::text,
    jsonb_build_object('codigo', v_emp.codigo, 'latitude', v_emp.latitude, 'longitude', v_emp.longitude),
    jsonb_build_object('codigo', v_emp.codigo, 'latitude', null, 'longitude', null),
    'Rollback controlado da geolocalização AP0058. txid=' || txid_current()::text
  );
end;
$$;
