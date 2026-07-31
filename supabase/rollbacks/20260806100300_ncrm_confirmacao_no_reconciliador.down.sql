-- Remove APENAS a ligacao nova: o reconciliador volta a nao chamar
-- confirmar_primeiras_saidas. A funcao de confirmacao continua existindo, os
-- dados ja confirmados continuam la e a correcao de autoria NAO e revertida --
-- desfazer uma correcao de auditoria seria voltar a afirmar algo falso.
DO $rb$
DECLARE v_sp text; v_src text; v_novo text; v_args text; v_ret text; v_cfg text; v_i int; v_j int;
BEGIN
  SELECT p.prosrc, pg_get_function_arguments(p.oid), pg_get_function_result(p.oid),
         array_to_string(p.proconfig, ', ')
    INTO v_src, v_args, v_ret, v_cfg
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
   WHERE n.nspname = 'ncrm_private' AND p.proname = 'reconciliar_mensagens';

  IF v_src IS NULL OR position('confirmar_primeiras_saidas' in v_src) = 0 THEN
    RAISE NOTICE 'reconciliador nao esta ligado; nada a desfazer'; RETURN;
  END IF;

  -- recorta o bloco inteiro, do comentario marcador ate o END; que o fecha
  v_i := position(E'\n\n  -- CRM Nova Era: outbound manual confirmado pela D-API' in v_src);
  IF v_i = 0 THEN RAISE EXCEPTION 'ABORTADO: marcador do bloco nao encontrado'; END IF;
  v_j := position(E'v_conf := jsonb_build_object(''ok'', false, ''erro'', SQLERRM);\n  END;' in v_src);
  IF v_j = 0 THEN RAISE EXCEPTION 'ABORTADO: fim do bloco nao encontrado'; END IF;

  v_novo := left(v_src, v_i - 1)
         || substr(v_src, v_j + length(E'v_conf := jsonb_build_object(''ok'', false, ''erro'', SQLERRM);\n  END;'));
  v_novo := replace(v_novo, E'v_entrada jsonb := ''{}''::jsonb;\n        v_conf jsonb := ''{}''::jsonb;',
                            'v_entrada jsonb := ''{}''::jsonb;');
  v_novo := replace(v_novo, '''finalizados'',v_fim,''entrada'',v_entrada,''confirmacao_humana'',v_conf);',
                            '''finalizados'',v_fim,''entrada'',v_entrada);');

  IF position('confirmar_primeiras_saidas' in v_novo) > 0 OR position('v_conf' in v_novo) > 0 THEN
    RAISE EXCEPTION 'ABORTADO: sobrou referencia a confirmacao apos o recorte';
  END IF;

  -- proconfig devolve search_path="" quando o search_path e vazio; reinterpolar
  -- isso como identificador da 'zero-length delimited identifier'.
  v_sp := CASE
    WHEN v_cfg IS NULL THEN ''''''
    WHEN replace(v_cfg, 'search_path=', '') IN ('""', '') THEN ''''''
    ELSE replace(v_cfg, 'search_path=', '')
  END;

  EXECUTE format(
    'CREATE OR REPLACE FUNCTION ncrm_private.reconciliar_mensagens(%s) RETURNS %s '
    'LANGUAGE plpgsql SECURITY DEFINER SET search_path TO %s AS %L',
    v_args, v_ret, v_sp, v_novo);
  RAISE NOTICE 'ligacao removida do reconciliador';
END $rb$;
