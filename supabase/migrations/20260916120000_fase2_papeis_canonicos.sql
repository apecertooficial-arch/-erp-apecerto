-- ============================================================================
-- Fase 2 — Papéis canônicos.
--
-- Espelho SQL de app/lib/papeis.ts. Os grupos abaixo precisam ter EXATAMENTE
-- os mesmos membros do objeto GRUPOS do TypeScript; tests/papeis.test.mjs lê
-- este arquivo e falha se divergirem.
--
-- O que muda:
--   1. public.papeis_do_grupo(text)  -> user_role[]   (definição pura)
--   2. public.papel_no_grupo(text)   -> boolean        (usuário logado, ativo)
--   3. is_admin, is_admin_exec, can_manage_all, is_product_manager e is_equipe
--      passam a delegar para papel_no_grupo. Assinatura, volatilidade,
--      SECURITY DEFINER e grants ficam como estão (create or replace preserva
--      o ACL), então as 176 policies que usam essas funções não são tocadas.
--
-- Quem ganha ou perde acesso: NINGUÉM ativo.
--   - is_product_manager perde os literais 'gestor', 'gestor_comercial' e
--     'gestor_equipe': não existem no enum user_role, nunca casaram.
--   - is_admin_exec passa a exigir usuarios.ativo, como todas as outras.
--     Usuário DESATIVADO com papel admin/executivo deixa de passar nas 22
--     policies que usam is_admin_exec. Em 16/09/2026 não há nenhum usuário
--     inativo com esses papéis (os 2 inativos são corretores), então ninguém
--     perde acesso hoje; a mudança só fecha a porta para contas desligadas.
--
-- O bloco final confere, usuário por usuário, que o resultado de cada função
-- antes e depois é o mesmo (exceto o caso documentado acima) e aborta a
-- migration inteira se não for.
-- ============================================================================

begin;

-- ---------------------------------------------------------------------------
-- 0. Retrato ANTES: resultado das funções atuais para cada usuário.
-- ---------------------------------------------------------------------------
create temporary table _papeis_antes (
  usuario_id uuid primary key,
  ativo boolean,
  papel text,
  is_admin boolean,
  is_admin_exec boolean,
  can_manage_all boolean,
  is_product_manager boolean,
  is_equipe boolean
) on commit drop;

do $$
declare u record;
begin
  for u in select id, ativo, role::text as papel from public.usuarios loop
    perform set_config('request.jwt.claims', json_build_object('sub', u.id, 'role', 'authenticated')::text, true);
    perform set_config('request.jwt.claim.sub', u.id::text, true);
    insert into _papeis_antes values (
      u.id, u.ativo, u.papel,
      coalesce(public.is_admin(), false),
      coalesce(public.is_admin_exec(), false),
      coalesce(public.can_manage_all(), false),
      coalesce(public.is_product_manager(), false),
      coalesce(public.is_equipe(), false)
    );
  end loop;
  perform set_config('request.jwt.claims', '', true);
  perform set_config('request.jwt.claim.sub', '', true);
end $$;

-- ---------------------------------------------------------------------------
-- 1. Definição dos grupos (espelho de GRUPOS em app/lib/papeis.ts).
-- ---------------------------------------------------------------------------
create or replace function public.papeis_do_grupo(p_grupo text)
returns public.user_role[]
language sql
immutable
parallel safe
set search_path to ''
as $function$
  select case p_grupo
    when 'todos'               then array['admin','executivo','diretor','gerente','corretor']
    when 'admin'               then array['admin']
    when 'acesso_total'        then array['admin','executivo']
    when 'gestao'              then array['admin','executivo','diretor','gerente']
    when 'financeiro'          then array['admin','executivo']
    when 'metas'               then array['admin','executivo']
    when 'dashboard_gerencial' then array['admin','executivo']
    when 'esteira_config'      then array['admin','executivo']
    when 'excluir_venda'       then array['admin','diretor']
    when 'produtos'            then array['admin','executivo','gerente']
    when 'hierarquia'          then array['admin','diretor','gerente']
    when 'supervisao_ia'       then array['admin','gerente']
    -- grupo desconhecido: ninguém (fail-closed)
    else array[]::text[]
  end::public.user_role[];
