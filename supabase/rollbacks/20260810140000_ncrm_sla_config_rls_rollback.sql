BEGIN;

DROP POLICY IF EXISTS ncrm_sla_config_authenticated_select
  ON public.ncrm_sla_redistribuicao_config;
ALTER TABLE public.ncrm_sla_redistribuicao_config DISABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.ncrm_sla_redistribuicao_config FROM PUBLIC, anon;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER
  ON public.ncrm_sla_redistribuicao_config FROM authenticated;
GRANT SELECT ON public.ncrm_sla_redistribuicao_config TO authenticated;

COMMIT;
