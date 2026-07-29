-- Rollback Fase 6 (PR A): remove SOMENTE os objetos aditivos ncrm_* desta migration.
DROP FUNCTION IF EXISTS public.ncrm_adocao_painel(int);
DROP FUNCTION IF EXISTS public.ncrm_rollout_checklist();
DROP FUNCTION IF EXISTS public.ncrm_piloto_limite(int);
DROP FUNCTION IF EXISTS public.ncrm_piloto_remover(uuid);
DROP FUNCTION IF EXISTS public.ncrm_piloto_liberar(uuid);
DROP FUNCTION IF EXISTS public.ncrm_pilotos_listar();
DROP FUNCTION IF EXISTS public.ncrm_registrar_acesso();
DROP FUNCTION IF EXISTS public.ncrm_tem_acesso();
DROP TABLE IF EXISTS public.ncrm_acesso;
DROP TABLE IF EXISTS public.ncrm_piloto_audit;
DROP TABLE IF EXISTS public.ncrm_piloto;
DROP TABLE IF EXISTS public.ncrm_piloto_config;
