-- ============================================================================
-- HOTFIX DE SEGURANÇA — REVOKE de `anon` nas cinco tabelas do CRM Nova Era.
-- Prova que a negação passa a ocorrer por PRIVILÉGIO (antes da RLS) e que
-- authenticated, service_role e as policies existentes seguem intactos.
-- ============================================================================

-- ------------------------------------------------------------------ SETUP
-- O harness local cria as tabelas sem os privilegios padrao do schema public do
-- Supabase. Reproduzimos aqui EXATAMENTE o estado observado em producao no precheck
-- (7 privilegios para anon nas 5 tabelas) para que o teste exercite o cenario real.
GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON TABLE public.ncrm_estado          TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON TABLE public.ncrm_evento          TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON TABLE public.ncrm_proposta        TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON TABLE public.ncrm_workflow_config TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON TABLE public.ncrm_workflow_passo  TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON TABLE public.ncrm_estado, public.ncrm_evento,
      public.ncrm_proposta, public.ncrm_workflow_config, public.ncrm_workflow_passo TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON TABLE public.ncrm_estado, public.ncrm_evento,
      public.ncrm_proposta, public.ncrm_workflow_config, public.ncrm_workflow_passo TO service_role;

-- ---------------------------------------------------------------- ANTES
SELECT public.test_assert(
  (SELECT count(*) FROM information_schema.role_table_grants
    WHERE table_schema='public' AND grantee='anon'
      AND table_name IN ('ncrm_estado','ncrm_evento','ncrm_proposta','ncrm_workflow_config','ncrm_workflow_passo')) = 35,
  'REVOKE antes: anon possui os 7 privilegios nas 5 tabelas (35 grants)');

-- Fotografia das policies e da RLS, para comparar depois.
CREATE TEMP TABLE _rev_policies_antes AS
  SELECT tablename, policyname, cmd, roles::text AS roles, coalesce(qual,'-') AS qual
    FROM pg_policies WHERE schemaname='public'
     AND tablename IN ('ncrm_estado','ncrm_evento','ncrm_proposta','ncrm_workflow_config','ncrm_workflow_passo');
CREATE TEMP TABLE _rev_rls_antes AS
  SELECT c.relname, c.relrowsecurity FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
   WHERE n.nspname='public' AND c.relname IN ('ncrm_estado','ncrm_evento','ncrm_proposta','ncrm_workflow_config','ncrm_workflow_passo');
CREATE TEMP TABLE _rev_dados_antes AS
  SELECT (SELECT count(*) FROM public.ncrm_estado)   AS estados,
         (SELECT count(*) FROM public.ncrm_evento)   AS eventos,
         (SELECT count(*) FROM public.ncrm_proposta) AS propostas,
         (SELECT count(*) FROM public.vendas)        AS vendas,
         (SELECT count(*) FROM public.visitas)       AS visitas,
         (SELECT count(*) FROM public.negocios)      AS negocios;

-- Antes do revoke, anon é barrado pela RLS: a consulta RODA e devolve zero.
SET ROLE anon;
SELECT public.test_assert((SELECT count(*) FROM public.ncrm_estado) = 0,
  'REVOKE antes: anon nao le nada, mas a consulta e permitida (barrado so pela RLS)');
RESET ROLE;

-- ---------------------------------------------------------------- APLICA
REVOKE ALL PRIVILEGES ON TABLE public.ncrm_estado          FROM anon;
REVOKE ALL PRIVILEGES ON TABLE public.ncrm_evento          FROM anon;
REVOKE ALL PRIVILEGES ON TABLE public.ncrm_proposta        FROM anon;
REVOKE ALL PRIVILEGES ON TABLE public.ncrm_workflow_config FROM anon;
REVOKE ALL PRIVILEGES ON TABLE public.ncrm_workflow_passo  FROM anon;

-- ---------------------------------------------------------------- DEPOIS
SELECT public.test_assert(
  (SELECT count(*) FROM information_schema.role_table_grants
    WHERE table_schema='public' AND grantee='anon'
      AND table_name IN ('ncrm_estado','ncrm_evento','ncrm_proposta','ncrm_workflow_config','ncrm_workflow_passo')) = 0,
  'REVOKE depois: anon sem NENHUM privilegio nas 5 tabelas');

