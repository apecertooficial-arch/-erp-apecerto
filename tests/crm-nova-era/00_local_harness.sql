-- LOCAL TEST HARNESS (execução SOMENTE em Postgres local — NUNCA em produção/staging real).
-- Emula a superfície do Supabase: roles anon/authenticated/service_role, auth.uid()/auth.jwt(),
-- tabelas legadas mínimas com os TIPOS REAIS descobertos, e os QUATRO helpers com os corpos REAIS
-- capturados por descoberta read-only. Isto permite exercitar RLS e RPCs de forma fiel.

\set ON_ERROR_STOP on

-- Roles do Supabase
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='anon') THEN CREATE ROLE anon NOLOGIN; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='authenticated') THEN CREATE ROLE authenticated NOLOGIN; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='service_role') THEN CREATE ROLE service_role NOLOGIN; END IF;
END $$;
GRANT anon, authenticated, service_role TO CURRENT_USER;   -- permite SET ROLE nos testes

-- Schema auth emulado
CREATE SCHEMA IF NOT EXISTS auth;
CREATE OR REPLACE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$
  SELECT NULLIF(current_setting('request.jwt.claims', true)::jsonb->>'sub','')::uuid
$$;
CREATE OR REPLACE FUNCTION auth.jwt() RETURNS jsonb LANGUAGE sql STABLE AS $$
  SELECT COALESCE(current_setting('request.jwt.claims', true),'{}')::jsonb
$$;
GRANT USAGE ON SCHEMA auth TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION auth.uid(), auth.jwt() TO anon, authenticated, service_role;

-- Tabelas legadas mínimas (tipos reais)
CREATE TABLE public.usuarios (
  id uuid PRIMARY KEY, nome text, email text, role text NOT NULL, permissoes jsonb, ativo boolean NOT NULL DEFAULT true, superior_id uuid
);
CREATE TABLE public.perfis (id text PRIMARY KEY, nome text, permissoes jsonb, is_system boolean DEFAULT true);
CREATE TABLE public.corretores (id bigint PRIMARY KEY, usuario_id uuid REFERENCES public.usuarios(id), ativo boolean DEFAULT true);
CREATE TABLE public.leads (id bigint PRIMARY KEY, nome text);
CREATE TABLE public.empreendimentos (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), nome text);
CREATE TABLE public.unidades (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), empreendimento_id uuid);
CREATE TABLE public.negocios (
  id bigint PRIMARY KEY, lead_id bigint NOT NULL REFERENCES public.leads(id),
  corretor_id bigint REFERENCES public.corretores(id), status text NOT NULL DEFAULT 'aberto'
);
CREATE INDEX idx_negocios_corretor ON public.negocios (corretor_id);   -- reproduz índice real
CREATE TABLE public.visitas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), negocio_id bigint REFERENCES public.negocios(id),
  created_by uuid, corretor_id bigint, status text NOT NULL DEFAULT 'agendada', data date
);
CREATE TABLE public.vendas (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), vgv numeric NOT NULL DEFAULT 0, status text NOT NULL DEFAULT 'pendente');

-- Helpers REAIS (corpos capturados da produção; owner = superusuário local => bypassam RLS legada)
CREATE OR REPLACE FUNCTION public.can_manage_all() RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  select exists (select 1 from public.usuarios u where u.id = (select auth.uid()) and u.ativo and u.role in ('admin','executivo'));
$$;
CREATE OR REPLACE FUNCTION public.current_broker_id() RETURNS bigint LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  select c.id from public.corretores c where c.usuario_id = (select auth.uid()) limit 1;
$$;
CREATE OR REPLACE FUNCTION public.manages_broker(p_corretor_id bigint) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  with me as (select u.id, u.role::text as role from usuarios u where u.id = (select auth.uid()) and u.ativo)
  select exists (
    select 1 from me cross join lateral (
      with recursive tree as (
        select id from usuarios where superior_id = me.id
        union all select u.id from usuarios u join tree t on u.superior_id = t.id
      ) select id from tree
    ) sub join corretores c on c.usuario_id = sub.id
    where me.role in ('gerente','diretor') and c.id = p_corretor_id);
