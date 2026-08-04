BEGIN;

ALTER TABLE public.f2_lead
  DROP COLUMN IF EXISTS corte_conversa_em;

COMMIT;
