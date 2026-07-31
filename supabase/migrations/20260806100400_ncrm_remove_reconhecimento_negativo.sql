-- =============================================================================
-- REMOVE O RECONHECIMENTO NEGATIVO DE ATUACAO HUMANA
--
-- A migration anterior deu precedencia ao reconhecedor positivo, o que resolve
-- DUPLICIDADE: quando a mensagem e um outbound real da D-API, a rotina nova
-- grava primeiro e o caminho antigo encontra a chave e nao repete.
--
-- Mas duplicidade nao era o unico problema. O caminho antigo classificava como
-- "saida humana" toda saida SEM marcador de automacao, e o chat interno do ERP
-- nao tem marcador de automacao. Entao, para uma mensagem que a rotina nova
-- recusa de proposito, o caminho antigo seguia adiante e registrava primeira
-- abordagem humana assim mesmo. Nao era duplicata: era falso positivo, e ficava
-- sozinho no registro justamente porque a rotina correta tinha recusado.
--
-- Ausencia de prova nao e prova. Os dois caminhos passam a exigir o mesmo
-- contrato positivo: a D-API confirmou que a mensagem saiu do celular do
-- corretor.
--
-- A mensagem recusada continua sendo processada e finalizada pelo checkpoint --
-- ela existe e nao pode ficar pendente para sempre. O que ela nao pode e virar
-- primeira atuacao humana.
-- =============================================================================

DO $mig$
DECLARE
  v_sp text; v_src text; v_novo text; v_over int; v_args text; v_ret text; v_cfg text;
  v_ancora_class text; v_ancora_ramo text;
BEGIN
  SELECT p.prosrc, pg_get_function_arguments(p.oid), pg_get_function_result(p.oid),
         array_to_string(p.proconfig, ', ')
    INTO v_src, v_args, v_ret, v_cfg
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
   WHERE n.nspname = 'ncrm_private' AND p.proname = 'reconciliar_mensagens';

  IF v_src IS NULL THEN
    RAISE NOTICE 'reconciliar_mensagens ausente; nada a corrigir'; RETURN;
  END IF;

  IF position('saida_nao_humana' in v_src) > 0 THEN
    RAISE NOTICE 'reconciliador ja exige o contrato positivo'; RETURN;
  END IF;

  SELECT count(*) INTO v_over FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
   WHERE n.nspname = 'ncrm_private' AND p.proname = 'reconciliar_mensagens';
  IF v_over <> 1 THEN RAISE EXCEPTION 'ABORTADO: % overloads de reconciliar_mensagens', v_over; END IF;

  v_ancora_class := '''sent'']) THEN v_tipo := ''saida_humana'';';
  v_ancora_ramo  := '      ELSE -- resposta_inbound';

  IF position(v_ancora_class in v_src) = 0 THEN
    RAISE EXCEPTION 'ABORTADO: classificacao de saida humana nao localizada'; END IF;
  IF position(v_ancora_ramo in v_src) = 0 THEN
    RAISE EXCEPTION 'ABORTADO: ramo de resposta_inbound nao localizado'; END IF;

  -- 1. Classificacao: so e saida humana o que a D-API confirmou.
  v_novo := replace(v_src, v_ancora_class,
    E'''sent'']) THEN\n' ||
    E'      -- Contrato POSITIVO. O chat interno do ERP tambem nao tem marcador de\n' ||
    E'      -- automacao, entao "nao parece robo" nunca foi criterio para dizer que\n' ||
    E'      -- a mensagem saiu do celular do corretor.\n' ||
    E'      IF ncrm_private.eh_outbound_manual(r.raw, r.direcao) THEN v_tipo := ''saida_humana'';\n' ||
    E'      ELSE v_tipo := ''saida_nao_humana'';\n' ||
    E'      END IF;');

  -- 2. Ramo proprio: registra e finaliza, sem tocar em nada de atuacao humana.
  v_novo := replace(v_novo, v_ancora_ramo,
    E'      ELSIF v_tipo = ''saida_nao_humana'' THEN\n' ||
    E'        -- Saida real, mas sem confirmacao da D-API: chat do ERP, espelho,\n' ||
    E'        -- automacao nao marcada. Fica registrada e finalizada; nao vira\n' ||
    E'        -- primeira abordagem, nao gera SLA, nao move etapa, nao cria evento.\n' ||
    E'        -- status ''noop'': ncrm_ingest_checkpoint_status_check nao aceita\n' ||
    E'        -- valor novo, e nao ha por que ampliar o vocabulario. O que a\n' ||
    E'        -- mensagem foi fica em motivo_final, que e o campo livre.\n' ||
    E'        v_st := ''noop'';\n' ||
    E'        v_motivo := ''saida_sem_confirmacao_dapi'';\n' ||
    E'        v_final := now();\n\n' ||
    v_ancora_ramo);

  v_sp := CASE
    WHEN v_cfg IS NULL THEN ''''''
    WHEN replace(v_cfg, 'search_path=', '') IN ('""', '') THEN ''''''
    ELSE replace(v_cfg, 'search_path=', '')
  END;

  EXECUTE format(
    'CREATE OR REPLACE FUNCTION ncrm_private.reconciliar_mensagens(%s) RETURNS %s '
    'LANGUAGE plpgsql SECURITY DEFINER SET search_path TO %s AS %L',
    v_args, v_ret, v_sp, v_novo);

  RAISE NOTICE 'reconciliador passa a exigir contrato positivo para atuacao humana';
