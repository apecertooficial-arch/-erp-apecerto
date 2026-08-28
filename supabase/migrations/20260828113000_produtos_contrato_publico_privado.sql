-- Blindagem do contrato público de Produtos.
-- Não altera dados comerciais: apenas substitui projeções públicas e adiciona
-- um resolvedor mínimo para links legados.

set lock_timeout = '5s';
set statement_timeout = '60s';

create or replace function public.site_identidade_publica(
  p_tipologia text,
  p_dormitorios integer,
  p_bairro text,
  p_cidade text
)
returns text
language sql
immutable
set search_path = ''
as $$
  select concat_ws(
    ' ',
    case
      when lower(coalesce(p_tipologia, '')) like '%studio%' then 'Studio'
      when lower(coalesce(p_tipologia, '')) like '%cobertura%' then 'Cobertura'
      when lower(coalesce(p_tipologia, '')) like '%casa%' then 'Casa'
      when lower(coalesce(p_tipologia, '')) like '%terreno%' then 'Terreno'
      when lower(coalesce(p_tipologia, '')) like '%comercial%'
        or lower(coalesce(p_tipologia, '')) like '%sala%' then 'Imóvel comercial'
      else 'Apartamento'
    end,
    case
      when p_dormitorios = 1 then 'com 1 quarto'
      when p_dormitorios > 1 then 'com ' || p_dormitorios::text || ' quartos'
      else null
    end,
    case when nullif(btrim(p_bairro), '') is not null then 'em ' || btrim(p_bairro) else null end,
    case when nullif(btrim(p_cidade), '') is not null then
      case when nullif(btrim(p_bairro), '') is not null then ', ' || btrim(p_cidade) else 'em ' || btrim(p_cidade) end
    else null end
  );
$$;

create or replace function public.site_logradouro_publico(p_endereco text)
returns text
language sql
immutable
set search_path = ''
as $$
  select nullif(
    btrim(
      regexp_replace(
        regexp_replace(
          regexp_replace(split_part(coalesce(p_endereco, ''), ',', 1), '\\m[0-9]{5}-?[0-9]{3}\\M', '', 'g'),
          '(?i)(,|\\s)+\\s*(n[ºo.]?\\s*)?[0-9]+[a-z]?([-/]?[0-9a-z]+)?([,;].*)?$',
          '',
          'g'
        ),
        '(?i)\\s+(ap(to|artamento)?|unidade|bloco|torre|lote|complemento)\\s+.*$',
        '',
        'g'
      )
    ),
    ''
  );
$$;

create or replace function public.site_midia_token(p_id uuid)
returns text
language sql
immutable
strict
set search_path = ''
as $$ select 'midia:' || p_id::text $$;

revoke all on function public.site_identidade_publica(text, integer, text, text) from public;
revoke all on function public.site_logradouro_publico(text) from public;
revoke all on function public.site_midia_token(uuid) from public;
grant execute on function public.site_identidade_publica(text, integer, text, text) to anon, authenticated;
grant execute on function public.site_logradouro_publico(text) to anon, authenticated;
grant execute on function public.site_midia_token(uuid) to anon, authenticated;

