-- PRO-MIG-001 — seleção compartilhada de unidades para migração.
--
-- A lista guarda somente o identificador da unidade e a autoria da seleção.
-- Dados de proprietário continuam na projeção privada existente e só podem
-- ser lidos por gestão de Produtos ou por quem recebeu a permissão granular
-- produtos.selecionar_migracao.

set lock_timeout = '5s';
set statement_timeout = '60s';

create table if not exists public.produto_migracao_selecoes (
  unidade_id uuid primary key references public.unidades(id) on delete restrict,
  selecionado_por uuid not null references public.usuarios(id) on delete restrict,
  selecionado_em timestamptz not null default now()
);

comment on table public.produto_migracao_selecoes is
  'Lista compartilhada das unidades escolhidas para migração; não duplica dados comerciais nem dados pessoais.';

alter table public.produto_migracao_selecoes enable row level security;

drop policy if exists produto_migracao_selecoes_ler on public.produto_migracao_selecoes;
create policy produto_migracao_selecoes_ler
  on public.produto_migracao_selecoes
  for select
  to authenticated
  using (
    (select public.is_product_manager())
    or (select public.has_perm('produtos', 'selecionar_migracao'))
  );

drop policy if exists produto_migracao_selecoes_inserir on public.produto_migracao_selecoes;
create policy produto_migracao_selecoes_inserir
  on public.produto_migracao_selecoes
  for insert
  to authenticated
  with check (
    selecionado_por = (select auth.uid())
    and (
      (select public.is_product_manager())
      or (select public.has_perm('produtos', 'selecionar_migracao'))
    )
  );

drop policy if exists produto_migracao_selecoes_remover on public.produto_migracao_selecoes;
create policy produto_migracao_selecoes_remover
  on public.produto_migracao_selecoes
  for delete
  to authenticated
  using (
    (select public.is_product_manager())
    or (select public.has_perm('produtos', 'selecionar_migracao'))
  );

revoke all on table public.produto_migracao_selecoes from public, anon, authenticated;
grant select, insert, delete on table public.produto_migracao_selecoes to authenticated;

-- A mesma permissão granular libera a ficha privada necessária à conferência
-- da migração. Corretor comum continua restrito às próprias captações.
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
      or (select public.has_perm('produtos', 'selecionar_migracao'))
      or (
        c.usuario_id = (select auth.uid())
        and exists (
          select 1 from public.usuarios us
          where us.id = (select auth.uid()) and us.ativo
        )
      )
    );
$$;

revoke all on function public.produto_unidades_proprietarios_ler(uuid[])
  from public, anon, authenticated;
grant execute on function public.produto_unidades_proprietarios_ler(uuid[])
  to authenticated;
