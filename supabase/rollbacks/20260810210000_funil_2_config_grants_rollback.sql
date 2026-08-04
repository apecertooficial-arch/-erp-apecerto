BEGIN;

-- Restaura exatamente o conjunto de privilégios existente antes do hardening.
GRANT INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER
  ON public.f2_operacao_config TO authenticated;

COMMIT;
