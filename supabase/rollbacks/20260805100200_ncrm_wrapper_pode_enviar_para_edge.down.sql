-- Remove a autoridade canonica consultada pelas cinco saidas de envio.
-- Antes de reverter, confirme que nenhum emissor ainda a chama: sem ela, as
-- Edge Functions recebem erro na RPC e param de enviar (fail-closed).
DROP FUNCTION IF EXISTS public.ncrm_pode_enviar_pelo_erp(bigint,bigint,bigint,text);
