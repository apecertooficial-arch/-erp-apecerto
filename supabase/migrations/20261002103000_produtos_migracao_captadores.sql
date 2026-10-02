-- PRO-MIG-002 — nomes dos captadores no espelho protegido de migração.
--
-- A RLS de corretores permanece restrita. Esta projeção expõe somente o nome
-- do captador associado à unidade e somente para gestão ou para quem recebeu
-- a permissão granular produtos.selecionar_migracao.

set lock_timeout = '5s';
set statement_timeout = '30s';

create or replace function public.produto_migracao_captadores_ler(
  p_unidade_ids uuid[]
)
returns table (
  unidade_id uuid,
  captador_nome text
)
language sql
stable
security definer
set search_path = ''
as $$
  select u.id, c.nome
  from public.unidades u
  join public.corretores c on c.id = u.captador_corretor_id
  where u.id = any(coalesce(p_unidade_ids, array[]::uuid[]))
    and (select auth.uid()) is not null
    and (
      (select public.is_product_manager())
      or (select public.has_perm('produtos', 'selecionar_migracao'))
    );
$$;

revoke all on function public.produto_migracao_captadores_ler(uuid[])
  from public, anon, authenticated;
grant execute on function public.produto_migracao_captadores_ler(uuid[])
  to authenticated;

comment on function public.produto_migracao_captadores_ler(uuid[]) is
  'Retorna somente unidade e nome do captador para usuários autorizados a preparar a migração de Produtos.';
