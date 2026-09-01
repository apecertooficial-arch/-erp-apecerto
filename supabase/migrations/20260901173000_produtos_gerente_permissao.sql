-- A função canônica de gestão de Produtos precisa refletir o papel operacional
-- `gerente`, já reconhecido pela matriz de permissões do ERP.
create or replace function public.is_product_manager()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.usuarios u
    where u.id = (select auth.uid())
      and u.ativo
      and u.role::text in (
        'admin', 'gestor', 'executivo', 'gestor_comercial', 'gestor_equipe', 'gerente'
      )
  );
$$;

revoke all on function public.is_product_manager() from public, anon, authenticated;
grant execute on function public.is_product_manager() to authenticated;

comment on function public.is_product_manager() is
  'Retorna se o usuário autenticado e ativo possui alçada de gestão de Produtos.';
