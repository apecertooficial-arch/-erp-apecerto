do $$
declare
  v_total integer;
begin
  if not exists (
    select 1
    from public.empreendimentos e
    where e.codigo = 'AP0058'
      and e.latitude is not distinct from -23.612253::numeric
      and e.longitude is not distinct from -46.668321::numeric
  ) then
    raise exception 'FALHA MAP-T1: AP0058 não está na coordenada validada.';
  end if;

  if exists (
    select 1
    from public.site_produtos
    where latitude is null or longitude is null
       or latitude not between -24.2 and -23.2
       or longitude not between -47.2 and -46.0
  ) then
    raise exception 'FALHA MAP-T2: há empreendimento visível sem posição aceita pelo site.';
  end if;

  select count(*) into v_total
  from public.erp_auditoria
  where acao = 'corrigir_geolocalizacao_mapa'
    and entidade = 'empreendimento'
    and depois ->> 'codigo' = 'AP0058'
    and (depois ->> 'latitude')::numeric = -23.612253
    and (depois ->> 'longitude')::numeric = -46.668321;
  if v_total <> 1 then
    raise exception 'FALHA MAP-T3: auditoria AP0058 tem % registros, esperado 1.', v_total;
  end if;
end;
$$;

select
  count(*) as empreendimentos_visiveis,
  coalesce(sum(json_array_length(coalesce(unidades_site, '[]'::json))), 0) as unidades_visiveis,
  count(*) filter (where latitude is not null and longitude is not null) as empreendimentos_no_mapa,
  count(distinct (latitude, longitude)) as pontos_distintos,
  now() at time zone 'utc' as verificado_em_utc
from public.site_produtos;
