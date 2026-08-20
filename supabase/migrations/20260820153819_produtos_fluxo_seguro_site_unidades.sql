-- Corrige o fluxo Produtos ERP -> site e fecha escritas diretas permissivas.
-- Regras centrais: só gestão publica/aprova; unidade pronta é produto próprio;
-- mídia de unidade não vaza para a galeria do prédio; indicação pertence ao captador.

create or replace function public.is_product_manager()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.usuarios
    where id = auth.uid()
      and ativo
      and role::text in ('admin', 'gestor', 'executivo', 'gestor_comercial', 'gestor_equipe')
  );
$$;

revoke all on function public.is_product_manager() from public;
revoke all on function public.is_product_manager() from anon;
grant execute on function public.is_product_manager() to authenticated;

create or replace function public.aprovar_empreendimento(
  p_id uuid,
  p_aprovar boolean,
  p_motivo text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
begin
  if not public.is_product_manager() then
    return jsonb_build_object('ok', false, 'error', 'Apenas a gestão de Produtos pode aprovar empreendimentos.');
  end if;
  if not exists (select 1 from public.empreendimentos where id = p_id) then
    return jsonb_build_object('ok', false, 'error', 'Empreendimento não encontrado.');
  end if;
  if p_aprovar then
    update public.empreendimentos
       set aprovacao = 'aprovado', publicado = true, rascunho = false,
           aprovado_por = v_uid, aprovado_em = now(), reprovacao_motivo = null
     where id = p_id;
    return jsonb_build_object('ok', true, 'aprovacao', 'aprovado');
  end if;
  update public.empreendimentos
     set aprovacao = 'reprovado', publicado = false,
         aprovado_por = v_uid, aprovado_em = now(),
         reprovacao_motivo = nullif(btrim(coalesce(p_motivo, '')), '')
   where id = p_id;
  return jsonb_build_object('ok', true, 'aprovacao', 'reprovado');
end;
$$;

revoke all on function public.aprovar_empreendimento(uuid, boolean, text) from public;
revoke all on function public.aprovar_empreendimento(uuid, boolean, text) from anon;
grant execute on function public.aprovar_empreendimento(uuid, boolean, text) to authenticated;

-- O registro legado publicado como rascunho já estava invisível na view; normaliza
-- o estado e impede que a combinação inválida volte a ser gravada.
update public.empreendimentos
set publicado = false
where publicado and (rascunho or aprovacao <> 'aprovado');

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.empreendimentos'::regclass
      and conname = 'empreendimentos_publicacao_consistente'
  ) then
    alter table public.empreendimentos
      add constraint empreendimentos_publicacao_consistente
      check (not publicado or (not rascunho and aprovacao = 'aprovado'));
  end if;
end $$;

drop policy if exists empreend_insert_captacao on public.empreendimentos;
create policy empreend_insert_captacao on public.empreendimentos
for insert to authenticated
with check (
  public.is_product_manager()
  or (
    captado_por_usuario = (select auth.uid())
    and not publicado
    and rascunho
    and aprovacao = 'pendente'
  )
);

drop policy if exists empreend_update_captador on public.empreendimentos;
create policy empreend_update_captador on public.empreendimentos
for update to authenticated
using (
  public.is_product_manager()
  or captado_por_usuario = (select auth.uid())
  or captador_corretor_id in (
    select c.id from public.corretores c where c.usuario_id = (select auth.uid())
  )
)
with check (
  public.is_product_manager()
  or (
    (
      captado_por_usuario = (select auth.uid())
      or captador_corretor_id in (
        select c.id from public.corretores c where c.usuario_id = (select auth.uid())
      )
    )
    and not publicado
    and aprovacao <> 'aprovado'
  )
);

drop policy if exists unidades_insert_captacao on public.unidades;
create policy unidades_insert_captacao on public.unidades
for insert to authenticated
with check (
  public.is_product_manager()
  or (
    captador_corretor_id in (
      select c.id from public.corretores c where c.usuario_id = (select auth.uid())
    )
    and (
      (de_terceiros and aprovacao = 'pendente')
      or (
        not de_terceiros
        and exists (
          select 1 from public.empreendimentos e
          where e.id = unidades.empreendimento_id
            and e.captado_por_usuario = (select auth.uid())
            and e.rascunho
            and not e.publicado
        )
      )
    )
  )
);

