-- CRM Nova Era — STATUS read-only do runner da Sara (Fase 4; aditivo, só objetos ncrm_*).
-- ---------------------------------------------------------------------------
-- Exposição SEGURA (admin autenticado; can_manage_all) do estado do runner observer:
-- enabled (ncrm_sara_runner_config), última execução (ncrm_sara_runner_estado) e
-- distribuição da fila (ncrm_sara_runner_item). SOMENTE LEITURA: não muta nada,
-- não liga o runner, não altera modo da Sara, não toca em objetos legados.
CREATE FUNCTION public.ncrm_sara_runner_status()
  RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $fn$
DECLARE v_uid uuid := auth.uid();
        v_enabled boolean; v_ult timestamptz; v_run uuid; v_proc int;
        v_itens jsonb;
BEGIN
  IF v_uid IS NULL THEN RETURN jsonb_build_object('ok',false,'erro','nao_autenticado'); END IF;
  IF COALESCE(public.can_manage_all(), false) IS NOT TRUE THEN RETURN jsonb_build_object('ok',false,'erro','sem_permissao'); END IF;

  SELECT enabled INTO v_enabled FROM public.ncrm_sara_runner_config WHERE id = true;
  SELECT ultima_execucao, ultimo_run_id, processados INTO v_ult, v_run, v_proc
    FROM public.ncrm_sara_runner_estado WHERE id = true;
  SELECT COALESCE(jsonb_object_agg(s, n), '{}'::jsonb) INTO v_itens FROM (
    SELECT COALESCE(ultimo_status,'sem_status') AS s, count(*) AS n
    FROM public.ncrm_sara_runner_item GROUP BY 1) t;

  RETURN jsonb_build_object(
    'ok', true,
    'enabled', COALESCE(v_enabled, false),
    'ultima_execucao', v_ult,
    'ultimo_run_id', v_run,
    'processados', COALESCE(v_proc, 0),
    'itens_por_status', v_itens
  );
END $fn$;
REVOKE ALL ON FUNCTION public.ncrm_sara_runner_status() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ncrm_sara_runner_status() TO authenticated;
COMMENT ON FUNCTION public.ncrm_sara_runner_status() IS 'CRM Nova Era: snapshot read-only do runner observer da Sara (admin). Não muta nada.';
