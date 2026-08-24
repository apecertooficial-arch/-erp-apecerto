-- Somente leitura. Execute antes da migration.
select
  e.id,
  e.codigo,
  e.nome,
  e.endereco,
  e.numero,
  e.cep,
  e.latitude,
  e.longitude,
  count(*) filter (where u.publicado is true) as unidades_publicadas,
  case
    when e.latitude is null and e.longitude is null then 'pronto_para_corrigir'
    when e.latitude = -23.612253 and e.longitude = -46.668321 then 'ja_corrigido'
    else 'bloqueado_estado_inesperado'
  end as estado
from public.empreendimentos e
left join public.unidades u on u.empreendimento_id = e.id
where e.codigo = 'AP0058'
group by e.id;

select
  count(*) as empreendimentos_visiveis,
  coalesce(sum(json_array_length(coalesce(unidades_site, '[]'::json))), 0) as unidades_visiveis,
  count(*) filter (
    where latitude is null or longitude is null
       or latitude not between -24.2 and -23.2
       or longitude not between -47.2 and -46.0
  ) as empreendimentos_visiveis_sem_posicao_valida,
  now() at time zone 'utc' as consultado_em_utc
from public.site_produtos;
