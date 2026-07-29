-- ROLLBACK versionado do hotfix de segurança.
--
-- Restaura EXATAMENTE os privilégios observados no precheck de 29/07/2026 sobre
-- produção (diaegvfveqezispcthwk). Nas cinco tabelas, `anon` possuía os sete
-- privilégios abaixo, todos com is_grantable = NO:
--   DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE
--
-- ATENÇÃO: este rollback reabre o acesso anônimo. Só deve ser usado se surgir uma
-- dependência legítima de `anon` que o precheck não encontrou. Não executar em
-- produção sem nova análise.
GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER
  ON TABLE public.ncrm_estado          TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER
  ON TABLE public.ncrm_evento          TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER
  ON TABLE public.ncrm_proposta        TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER
  ON TABLE public.ncrm_workflow_config TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER
  ON TABLE public.ncrm_workflow_passo  TO anon;