drop policy if exists unidades_update_captador on public.unidades;
create policy unidades_update_captador on public.unidades
for update to authenticated
using (
  public.is_product_manager()
  or captador_corretor_id in (
    select c.id from public.corretores c where c.usuario_id = (select auth.uid())
  )
)
with check (
  public.is_product_manager()
  or (
    captador_corretor_id in (
      select c.id from public.corretores c where c.usuario_id = (select auth.uid())
    )
    and (
      (de_terceiros and aprovacao <> 'aprovado')
      or (
        not de_terceiros
        and exists (
          select 1 from public.empreendimentos e
          where e.id = unidades.empreendimento_id
            and e.captado_por_usuario = (select auth.uid())
            and not e.publicado
        )
      )
    )
  )
);

drop policy if exists unidades_delete_captador on public.unidades;
create policy unidades_delete_captador on public.unidades
for delete to authenticated
using (
  public.is_product_manager()
  or (
    not de_terceiros
    and exists (
      select 1 from public.empreendimentos e
      where e.id = unidades.empreendimento_id
        and e.captado_por_usuario = (select auth.uid())
        and not e.publicado
    )
  )
);

drop policy if exists unidades_select_produto_publicado on public.unidades;
create policy unidades_select_produto_publicado on public.unidades
for select to anon
using (
  disponivel
  and aprovacao = 'aprovado'
  and exists (
    select 1 from public.empreendimentos e
    where e.id = unidades.empreendimento_id
      and e.publicado and not e.rascunho and e.aprovacao = 'aprovado'
  )
);

drop policy if exists midias_insert_captacao on public.midias;
create policy midias_insert_captacao on public.midias
for insert to authenticated
with check (
  public.is_product_manager()
  or exists (
    select 1 from public.empreendimentos e
    where e.id = midias.empreendimento_id
      and e.captado_por_usuario = (select auth.uid())
  )
  or exists (
    select 1
    from public.unidades u
    join public.corretores c on c.id = u.captador_corretor_id
    where u.id = midias.unidade_id
      and u.empreendimento_id = midias.empreendimento_id
      and c.usuario_id = (select auth.uid())
  )
);

drop policy if exists midias_update_captador on public.midias;
create policy midias_update_captador on public.midias
for update to authenticated
using (
  public.is_product_manager()
  or exists (
    select 1 from public.empreendimentos e
    where e.id = midias.empreendimento_id
      and e.captado_por_usuario = (select auth.uid())
  )
  or exists (
    select 1 from public.unidades u
    join public.corretores c on c.id = u.captador_corretor_id
    where u.id = midias.unidade_id and c.usuario_id = (select auth.uid())
  )
)
with check (
  public.is_product_manager()
  or exists (
    select 1 from public.empreendimentos e
    where e.id = midias.empreendimento_id
      and e.captado_por_usuario = (select auth.uid())
  )
  or exists (
    select 1 from public.unidades u
    join public.corretores c on c.id = u.captador_corretor_id
    where u.id = midias.unidade_id
      and u.empreendimento_id = midias.empreendimento_id
      and c.usuario_id = (select auth.uid())
  )
);

drop policy if exists midias_delete_captacao on public.midias;
create policy midias_delete_captacao on public.midias
for delete to authenticated
using (
  public.is_product_manager()
  or exists (
    select 1 from public.empreendimentos e
    where e.id = midias.empreendimento_id
      and e.captado_por_usuario = (select auth.uid())
  )
  or exists (
    select 1 from public.unidades u
    join public.corretores c on c.id = u.captador_corretor_id
    where u.id = midias.unidade_id and c.usuario_id = (select auth.uid())
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
  )
  and (
    unidade_id is null
    or exists (
      select 1 from public.unidades u
      where u.id = midias.unidade_id
        and u.empreendimento_id = midias.empreendimento_id
        and u.disponivel and u.aprovacao = 'aprovado'
    )
  )
);

