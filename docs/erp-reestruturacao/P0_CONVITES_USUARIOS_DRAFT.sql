-- DRAFT NÃO EXECUTÁVEL AUTOMATICAMENTE.
-- Não mover para supabase/migrations nem aplicar em produção sem:
-- 1) deploy validado das três Edge Functions canônicas;
-- 2) smoke positivo/negativo em ambiente isolado;
-- 3) inventário dos convites legados ainda abertos;
-- 4) aprovação específica da migration e rollback ensaiado.

begin;

do $$
begin
  if to_regclass('public.acesso_convites') is null
     or to_regclass('public.cadastro_convites') is null then
    raise exception 'convites_preflight_tabelas_ausentes';
  end if;
  if not exists (
    select 1 from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relname = 'acesso_convites' and c.relrowsecurity
  ) or not exists (
    select 1 from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relname = 'cadastro_convites' and c.relrowsecurity
  ) then
    raise exception 'convites_preflight_rls_desligada';
  end if;
end $$;

-- O navegador deixa de ser autoridade de criação/leitura de convites. Só as
-- Edge Functions, usando service_role após sua autenticação própria, operam as
-- tabelas. RLS continua ligada como defesa adicional.
revoke all on table public.acesso_convites from anon, authenticated;
revoke all on table public.cadastro_convites from anon, authenticated;
grant select, insert, update, delete on table public.acesso_convites to service_role;
grant select, insert, update, delete on table public.cadastro_convites to service_role;

-- Novas gravações guardam somente SHA-256. NOT VALID preserva links antigos já
-- emitidos; a validação completa fica para a contração depois que expirarem.
alter table public.acesso_convites
  add constraint acesso_convites_token_hash_novo_ck
  check (token ~ '^sha256:[0-9a-f]{64}$') not valid;

alter table public.cadastro_convites
  add constraint cadastro_convites_token_hash_novo_ck
  check (token ~ '^sha256:[0-9a-f]{64}$') not valid;

-- Autocadastro público cria apenas corretor. Convites administrativos para
-- outros papéis continuam no fluxo autenticado admin-usuarios.
alter table public.cadastro_convites
  add constraint cadastro_convites_autocadastro_corretor_novo_ck
  check (role = 'corretor') not valid;

create index if not exists acesso_convites_abertos_expira_idx
  on public.acesso_convites (expira_em)
  where usado_em is null;

create index if not exists cadastro_convites_abertos_expira_idx
  on public.cadastro_convites (expira_em)
  where usado_em is null;

comment on table public.acesso_convites is
  'Convites administrativos de senha; token novo armazenado somente como SHA-256 e consumido antes da mutação Auth.';
comment on table public.cadastro_convites is
  'Convites de autocadastro de corretor; acesso apenas por Edge Functions com token de uso único.';

commit;

-- ROLLBACK OPERACIONAL (executar separadamente, apenas se o deploy das Edge
-- Functions for revertido):
-- begin;
-- alter table public.acesso_convites drop constraint if exists acesso_convites_token_hash_novo_ck;
-- alter table public.cadastro_convites drop constraint if exists cadastro_convites_token_hash_novo_ck;
-- alter table public.cadastro_convites drop constraint if exists cadastro_convites_autocadastro_corretor_novo_ck;
-- grant select, insert, update, delete on table public.cadastro_convites to authenticated;
-- commit;
