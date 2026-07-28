-- Rollback: visita atômica (só objetos ncrm_*).
DROP FUNCTION IF EXISTS public.ncrm_agendar_visita_e_encaminhar(bigint,int,bigint,date,text,uuid,text,boolean,bigint,text);
