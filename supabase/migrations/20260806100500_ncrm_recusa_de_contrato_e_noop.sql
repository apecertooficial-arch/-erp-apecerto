-- =============================================================================
-- RECUSA DE CONTRATO E NOOP DEFINITIVO, NAO ERRO RETENTAVEL
--
-- Detectado no smoke pos-publicacao: dois checkpoints entraram em status 'erro'
-- com motivo 'nao_e_outbound_manual_confirmado', tentativa 2, com retry agendado.
--
-- A recusa em si esta certa. Os dois negocios NAO tem corretor, e a defesa em
-- profundidade exige que a sessao que recebeu a mensagem seja a do corretor
-- daquele atendimento. Sem corretor, essa afirmacao nao pode ser feita, e a
-- funcao recusa -- que e o comportamento desejado.
--
-- O que esta errado e a CLASSIFICACAO da recusa. O reconciliador so conhece tres
-- erros como "nao adianta insistir" (primeira_abordagem_ja_registrada,
-- estado_em_saida, anterior_a_distribuicao); qualquer outro vira 'erro', ganha
-- backoff exponencial e e retentado ate max_tentativas, quando enfim vira
-- 'erro:persistente'.
--
-- Uma mensagem recusada por contrato nunca vai passar numa proxima tentativa: o
-- raw nao muda, o negocio nao ganha corretor sozinho. Retentar oito vezes so
-- produz ruido e faz um estado esperado parecer defeito. Recusa de contrato e
-- decisao final: noop, finalizado, motivo registrado.
-- =============================================================================

DO $mig$
DECLARE
  v_sp text; v_src text; v_novo text; v_over int; v_args text; v_ret text; v_cfg text; v_ancora text;
BEGIN
  SELECT p.prosrc, pg_get_function_arguments(p.oid), pg_get_function_result(p.oid),
         array_to_string(p.proconfig, ', ')
    INTO v_src, v_args, v_ret, v_cfg
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
   WHERE n.nspname = 'ncrm_private' AND p.proname = 'reconciliar_mensagens';

  IF v_src IS NULL THEN
    RAISE NOTICE 'reconciliar_mensagens ausente; nada a corrigir'; RETURN;
  END IF;

  IF position('''nao_e_outbound_manual_confirmado''' in v_src) > 0 THEN
    RAISE NOTICE 'recusa de contrato ja tratada como noop'; RETURN;
  END IF;

  SELECT count(*) INTO v_over FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
   WHERE n.nspname = 'ncrm_private' AND p.proname = 'reconciliar_mensagens';
  IF v_over <> 1 THEN RAISE EXCEPTION 'ABORTADO: % overloads', v_over; END IF;

  v_ancora := 'ELSIF v_res->>''erro'' IN (''primeira_abordagem_ja_registrada'',''estado_em_saida'',''anterior_a_distribuicao'') THEN';
  IF position(v_ancora in v_src) = 0 THEN
    RAISE EXCEPTION 'ABORTADO: lista de erros finais nao localizada no corpo auditado';
  END IF;

  v_novo := replace(v_src, v_ancora,
    'ELSIF v_res->>''erro'' IN (''primeira_abordagem_ja_registrada'',''estado_em_saida'',''anterior_a_distribuicao'',''nao_e_outbound_manual_confirmado'') THEN');

  v_sp := CASE
    WHEN v_cfg IS NULL THEN ''''''
    WHEN replace(v_cfg, 'search_path=', '') IN ('""', '') THEN ''''''
    ELSE replace(v_cfg, 'search_path=', '')
  END;

  EXECUTE format(
    'CREATE OR REPLACE FUNCTION ncrm_private.reconciliar_mensagens(%s) RETURNS %s '
    'LANGUAGE plpgsql SECURITY DEFINER SET search_path TO %s AS %L',
    v_args, v_ret, v_sp, v_novo);

  RAISE NOTICE 'recusa de contrato passa a ser noop definitivo';
END $mig$;

-- Fecha os checkpoints que ja estao em retry por este motivo. Nao reprocessa
-- nada: apenas para de insistir no que nunca vai passar.
UPDATE public.ncrm_ingest_checkpoint
   SET status = 'noop',
       motivo_final = 'nao_e_outbound_manual_confirmado',
       proxima_tentativa_em = NULL,
       finalizado_em = COALESCE(finalizado_em, now()),
       atualizado_em = now()
 WHERE status = 'erro'
   AND ultimo_erro = 'nao_e_outbound_manual_confirmado';

DO $v$
DECLARE v_n int;
BEGIN
  SELECT count(*) INTO v_n FROM public.ncrm_ingest_checkpoint
   WHERE status = 'erro' AND ultimo_erro = 'nao_e_outbound_manual_confirmado';
  IF v_n > 0 THEN
    RAISE EXCEPTION 'ABORTADO: % checkpoint(s) ainda em erro por recusa de contrato', v_n;
  END IF;
END $v$;
