-- CRM Nova Era — SNAPSHOT ADMIN read-only do piloto (Fase 3, Regra 7; aditivo).
-- NÃO aplicada nesta rodada. Só LEITURA agregada: ingestão + checkpoints + fila de
-- reconciliação + Sara (modo/análises). Não muta nada. Admin autenticado.
CREATE FUNCTION public.ncrm_admin_status()
  RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $fn$
DECLARE v_uid uuid := auth.uid();
        v_cfg record; v_aud record;
        v_total int; v_proc int; v_noop int; v_err int; v_pend int;
        v_ult_exec timestamptz; v_ult_ckpt bigint;
        v_est int; v_ev int; v_prop int;
        v_sara_modo text; v_sara_total int; v_sara_pend int;
        v_erros jsonb;
BEGIN
  IF v_uid IS NULL THEN RETURN jsonb_build_object('ok',false,'erro','nao_autenticado'); END IF;
  IF COALESCE(public.can_manage_all(), false) IS NOT TRUE THEN RETURN jsonb_build_object('ok',false,'erro','sem_permissao'); END IF;

  SELECT ativo, ativo_desde, atualizado_em, atualizado_por INTO v_cfg FROM public.ncrm_ingest_config WHERE id = true;
  SELECT acao, ativo_desde, atualizado_por, criado_em INTO v_aud FROM public.ncrm_ingest_audit ORDER BY id DESC LIMIT 1;

  SELECT count(*),
         count(*) FILTER (WHERE status='processado'),
         count(*) FILTER (WHERE status='noop'),
         count(*) FILTER (WHERE status='erro'),
         count(*) FILTER (WHERE status IN ('pendente','erro')),
         max(processado_em), max(id)
    INTO v_total, v_proc, v_noop, v_err, v_pend, v_ult_exec, v_ult_ckpt
    FROM public.ncrm_ingest_checkpoint;

  SELECT COALESCE(jsonb_agg(e), '[]'::jsonb) INTO v_erros FROM (
    SELECT wa_message_id, negocio_id, ultimo_erro, atualizado_em
    FROM public.ncrm_ingest_checkpoint WHERE status='erro' ORDER BY atualizado_em DESC LIMIT 10) e;

  SELECT count(*) INTO v_est FROM public.ncrm_estado;
  SELECT count(*) INTO v_ev FROM public.ncrm_evento;
  SELECT count(*) INTO v_prop FROM public.ncrm_proposta;

  -- Sara (se a migration de Sara existir; caso contrário, nulos)
  BEGIN
    SELECT modo INTO v_sara_modo FROM public.ncrm_sara_config WHERE id = true;
    SELECT count(*) FILTER (WHERE decisao='pendente'), count(*) INTO v_sara_pend, v_sara_total FROM public.ncrm_sara_analise;
  EXCEPTION WHEN undefined_table THEN v_sara_modo := NULL; v_sara_total := NULL; v_sara_pend := NULL;
  END;

  RETURN jsonb_build_object(
    'ok', true,
    'ingest', jsonb_build_object('ativo', COALESCE(v_cfg.ativo,false), 'ativo_desde', v_cfg.ativo_desde,
      'atualizado_em', v_cfg.atualizado_em, 'atualizado_por', v_cfg.atualizado_por,
      'ultima_auditoria', CASE WHEN v_aud IS NULL THEN NULL ELSE jsonb_build_object('acao', v_aud.acao, 'criado_em', v_aud.criado_em, 'atualizado_por', v_aud.atualizado_por) END),
    'checkpoints', jsonb_build_object('total', v_total, 'processados', v_proc, 'noop', v_noop, 'erros', v_err,
      'fila_reconciliacao', v_pend, 'ultima_execucao', v_ult_exec, 'ultimo_checkpoint_id', v_ult_ckpt),
    'operacional', jsonb_build_object('estados', v_est, 'eventos', v_ev, 'propostas', v_prop),
    'sara', jsonb_build_object('modo', v_sara_modo, 'analises_total', v_sara_total, 'analises_pendentes', v_sara_pend),
    'erros_recentes', v_erros
  );
END $fn$;
REVOKE ALL ON FUNCTION public.ncrm_admin_status() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ncrm_admin_status() TO authenticated;