-- O visitante só recebe leitura das colunas comerciais. Escrita, truncate,
-- referências e dados de proprietário/acesso ficam explicitamente revogados.
revoke all privileges on public.empreendimentos from anon;
grant select (
  id, nome, slug, slogan, bairro, endereco, status, entrega, area_util,
  dormitorios, suites, banheiros, vagas, preco, condominio_valor, destaque,
  ordem, lazer, diferenciais, finalidade, descricao, iptu, latitude, longitude,
  titulo, tour_url, cidade, uf, codigo, publicado, rascunho, aprovacao
) on public.empreendimentos to anon;

revoke all privileges on public.unidades from anon;
grant select (
  id, empreendimento_id, codigo, numero, tipologia, area_m2, vagas,
  valor_tabela, valor_promo, disponivel, aprovacao
) on public.unidades to anon;

revoke all privileges on public.midias from anon;
grant select (
  id, empreendimento_id, unidade_id, storage_path, tipo, is_capa, created_at
) on public.midias to anon;

create index if not exists midias_produto_unidade_tipo_ordem_idx
on public.midias (empreendimento_id, unidade_id, tipo, is_capa desc, created_at);

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
  (select count(*) from public.unidades u where u.empreendimento_id = e.id and u.disponivel and u.aprovacao = 'aprovado') as unidades_disponiveis,
  (select min(coalesce(u.valor_promo, u.valor_tabela)) from public.unidades u where u.empreendimento_id = e.id and u.disponivel and u.aprovacao = 'aprovado') as preco_min,
  (select max(coalesce(u.valor_promo, u.valor_tabela)) from public.unidades u where u.empreendimento_id = e.id and u.disponivel and u.aprovacao = 'aprovado') as preco_max,
  (select min(u.area_m2) from public.unidades u where u.empreendimento_id = e.id and u.disponivel and u.aprovacao = 'aprovado') as area_min_disponivel,
  (select max(u.area_m2) from public.unidades u where u.empreendimento_id = e.id and u.disponivel and u.aprovacao = 'aprovado') as area_max_disponivel,
  (
    select min(case when lower(coalesce(u.tipologia, '')) like '%studio%' then 0 when substring(coalesce(u.tipologia, '') from '^[[:space:]]*([0-9]+)') is not null then substring(u.tipologia from '^[[:space:]]*([0-9]+)')::integer else null end)
    from public.unidades u where u.empreendimento_id = e.id and u.disponivel and u.aprovacao = 'aprovado'
  ) as dormitorios_min_disponiveis,
  (
    select max(case when lower(coalesce(u.tipologia, '')) like '%studio%' then 0 when substring(coalesce(u.tipologia, '') from '^[[:space:]]*([0-9]+)') is not null then substring(u.tipologia from '^[[:space:]]*([0-9]+)')::integer else null end)
    from public.unidades u where u.empreendimento_id = e.id and u.disponivel and u.aprovacao = 'aprovado'
  ) as dormitorios_max_disponiveis,
  (select min(u.vagas) from public.unidades u where u.empreendimento_id = e.id and u.disponivel and u.aprovacao = 'aprovado') as vagas_min_disponiveis,
  (select max(u.vagas) from public.unidades u where u.empreendimento_id = e.id and u.disponivel and u.aprovacao = 'aprovado') as vagas_max_disponiveis,
  (
    select array_agg(distinct u.tipologia order by u.tipologia) filter (where u.tipologia is not null)
    from public.unidades u where u.empreendimento_id = e.id and u.disponivel and u.aprovacao = 'aprovado'
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
    where u.empreendimento_id = e.id and u.disponivel and u.aprovacao = 'aprovado'
  ) as unidades_site
from public.empreendimentos e
where e.publicado and not e.rascunho and e.aprovacao = 'aprovado';

grant select on public.site_produtos to anon, authenticated;

comment on view public.site_produtos is
  'Catálogo público aprovado. Prédios usam apenas mídia comum; unidades prontas recebem galeria própria e nunca expõem dados privados.';
