-- Expõe ao site os campos comerciais que o ERP promete publicar.
-- A view permanece security invoker e nunca expõe rascunhos ou não aprovados.

do $baseline_site_view$
begin
  if to_regclass('public.apecerto_baseline_metadata') is not null then
    drop view if exists public.site_produtos;
  end if;
end
$baseline_site_view$;

create or replace view public.site_produtos
with (security_invoker = true)
as
select
  e.id,
  e.nome,
  e.slug,
  e.slogan,
  e.bairro,
  e.endereco,
  e.status,
  e.entrega,
  e.area_util,
  e.dormitorios,
  e.suites,
  e.banheiros,
  e.vagas,
  e.preco,
  e.condominio_valor,
  e.destaque,
  e.ordem,
  e.lazer,
  e.diferenciais,
  e.finalidade,
  e.descricao,
  e.iptu,
  e.latitude,
  e.longitude,
  (
    select m.storage_path
    from public.midias m
    where m.empreendimento_id = e.id
      and m.tipo = 'foto'::public.tipo_midia
    order by m.is_capa desc, m.created_at
    limit 1
  ) as capa_path,
  (
    select coalesce(json_agg(m.storage_path order by m.is_capa desc, m.created_at), '[]'::json)
    from public.midias m
    where m.empreendimento_id = e.id
      and m.tipo = 'foto'::public.tipo_midia
  ) as fotos,
  (select count(*) from public.unidades u where u.empreendimento_id = e.id and u.disponivel) as unidades_disponiveis,
  (select min(coalesce(u.valor_promo, u.valor_tabela)) from public.unidades u where u.empreendimento_id = e.id and u.disponivel) as preco_min,
  (select max(coalesce(u.valor_promo, u.valor_tabela)) from public.unidades u where u.empreendimento_id = e.id and u.disponivel) as preco_max,
  (select min(u.area_m2) from public.unidades u where u.empreendimento_id = e.id and u.disponivel) as area_min_disponivel,
  (select max(u.area_m2) from public.unidades u where u.empreendimento_id = e.id and u.disponivel) as area_max_disponivel,
  (
    select min(case
      when lower(coalesce(u.tipologia, '')) like '%studio%' then 0
      when substring(coalesce(u.tipologia, '') from '^[[:space:]]*([0-9]+)') is not null
        then substring(u.tipologia from '^[[:space:]]*([0-9]+)')::integer
      else null
    end)
    from public.unidades u
    where u.empreendimento_id = e.id and u.disponivel
  ) as dormitorios_min_disponiveis,
  (
    select max(case
      when lower(coalesce(u.tipologia, '')) like '%studio%' then 0
      when substring(coalesce(u.tipologia, '') from '^[[:space:]]*([0-9]+)') is not null
        then substring(u.tipologia from '^[[:space:]]*([0-9]+)')::integer
      else null
    end)
    from public.unidades u
    where u.empreendimento_id = e.id and u.disponivel
  ) as dormitorios_max_disponiveis,
  (select min(u.vagas) from public.unidades u where u.empreendimento_id = e.id and u.disponivel) as vagas_min_disponiveis,
  (select max(u.vagas) from public.unidades u where u.empreendimento_id = e.id and u.disponivel) as vagas_max_disponiveis,
  (
    select array_agg(distinct u.tipologia order by u.tipologia) filter (where u.tipologia is not null)
    from public.unidades u
    where u.empreendimento_id = e.id and u.disponivel
  ) as tipologias_disponiveis,
  e.titulo,
  e.tour_url,
  e.cidade,
  e.uf
from public.empreendimentos e
where e.publicado
  and not e.rascunho
  and e.aprovacao = 'aprovado';
