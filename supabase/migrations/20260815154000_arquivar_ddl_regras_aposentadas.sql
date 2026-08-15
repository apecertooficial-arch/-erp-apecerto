-- Metadados suficientes para reconstruir exatamente os objetos antes do corte.

create table if not exists ncrm_private.arquivo_regras_ddl_20260815 (
  tipo text not null,
  objeto text not null,
  definicao jsonb not null,
  arquivado_em timestamptz not null default now(),
  primary key (tipo, objeto)
);

insert into ncrm_private.arquivo_regras_ddl_20260815 (tipo, objeto, definicao)
select 'colunas', c.table_name,
       jsonb_agg(jsonb_build_object(
         'ordem', c.ordinal_position,
         'nome', c.column_name,
         'tipo', c.data_type,
         'udt', c.udt_name,
         'nullable', c.is_nullable,
         'default', c.column_default,
         'identity', c.is_identity,
         'identity_generation', c.identity_generation
       ) order by c.ordinal_position)
from information_schema.columns c
where c.table_schema = 'public'
  and c.table_name in ('f2_cadencia_regua', 'funil_regra', 'funil_regra_execucao')
group by c.table_name
on conflict (tipo, objeto) do nothing;

insert into ncrm_private.arquivo_regras_ddl_20260815 (tipo, objeto, definicao)
select 'constraint', con.conname,
       jsonb_build_object(
         'tabela', con.conrelid::regclass::text,
         'destino', nullif(con.confrelid::regclass::text, '-'),
         'tipo', con.contype,
         'sql', pg_get_constraintdef(con.oid)
       )
from pg_constraint con
where con.conrelid in (
  'public.f2_cadencia_regua'::regclass,
  'public.funil_regra'::regclass,
  'public.funil_regra_execucao'::regclass
)
   or con.confrelid = 'public.funil_regra'::regclass
on conflict (tipo, objeto) do nothing;

insert into ncrm_private.arquivo_regras_ddl_20260815 (tipo, objeto, definicao)
select 'indice', i.relname,
       jsonb_build_object('tabela', t.relname, 'sql', pg_get_indexdef(i.oid))
from pg_index x
join pg_class i on i.oid = x.indexrelid
join pg_class t on t.oid = x.indrelid
join pg_namespace n on n.oid = t.relnamespace
where n.nspname = 'public'
  and t.relname in ('f2_cadencia_regua', 'funil_regra', 'funil_regra_execucao')
on conflict (tipo, objeto) do nothing;

insert into ncrm_private.arquivo_regras_ddl_20260815 (tipo, objeto, definicao)
select 'politica', p.polname,
       jsonb_build_object(
         'tabela', c.relname,
         'comando', p.polcmd,
         'permissiva', p.polpermissive,
         'roles', p.polroles,
         'using', pg_get_expr(p.polqual, p.polrelid),
         'check', pg_get_expr(p.polwithcheck, p.polrelid)
       )
from pg_policy p
join pg_class c on c.oid = p.polrelid
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relname in ('f2_cadencia_regua', 'funil_regra', 'funil_regra_execucao')
on conflict (tipo, objeto) do nothing;

revoke all on ncrm_private.arquivo_regras_ddl_20260815
from public, anon, authenticated;
grant select on ncrm_private.arquivo_regras_ddl_20260815 to service_role;

comment on table ncrm_private.arquivo_regras_ddl_20260815 is
  'Snapshot privado de colunas, constraints, indices e policies antes do corte de 19/08/2026.';
