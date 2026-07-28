-- =====================================================================================
-- BOOTSTRAP LOCAL (SOMENTE dress-rehearsal em Postgres efêmero) — NÃO usar no Supabase real.
-- Recria o que o Supabase JÁ fornece: roles anon/authenticated/service_role e auth.uid()/auth.jwt().
-- No projeto de STAGING real, estes objetos já existem; comece por 01_estrutura_legado.sql.
-- =====================================================================================
\set ON_ERROR_STOP on
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='anon') THEN CREATE ROLE anon NOLOGIN; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='authenticated') THEN CREATE ROLE authenticated NOLOGIN; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='service_role') THEN CREATE ROLE service_role NOLOGIN; END IF;
END $$;
GRANT anon, authenticated, service_role TO CURRENT_USER;

CREATE SCHEMA IF NOT EXISTS auth;
CREATE OR REPLACE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$
  SELECT NULLIF(current_setting('request.jwt.claims', true)::jsonb->>'sub','')::uuid
$$;
CREATE OR REPLACE FUNCTION auth.jwt() RETURNS jsonb LANGUAGE sql STABLE AS $$
  SELECT COALESCE(current_setting('request.jwt.claims', true),'{}')::jsonb
$$;
GRANT USAGE ON SCHEMA auth TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION auth.uid(), auth.jwt() TO anon, authenticated, service_role;

-- Helpers de asserção (para os smoke tests)
CREATE OR REPLACE FUNCTION public.test_assert(cond boolean, msg text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN IF cond IS NOT TRUE THEN RAISE EXCEPTION 'ASSERT FAIL: %', msg; ELSE RAISE NOTICE 'PASS: %', msg; END IF; END $$;
CREATE OR REPLACE FUNCTION public.test_expect_error(p_sql text, p_want text, msg text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  BEGIN EXECUTE p_sql; RAISE EXCEPTION 'ASSERT FAIL (esperava erro, não houve): %', msg;
  EXCEPTION WHEN others THEN
    IF p_want IS NOT NULL AND SQLSTATE <> p_want AND position(p_want in SQLERRM) = 0 THEN
      RAISE EXCEPTION 'ASSERT FAIL (erro % / % ): %', SQLSTATE, SQLERRM, msg; END IF;
    RAISE NOTICE 'PASS (erro esperado): %', msg;
  END;
END $$;
SELECT 'BOOTSTRAP_LOCAL_OK' AS status;