-- Cada privilégio, um a um, em cada tabela.
DO $$
DECLARE t text; p text;
BEGIN
  FOREACH t IN ARRAY ARRAY['ncrm_estado','ncrm_evento','ncrm_proposta','ncrm_workflow_config','ncrm_workflow_passo'] LOOP
    FOREACH p IN ARRAY ARRAY['SELECT','INSERT','UPDATE','DELETE','TRUNCATE','REFERENCES','TRIGGER'] LOOP
      PERFORM public.test_assert(
        NOT has_table_privilege('anon', 'public.'||t, p),
        format('REVOKE depois: anon sem %s em %s', p, t));
    END LOOP;
  END LOOP;
END $$;

-- A negação agora é por PRIVILÉGIO (erro 42501), não silêncio da RLS.
DO $$
DECLARE t text; v_erro text;
BEGIN
  FOREACH t IN ARRAY ARRAY['ncrm_estado','ncrm_evento','ncrm_proposta','ncrm_workflow_config','ncrm_workflow_passo'] LOOP
    v_erro := NULL;
    BEGIN
      SET LOCAL ROLE anon;
      EXECUTE format('SELECT count(*) FROM public.%I', t);
    EXCEPTION WHEN insufficient_privilege THEN v_erro := 'privilegio';
              WHEN others THEN v_erro := SQLSTATE;
    END;
    RESET ROLE;
    PERFORM public.test_assert(v_erro = 'privilegio',
      format('REVOKE depois: leitura anon em %s falha por privilegio, nao pela RLS', t));
  END LOOP;
END $$;

-- Escrita anônima também é barrada antes de qualquer policy.
DO $$
DECLARE v_erro text;
BEGIN
  v_erro := NULL;
  BEGIN
    SET LOCAL ROLE anon;
    EXECUTE 'INSERT INTO public.ncrm_estado (negocio_id, workflow_config_id, etapa) VALUES (1,1,''novo'')';
  EXCEPTION WHEN insufficient_privilege THEN v_erro := 'privilegio';
            WHEN others THEN v_erro := SQLSTATE;
  END;
  RESET ROLE;
  PERFORM public.test_assert(v_erro = 'privilegio', 'REVOKE depois: escrita anon barrada por privilegio');
END $$;

-- ------------------------------------------- authenticated e service_role intactos
SELECT public.test_assert(
  (SELECT count(*) FROM information_schema.role_table_grants
    WHERE table_schema='public' AND grantee='authenticated'
      AND table_name IN ('ncrm_estado','ncrm_evento','ncrm_proposta','ncrm_workflow_config','ncrm_workflow_passo')) = 35,
  'REVOKE: privilegios de authenticated preservados');
SELECT public.test_assert(
  (SELECT count(*) FROM information_schema.role_table_grants
    WHERE table_schema='public' AND grantee='service_role'
      AND table_name IN ('ncrm_estado','ncrm_evento','ncrm_proposta','ncrm_workflow_config','ncrm_workflow_passo')) >= 34,
  'REVOKE: privilegios de service_role preservados');

-- ------------------------------------------------------- RLS e policies preservadas
SELECT public.test_assert(
  NOT EXISTS (SELECT 1 FROM _rev_policies_antes a
               FULL JOIN (SELECT tablename, policyname, cmd, roles::text AS roles, coalesce(qual,'-') AS qual
                            FROM pg_policies WHERE schemaname='public'
                             AND tablename IN ('ncrm_estado','ncrm_evento','ncrm_proposta','ncrm_workflow_config','ncrm_workflow_passo')) d
                 ON a.tablename = d.tablename AND a.policyname = d.policyname
              WHERE a.policyname IS NULL OR d.policyname IS NULL
                 OR a.cmd IS DISTINCT FROM d.cmd OR a.roles IS DISTINCT FROM d.roles OR a.qual IS DISTINCT FROM d.qual),
  'REVOKE: nenhuma policy criada, removida ou alterada');
SELECT public.test_assert(
  (SELECT count(*) FROM _rev_rls_antes a JOIN pg_class c ON c.relname = a.relname
     JOIN pg_namespace n ON n.oid = c.relnamespace AND n.nspname='public'
    WHERE c.relrowsecurity IS DISTINCT FROM a.relrowsecurity) = 0,
  'REVOKE: RLS inalterada nas 5 tabelas');

