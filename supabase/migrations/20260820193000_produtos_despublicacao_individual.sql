-- Permite retirar do site um apartamento pronto sem indisponibilizar a unidade
-- e sem despublicar as demais unidades do mesmo condomínio.

alter table public.unidades
  add column if not exists publicado boolean not null default true;

comment on column public.unidades.publicado is
  'Controle editorial do site. Não altera disponibilidade comercial nem aprovação da unidade.';

drop policy if exists unidades_select_produto_publicado on public.unidades;
create policy unidades_select_produto_publicado on public.unidades
for select to anon
using (
  publicado
  and disponivel
  and aprovacao = 'aprovado'
  and exists (
    select 1 from public.empreendimentos e
    where e.id = unidades.empreendimento_id
      and e.publicado and not e.rascunho and e.aprovacao = 'aprovado'
  )
);

drop policy if exists midias_select_produto_publicado on public.midias;
create policy midias_select_produto_publicado on public.midias
for select to anon
using (
  exists (
    select 1 from public.empreendimentos e
    where e.id = midias.empreendimento_id
      and e.publicado and not e.rascunho and e.aprovacao = 'aprovado'
      and (
        midias.unidade_id is null
        or exists (
          select 1 from public.unidades u
          where u.id = midias.unidade_id
            and u.empreendimento_id = midias.empreendimento_id
            and u.publicado and u.disponivel and u.aprovacao = 'aprovado'
        )
      )
  )
);

revoke all privileges on public.unidades from anon;
grant select (
  id, empreendimento_id, codigo, numero, tipologia, area_m2, vagas,
  valor_tabela, valor_promo, disponivel, aprovacao, publicado
) on public.unidades to anon;

create or replace view public.site_produtos
with (security_invoker = true)
as
select
  e.id, e.nome, e.slug, e.slogan, e.bairro, e.endereco, e.status, e.entrega,
  e.area_util, e.dormitorios, e.suites, e.banheiros, e.vagas, e.preco,
  e.condominio_valor, e.destaque, e.ordem, e.lazer, e.diferenciais,
  e.finalidade, e.descricao, e.iptu, e.latitude, e.longitude,
  (
    select m.storage_path from public.midias m
    where m.empreendimento_id = e.id and m.unidade_id is null and m.tipo = 'foto'::public.tipo_midia
    order by m.is_capa desc, m.created_at limit 1
  ) as capa_path,
  (
    select coalesce(json_agg(m.storage_path order by m.is_capa desc, m.created_at), '[]'::json)
    from public.midias m
    where m.empreendimento_id = e.id and m.unidade_id is null and m.tipo = 'foto'::public.tipo_midia
  ) as fotos,
  (select count(*) from public.unidades u where u.empreendimento_id = e.id and u.publicado and u.disponivel and u.aprovacao = 'aprovado') as unidades_disponiveis,
  (select min(coalesce(u.valor_promo, u.valor_tabela)) from public.unidades u where u.empreendimento_id = e.id and u.publicado and u.disponivel and u.aprovacao = 'aprovado') as preco_min,
  (select max(coalesce(u.valor_promo, u.valor_tabela)) from public.unidades u where u.empreendimento_id = e.id and u.publicado and u.disponivel and u.aprovacao = 'aprovado') as preco_max,
  (select min(u.area_m2) from public.unidades u where u.empreendimento_id = e.id and u.publicado and u.disponivel and u.aprovacao = 'aprovado') as area_min_disponivel,
  (select max(u.area_m2) from public.unidades u where u.empreendimento_id = e.id and u.publicado and u.disponivel and u.aprovacao = 'aprovado') as area_max_disponivel,
  (
    select min(case when lower(coalesce(u.tipologia, '')) like '%studio%' then 0 when substring(coalesce(u.tipologia, '') from '^[[:space:]]*([0-9]+)') is not null then substring(u.tipologia from '^[[:space:]]*([0-9]+)')::integer else null end)
    from public.unidades u where u.empreendimento_id = e.id and u.publicado and u.disponivel and u.aprovacao = 'aprovado'
  ) as dormitorios_min_disponiveis,
  (
    select max(case when lower(coalesce(u.tipologia, '')) like '%studio%' then 0 when substring(coalesce(u.tipologia, '') from '^[[:space:]]*([0-9]+)') is not null then substring(u.tipologia from '^[[:space:]]*([0-9]+)')::integer else null end)
    from public.unidades u where u.empreendimento_id = e.id and u.publicado and u.disponivel and u.aprovacao = 'aprovado'
  ) as dormitorios_max_disponiveis,
  (select min(u.vagas) from public.unidades u where u.empreendimento_id = e.id and u.publicado and u.disponivel and u.aprovacao = 'aprovado') as vagas_min_disponiveis,
  (select max(u.vagas) from public.unidades u where u.empreendimento_id = e.id and u.publicado and u.disponivel and u.aprovacao = 'aprovado') as vagas_max_disponiveis,
  (
    select array_agg(distinct u.tipologia order by u.tipologia) filter (where u.tipologia is not null)
    from public.unidades u where u.empreendimento_id = e.id and u.publicado and u.disponivel and u.aprovacao = 'aprovado'
  ) as tipologias_disponiveis,
  e.titulo, e.tour_url, e.cidade, e.uf, e.codigo,
  (
    select coalesce(json_agg(json_build_object(
      'codigo', u.codigo,
      'numero', u.numero,
      'tipologia', u.tipologia,
      'area_m2', u.area_m2,
      'vagas', u.vagas,
      'valor', coalesce(u.valor_promo, u.valor_tabela),
      'capa_path', (
        select m.storage_path from public.midias m
        where m.unidade_id = u.id and m.tipo = 'foto'::public.tipo_midia
        order by m.is_capa desc, m.created_at limit 1
      ),
      'fotos', (
        select coalesce(json_agg(m.storage_path order by m.is_capa desc, m.created_at), '[]'::json)
        from public.midias m
        where m.unidade_id = u.id and m.tipo = 'foto'::public.tipo_midia
      )
    ) order by u.numero), '[]'::json)
    from public.unidades u
    where u.empreendimento_id = e.id and u.publicado and u.disponivel and u.aprovacao = 'aprovado'
  ) as unidades_site
from public.empreendimentos e
where e.publicado and not e.rascunho and e.aprovacao = 'aprovado';

grant select on public.site_produtos to anon, authenticated;

create index if not exists unidades_site_publicacao_idx
on public.unidades (empreendimento_id, publicado, disponivel, aprovacao);

comment on view public.site_produtos is
  'Catálogo público aprovado. Apartamentos prontos respeitam publicação individual sem perder disponibilidade comercial.';