END $mig$;

-- =============================================================================
-- DEFESA EM PROFUNDIDADE NA PROPRIA RPC
--
-- Corrigir o chamador resolve o chamador de hoje. ncrm_registrar_primeira_humana
-- e SECURITY DEFINER e recebe (negocio_id, message_id, quando): ate agora ela
-- acreditava em quem chamava. Qualquer caller futuro -- outra rotina, um script
-- de backfill, uma correcao manual -- poderia registrar chat do ERP como
-- primeira abordagem sem que nada reclamasse.
--
-- Ela passa a ir ate a mensagem original e conferir o mesmo contrato:
--   . a wa_mensagem daquele message_id existe;
--   . eh_outbound_manual aprova raw e direcao (fromMe, nao motor, nao via=crm,
--     nao espelho);
--   . a mensagem pertence ao lead daquele negocio;
--   . a sessao que recebeu a mensagem e do corretor daquele negocio.
--
-- Sem isso: erro explicito, sem mutacao nenhuma.
-- =============================================================================

DO $mig$
DECLARE v_sp text; v_src text; v_novo text; v_over int; v_args text; v_ret text; v_cfg text; v_ancora text;
BEGIN
  SELECT p.prosrc, pg_get_function_arguments(p.oid), pg_get_function_result(p.oid),
         array_to_string(p.proconfig, ', ')
    INTO v_src, v_args, v_ret, v_cfg
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
   WHERE n.nspname = 'public' AND p.proname = 'ncrm_registrar_primeira_humana';

  IF v_src IS NULL THEN RAISE NOTICE 'RPC ausente; nada a proteger'; RETURN; END IF;
  IF position('nao_e_outbound_manual_confirmado' in v_src) > 0 THEN
    RAISE NOTICE 'RPC ja valida o contrato positivo'; RETURN; END IF;

  SELECT count(*) INTO v_over FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
   WHERE n.nspname = 'public' AND p.proname = 'ncrm_registrar_primeira_humana';
  IF v_over <> 1 THEN RAISE EXCEPTION 'ABORTADO: % overloads da RPC', v_over; END IF;

  -- a verificacao entra depois da idempotencia e ANTES de qualquer escrita
  v_ancora := '  -- Mensagem anterior à existência do negócio não é primeira abordagem.';
  IF position(v_ancora in v_src) = 0 THEN
    RAISE EXCEPTION 'ABORTADO: ponto de insercao nao localizado no corpo auditado'; END IF;

  v_novo := replace(v_src, v_ancora,
    E'  -- Defesa em profundidade: a RPC nao acredita no chamador. Vai ate a\n' ||
    E'  -- mensagem original e exige o mesmo contrato positivo, inclusive a\n' ||
    E'  -- associacao com o lead e com a sessao do corretor daquele negocio.\n' ||
    E'  IF NOT EXISTS (\n' ||
    E'    SELECT 1\n' ||
    E'      FROM public.wa_mensagens m\n' ||
    E'      JOIN public.wa_conversas cv ON cv.id = m.conversa_id\n' ||
    E'      JOIN public.wa_contatos  ct ON ct.id = cv.contato_id\n' ||
    E'      JOIN public.wa_instancias wi ON wi.id = m.instancia_id\n' ||
    E'     WHERE m.wa_message_id = v_msg\n' ||
    E'       AND ncrm_private.eh_outbound_manual(m.raw, m.direcao)\n' ||
    E'       AND ct.lead_id = v_lead\n' ||
    E'       AND wi.corretor_id = v_corretor\n' ||
    E'  ) THEN\n' ||
    E'    RETURN jsonb_build_object(''ok'', false, ''erro'', ''nao_e_outbound_manual_confirmado'');\n' ||
    E'  END IF;\n\n' ||
    v_ancora);

  v_sp := CASE
    WHEN v_cfg IS NULL THEN ''''''
    WHEN replace(v_cfg, 'search_path=', '') IN ('""', '') THEN ''''''
    ELSE replace(v_cfg, 'search_path=', '')
  END;

  EXECUTE format(
    'CREATE OR REPLACE FUNCTION public.ncrm_registrar_primeira_humana(%s) RETURNS %s '
    'LANGUAGE plpgsql SECURITY DEFINER SET search_path TO %s AS %L',
    v_args, v_ret, v_sp, v_novo);

  RAISE NOTICE 'RPC protegida contra registro de saida nao confirmada';
END $mig$;

-- Verificacao final: nao pode sobrar caminho que aceite atuacao humana sem o
-- contrato positivo.
DO $v$
DECLARE v_falta text;
BEGIN
  SELECT string_agg(n.nspname||'.'||p.proname, ', ') INTO v_falta
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
   WHERE (n.nspname, p.proname) IN (('ncrm_private','reconciliar_mensagens'),
                                    ('public','ncrm_registrar_primeira_humana'),
                                    ('ncrm_private','confirmar_primeiras_saidas'))
     AND position('eh_outbound_manual' in p.prosrc) = 0;
  IF v_falta IS NOT NULL THEN
    RAISE EXCEPTION 'ABORTADO: caminho sem contrato positivo: %', v_falta;
  END IF;
END $v$;