$function$;

comment on function public.papeis_do_grupo(text) is
  'Membros de cada grupo de papéis. Espelho de app/lib/papeis.ts (GRUPOS); grupo desconhecido = vazio.';

-- ---------------------------------------------------------------------------
-- 2. O usuário logado (e ativo) pertence ao grupo?
-- ---------------------------------------------------------------------------
create or replace function public.papel_no_grupo(p_grupo text)
returns boolean
language sql
stable
security definer
set search_path to ''
as $function$
  select exists (
    select 1
    from public.usuarios u
    where u.id = (select auth.uid())
      and u.ativo
      and u.role = any (public.papeis_do_grupo(p_grupo))
  );
$function$;

comment on function public.papel_no_grupo(text) is
  'true se auth.uid() é usuário ativo com papel no grupo (ver papeis_do_grupo). Espelho de papelNoGrupo() em app/lib/papeis.ts.';

revoke all on function public.papel_no_grupo(text) from public, anon;
grant execute on function public.papel_no_grupo(text) to authenticated, service_role;
revoke all on function public.papeis_do_grupo(text) from public, anon;
grant execute on function public.papeis_do_grupo(text) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 3. Funções existentes delegam para a definição única.
--    (mesma assinatura, STABLE, SECURITY DEFINER; ACL preservado)
-- ---------------------------------------------------------------------------
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $function$
  select public.papel_no_grupo('admin');
$function$;

create or replace function public.is_admin_exec()
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $function$
  select public.papel_no_grupo('acesso_total');
$function$;

create or replace function public.can_manage_all()
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $function$
  select public.papel_no_grupo('acesso_total');
$function$;

create or replace function public.is_product_manager()
returns boolean
language sql
stable
security definer
set search_path to ''
as $function$
  select public.papel_no_grupo('produtos');
$function$;

create or replace function public.is_equipe()
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $function$
  select public.papel_no_grupo('todos');
$function$;

-- ---------------------------------------------------------------------------
-- 4. Retrato DEPOIS e comparação. Qualquer diferença não documentada aborta.
-- ---------------------------------------------------------------------------
do $$
declare
  u record;
  d record;
  v_divergencias text := '';
begin
  for u in select * from _papeis_antes loop
    perform set_config('request.jwt.claims', json_build_object('sub', u.usuario_id, 'role', 'authenticated')::text, true);
    perform set_config('request.jwt.claim.sub', u.usuario_id::text, true);
    select
      coalesce(public.is_admin(), false)           as is_admin,
      coalesce(public.is_admin_exec(), false)      as is_admin_exec,
      coalesce(public.can_manage_all(), false)     as can_manage_all,
      coalesce(public.is_product_manager(), false) as is_product_manager,
      coalesce(public.is_equipe(), false)          as is_equipe
    into d;

    if d.is_admin is distinct from u.is_admin then
      v_divergencias := v_divergencias || format(' is_admin(%s/%s)', u.papel, u.ativo);
    end if;
    -- única mudança admitida: conta INATIVA admin/executivo perde is_admin_exec
    if d.is_admin_exec is distinct from u.is_admin_exec
       and not (u.ativo = false and u.is_admin_exec and not d.is_admin_exec) then
      v_divergencias := v_divergencias || format(' is_admin_exec(%s/%s)', u.papel, u.ativo);
    end if;
    if d.can_manage_all is distinct from u.can_manage_all then
      v_divergencias := v_divergencias || format(' can_manage_all(%s/%s)', u.papel, u.ativo);
    end if;
    if d.is_product_manager is distinct from u.is_product_manager then
      v_divergencias := v_divergencias || format(' is_product_manager(%s/%s)', u.papel, u.ativo);
    end if;
    if d.is_equipe is distinct from u.is_equipe then
      v_divergencias := v_divergencias || format(' is_equipe(%s/%s)', u.papel, u.ativo);
    end if;
  end loop;
  perform set_config('request.jwt.claims', '', true);
  perform set_config('request.jwt.claim.sub', '', true);

  if v_divergencias <> '' then
    raise exception 'fase2_papeis: acesso mudaria para:%', v_divergencias;
  end if;
end $$;

commit;
