set lock_timeout = '5s';
set statement_timeout = '60s';

create schema if not exists produtos_authz;
revoke all on schema produtos_authz from public, anon, authenticated;
grant usage on schema produtos_authz to authenticated;

create or replace function produtos_authz.usuario_ativo()
returns boolean language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.usuarios u
    where u.id = (select auth.uid()) and u.ativo is true
  );
$$;
revoke all on function produtos_authz.usuario_ativo() from public, anon, authenticated;
grant execute on function produtos_authz.usuario_ativo() to authenticated;

drop policy if exists empreend_select_all on public.empreendimentos;
create policy empreend_select_all on public.empreendimentos for select to authenticated
using ((select produtos_authz.usuario_ativo()));
drop policy if exists unidades_select_all on public.unidades;
create policy unidades_select_all on public.unidades for select to authenticated
using ((select produtos_authz.usuario_ativo()));
drop policy if exists midias_select_all on public.midias;
create policy midias_select_all on public.midias for select to authenticated
using ((select produtos_authz.usuario_ativo()));

-- Restritiva: combina por AND com todas as policies permissivas existentes e
-- impede que uma policy histórica de escrita reabra acesso para perfil inativo.
drop policy if exists empreend_perfil_ativo_restritivo on public.empreendimentos;
create policy empreend_perfil_ativo_restritivo on public.empreendimentos as restrictive
for all to authenticated using ((select produtos_authz.usuario_ativo()))
with check ((select produtos_authz.usuario_ativo()));
drop policy if exists unidades_perfil_ativo_restritivo on public.unidades;
create policy unidades_perfil_ativo_restritivo on public.unidades as restrictive
for all to authenticated using ((select produtos_authz.usuario_ativo()))
with check ((select produtos_authz.usuario_ativo()));
drop policy if exists midias_perfil_ativo_restritivo on public.midias;
create policy midias_perfil_ativo_restritivo on public.midias as restrictive
for all to authenticated using ((select produtos_authz.usuario_ativo()))
with check ((select produtos_authz.usuario_ativo()));

revoke all privileges on table public.vw_produtos_publicos from authenticated;

do $$
declare v_config text;
begin
  select coalesce(array_to_string(proconfig, ','), '') into v_config
  from pg_proc where oid = 'produtos_authz.usuario_ativo()'::regprocedure;
  if has_function_privilege('anon', 'produtos_authz.usuario_ativo()', 'execute')
     or not has_function_privilege('authenticated', 'produtos_authz.usuario_ativo()', 'execute')
     or v_config !~ 'search_path=' then
    raise exception 'AUTHZ_POSTCHECK: helper de perfil ativo possui privilégio/configuração insegura.';
  end if;
end $$;
