-- =============================================================================
-- LIGA A CONFIRMACAO DE OUTBOUND MANUAL AO FLUXO AUTOMATICO
--
-- confirmar_primeiras_saidas existia mas ninguem a chamava. Uma rotina que so
-- roda quando alguem lembra de rodar nao e parte do produto: e um script.
--
-- O ponto de acoplamento canonico e ncrm_private.reconciliar_mensagens, que ja
-- roda por cron a cada minuto e ja e o lugar onde a ingestao vira estado. Nao
-- criamos cron novo: mais um agendamento seria mais uma coisa para desalinhar.
--
-- PRECEDENCIA. O reconciliador ja reconhecia "saida humana" por criterio
-- NEGATIVO: saida sem marcador de automacao. Isso aceita o chat interno do ERP
-- como se fosse o WhatsApp do corretor. A confirmacao por webhook da D-API
-- (criterio POSITIVO) roda ANTES do laco, entao quando o caminho antigo chega na
-- mesma mensagem ele encontra a chave 'humana:<message_id>' ja gravada e devolve
-- ja_processado. Mesma chave de idempotencia nos dois caminhos: por construcao,
-- nao ha como gravar dois eventos para a mesma mensagem.
--
-- CONCORRENCIA. pg_try_advisory_xact_lock: se um tick anterior ainda estiver
-- rodando, este pula em vez de esperar. O cron e de um minuto; empilhar
-- execucoes seria pior do que perder um ciclo.
--
-- ERRO ISOLADO. A confirmacao roda em bloco proprio com EXCEPTION. Se ela
-- falhar, a reconciliacao de mensagens continua: um defeito na metrica nao pode
-- derrubar a ingestao.
--
-- SEM REDE. confirmar_primeiras_saidas so le e escreve tabelas. Nao chama
-- extensions.http, nao fala com a D-API e nao envia mensagem nenhuma.
--
-- NAO ATRASA O WEBHOOK. Isto roda no cron, nao no caminho de entrada do webhook.
--
-- A alteracao e feita por substituicao mecanica sobre prosrc, conferindo antes
-- que a funcao existe, que tem uma unica assinatura e que ainda nao foi ligada.
-- =============================================================================

-- Helper local: proconfig devolve search_path="" para search_path vazio, e
-- reinterpolar isso como identificador gera 'zero-length delimited identifier'.
-- Aqui o valor volta a ser o literal '' que o CREATE FUNCTION espera.
CREATE OR REPLACE FUNCTION ncrm_private.ncrm_sp_literal(p_cfg text)
RETURNS text LANGUAGE sql IMMUTABLE AS $f$
  SELECT CASE
    WHEN p_cfg IS NULL THEN ''''''
    WHEN replace(p_cfg, 'search_path=', '') IN ('""', '') THEN ''''''
    ELSE replace(p_cfg, 'search_path=', '')
  END;
$f$;

DO $mig$
DECLARE
  v_src text; v_novo text; v_over int; v_args text; v_ret text; v_cfg text;
  v_ancora_decl text; v_ancora_bloco text; v_ancora_ret text;
BEGIN
  SELECT p.prosrc, pg_get_function_arguments(p.oid), pg_get_function_result(p.oid),
         array_to_string(p.proconfig, ', ')
    INTO v_src, v_args, v_ret, v_cfg
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
   WHERE n.nspname = 'ncrm_private' AND p.proname = 'reconciliar_mensagens';

  IF v_src IS NULL THEN
    RAISE NOTICE 'reconciliar_mensagens ausente: banco sem o reconciliador, nada a ligar';
    RETURN;
  END IF;

  IF position('confirmar_primeiras_saidas' in v_src) > 0 THEN
    RAISE NOTICE 'reconciliador ja chama confirmar_primeiras_saidas';
    RETURN;
  END IF;

  SELECT count(*) INTO v_over FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
   WHERE n.nspname = 'ncrm_private' AND p.proname = 'reconciliar_mensagens';
  IF v_over <> 1 THEN RAISE EXCEPTION 'ABORTADO: % overloads de reconciliar_mensagens', v_over; END IF;

  -- Tres ancoras. Se qualquer uma nao existir, o corpo nao e o que auditamos.
  v_ancora_decl  := 'v_entrada jsonb := ''{}''::jsonb;';
  v_ancora_bloco := 'EXCEPTION WHEN OTHERS THEN v_entrada := jsonb_build_object(''ok'',false,''erro'',SQLERRM); END;';
  v_ancora_ret   := '''finalizados'',v_fim,''entrada'',v_entrada);';

  IF position(v_ancora_decl in v_src) = 0 THEN RAISE EXCEPTION 'ABORTADO: declaracao de v_entrada nao localizada'; END IF;
  IF position(v_ancora_bloco in v_src) = 0 THEN RAISE EXCEPTION 'ABORTADO: bloco de entrada_por_distribuicao nao localizado'; END IF;
  IF position(v_ancora_ret in v_src) = 0 THEN RAISE EXCEPTION 'ABORTADO: retorno nao localizado'; END IF;

  v_novo := replace(v_src, v_ancora_decl,
    v_ancora_decl || E'\n        v_conf jsonb := ''{}''::jsonb;');

  v_novo := replace(v_novo, v_ancora_bloco,
    v_ancora_bloco ||
    E'\n\n  -- CRM Nova Era: outbound manual confirmado pela D-API tem precedencia sobre' ||
    E'\n  -- o reconhecimento por criterio negativo que vem no laco abaixo.' ||
    E'\n  BEGIN' ||
    E'\n    IF pg_try_advisory_xact_lock(hashtext(''ncrm_confirmar_primeiras_saidas'')) THEN' ||
    E'\n      v_conf := ncrm_private.confirmar_primeiras_saidas(200);' ||
    E'\n      IF COALESCE((v_conf->>''confirmadas'')::int, 0) > 0 THEN' ||
    E'\n        RAISE LOG ''ncrm: % primeira(s) saida(s) humana(s) confirmada(s) pela D-API'', v_conf->>''confirmadas'';' ||
    E'\n      END IF;' ||
    E'\n    ELSE' ||
    E'\n      v_conf := jsonb_build_object(''ok'', true, ''pulado'', ''tick_anterior_em_execucao'');' ||
    E'\n    END IF;' ||
    E'\n  EXCEPTION WHEN OTHERS THEN' ||
    E'\n    v_conf := jsonb_build_object(''ok'', false, ''erro'', SQLERRM);' ||
    E'\n  END;');

  v_novo := replace(v_novo, v_ancora_ret,
    '''finalizados'',v_fim,''entrada'',v_entrada,''confirmacao_humana'',v_conf);');

  EXECUTE format(
    'CREATE OR REPLACE FUNCTION ncrm_private.reconciliar_mensagens(%s) RETURNS %s '
    'LANGUAGE plpgsql SECURITY DEFINER SET search_path TO %s AS %L',
    v_args, v_ret, ncrm_private.ncrm_sp_literal(v_cfg), v_novo);

  RAISE NOTICE 'reconciliador ligado a confirmar_primeiras_saidas';