$$;
CREATE OR REPLACE FUNCTION public.has_perm(p_modulo text, p_acao text) RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
declare v_role text; v_uid uuid := (select auth.uid()); v_over jsonb; v_prof jsonb;
begin
  if v_uid is null then return false; end if;
  select u.role::text, u.permissoes into v_role, v_over from usuarios u where u.id = v_uid and u.ativo;
  if v_role is null then return false; end if;
  if v_role in ('admin','executivo') then return true; end if;
  if v_over is not null and v_over ? p_modulo then return (v_over -> p_modulo) ? p_acao; end if;
  select p.permissoes into v_prof from perfis p where p.id = v_role;
  if v_prof is not null and v_prof ? p_modulo then return (v_prof -> p_modulo) ? p_acao; end if;
  return false;
end $$;
GRANT EXECUTE ON FUNCTION public.can_manage_all(), public.current_broker_id(), public.manages_broker(bigint), public.has_perm(text,text) TO anon, authenticated, service_role;

-- Seed de identidades
INSERT INTO public.perfis (id, permissoes) VALUES
  ('corretor', '{"crm":["ver","editar"]}'::jsonb),
  ('gerente',  '{"crm":["ver","editar"]}'::jsonb),
  ('admin',    '{}'::jsonb);
INSERT INTO public.usuarios (id, nome, role, ativo, superior_id) VALUES
  ('aaaaaaaa-0000-0000-0000-000000000001','Admin','admin',true,NULL),
  ('bbbbbbbb-0000-0000-0000-000000000001','Gerente','gerente',true,'aaaaaaaa-0000-0000-0000-000000000001'),
  ('cccccccc-0000-0000-0000-000000000001','Corretor A','corretor',true,'bbbbbbbb-0000-0000-0000-000000000001'),
  ('dddddddd-0000-0000-0000-000000000001','Corretor B','corretor',true,'aaaaaaaa-0000-0000-0000-000000000001');
INSERT INTO public.corretores (id, usuario_id) VALUES
  (10,'cccccccc-0000-0000-0000-000000000001'),
  (20,'dddddddd-0000-0000-0000-000000000001'),
  (30,'bbbbbbbb-0000-0000-0000-000000000001');
-- Leads e negócios (A=10, B=20)
INSERT INTO public.leads (id, nome) SELECT g, 'Lead '||g FROM generate_series(1,8) g;
INSERT INTO public.negocios (id, lead_id, corretor_id, status) VALUES
  (100,1,10,'aberto'),(200,2,20,'aberto'),(300,3,10,'aberto'),(400,4,10,'aberto'),
  (500,5,10,'aberto'),(600,6,10,'aberto'),(700,7,10,'aberto'),(710,8,10,'aberto');
-- Empreendimento/unidade e vendas (baseline de contagem)
INSERT INTO public.empreendimentos (id, nome) VALUES ('11111111-1111-1111-1111-111111111111','Emp Demo');
INSERT INTO public.unidades (id, empreendimento_id) VALUES ('22222222-2222-2222-2222-222222222222','11111111-1111-1111-1111-111111111111');
INSERT INTO public.vendas (vgv, status) VALUES (100000,'pendente'),(200000,'pendente');
-- Visitas de teste (para saída visita)
INSERT INTO public.visitas (id, negocio_id, status, data) VALUES ('33333333-3333-3333-3333-333333333333',500,'agendada',current_date+1);

-- Assert helpers
CREATE OR REPLACE FUNCTION public.test_assert(cond boolean, msg text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN IF cond IS NOT TRUE THEN RAISE EXCEPTION 'ASSERT FAIL: %', msg; ELSE RAISE NOTICE 'PASS: %', msg; END IF; END $$;
CREATE OR REPLACE FUNCTION public.test_expect_error(p_sql text, p_want text, msg text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  BEGIN
    EXECUTE p_sql;
    RAISE EXCEPTION 'ASSERT FAIL (esperava erro, não houve): %', msg;
  EXCEPTION WHEN others THEN
    IF p_want IS NOT NULL AND SQLSTATE <> p_want AND position(p_want in SQLERRM) = 0 THEN
      RAISE EXCEPTION 'ASSERT FAIL (erro % / % ): %', SQLSTATE, SQLERRM, msg;
    END IF;
    RAISE NOTICE 'PASS (erro esperado): %', msg;
  END;
END $$;
