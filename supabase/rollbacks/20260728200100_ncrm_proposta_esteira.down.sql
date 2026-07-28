-- Rollback: proposta atômica na Esteira (só objetos ncrm_*).
DROP FUNCTION IF EXISTS public.ncrm_registrar_proposta_esteira(bigint,int,uuid,numeric,text,text,text);
DROP INDEX IF EXISTS public.ux_ncrm_proposta_solicitacao;
DROP INDEX IF EXISTS public.ix_ncrm_proposta_solicitacao;
ALTER TABLE public.ncrm_proposta DROP COLUMN IF EXISTS venda_solicitacao_id;
