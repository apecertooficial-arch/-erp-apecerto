-- Rollback: Sara modo observador (só objetos ncrm_*).
DROP FUNCTION IF EXISTS public.ncrm_sara_analises_recentes(int);
DROP FUNCTION IF EXISTS public.ncrm_sara_decidir_analise(bigint,text,text);
DROP FUNCTION IF EXISTS public.ncrm_sara_registrar_analise(uuid,text,bigint,text,text,text,timestamptz,text,jsonb,numeric,boolean,boolean,boolean,boolean,text,text);
DROP FUNCTION IF EXISTS public.ncrm_sara_definir_modo(text,boolean);
DROP FUNCTION IF EXISTS public.ncrm_sara_modo_status();
DROP TABLE IF EXISTS public.ncrm_sara_analise;
DROP TABLE IF EXISTS public.ncrm_sara_config;
