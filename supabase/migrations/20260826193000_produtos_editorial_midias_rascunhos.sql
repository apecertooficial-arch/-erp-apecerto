-- Produtos v6: conteúdo editorial por unidade, galeria ordenável e rascunho
-- privado no servidor. A unidade continua sendo o imóvel comercial canônico.

set lock_timeout = '5s';
set statement_timeout = '60s';

alter table public.empreendimentos
  add column if not exists seo_titulo text,
  add column if not exists seo_descricao text;

alter table public.unidades
  add column if not exists titulo_comercial text,
  add column if not exists descricao_comercial text,
  add column if not exists seo_titulo text,
  add column if not exists seo_descricao text;

alter table public.midias
  add column if not exists ordem integer,
  add column if not exists alt_text text,
  add column if not exists ia_categoria_sugerida text,
  add column if not exists ia_confianca numeric,
  add column if not exists ia_revisado_em timestamptz;

with ordenadas as (
  select id,
         row_number() over (
           partition by empreendimento_id, unidade_id, tipo
           order by is_capa desc, created_at, id
         ) - 1 as nova_ordem
  from public.midias
)
update public.midias m
set ordem = o.nova_ordem
from ordenadas o
where o.id = m.id and m.ordem is null;

alter table public.midias alter column ordem set default 0;
alter table public.midias alter column ordem set not null;

alter table public.midias drop constraint if exists midias_ordem_check;
alter table public.midias add constraint midias_ordem_check check (ordem between 0 and 10000);
alter table public.midias drop constraint if exists midias_alt_text_check;
alter table public.midias add constraint midias_alt_text_check
  check (alt_text is null or char_length(btrim(alt_text)) between 3 and 220);
alter table public.midias drop constraint if exists midias_ia_confianca_check;
alter table public.midias add constraint midias_ia_confianca_check
  check (ia_confianca is null or ia_confianca between 0 and 1);

create index if not exists midias_galeria_ordem_idx
  on public.midias (empreendimento_id, unidade_id, tipo, is_capa desc, ordem, created_at);

comment on column public.midias.ordem is
  'Ordem editorial explícita dentro da galeria do produto ou da unidade.';
comment on column public.midias.alt_text is
  'Descrição acessível e SEO revisada por uma pessoa; nunca contém dados do proprietário.';
comment on column public.midias.ia_categoria_sugerida is
  'Sugestão de categoria produzida por assistência visual; não substitui a decisão humana.';

create schema if not exists private;

create table if not exists private.produto_cadastro_rascunhos (
  usuario_id uuid primary key references auth.users(id) on delete cascade,
  payload jsonb not null check (jsonb_typeof(payload) = 'object'),
  etapa integer not null default 0 check (etapa between 0 and 6),
  versao bigint not null default 1 check (versao > 0),
  atualizado_em timestamptz not null default now(),
  expira_em timestamptz not null default (now() + interval '30 days')
);

alter table private.produto_cadastro_rascunhos
  add column if not exists versao bigint not null default 1;
alter table private.produto_cadastro_rascunhos
  drop constraint if exists produto_cadastro_rascunhos_versao_check;
alter table private.produto_cadastro_rascunhos
  add constraint produto_cadastro_rascunhos_versao_check check (versao > 0);

alter table private.produto_cadastro_rascunhos enable row level security;
revoke all on table private.produto_cadastro_rascunhos from public, anon, authenticated;

