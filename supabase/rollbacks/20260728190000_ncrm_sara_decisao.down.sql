-- Rollback da correção ncrm_registrar_decisao_sara (remove só o objeto ncrm_*).
DROP FUNCTION IF EXISTS public.ncrm_registrar_decisao_sara(bigint,int,text,jsonb,numeric,text,text);
