-- Somente leitura. Execute antes da migration.
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
select e.codigo, e.nome, e.latitude, e.longitude,
       c.latitude as latitude_validada, c.longitude as longitude_validada,
       case
         when e.latitude is not distinct from c.latitude
          and e.longitude is not distinct from c.longitude then 'ja_corrigido'
         when e.latitude is not distinct from c.latitude_anterior
          and e.longitude is not distinct from c.longitude_anterior then 'pronto_para_corrigir'
         else 'bloqueado_estado_inesperado'
       end as estado
from coordenadas c
left join public.empreendimentos e on e.codigo = c.codigo
order by c.codigo;

with resumo as (
  select
    count(*) filter (where u.publicado is true) as unidades_publicadas,
    count(*) filter (
      where u.publicado is true
        and (e.latitude is null or e.longitude is null)
    ) as unidades_publicadas_sem_coordenada,
    count(distinct e.id) filter (where u.publicado is true) as empreendimentos_visiveis
  from public.unidades u
  join public.empreendimentos e on e.id = u.empreendimento_id
)
select *, now() at time zone 'utc' as consultado_em_utc
from resumo;
