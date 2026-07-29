-- Rollback Fase 5 (PR A): remove SOMENTE os objetos aditivos ncrm_* desta migration.
DROP INDEX IF EXISTS public.ix_ncrm_estado_fila;
DROP INDEX IF EXISTS public.ix_ncrm_estado_resposta;
DROP FUNCTION IF EXISTS public.ncrm_gestao_painel();
DROP FUNCTION IF EXISTS public.ncrm_fila_trabalho(text,bigint,int);
DROP FUNCTION IF EXISTS public.ncrm_justificar_atraso(bigint,text,text);
DROP TABLE IF EXISTS public.ncrm_justificativa;
DROP FUNCTION IF EXISTS ncrm_private.ajustar_para_janela(timestamptz);
DROP FUNCTION IF EXISTS public.ncrm_cadencia_config_set(jsonb);
DROP FUNCTION IF EXISTS public.ncrm_cadencia_config_get();
DROP TABLE IF EXISTS public.ncrm_cadencia_config_audit;
DROP TABLE IF EXISTS public.ncrm_cadencia_config;
