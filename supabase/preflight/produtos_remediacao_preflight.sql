-- Somente leitura. Execute com psql -X -v ON_ERROR_STOP=1 e salve a saída
-- em diretório protegido; o arquivo não imprime conteúdo comercial ou PII.
begin transaction read only;
set local statement_timeout = '60s';
set local lock_timeout = '5s';

select current_setting('server_version') as postgres_version,
       current_database() as database_name,
       pg_is_in_recovery() as replica;

select 'empreendimentos' as objeto, count(*) as total,
       encode(extensions.digest(coalesce(string_agg(id::text || '|' || coalesce(preco::text,'') || '|' || coalesce(publicado::text,'') order by id),''),'sha256'),'hex') as fingerprint
from public.empreendimentos
union all
select 'unidades', count(*),
       encode(extensions.digest(coalesce(string_agg(id::text || '|' || coalesce(valor_tabela::text,'') || '|' || coalesce(valor_promo::text,'') || '|' || coalesce(publicado::text,'') order by id),''),'sha256'),'hex')
from public.unidades
union all
select 'midias', count(*),
       encode(extensions.digest(coalesce(string_agg(id::text || '|' || empreendimento_id::text || '|' || coalesce(unidade_id::text,'') order by id),''),'sha256'),'hex')
from public.midias;

select count(*) filter (where ordem is null) as ordem_nula,
       count(*) filter (where storage_path is null or btrim(storage_path) = '') as path_vazio
from public.midias;
select count(*) as grupos_com_multiplas_capas from (
  select empreendimento_id, unidade_id from public.midias where is_capa
  group by empreendimento_id, unidade_id having count(*) > 1
) q;
select count(*) as paths_sem_objeto from public.midias m
where not exists (select 1 from storage.objects o where o.bucket_id='empreendimentos' and o.name=m.storage_path);
select count(*) as objetos_sem_midia from storage.objects o
where o.bucket_id='empreendimentos' and not exists (select 1 from public.midias m where m.storage_path=o.name);

select coalesce(metadata->>'mimetype','(ausente)') as mime,
       count(*) as objetos,
       max(coalesce((metadata->>'size')::bigint,0)) as maior_bytes
from storage.objects where bucket_id='empreendimentos'
group by 1 order by 1;

select id, public, file_size_limit, allowed_mime_types
from storage.buckets where id='empreendimentos';
select schemaname, tablename, policyname, roles, cmd
from pg_policies where (schemaname='public' and tablename in ('empreendimentos','unidades','midias','vw_produtos_publicos'))
   or (schemaname='storage' and tablename='objects' and policyname like 'emp_storage_%')
order by schemaname,tablename,policyname;

select grantee, table_name, privilege_type
from information_schema.role_table_grants
where table_schema='public' and table_name in ('empreendimentos','unidades','midias','site_produtos','site_produtos_catalogo','vw_produtos_publicos')
  and grantee in ('anon','authenticated') order by grantee,table_name,privilege_type;
select grantee, table_name, column_name, privilege_type
from information_schema.column_privileges
where table_schema='public' and table_name in ('empreendimentos','unidades','midias')
  and grantee in ('anon','authenticated') order by grantee,table_name,column_name;

select p.oid::regprocedure::text as assinatura, p.prosecdef, p.provolatile,
       coalesce(array_to_string(p.proconfig,','),'') as config
from pg_proc p join pg_namespace n on n.oid=p.pronamespace
where (n.nspname='public' and p.proname like 'produto_%') or n.nspname='produtos_authz'
order by 1;

select count(*) as locks_aguardando
from pg_locks where not granted;
select pid, wait_event_type, wait_event, state
from pg_stat_activity
where pid <> pg_backend_pid() and wait_event_type='Lock';

rollback;
