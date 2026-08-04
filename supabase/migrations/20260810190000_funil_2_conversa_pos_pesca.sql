BEGIN;

-- O Funil 2.0 preserva o negócio original, mas a experiência da cópia começa
-- no instante em que ela entra no laboratório. A coluna é o limite canônico
-- usado pela API para não expor a conversa anterior à pesca.
ALTER TABLE public.f2_lead
  ADD COLUMN IF NOT EXISTS corte_conversa_em timestamptz;

UPDATE public.f2_lead
SET corte_conversa_em = COALESCE(corte_conversa_em, criado_em)
WHERE corte_conversa_em IS NULL;

ALTER TABLE public.f2_lead
  ALTER COLUMN corte_conversa_em SET DEFAULT now(),
  ALTER COLUMN corte_conversa_em SET NOT NULL;

COMMENT ON COLUMN public.f2_lead.corte_conversa_em IS
  'Início visível da conversa na cópia. Mensagens anteriores permanecem no legado, mas não aparecem no Funil 2.0.';

COMMIT;