END $mig$;

REVOKE ALL ON FUNCTION ncrm_private.reconciliar_mensagens(integer,integer,interval) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION ncrm_private.reconciliar_mensagens(integer,integer,interval) TO service_role;

-- =============================================================================
-- MESMA CORRECAO DE AUTORIA NO CAMINHO LEGADO
--
-- ncrm_registrar_primeira_humana e a funcao que o reconciliador ja chamava, e
-- ela grava origem='usuario' com executado_por = corretor.usuario_id sempre que
-- o corretor tem usuario. Corrigir so a rotina nova deixaria a auditoria mentindo
-- no caminho que roda hoje.
--
-- Nao e ampliacao de escopo: e o mesmo defeito de autoria (P0-3), no lugar onde
-- ele realmente acontece. O corretor continua identificado em
-- corretor_id_no_evento; o que muda e a afirmacao sobre quem EXECUTOU.
-- =============================================================================

DO $mig$
DECLARE v_src text; v_novo text; v_over int; v_args text; v_ret text; v_cfg text; v_ancora text;
BEGIN
  SELECT p.prosrc, pg_get_function_arguments(p.oid), pg_get_function_result(p.oid),
         array_to_string(p.proconfig, ', ')
    INTO v_src, v_args, v_ret, v_cfg
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
   WHERE n.nspname = 'public' AND p.proname = 'ncrm_registrar_primeira_humana';

  IF v_src IS NULL THEN
    RAISE NOTICE 'ncrm_registrar_primeira_humana ausente; nada a corrigir'; RETURN;
  END IF;

  IF position('registrado_por' in v_src) > 0 THEN
    RAISE NOTICE 'autoria de ncrm_registrar_primeira_humana ja corrigida'; RETURN;
  END IF;

  SELECT count(*) INTO v_over FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
   WHERE n.nspname = 'public' AND p.proname = 'ncrm_registrar_primeira_humana';
  IF v_over <> 1 THEN RAISE EXCEPTION 'ABORTADO: % overloads', v_over; END IF;

  v_ancora := 'CASE WHEN (SELECT u.usuario_id FROM public.corretores u WHERE u.id = v_corretor) IS NOT NULL
           THEN ''usuario'' ELSE ''sistema'' END,
      (SELECT u.usuario_id FROM public.corretores u WHERE u.id = v_corretor),';
  IF position(v_ancora in v_src) = 0 THEN
    RAISE EXCEPTION 'ABORTADO: bloco de autoria nao localizado no corpo auditado';
  END IF;

  v_novo := replace(v_src, v_ancora, E'''sistema'',\n      NULL,');

  -- payload passa a dizer quem mandou e quem registrou, que sao coisas diferentes
  v_novo := replace(v_novo,
    'jsonb_build_object(''message_id'', v_msg, ''primeira_abordagem'',''humana'',',
    'jsonb_build_object(''message_id'', v_msg, ''primeira_abordagem'',''humana'',' ||
    E'\n                         ''enviado_por'',''whatsapp_nativo_do_corretor'',' ||
    E'\n                         ''registrado_por'',''reconciliador_ncrm'',');

  EXECUTE format(
    'CREATE OR REPLACE FUNCTION public.ncrm_registrar_primeira_humana(%s) RETURNS %s '
    'LANGUAGE plpgsql SECURITY DEFINER SET search_path TO %s AS %L',
    v_args, v_ret, ncrm_private.ncrm_sp_literal(v_cfg), v_novo);

  RAISE NOTICE 'autoria corrigida em ncrm_registrar_primeira_humana';
END $mig$;

-- Verificacao: nenhum caminho de primeira abordagem humana pode afirmar que um
-- usuario executou a rotina de integracao.
DO $v$
DECLARE v_n int;
BEGIN
  SELECT count(*) INTO v_n
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
   WHERE (n.nspname, p.proname) IN (('public','ncrm_registrar_primeira_humana'),
                                    ('ncrm_private','confirmar_primeiras_saidas'))
     AND position('registrado_por' in p.prosrc) = 0;
  IF v_n > 0 THEN
    RAISE EXCEPTION 'ABORTADO: % funcao(oes) de primeira abordagem sem autoria corrigida', v_n;
  END IF;
END $v$;