create or replace view public.site_produtos
with (security_invoker = true)
as
select
  e.id,
  public.site_identidade_publica(null, coalesce(e.dormitorios, ua.dormitorios_min), e.bairro, e.cidade) as nome,
  'imovel-' || e.id::text as slug,
  'Imóvel disponível na região'::text as slogan,
  e.bairro,
  public.site_logradouro_publico(e.endereco) as endereco,
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
  '{}'::text[] as lazer,
  '{}'::text[] as diferenciais,
  e.finalidade,
  public.site_identidade_publica(null, coalesce(e.dormitorios, ua.dormitorios_min), e.bairro, e.cidade)
    || '. Consulte características, fotos e disponibilidade.' as descricao,
  e.iptu,
  null::numeric(9,6) as latitude,
  null::numeric(9,6) as longitude,
  (
    select public.site_midia_token(m.id) from public.midias m
    where m.empreendimento_id = e.id and m.unidade_id is null and m.tipo = 'foto'::public.tipo_midia
    order by m.is_capa desc, m.ordem, m.created_at limit 1
  ) as capa_path,
  (
    select coalesce(json_agg(public.site_midia_token(m.id) order by m.is_capa desc, m.ordem, m.created_at), '[]'::json)
    from public.midias m
    where m.empreendimento_id = e.id and m.unidade_id is null and m.tipo = 'foto'::public.tipo_midia
  ) as fotos,
  ua.unidades_disponiveis,
  ua.preco_min,
  ua.preco_max,
  ua.area_min as area_min_disponivel,
  ua.area_max as area_max_disponivel,
  ua.dormitorios_min as dormitorios_min_disponiveis,
  ua.dormitorios_max as dormitorios_max_disponiveis,
  ua.vagas_min as vagas_min_disponiveis,
  ua.vagas_max as vagas_max_disponiveis,
  ua.tipologias as tipologias_disponiveis,
  public.site_identidade_publica(null, coalesce(e.dormitorios, ua.dormitorios_min), e.bairro, e.cidade) as titulo,
  null::text as tour_url,
  e.cidade,
  e.uf,
  null::text as codigo,
  (
    select coalesce(json_agg(json_build_object(
      'id', u.id,
      'slug', 'imovel-' || u.id::text,
      'codigo', null,
      'numero', null,
      'tipologia', u.tipologia,
      'area_m2', u.area_m2,
      'vagas', u.vagas,
      'valor', coalesce(u.valor_promo, u.valor_tabela),
      'titulo_comercial', public.site_identidade_publica(u.tipologia, case when lower(coalesce(u.tipologia,'')) like '%studio%' then 0 else nullif(substring(u.tipologia from '^[[:space:]]*([0-9]+)'), '')::integer end, e.bairro, e.cidade),
      'descricao_comercial', public.site_identidade_publica(u.tipologia, case when lower(coalesce(u.tipologia,'')) like '%studio%' then 0 else nullif(substring(u.tipologia from '^[[:space:]]*([0-9]+)'), '')::integer end, e.bairro, e.cidade) || '. Consulte características, fotos e disponibilidade.',
      'seo_titulo', public.site_identidade_publica(u.tipologia, case when lower(coalesce(u.tipologia,'')) like '%studio%' then 0 else nullif(substring(u.tipologia from '^[[:space:]]*([0-9]+)'), '')::integer end, e.bairro, e.cidade),
      'seo_descricao', public.site_identidade_publica(u.tipologia, case when lower(coalesce(u.tipologia,'')) like '%studio%' then 0 else nullif(substring(u.tipologia from '^[[:space:]]*([0-9]+)'), '')::integer end, e.bairro, e.cidade) || '. Consulte características, fotos e disponibilidade.',
      'capa_path', (select public.site_midia_token(m.id) from public.midias m where m.unidade_id = u.id and m.tipo = 'foto'::public.tipo_midia order by m.is_capa desc, m.ordem, m.created_at limit 1),
      'fotos', (select coalesce(json_agg(public.site_midia_token(m.id) order by m.is_capa desc, m.ordem, m.created_at), '[]'::json) from public.midias m where m.unidade_id = u.id and m.tipo = 'foto'::public.tipo_midia),
      'fotos_meta', (select coalesce(json_agg(json_build_object('path', public.site_midia_token(m.id), 'alt_text', concat('Foto ', coalesce(nullif(m.categoria,''), 'do imóvel')), 'categoria', m.categoria, 'ordem', m.ordem) order by m.is_capa desc, m.ordem, m.created_at), '[]'::json) from public.midias m where m.unidade_id = u.id and m.tipo = 'foto'::public.tipo_midia)
    ) order by u.id), '[]'::json)
    from public.unidades u
    where u.empreendimento_id = e.id and u.publicado and u.disponivel and u.aprovacao = 'aprovado'
  ) as unidades_site,
  public.site_identidade_publica(null, coalesce(e.dormitorios, ua.dormitorios_min), e.bairro, e.cidade) as seo_titulo,
  public.site_identidade_publica(null, coalesce(e.dormitorios, ua.dormitorios_min), e.bairro, e.cidade)
    || '. Consulte características, fotos e disponibilidade.' as seo_descricao,
  (
    select coalesce(json_agg(json_build_object('path', public.site_midia_token(m.id), 'alt_text', concat('Foto ', coalesce(nullif(m.categoria,''), 'do imóvel')), 'categoria', m.categoria, 'ordem', m.ordem) order by m.is_capa desc, m.ordem, m.created_at), '[]'::json)
    from public.midias m where m.empreendimento_id = e.id and m.unidade_id is null and m.tipo = 'foto'::public.tipo_midia
  ) as fotos_meta