create or replace function public.produto_cadastro_rascunho_salvar(
  p_payload jsonb,
  p_etapa integer,
  p_versao_esperada bigint default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_versao bigint;
begin
  if v_uid is null then
    raise insufficient_privilege using message = 'DRAFT_FORBIDDEN: sessão inválida.';
  end if;
  if jsonb_typeof(p_payload) is distinct from 'object'
     or octet_length(p_payload::text) > 200000
     or p_etapa not between 0 and 6 then
    raise check_violation using message = 'DRAFT_INVALID: rascunho inválido ou acima do limite.';
  end if;

  delete from private.produto_cadastro_rascunhos where expira_em <= now();

  if p_versao_esperada is null then
    insert into private.produto_cadastro_rascunhos (
      usuario_id, payload, etapa, versao, atualizado_em, expira_em
    ) values (
      v_uid, p_payload, p_etapa, 1, now(), now() + interval '30 days'
    )
    on conflict (usuario_id) do nothing
    returning versao into v_versao;
  else
    update private.produto_cadastro_rascunhos
    set payload = p_payload,
        etapa = p_etapa,
        versao = versao + 1,
        atualizado_em = now(),
        expira_em = now() + interval '30 days'
    where usuario_id = v_uid and versao = p_versao_esperada
    returning versao into v_versao;
  end if;

  if v_versao is null then
    raise serialization_failure using message = 'DRAFT_CONFLICT: o rascunho foi alterado em outra sessão. Reabra o cadastro antes de continuar.';
  end if;

  return jsonb_build_object('ok', true, 'versao', v_versao, 'salvo_em', now());
end;
$$;

create or replace function public.produto_cadastro_rascunho_ler()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (
      select jsonb_build_object(
        'payload', r.payload,
        'etapa', r.etapa,
        'versao', r.versao,
        'atualizado_em', r.atualizado_em
      )
      from private.produto_cadastro_rascunhos r
      where r.usuario_id = auth.uid()
        and r.expira_em > now()
    ),
    '{}'::jsonb
  );
$$;

create or replace function public.produto_cadastro_rascunho_excluir()
returns boolean
language sql
security definer
set search_path = ''
as $$
  with removido as (
    delete from private.produto_cadastro_rascunhos
    where usuario_id = auth.uid()
    returning 1
  )
  select exists(select 1 from removido);
$$;

revoke all on function public.produto_cadastro_rascunho_salvar(jsonb, integer, bigint) from public, anon;
revoke all on function public.produto_cadastro_rascunho_ler() from public, anon;
revoke all on function public.produto_cadastro_rascunho_excluir() from public, anon;
grant execute on function public.produto_cadastro_rascunho_salvar(jsonb, integer, bigint) to authenticated;
grant execute on function public.produto_cadastro_rascunho_ler() to authenticated;
grant execute on function public.produto_cadastro_rascunho_excluir() to authenticated;

comment on table private.produto_cadastro_rascunhos is
  'Rascunho privado do cadastro de Produtos. Um registro por usuário, expira em 30 dias e não é exposto por tabela pública.';

-- O seletor de proprietário nunca lista a carteira inteira. Um corretor só
-- recebe proprietários de produtos que ele próprio captou.
create or replace function public.produto_proprietarios_meus()
returns table (id uuid, nome text, email text, telefone text)
language sql
stable
security definer
set search_path = ''
as $$
  select distinct p.id, p.nome, p.email, p.telefone
  from public.proprietarios p
  join public.empreendimentos e on e.proprietario_id = p.id
  left join public.corretores c on c.id = e.captador_corretor_id
  where (select auth.uid()) is not null
    and (
      (select public.is_product_manager())
      or (
        (e.captado_por_usuario = (select auth.uid()) or c.usuario_id = (select auth.uid()))
        and exists (select 1 from public.usuarios us where us.id = (select auth.uid()) and us.ativo)
      )
    )
  order by p.nome;
$$;

revoke all on function public.produto_proprietarios_meus() from public, anon, authenticated;
grant execute on function public.produto_proprietarios_meus() to authenticated;

-- A ficha lê PII por uma função autorizadora em vez de carregar a tabela
-- inteira e tentar ocultar os campos apenas depois, na resposta HTTP.
create or replace function public.produto_proprietario_ler(
  p_empreendimento_id uuid
)
returns table (id uuid, nome text, email text, telefone text)
language sql
stable
security definer
set search_path = ''
as $$
  select p.id, p.nome, p.email, p.telefone
  from public.empreendimentos e
  join public.proprietarios p on p.id = e.proprietario_id
  left join public.corretores c on c.id = e.captador_corretor_id
  where e.id = p_empreendimento_id
    and (select auth.uid()) is not null
    and (
      (select public.is_product_manager())
      or (
        (e.captado_por_usuario = (select auth.uid()) or c.usuario_id = (select auth.uid()))
        and exists (select 1 from public.usuarios us where us.id = (select auth.uid()) and us.ativo)
      )
    );
