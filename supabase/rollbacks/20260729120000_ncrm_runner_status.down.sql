-- Rollback do status read-only do runner (Fase 4). Remove SOMENTE a função aditiva.
DROP FUNCTION IF EXISTS public.ncrm_sara_runner_status();
