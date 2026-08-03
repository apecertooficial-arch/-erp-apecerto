BEGIN;

-- A configuração é legível pelos usuários autenticados, mas só rotinas internas
-- podem alterá-la. A policy explicita a leitura que já era concedida por GRANT.
ALTER TABLE public.ncrm_sla_redistribuicao_config ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS ncrm_sla_config_authenticated_select
  ON public.ncrm_sla_redistribuicao_config;
CREATE POLICY ncrm_sla_config_authenticated_select
  ON public.ncrm_sla_redistribuicao_config
  FOR SELECT
  TO authenticated
  USING (true);

REVOKE ALL ON public.ncrm_sla_redistribuicao_config FROM PUBLIC, anon;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER
  ON public.ncrm_sla_redistribuicao_config FROM authenticated;
GRANT SELECT ON public.ncrm_sla_redistribuicao_config TO authenticated;

COMMIT;