from public.empreendimentos e
join lateral (
  select
    count(*)::bigint as unidades_disponiveis,
    min(coalesce(u.valor_promo, u.valor_tabela)) as preco_min,
    max(coalesce(u.valor_promo, u.valor_tabela)) as preco_max,
    min(u.area_m2) as area_min,
    max(u.area_m2) as area_max,
    min(case when lower(coalesce(u.tipologia,'')) like '%studio%' then 0 else nullif(substring(u.tipologia from '^[[:space:]]*([0-9]+)'), '')::integer end) as dormitorios_min,
    max(case when lower(coalesce(u.tipologia,'')) like '%studio%' then 0 else nullif(substring(u.tipologia from '^[[:space:]]*([0-9]+)'), '')::integer end) as dormitorios_max,
    min(u.vagas) as vagas_min,
    max(u.vagas) as vagas_max,
    array_agg(distinct u.tipologia order by u.tipologia) filter (where u.tipologia is not null) as tipologias
  from public.unidades u
  where u.empreendimento_id = e.id and u.publicado and u.disponivel and u.aprovacao = 'aprovado'
) ua on ua.unidades_disponiveis > 0
where e.publicado and not e.rascunho and e.aprovacao = 'aprovado';

create or replace view public.site_produtos_catalogo
with (security_invoker = true)
as
select
  id, nome, slug, slogan, bairro, endereco, status, entrega, area_util,
  dormitorios, suites, banheiros, vagas, preco, condominio_valor, destaque, ordem,
  '{}'::text[] as lazer, '{}'::text[] as diferenciais, finalidade,
  null::text as descricao, iptu, null::numeric(9,6) as latitude, null::numeric(9,6) as longitude,
  capa_path, '[]'::json as fotos, unidades_disponiveis, preco_min, preco_max,
  area_min_disponivel, area_max_disponivel, dormitorios_min_disponiveis,
  dormitorios_max_disponiveis, vagas_min_disponiveis, vagas_max_disponiveis,
  tipologias_disponiveis, titulo, null::text as tour_url, cidade, uf,
  null::text as codigo,
  (
    select coalesce(json_agg(json_build_object(
      'id', unit->>'id', 'slug', unit->>'slug', 'codigo', null, 'numero', null,
      'tipologia', unit->>'tipologia', 'area_m2', unit->>'area_m2',
      'vagas', unit->>'vagas', 'valor', unit->>'valor', 'capa_path', unit->>'capa_path'
    )), '[]'::json)
    from json_array_elements(unidades_site) unit
  ) as unidades_site
from public.site_produtos;

revoke all on public.site_produtos from anon, authenticated;
revoke all on public.site_produtos_catalogo from anon, authenticated;
grant select on public.site_produtos to anon, authenticated;
grant select on public.site_produtos_catalogo to anon, authenticated;

create or replace function public.site_produto_resolver_slug_legado(p_slug text)
returns table(slug text)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if p_slug is null or length(p_slug) > 180 or p_slug !~ '^[a-z0-9-]+$' then
    return;
  end if;

  return query
  select 'imovel-' || e.id::text
  from public.empreendimentos e
  where e.slug = p_slug and e.publicado and not e.rascunho and e.aprovacao = 'aprovado'
  limit 1;

  if found then return; end if;

  return query
  select 'imovel-' || u.id::text
  from public.unidades u
  join public.empreendimentos e on e.id = u.empreendimento_id
  where u.publicado and u.disponivel and u.aprovacao = 'aprovado'
    and (
      p_slug = coalesce(nullif(btrim(regexp_replace(lower(coalesce(e.slug, '')), '[^a-z0-9]+', '-', 'g'), '-'), ''), 'imovel')
        || '-un-'
        || case when nullif(btrim(regexp_replace(lower(coalesce(u.codigo, '')), '[^a-z0-9]+', '-', 'g'), '-'), '') is null then '' else btrim(regexp_replace(lower(u.codigo), '[^a-z0-9]+', '-', 'g'), '-') || '-' end
        || u.id::text
      or right(p_slug, 36) = u.id::text
    )
  limit 1;
end;
$$;

revoke all on function public.site_produto_resolver_slug_legado(text) from public, anon, authenticated;
grant execute on function public.site_produto_resolver_slug_legado(text) to anon, authenticated;

comment on view public.site_produtos is
  'Contrato público allowlisted: identidade neutra, logradouro sem número, sem coordenadas, códigos, nomes internos ou paths de Storage.';
comment on view public.site_produtos_catalogo is
  'Projeção leve do contrato público blindado para catálogo.';
