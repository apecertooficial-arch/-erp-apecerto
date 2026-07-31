-- Remove a RPC de intencao e a rotina de expiracao.
DROP FUNCTION IF EXISTS public.ncrm_registrar_whatsapp_aberto(bigint,text);
DROP FUNCTION IF EXISTS ncrm_private.expirar_intencoes_abandonadas(int);
DROP TABLE IF EXISTS public.ncrm_whatsapp_intencao;

-- As colunas de SLA em ncrm_estado NAO sao removidas: elas guardam quando cada
-- primeira abordagem humana foi confirmada. Derrubar a coluna apagaria a
-- evidencia. Rollback de codigo nao apaga historico de atendimento.
