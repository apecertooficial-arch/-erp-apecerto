-- ROLLBACK versionado da FASE 6.1. Restaura a reconciliação anterior e remove só o que
-- esta migration criou. Nenhum registro de fila é apagado; os itens finalizados voltam
-- para 'noop' (estado final equivalente na versão anterior), preservando o histórico.
DROP FUNCTION IF EXISTS public.ncrm_ingest_fila_resumo();
DROP FUNCTION IF EXISTS public.ncrm_ingest_classificar_backlog(int,text);
DROP FUNCTION IF EXISTS public.ncrm_ingest_lifecycle_set(jsonb);
DROP FUNCTION IF EXISTS public.ncrm_ingest_lifecycle_get();

UPDATE public.ncrm_ingest_checkpoint
   SET status = 'noop'
 WHERE status IN ('noop_fora_do_escopo','noop_sem_negocio_expirado');

ALTER TABLE public.ncrm_ingest_checkpoint DROP CONSTRAINT IF EXISTS ck_ncrm_ingest_final_coerente;
ALTER TABLE public.ncrm_ingest_checkpoint DROP CONSTRAINT IF EXISTS ncrm_ingest_checkpoint_status_check;
ALTER TABLE public.ncrm_ingest_checkpoint ADD CONSTRAINT ncrm_ingest_checkpoint_status_check
  CHECK (status IN ('pendente','processado','noop','erro'));

DROP INDEX IF EXISTS public.ix_ncrm_ingest_fila_aberta;
DROP INDEX IF EXISTS public.ix_ncrm_ingest_status_criado;
ALTER TABLE public.ncrm_ingest_checkpoint
  DROP COLUMN IF EXISTS proxima_tentativa_em,
  DROP COLUMN IF EXISTS motivo_final,
  DROP COLUMN IF EXISTS finalizado_em;

DROP TABLE IF EXISTS public.ncrm_ingest_lifecycle_config;

-- Reconciliação: volta ao comportamento da Fase 4 (janela fixa de 2 dias, teto de tentativas).
CREATE OR REPLACE FUNCTION ncrm_private.reconciliar_mensagens(
    p_limite integer DEFAULT 200, p_max_tentativas integer DEFAULT 5, p_janela_inbound interval DEFAULT '2 days'::interval)
  RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $function$
DECLARE r record; v_neg bigint; v_tipo text; v_idem text; v_res jsonb; v_st text; v_err text;
        v_proc int := 0; v_noop int := 0; v_err_ct int := 0;
        v_ativo boolean; v_desde timestamptz;
BEGIN
  SELECT ativo, ativo_desde INTO v_ativo, v_desde FROM public.ncrm_ingest_config WHERE id = true;
  IF COALESCE(v_ativo, false) IS NOT TRUE OR v_desde IS NULL THEN
    RETURN jsonb_build_object('ok', true, 'inativo', true, 'processados', 0, 'noop', 0, 'erros', 0);
  END IF;
  FOR r IN
    SELECT m.id, m.wa_message_id, m.conversa_id, m.direcao, m.raw, m.criado_em,
           COALESCE(m.enviado_em, m.criado_em) AS quando,
           cp.id AS cp_id, cp.tentativas AS cp_tent, cp.status AS cp_status
    FROM public.wa_mensagens m
    LEFT JOIN public.ncrm_ingest_checkpoint cp ON cp.mensagem_id = m.id
    WHERE m.criado_em >= v_desde
      AND ((m.raw ->> 'origem') = 'motor'
        OR lower(coalesce(m.direcao,'')) = ANY (ARRAY['recebida','entrada','in','inbound','received']))
      AND (cp.id IS NULL OR (cp.status IN ('pendente','erro') AND cp.tentativas < p_max_tentativas))
    ORDER BY m.criado_em ASC, m.id ASC
    LIMIT p_limite
  LOOP
    IF (r.raw ->> 'origem') = 'motor' THEN v_tipo := 'msg_automatica'; ELSE v_tipo := 'resposta_inbound'; END IF;
    v_neg := ncrm_private.resolver_negocio_por_conversa(r.conversa_id);
    v_idem := COALESCE(NULLIF(btrim(coalesce(r.wa_message_id,'')),''), r.id::text);
    v_st := 'processado'; v_err := NULL; v_res := NULL;
    BEGIN
      IF v_neg IS NULL THEN
        IF r.criado_em > now() - p_janela_inbound THEN v_st := 'pendente'; v_err := 'sem_negocio_ainda';
        ELSE v_st := 'noop'; v_err := 'sem_negocio'; END IF;
      ELSIF v_tipo = 'msg_automatica' THEN
        v_res := public.ncrm_registrar_msg_automatica(v_neg, v_idem, r.quando);
        IF (v_res->>'ok')::boolean THEN v_st := 'processado';
        ELSIF v_res->>'erro' IN ('estado_ja_existe') THEN v_st := 'noop';
        ELSE v_st := 'erro'; v_err := v_res->>'erro'; END IF;
      ELSE
        v_res := public.ncrm_registrar_resposta_cliente(v_neg, v_idem, r.quando);
        IF (v_res->>'ok')::boolean THEN v_st := 'processado';
        ELSIF v_res->>'erro' = 'estado_inexistente' AND r.criado_em > now() - p_janela_inbound THEN v_st := 'pendente'; v_err := 'estado_inexistente';
        ELSIF v_res->>'erro' IN ('estado_inexistente','estado_em_saida') THEN v_st := 'noop'; v_err := v_res->>'erro';
        ELSE v_st := 'erro'; v_err := v_res->>'erro'; END IF;
      END IF;
    EXCEPTION WHEN others THEN v_st := 'erro'; v_err := SQLERRM;
    END;
    INSERT INTO public.ncrm_ingest_checkpoint (mensagem_id, wa_message_id, tipo, negocio_id, status, tentativas, ultimo_erro, processado_em)
    VALUES (r.id, r.wa_message_id, v_tipo, v_neg, v_st,
            COALESCE(r.cp_tent,0) + CASE WHEN v_st='erro' OR v_st='pendente' THEN 1 ELSE 0 END, v_err,
            CASE WHEN v_st IN ('processado','noop') THEN now() ELSE NULL END)
    ON CONFLICT (mensagem_id) DO UPDATE SET
      status = EXCLUDED.status, negocio_id = EXCLUDED.negocio_id, ultimo_erro = EXCLUDED.ultimo_erro,
      tentativas = public.ncrm_ingest_checkpoint.tentativas + CASE WHEN EXCLUDED.status IN ('erro','pendente') THEN 1 ELSE 0 END,
      processado_em = EXCLUDED.processado_em, atualizado_em = now();
    IF v_st = 'processado' THEN v_proc := v_proc + 1;
    ELSIF v_st = 'noop' THEN v_noop := v_noop + 1;
    ELSIF v_st = 'erro' THEN v_err_ct := v_err_ct + 1; END IF;
  END LOOP;
  RETURN jsonb_build_object('ok',true,'processados',v_proc,'noop',v_noop,'erros',v_err_ct);
END $function$;