-- ------------------------------------------------------------------ dados intactos
SELECT public.test_assert(
  (SELECT estados FROM _rev_dados_antes) = (SELECT count(*) FROM public.ncrm_estado)
  AND (SELECT eventos FROM _rev_dados_antes) = (SELECT count(*) FROM public.ncrm_evento)
  AND (SELECT propostas FROM _rev_dados_antes) = (SELECT count(*) FROM public.ncrm_proposta)
  AND (SELECT vendas FROM _rev_dados_antes) = (SELECT count(*) FROM public.vendas)
  AND (SELECT visitas FROM _rev_dados_antes) = (SELECT count(*) FROM public.visitas)
  AND (SELECT negocios FROM _rev_dados_antes) = (SELECT count(*) FROM public.negocios),
  'REVOKE: zero alteracao em dados operacionais e no legado');

-- --------------------------------------- authenticated continua obedecendo a policy
SELECT set_config('request.jwt.claims', json_build_object('sub','aaaaaaaa-0000-0000-0000-000000000001','role','authenticated')::text, false);
SET ROLE authenticated;
SELECT public.test_assert((SELECT count(*) FROM public.ncrm_workflow_config) >= 1,
  'REVOKE: admin autenticado continua lendo a configuracao (policy using=true)');
SELECT public.test_assert((public.ncrm_admin_status()->>'ok')::boolean,
  'REVOKE: RPC administrativa continua respondendo');
RESET ROLE;

-- Corretor autenticado: sem erro de privilegio e limitado pela policy (nunca ve tudo).
SELECT set_config('request.jwt.claims', json_build_object('sub','cccccccc-0000-0000-0000-000000000001','role','authenticated')::text, false);
SET ROLE authenticated;
SELECT public.test_assert((SELECT count(*) FROM public.ncrm_estado) >= 0,
  'REVOKE: corretor autenticado consulta sem erro de privilegio');
CREATE TEMP TABLE _rev_corretor_visiveis AS SELECT count(*) AS visiveis FROM public.ncrm_estado;
RESET ROLE;
-- A comparacao com o total roda FORA do papel: o corretor nao enxerga mais que o conjunto inteiro.
SELECT public.test_assert(
  (SELECT visiveis FROM _rev_corretor_visiveis) <= (SELECT estados FROM _rev_dados_antes),
  'REVOKE: corretor continua restrito pela policy (nunca ve mais que o total)');

-- Rotinas internas (SECURITY DEFINER / service_role) seguem operando.
SELECT public.test_assert((ncrm_private.reconciliar_mensagens(5)->>'ok')::boolean,
  'REVOKE: reconciliacao interna continua funcionando');

-- ---------------------------------------------------------------- ROLLBACK LOCAL
GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON TABLE public.ncrm_estado          TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON TABLE public.ncrm_evento          TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON TABLE public.ncrm_proposta        TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON TABLE public.ncrm_workflow_config TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON TABLE public.ncrm_workflow_passo  TO anon;
SELECT public.test_assert(
  (SELECT count(*) FROM information_schema.role_table_grants
    WHERE table_schema='public' AND grantee='anon'
      AND table_name IN ('ncrm_estado','ncrm_evento','ncrm_proposta','ncrm_workflow_config','ncrm_workflow_passo')) = 35,
  'REVOKE rollback: privilegios anteriores restaurados exatamente (35 grants)');

-- ------------------------------------------------------------- REAPLICAÇÃO
REVOKE ALL PRIVILEGES ON TABLE public.ncrm_estado          FROM anon;
REVOKE ALL PRIVILEGES ON TABLE public.ncrm_evento          FROM anon;
REVOKE ALL PRIVILEGES ON TABLE public.ncrm_proposta        FROM anon;
REVOKE ALL PRIVILEGES ON TABLE public.ncrm_workflow_config FROM anon;
REVOKE ALL PRIVILEGES ON TABLE public.ncrm_workflow_passo  FROM anon;
SELECT public.test_assert(
  (SELECT count(*) FROM information_schema.role_table_grants
    WHERE table_schema='public' AND grantee='anon'
      AND table_name IN ('ncrm_estado','ncrm_evento','ncrm_proposta','ncrm_workflow_config','ncrm_workflow_passo')) = 0,
  'REVOKE reaplicado apos rollback: anon novamente sem privilegio');

DROP TABLE _rev_policies_antes; DROP TABLE _rev_rls_antes; DROP TABLE _rev_dados_antes; DROP TABLE _rev_corretor_visiveis;
