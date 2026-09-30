-- PRO-ADM-001 — alçada individual de gestão de Produtos.
--
-- Fabiano continua com seu papel geral atual. A concessão abaixo vale somente
-- para Produtos e inclui estoque completo, decisões editoriais e os dados
-- privados de proprietários já protegidos pelas RPCs do módulo.

set lock_timeout = '5s';
set statement_timeout = '60s';

alter table public.usuarios
  add column if not exists gestor_produtos boolean not null default false;

comment on column public.usuarios.gestor_produtos is
  'Concessão individual de gestão completa de Produtos, inclusive dados privados de proprietários; não amplia o papel geral do usuário.';

create or replace function public.is_product_manager()
returns boolean
language sql
stable
security definer
set search_path = ''
as $function$
  select exists (
    select 1
    from public.usuarios u
    where u.id = (select auth.uid())
      and u.ativo
      and (
        u.role = any (public.papeis_do_grupo('produtos'))
        or u.gestor_produtos
      )
  );
$function$;

comment on function public.is_product_manager() is
  'Retorna se o usuário autenticado e ativo possui alçada de gestão de Produtos por papel canônico ou concessão individual dedicada.';

revoke all on function public.is_product_manager() from public, anon;
grant execute on function public.is_product_manager() to authenticated, service_role;

do $migration$
declare
  v_alvos integer;
  v_usuario_id uuid;
  v_ja_concedido boolean;
begin
  select count(*), (array_agg(id))[1], bool_or(gestor_produtos)
    into v_alvos, v_usuario_id, v_ja_concedido
  from public.usuarios
  where ativo
    and lower(btrim(nome)) = 'fabiano';

  if v_alvos <> 1 then
    raise exception 'PRO_ADM_001_TARGET_COUNT: esperado 1 usuário ativo chamado Fabiano; encontrado %', v_alvos;
  end if;

  update public.usuarios
  set gestor_produtos = true
  where id = v_usuario_id
    and gestor_produtos is not true;

  if not coalesce(v_ja_concedido, false) then
    insert into public.erp_auditoria (
      usuario_nome, acao, modulo, entidade, entidade_id, antes, depois, detalhe
    ) values (
      'Operação administrativa autorizada',
      'conceder_gestao_produtos',
      'produtos',
      'usuario',
      v_usuario_id::text,
      jsonb_build_object('gestor_produtos', false),
      jsonb_build_object('gestor_produtos', true),
      'Acesso individual de gestão completa de Produtos concedido ao usuário Fabiano por solicitação administrativa; papel geral preservado.'
    );
  end if;
end
$migration$;
