-- Gera SQL restaurável como texto, sem executar mutação. Rode com psql -XAt
-- e redirecione para um arquivo protegido fora do repositório.
begin transaction read only;
set local statement_timeout = '60s';

select 'revoke all privileges on table public.empreendimentos, public.unidades, public.midias, public.vw_produtos_publicos from anon, public;';
select format('grant %s on table %I.%I to %s;', lower(privilege_type), table_schema, table_name,
              case when grantee='PUBLIC' then 'public' else quote_ident(grantee) end)
from information_schema.table_privileges
where table_schema='public'
  and table_name in ('empreendimentos','unidades','midias','vw_produtos_publicos')
  and grantee in ('anon','PUBLIC')
order by grantee,table_name,privilege_type;
select format('grant %s (%I) on table %I.%I to %s;', lower(privilege_type), column_name, table_schema, table_name,
              case when grantee='PUBLIC' then 'public' else quote_ident(grantee) end)
from information_schema.column_privileges
where table_schema='public'
  and table_name in ('empreendimentos','unidades','midias','vw_produtos_publicos')
  and grantee in ('anon','PUBLIC')
order by grantee,table_name,column_name,privilege_type;

select 'delete from storage.buckets where false; -- sentinela: nenhum objeto é apagado';
select format(
  'update storage.buckets set public=%L, file_size_limit=%s, allowed_mime_types=%s where id=%L;',
  public,
  coalesce(file_size_limit::text,'null'),
  case when allowed_mime_types is null then 'null' else quote_literal(allowed_mime_types::text) || '::text[]' end,
  id
)
from storage.buckets where id='empreendimentos';

select format('drop policy if exists %I on %I.%I;', p.polname, n.nspname, c.relname)
from pg_policy p join pg_class c on c.oid=p.polrelid join pg_namespace n on n.oid=c.relnamespace
where n.nspname='storage' and c.relname='objects' and p.polname like 'emp_storage_%'
order by p.polname;
select format(
  'create policy %I on %I.%I as %s for %s to %s%s%s;',
  p.polname, n.nspname, c.relname,
  case when p.polpermissive then 'permissive' else 'restrictive' end,
  case p.polcmd when 'r' then 'select' when 'a' then 'insert' when 'w' then 'update' when 'd' then 'delete' else 'all' end,
  (select string_agg(case when role_oid=0 then 'public' else quote_ident(pg_get_userbyid(role_oid)) end, ', ')
   from unnest(p.polroles) role_oid),
  case when p.polqual is null then '' else ' using (' || pg_get_expr(p.polqual,p.polrelid) || ')' end,
  case when p.polwithcheck is null then '' else ' with check (' || pg_get_expr(p.polwithcheck,p.polrelid) || ')' end
)
from pg_policy p join pg_class c on c.oid=p.polrelid join pg_namespace n on n.oid=c.relnamespace
where n.nspname='storage' and c.relname='objects' and p.polname like 'emp_storage_%'
order by p.polname;

rollback;