$$;

revoke all on function public.produto_proprietario_ler(uuid) from public, anon, authenticated;
grant execute on function public.produto_proprietario_ler(uuid) to authenticated;

-- Resolve o proprietário de uma nova captação sem abrir SELECT/INSERT direto
-- na tabela de PII para o navegador ou para a API autenticada.
create or replace function public.produto_proprietario_captacao_resolver(
  p_proprietario_id uuid,
  p_nome text,
  p_email text,
  p_telefone text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_corretor_id bigint;
  v_id uuid;
  v_email text := lower(btrim(coalesce(p_email, '')));
begin
  if v_uid is null then
    raise insufficient_privilege using message = 'OWNER_FORBIDDEN: sessão inválida.';
  end if;
  select c.id into v_corretor_id
  from public.corretores c
  join public.usuarios u on u.id = c.usuario_id
  where c.usuario_id = v_uid and u.ativo
  limit 1;
  if not public.is_product_manager() and v_corretor_id is null then
    raise insufficient_privilege using message = 'OWNER_FORBIDDEN: usuário sem vínculo operacional ativo.';
  end if;

  if p_proprietario_id is not null then
    if public.is_product_manager() or exists (
      select 1 from public.empreendimentos e
      where e.proprietario_id = p_proprietario_id
        and (e.captado_por_usuario = v_uid or e.captador_corretor_id = v_corretor_id)
    ) then
      return p_proprietario_id;
    end if;
    raise insufficient_privilege using message = 'OWNER_FORBIDDEN: proprietário fora da sua carteira.';
  end if;

  if nullif(btrim(coalesce(p_nome, '')), '') is null
     or nullif(v_email, '') is null
     or nullif(btrim(coalesce(p_telefone, '')), '') is null then
    raise check_violation using message = 'OWNER_INVALID: nome, e-mail e telefone são obrigatórios.';
  end if;
  select p.id into v_id from public.proprietarios p where lower(btrim(p.email)) = v_email limit 1;
  if v_id is null then
    begin
      insert into public.proprietarios (nome, email, telefone, created_by)
      values (btrim(p_nome), v_email, btrim(p_telefone), v_uid)
      returning id into v_id;
    exception when unique_violation then
      select p.id into v_id from public.proprietarios p where lower(btrim(p.email)) = v_email limit 1;
    end;
  end if;
  return v_id;
end;
$$;

revoke all on function public.produto_proprietario_captacao_resolver(uuid, text, text, text) from public, anon, authenticated;
grant execute on function public.produto_proprietario_captacao_resolver(uuid, text, text, text) to authenticated;

create or replace function public.produto_proprietario_salvar(
  p_empreendimento_id uuid,
  p_nome text,
  p_email text,
  p_telefone text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_corretor_id bigint;
  v_owner_id uuid;
begin
  select c.id into v_corretor_id
  from public.corretores c join public.usuarios us on us.id = c.usuario_id
  where c.usuario_id = v_uid and us.ativo limit 1;
  if v_uid is null or not (
    public.is_product_manager() or exists (
      select 1 from public.empreendimentos e
      where e.id = p_empreendimento_id
        and (e.captado_por_usuario = v_uid or e.captador_corretor_id = v_corretor_id)
    )
  ) then
    raise insufficient_privilege using message = 'OWNER_FORBIDDEN: sem permissão para editar este proprietário.';
  end if;
  if nullif(btrim(coalesce(p_nome, '')), '') is null
     or nullif(btrim(coalesce(p_email, '')), '') is null
     or nullif(btrim(coalesce(p_telefone, '')), '') is null then
    raise check_violation using message = 'OWNER_INVALID: nome, e-mail e telefone são obrigatórios.';
  end if;

  select e.proprietario_id into v_owner_id
  from public.empreendimentos e where e.id = p_empreendimento_id for update;
  if v_owner_id is null then
    insert into public.proprietarios (nome, email, telefone, created_by)
    values (btrim(p_nome), lower(btrim(p_email)), btrim(p_telefone), v_uid)
    returning id into v_owner_id;
    update public.empreendimentos set proprietario_id = v_owner_id where id = p_empreendimento_id;
  else
    update public.proprietarios
    set nome = btrim(p_nome), email = lower(btrim(p_email)), telefone = btrim(p_telefone)
    where id = v_owner_id;
  end if;
  return v_owner_id;
end;
$$;

revoke all on function public.produto_proprietario_salvar(uuid, text, text, text) from public, anon, authenticated;
grant execute on function public.produto_proprietario_salvar(uuid, text, text, text) to authenticated;

-- Gestores podem administrar a ficha; o corretor continua recebendo apenas
-- o proprietário das unidades cuja captação é dele.
create or replace function public.produto_unidades_proprietarios_ler(
  p_empreendimento_ids uuid[]
)
returns table (
  unidade_id uuid,
  proprietario_nome text,
  proprietario_contato text
)
language sql
stable
security definer
set search_path = ''
as $$
  select p.unidade_id, p.nome, p.contato
  from private.unidade_proprietarios p
  join public.unidades u on u.id = p.unidade_id
  left join public.corretores c on c.id = u.captador_corretor_id
  where u.empreendimento_id = any(coalesce(p_empreendimento_ids, array[]::uuid[]))
    and (select auth.uid()) is not null
    and (
      (select public.is_product_manager())
      or (
        c.usuario_id = (select auth.uid())
        and exists (select 1 from public.usuarios us where us.id = (select auth.uid()) and us.ativo)
      )
    );
$$;

revoke all on function public.produto_unidades_proprietarios_ler(uuid[]) from public, anon, authenticated;
grant execute on function public.produto_unidades_proprietarios_ler(uuid[]) to authenticated;

create or replace function public.produto_midias_reordenar(
  p_empreendimento_id uuid,
  p_unidade_id uuid,
  p_ids uuid[]
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_corretor_id bigint;
  v_tipo public.tipo_midia;
  v_pode boolean := false;
  v_total integer;
begin
  if v_uid is null or p_empreendimento_id is null or coalesce(array_length(p_ids, 1), 0) < 1 then
    raise insufficient_privilege using message = 'MEDIA_ORDER_FORBIDDEN: sessão ou galeria inválida.';
  end if;
  if array_length(p_ids, 1) > 500 or (
    select count(distinct media_id) from unnest(p_ids) as ids(media_id)
  ) <> array_length(p_ids, 1) then
    raise check_violation using message = 'MEDIA_ORDER_INVALID: lista de mídias inválida.';
  end if;

  select c.id into v_corretor_id
  from public.corretores c join public.usuarios us on us.id = c.usuario_id
  where c.usuario_id = v_uid and us.ativo limit 1;
  select public.is_product_manager() into v_pode;
  if not v_pode and p_unidade_id is null then
    select exists (
      select 1 from public.empreendimentos e
      where e.id = p_empreendimento_id
        and (e.captado_por_usuario = v_uid or (v_corretor_id is not null and e.captador_corretor_id = v_corretor_id))
    ) into v_pode;
  elsif not v_pode then
    select exists (
      select 1 from public.unidades u
      where u.id = p_unidade_id and u.empreendimento_id = p_empreendimento_id
        and v_corretor_id is not null and u.captador_corretor_id = v_corretor_id
    ) into v_pode;
  end if;
  if not v_pode then
    raise insufficient_privilege using message = 'MEDIA_ORDER_FORBIDDEN: sem permissão para ordenar esta galeria.';
  end if;

  select m.tipo into v_tipo from public.midias m
  where m.id = p_ids[1] and m.empreendimento_id = p_empreendimento_id
    and m.unidade_id is not distinct from p_unidade_id;
  if v_tipo is null then
    raise exception using errcode = 'P0002', message = 'MEDIA_ORDER_NOT_FOUND: mídia não encontrada.';
  end if;
  select count(*) into v_total from public.midias m
  where m.empreendimento_id = p_empreendimento_id
    and m.unidade_id is not distinct from p_unidade_id and m.tipo = v_tipo;
  if v_total <> array_length(p_ids, 1) or exists (
    select 1 from unnest(p_ids) media_id
    where not exists (
      select 1 from public.midias m where m.id = media_id and m.empreendimento_id = p_empreendimento_id
        and m.unidade_id is not distinct from p_unidade_id and m.tipo = v_tipo
    )
  ) then
    raise check_violation using message = 'MEDIA_ORDER_INVALID: a lista não corresponde à galeria atual.';
  end if;

  update public.midias m set ordem = ordered.position - 1
  from unnest(p_ids) with ordinality ordered(id, position)
  where m.id = ordered.id;
  return jsonb_build_object('ok', true, 'quantidade', v_total);
end;
$$;

revoke all on function public.produto_midias_reordenar(uuid, uuid, uuid[]) from public, anon;
grant execute on function public.produto_midias_reordenar(uuid, uuid, uuid[]) to authenticated;

-- A troca da capa acontece em uma única transação. Assim uma falha não deixa
-- a galeria sem capa entre dois updates separados do cliente.
create or replace function public.produto_midia_definir_capa(
  p_empreendimento_id uuid,
  p_unidade_id uuid,
  p_media_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_corretor_id bigint;
  v_pode boolean := false;
begin
  if v_uid is null then
    raise insufficient_privilege using message = 'MEDIA_COVER_FORBIDDEN: sessão inválida.';
  end if;
  select c.id into v_corretor_id
  from public.corretores c join public.usuarios us on us.id = c.usuario_id
  where c.usuario_id = v_uid and us.ativo limit 1;
  select public.is_product_manager() into v_pode;
  if not v_pode and p_unidade_id is null then
    select exists (
      select 1 from public.empreendimentos e
      where e.id = p_empreendimento_id
        and (e.captado_por_usuario = v_uid or (v_corretor_id is not null and e.captador_corretor_id = v_corretor_id))
    ) into v_pode;
  elsif not v_pode then
    select exists (
      select 1 from public.unidades u
      where u.id = p_unidade_id and u.empreendimento_id = p_empreendimento_id
        and v_corretor_id is not null and u.captador_corretor_id = v_corretor_id
    ) into v_pode;
  end if;
  if not v_pode then
    raise insufficient_privilege using message = 'MEDIA_COVER_FORBIDDEN: sem permissão para alterar esta galeria.';
  end if;
  if not exists (
    select 1 from public.midias m
    where m.id = p_media_id and m.empreendimento_id = p_empreendimento_id
      and m.unidade_id is not distinct from p_unidade_id
      and m.tipo = 'foto'::public.tipo_midia
  ) then
    raise exception using errcode = 'P0002', message = 'MEDIA_COVER_NOT_FOUND: foto não encontrada.';
  end if;

  update public.midias m
  set is_capa = (m.id = p_media_id)
  where m.empreendimento_id = p_empreendimento_id
    and m.unidade_id is not distinct from p_unidade_id
    and m.tipo = 'foto'::public.tipo_midia;

  return jsonb_build_object('ok', true, 'media_id', p_media_id);
end;
$$;

revoke all on function public.produto_midia_definir_capa(uuid, uuid, uuid) from public, anon, authenticated;
grant execute on function public.produto_midia_definir_capa(uuid, uuid, uuid) to authenticated;

-- A autoria da unidade é o vínculo de captação. O marcador legado
-- de_terceiros não pode retirar do captador o direito de corrigir sua ficha.
drop policy if exists unidades_update_captador on public.unidades;
create policy unidades_update_captador on public.unidades
for update to authenticated
using (
  public.is_product_manager()
  or captador_corretor_id in (
    select c.id from public.corretores c join public.usuarios us on us.id = c.usuario_id
    where c.usuario_id = (select auth.uid()) and us.ativo
  )
)
with check (
  public.is_product_manager()
  or (
    captador_corretor_id in (
      select c.id from public.corretores c join public.usuarios us on us.id = c.usuario_id
      where c.usuario_id = (select auth.uid()) and us.ativo
    )
    and not publicado
    and aprovacao <> 'aprovado'
  )
);

drop policy if exists emp_storage_delete_captador on storage.objects;
create policy emp_storage_delete_captador on storage.objects
for delete to authenticated
using (
  bucket_id = 'empreendimentos'
  and (
    (storage.foldername(name))[1] = (select auth.uid())::text
    or public.is_product_manager()
    or exists (
      select 1
      from public.midias m
      join public.unidades u
        on u.id = m.unidade_id and u.empreendimento_id = m.empreendimento_id
      join public.corretores c on c.id = u.captador_corretor_id
      join public.usuarios us on us.id = c.usuario_id and us.ativo
      where m.storage_path = storage.objects.name
        and c.usuario_id = (select auth.uid())
    )
  )
);

-- Compatibilidade com a função v5: ela exigia de_terceiros=true. A correção
-- autoriza primeiro pelo captador canônico e ajusta o marcador apenas dentro
-- da mesma transação que exclui a unidade; se a exclusão falhar, tudo reverte.
create or replace function public.produto_unidade_excluir_canonica(
  p_empreendimento_id uuid,
  p_unidade_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_corretor_id bigint;
  v_gerencia boolean := false;
begin
  if v_uid is null then
    raise insufficient_privilege using message = 'UNIT_DELETE_FORBIDDEN: sessão inválida.';
  end if;
  v_gerencia := coalesce(public.is_product_manager(), false);
  select c.id into v_corretor_id
  from public.corretores c join public.usuarios us on us.id = c.usuario_id
  where c.usuario_id = v_uid and us.ativo limit 1;
  if not v_gerencia and not exists (
    select 1 from public.unidades u
    where u.id = p_unidade_id and u.empreendimento_id = p_empreendimento_id
      and v_corretor_id is not null and u.captador_corretor_id = v_corretor_id
  ) then
    raise insufficient_privilege using message = 'UNIT_DELETE_FORBIDDEN: somente o captador da unidade ou a gestão pode excluí-la.';
  end if;
  if not v_gerencia then
    update public.unidades u set de_terceiros = true
    where u.id = p_unidade_id and u.empreendimento_id = p_empreendimento_id;
  end if;
  return public.produto_unidade_excluir(p_empreendimento_id, p_unidade_id);
end;
$$;

revoke all on function public.produto_unidade_excluir_canonica(uuid, uuid) from public, anon, authenticated;
grant execute on function public.produto_unidade_excluir_canonica(uuid, uuid) to authenticated;

-- A view pública continua compatível e ganha apenas metadados editoriais.
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
    order by m.is_capa desc, m.ordem, m.created_at limit 1
  ) as capa_path,
  (
    select coalesce(json_agg(m.storage_path order by m.is_capa desc, m.ordem, m.created_at), '[]'::json)
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
      'id', u.id,
      'slug', coalesce(nullif(btrim(regexp_replace(lower(coalesce(e.slug, '')), '[^a-z0-9]+', '-', 'g'), '-'), ''), 'imovel')
        || '-un-'
        || case when nullif(btrim(regexp_replace(lower(coalesce(u.codigo, '')), '[^a-z0-9]+', '-', 'g'), '-'), '') is null then '' else btrim(regexp_replace(lower(u.codigo), '[^a-z0-9]+', '-', 'g'), '-') || '-' end
        || u.id::text,
      'codigo', u.codigo,
      'numero', u.numero,
      'tipologia', u.tipologia,
      'area_m2', u.area_m2,
      'vagas', u.vagas,
      'valor', coalesce(u.valor_promo, u.valor_tabela),
      'titulo_comercial', u.titulo_comercial,
      'descricao_comercial', u.descricao_comercial,
      'seo_titulo', u.seo_titulo,
      'seo_descricao', u.seo_descricao,
      'capa_path', (
        select m.storage_path from public.midias m
        where m.unidade_id = u.id and m.tipo = 'foto'::public.tipo_midia
        order by m.is_capa desc, m.ordem, m.created_at limit 1
      ),
      'fotos', (
        select coalesce(json_agg(m.storage_path order by m.is_capa desc, m.ordem, m.created_at), '[]'::json)
        from public.midias m where m.unidade_id = u.id and m.tipo = 'foto'::public.tipo_midia
      ),
      'fotos_meta', (
        select coalesce(json_agg(json_build_object('path', m.storage_path, 'alt_text', m.alt_text, 'categoria', m.categoria, 'ordem', m.ordem) order by m.is_capa desc, m.ordem, m.created_at), '[]'::json)
        from public.midias m where m.unidade_id = u.id and m.tipo = 'foto'::public.tipo_midia
      )
    ) order by u.numero nulls last, u.id), '[]'::json)
    from public.unidades u
    where u.empreendimento_id = e.id and u.publicado and u.disponivel and u.aprovacao = 'aprovado'
  ) as unidades_site,
  e.seo_titulo,
  e.seo_descricao,
  (
    select coalesce(json_agg(json_build_object('path', m.storage_path, 'alt_text', m.alt_text, 'categoria', m.categoria, 'ordem', m.ordem) order by m.is_capa desc, m.ordem, m.created_at), '[]'::json)
    from public.midias m where m.empreendimento_id = e.id and m.unidade_id is null and m.tipo = 'foto'::public.tipo_midia
  ) as fotos_meta
from public.empreendimentos e
where e.publicado and not e.rascunho and e.aprovacao = 'aprovado'
  and exists (
    select 1 from public.unidades u
    where u.empreendimento_id = e.id and u.publicado and u.disponivel and u.aprovacao = 'aprovado'
  );

revoke all privileges on public.site_produtos from anon, authenticated;
grant select on public.site_produtos to anon, authenticated;
grant select (seo_titulo, seo_descricao) on public.empreendimentos to anon;
grant select (titulo_comercial, descricao_comercial, seo_titulo, seo_descricao) on public.unidades to anon;
grant select (ordem, alt_text, categoria) on public.midias to anon;

comment on view public.site_produtos is
  'Fonte pública única: unidade publicada com conteúdo/SEO próprio, mídia ordenada e metadados acessíveis; sem dados privados.';

-- Auditoria gerencial, somente leitura. Não corrige preço automaticamente:
-- destaca valores incompatíveis com a finalidade para revisão humana.
create or replace function public.produto_precos_suspeitos()
returns table (
  entidade text,
  entidade_id uuid,
  codigo text,
  finalidade text,
  valor numeric,
  motivo text
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null or not public.is_product_manager() then
    raise insufficient_privilege using message = 'PRICE_AUDIT_FORBIDDEN: apenas a gestão pode auditar preços.';
  end if;

  return query
  select 'produto'::text, e.id, e.codigo::text, coalesce(e.finalidade, 'venda')::text, e.preco::numeric,
         case
           when lower(coalesce(e.finalidade, 'venda')) = 'aluguel' then 'Aluguel fora da faixa de R$ 500 a R$ 500.000'
           else 'Venda fora da faixa de R$ 100.000 a R$ 100.000.000'
         end
  from public.empreendimentos e
  where e.preco is not null and (
    (lower(coalesce(e.finalidade, 'venda')) = 'aluguel' and (e.preco < 500 or e.preco > 500000))
    or (lower(coalesce(e.finalidade, 'venda')) <> 'aluguel' and (e.preco < 100000 or e.preco > 100000000))
  )
  union all
  select 'unidade'::text, u.id, u.codigo::text, coalesce(e.finalidade, 'venda')::text, coalesce(u.valor_promo, u.valor_tabela)::numeric,
         case
           when lower(coalesce(e.finalidade, 'venda')) = 'aluguel' then 'Aluguel da unidade fora da faixa de R$ 500 a R$ 500.000'
           else 'Venda da unidade fora da faixa de R$ 100.000 a R$ 100.000.000'
         end
  from public.unidades u
  join public.empreendimentos e on e.id = u.empreendimento_id
  where coalesce(u.valor_promo, u.valor_tabela) is not null and (
    (lower(coalesce(e.finalidade, 'venda')) = 'aluguel' and (coalesce(u.valor_promo, u.valor_tabela) < 500 or coalesce(u.valor_promo, u.valor_tabela) > 500000))
    or (lower(coalesce(e.finalidade, 'venda')) <> 'aluguel' and (coalesce(u.valor_promo, u.valor_tabela) < 100000 or coalesce(u.valor_promo, u.valor_tabela) > 100000000))
  )
  order by 1, 3 nulls last;
end;
$$;

revoke all on function public.produto_precos_suspeitos() from public, anon, authenticated;
grant execute on function public.produto_precos_suspeitos() to authenticated;
