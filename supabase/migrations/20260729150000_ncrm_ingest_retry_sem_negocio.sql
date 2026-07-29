-- CRM Nova Era — INGEST: retry para mensagem do MOTOR sem negócio (Fase 4; corretivo, aditivo).
-- ---------------------------------------------------------------------------
-- CAUSA RAIZ (observada em produção, 29/07/2026): o motor envia a 1ª mensagem automática
-- ANTES de o negócio do lead ser criado (corrida de segundos/minutos). A reconciliação
-- marcava 'noop' DEFINITIVO (sem_negocio) e o ncrm_estado nunca nascia. Correção: dentro
-- da janela, mensagem sem negócio (motor OU inbound) fica 'pendente' e é retentada; o
-- noop definitivo só ocorre fora da janela. Nada além dessa ramificação muda.
CREATE OR REPLACE FUNCTION ncrm_private.reconciliar_mensagens(p_limite int DEFAULT 200, p_max_tentativas int DEFAULT 5, p_janela_inbound interval DEFAULT interval '2 days')
  RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $fn$
DECLARE r record; v_neg bigint; v_tipo text; v_idem text; v_res jsonb; v_st text; v_err text;
        v_proc int := 0; v_noop int := 0; v_err_ct int := 0;
        v_ativo boolean; v_desde timestamptz;
BEGIN
  -- CORTE DE ATIVAÇÃO: enquanto inativo, não processa NADA (nem cria checkpoints).
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
    -- Só mensagens POSTERIORES ao corte E ELEGÍVEIS (motor OU inbound). Nunca varre
    -- histórico anterior à ativação nem cria checkpoint para mensagens humanas/irrelevantes.
    WHERE m.criado_em >= v_desde
      AND (
        (m.raw ->> 'origem') = 'motor'
        OR lower(coalesce(m.direcao,'')) = ANY (ARRAY['recebida','entrada','in','inbound','received'])
      )
      AND (cp.id IS NULL OR (cp.status IN ('pendente','erro') AND cp.tentativas < p_max_tentativas))
    ORDER BY m.criado_em ASC, m.id ASC
    LIMIT p_limite
  LOOP
    -- Já filtrado na seleção: motor => automação; caso contrário => inbound.
    IF (r.raw ->> 'origem') = 'motor' THEN v_tipo := 'msg_automatica';
    ELSE v_tipo := 'resposta_inbound';
    END IF;

    v_neg := ncrm_private.resolver_negocio_por_conversa(r.conversa_id);
    v_idem := COALESCE(NULLIF(btrim(coalesce(r.wa_message_id,'')),''), r.id::text);  -- idempotência estável
    v_st := 'processado'; v_err := NULL; v_res := NULL;

    BEGIN
      IF v_neg IS NULL THEN
        -- inbound sem negócio: reconciliável por tempo limitado; automação sem negócio: noop
        -- FASE 4 (corrida real observada em produção): o MOTOR pode disparar a 1ª mensagem
        -- ANTES de o negócio existir. Dentro da janela, AMBOS os tipos ficam 'pendente'
        -- (retry pela própria reconciliação); noop definitivo só fora da janela.
        IF r.criado_em > now() - p_janela_inbound THEN v_st := 'pendente'; v_err := 'sem_negocio_ainda';
        ELSE v_st := 'noop'; v_err := 'sem_negocio'; END IF;
      ELSIF v_tipo = 'msg_automatica' THEN
        v_res := public.ncrm_registrar_msg_automatica(v_neg, v_idem, r.quando);
        IF (v_res->>'ok')::boolean THEN v_st := 'processado';
        ELSIF v_res->>'erro' IN ('estado_ja_existe') THEN v_st := 'noop';  -- msgs adicionais do mesmo disparo => noop
        ELSE v_st := 'erro'; v_err := v_res->>'erro'; END IF;
      ELSE -- resposta_inbound
        v_res := public.ncrm_registrar_resposta_cliente(v_neg, v_idem, r.quando);
        IF (v_res->>'ok')::boolean THEN v_st := 'processado';
        ELSIF v_res->>'erro' = 'estado_inexistente' AND r.criado_em > now() - p_janela_inbound THEN v_st := 'pendente'; v_err := 'estado_inexistente';
        ELSIF v_res->>'erro' IN ('estado_inexistente','estado_em_saida') THEN v_st := 'noop'; v_err := v_res->>'erro';
        ELSE v_st := 'erro'; v_err := v_res->>'erro'; END IF;
      END IF;
    EXCEPTION WHEN others THEN
      v_st := 'erro'; v_err := SQLERRM;   -- falha do NCRM NÃO propaga p/ WhatsApp (função isolada, agendada)
    END;

    INSERT INTO public.ncrm_ingest_checkpoint (mensagem_id, wa_message_id, tipo, negocio_id, status, tentativas, ultimo_erro, processado_em)
    VALUES (r.id, r.wa_message_id, CASE WHEN v_tipo='ignorado' THEN 'ignorado' ELSE v_tipo END, v_neg, v_st,
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
END $fn$;
REVOKE ALL ON FUNCTION ncrm_private.reconciliar_mensagens(int,int,interval) FROM PUBLIC;

-- Requalificação ÚNICA e restrita: reabre para retry SOMENTE os checkpoints do MOTOR já
-- marcados noop/sem_negocio (vítimas da corrida). Nenhum estado é inserido manualmente —
-- a criação continua exclusivamente pelo caminho canônico (ncrm_registrar_msg_automatica).
UPDATE public.ncrm_ingest_checkpoint
   SET status = 'pendente', processado_em = NULL, ultimo_erro = 'sem_negocio_ainda', atualizado_em = now()
 WHERE tipo = 'msg_automatica' AND status = 'noop' AND ultimo_erro = 'sem_negocio';
