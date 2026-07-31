-- =============================================================================
-- RECONHECIMENTO DO OUTBOUND MANUAL — a mensagem que o corretor mandou do
-- proprio celular e que voltou sincronizada pela D-API.
--
-- Contrato POSITIVO, derivado da auditoria de 30/07/2026 sobre 7 dias reais.
-- Familias que convivem em wa_mensagens.raw:
--   webhook D-API   : tem fromMe             <- a unica que conta
--   motor           : origem = motor
--   chat do ERP     : via = crm
--   espelho antigo  : tem status + wa_message_id
--
-- Exigimos a marca do webhook. Ausencia de campo nunca e prova.
-- =============================================================================

CREATE OR REPLACE FUNCTION ncrm_private.eh_outbound_manual(
  p_raw jsonb, p_direcao text
) RETURNS boolean
LANGUAGE sql IMMUTABLE SET search_path = '' AS $fn$
  SELECT p_raw IS NOT NULL
     AND lower(coalesce(p_direcao,'')) IN ('enviada','saida','out','outbound','sent')
     -- exclui as outras familias ANTES de aceitar
     AND coalesce(p_raw->>'origem','') <> 'motor'
     AND coalesce(p_raw->>'via','')    <> 'crm'
     AND NOT (p_raw ? 'status' AND p_raw ? 'wa_message_id')
     -- marca positiva da familia do webhook
     AND (p_raw ? 'fromMe' OR p_raw ? 'from_me')
     AND lower(coalesce(p_raw->>'fromMe', p_raw->>'from_me','')) IN ('true','1');
$fn$;

COMMENT ON FUNCTION ncrm_private.eh_outbound_manual(jsonb,text) IS
  'Reconhece positivamente a mensagem enviada pelo WhatsApp nativo do corretor. Recusa motor, chat do ERP e espelho interno mesmo quando trazem fromMe.';

REVOKE ALL ON FUNCTION ncrm_private.eh_outbound_manual(jsonb,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION ncrm_private.eh_outbound_manual(jsonb,text) TO service_role;
