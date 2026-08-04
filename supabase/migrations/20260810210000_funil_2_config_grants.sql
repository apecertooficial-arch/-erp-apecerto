BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';

DO $do$
BEGIN
  IF to_regclass('public.f2_operacao_config') IS NULL
    OR to_regprocedure('public.f2_configurar_operacao(time,time,integer,integer,integer,integer,integer,integer,integer,integer,integer,integer,integer,integer)') IS NULL THEN
    RAISE EXCEPTION 'dependencias_funil_2_config_ausentes';
  END IF;
END;$do$;

-- A configuração é alterada somente pela RPC administrativa auditada.
-- authenticated mantém apenas a leitura, ainda limitada pela RLS de admin.
REVOKE ALL ON public.f2_operacao_config FROM authenticated;
GRANT SELECT ON public.f2_operacao_config TO authenticated;

COMMIT;
