-- Rollback de dados somente. Mantém a constraint e o fechamento de segurança da RPC.
set lock_timeout = '5s';
set statement_timeout = '30s';

do $$
declare
  v_alvo record;
  v_total integer := 0;
begin
  for v_alvo in
    with coordenadas(codigo, latitude, longitude, latitude_anterior, longitude_anterior) as (
      values
        ('AP0001', -23.599535::numeric, -46.660072::numeric, null::numeric, null::numeric),
        ('AP0004', -23.599611::numeric, -46.662762::numeric, null::numeric, null::numeric),
        ('AP0006', -23.613810::numeric, -46.667819::numeric, null::numeric, null::numeric),
        ('AP0010', -23.613441::numeric, -46.666123::numeric, -23.597085::numeric, -46.662888::numeric),
        ('AP0011', -23.610503::numeric, -46.665011::numeric, null::numeric, null::numeric),
        ('AP0014', -23.624548::numeric, -46.635838::numeric, null::numeric, null::numeric),
        ('AP0015', -23.605469::numeric, -46.665922::numeric, null::numeric, null::numeric),
        ('AP0016', -23.612795::numeric, -46.667360::numeric, null::numeric, null::numeric),
        ('AP0017', -23.611761::numeric, -46.668637::numeric, -23.597085::numeric, -46.662888::numeric),
        ('AP0019', -23.606011::numeric, -46.660267::numeric, null::numeric, null::numeric),
        ('AP0023', -23.614430::numeric, -46.666523::numeric, null::numeric, null::numeric),
        ('AP0027', -23.607567::numeric, -46.666957::numeric, null::numeric, null::numeric),
        ('AP0031', -23.611486::numeric, -46.667558::numeric, null::numeric, null::numeric),
        ('AP0032', -23.605351::numeric, -46.664072::numeric, -23.597085::numeric, -46.662888::numeric),
        ('AP0033', -23.614632::numeric, -46.670559::numeric, null::numeric, null::numeric),
        ('AP0038', -23.607567::numeric, -46.668507::numeric, null::numeric, null::numeric),
        ('AP0040', -23.601873::numeric, -46.656959::numeric, null::numeric, null::numeric),
        ('AP0041', -23.612047::numeric, -46.669266::numeric, -23.597085::numeric, -46.662888::numeric),
        ('AP0042', -23.599753::numeric, -46.661107::numeric, -23.597085::numeric, -46.662888::numeric),
        ('AP0048', -23.605477::numeric, -46.638712::numeric, null::numeric, null::numeric),
        ('AP0062', -23.608949::numeric, -46.664855::numeric, null::numeric, null::numeric)
    )
    select e.id, e.codigo,
           e.latitude as latitude_atual, e.longitude as longitude_atual,
           c.latitude as latitude_nova, c.longitude as longitude_nova,
           c.latitude_anterior, c.longitude_anterior
    from coordenadas c
    join public.empreendimentos e on e.codigo = c.codigo
    order by e.codigo
    for update of e
  loop
    if v_alvo.latitude_atual is not distinct from v_alvo.latitude_anterior
       and v_alvo.longitude_atual is not distinct from v_alvo.longitude_anterior then
      continue;
    end if;
    if v_alvo.latitude_atual is distinct from v_alvo.latitude_nova
       or v_alvo.longitude_atual is distinct from v_alvo.longitude_nova then
      raise exception 'ROLLBACK_MAP_BLOCKED: % foi editado depois do rollout.', v_alvo.codigo;
    end if;
    update public.empreendimentos
       set latitude = v_alvo.latitude_anterior,
           longitude = v_alvo.longitude_anterior
     where id = v_alvo.id;
    insert into public.erp_auditoria (
      usuario_nome, acao, modulo, entidade, entidade_id, antes, depois, detalhe
    ) values (
      'Sistema', 'rollback_geolocalizacao_mapa', 'produtos', 'empreendimento', v_alvo.id::text,
      jsonb_build_object('codigo', v_alvo.codigo, 'latitude', v_alvo.latitude_atual, 'longitude', v_alvo.longitude_atual),
      jsonb_build_object('codigo', v_alvo.codigo, 'latitude', v_alvo.latitude_anterior, 'longitude', v_alvo.longitude_anterior),
      'Rollback controlado da correção do mapa. txid=' || txid_current()::text
    );
    v_total := v_total + 1;
  end loop;
  if v_total not in (0, 21) then
    raise exception 'ROLLBACK_MAP_PARTIAL: operação parcial (%/21).', v_total;
  end if;
end;
$$;
