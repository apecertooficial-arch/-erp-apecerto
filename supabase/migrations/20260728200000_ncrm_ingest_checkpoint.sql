-- CRM Nova Era — INGESTÃO POR RECONCILIAÇÃO ADITIVA (somente objetos ncrm_*).
-- ---------------------------------------------------------------------------
-- NÃO altera/recria wa_ingerir, motor_envia_abordagem, wa_registrar_saida, dapi-webhook.
-- NÃO cria trigger em tabela legada. NUNCA modifica wa_mensagens. Lê o histórico já
-- persistido e chama as RPCs ncrm_* de forma idempotente (checkpoint por linha).
-- Automação = raw->>'origem'='motor' (confirmado). Inbound = mensagem recebida.

-- Checkpoint: uma linha por mensagem processada (idempotência estável).
CREATE TABLE public.ncrm_ingest_checkpoint (
  id             bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  mensagem_id    uuid NOT NULL,                 -- wa_mensagens.id (sem FK p/ não travar a legada)
  wa_message_id  text NULL,
  tipo           text NOT NULL CHECK (tipo IN ('msg_automatica','resposta_inbound','ignorado')),
  negocio_id     bigint NULL,
  status         text NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente','processado','noop','erro')),
  tentativas     integer NOT NULL DEFAULT 0 CHECK (tentativas >= 0),
  ultimo_erro    text NULL,
  processado_em  timestamptz NULL,
  criado_em      timestamptz NOT NULL DEFAULT now(),
  atualizado_em  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ux_ncrm_ingest_msg UNIQUE (mensagem_id)   -- não reprocessa a mesma linha
);
CREATE INDEX ix_ncrm_ingest_pendentes ON public.ncrm_ingest_checkpoint (status, atualizado_em) WHERE status IN ('pendente','erro');
COMMENT ON TABLE public.ncrm_ingest_checkpoint IS 'CRM Nova Era: checkpoint de reconciliação wa_mensagens -> RPCs ncrm_*. Sem acesso a anon/authenticated.';

-- RLS: fechada. Nem anon nem authenticated leem/escrevem (só via RPC administrativa DEFINER).
REVOKE ALL ON public.ncrm_ingest_checkpoint FROM PUBLIC, anon, authenticated;
ALTER TABLE public.ncrm_ingest_checkpoint ENABLE ROW LEVEL SECURITY;
-- (sem policies => authenticated/anon não enxergam nada; DEFINER owner postgres opera)

-- Resolve o negócio ativo mais recente a partir da conversa (conversa->contato->lead->negocio).
CREATE FUNCTION ncrm_private.resolver_negocio_por_conversa(p_conversa_id uuid)
  RETURNS bigint LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $fn$
  SELECT n.id
  FROM public.wa_conversas c
  JOIN public.wa_contatos ct ON ct.id = c.contato_id
  JOIN public.negocios n ON n.lead_id = ct.lead_id
  WHERE c.id = p_conversa_id AND ct.lead_id IS NOT NULL
  ORDER BY (n.status NOT IN ('perdido','descartado','cancelado')) DESC, n.id DESC
  LIMIT 1
$fn$;
REVOKE ALL ON FUNCTION ncrm_private.resolver_negocio_por_conversa(uuid) FROM PUBLIC;

-- Reconciliação idempotente. Nunca modifica wa_mensagens. Nunca atrasa WhatsApp.
CREATE FUNCTION ncrm_private.reconciliar_mensagens(p_limite int DEFAULT 200, p_max_tentativas int DEFAULT 5, p_janela_inbound interval DEFAULT interval '2 days')
  RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $fn$
DECLARE r record; v_neg bigint; v_tipo text; v_idem text; v_res jsonb; v_st text; v_err text;
        v_proc int := 0; v_noop int := 0; v_err_ct int := 0;
BEGIN
  FOR r IN
    SELECT m.id, m.wa_message_id, m.conversa_id, m.direcao, m.raw, m.criado_em,
           COALESCE(m.enviado_em, m.criado_em) AS quando,
           cp.id AS cp_id, cp.tentativas AS cp_tent, cp.status AS cp_status
    FROM public.wa_mensagens m
    LEFT JOIN public.ncrm_ingest_checkpoint cp ON cp.mensagem_id = m.id
    WHERE (cp.id IS NULL OR (cp.status IN ('pendente','erro') AND cp.tentativas < p_max_tentativas))
    ORDER BY m.criado_em ASC, m.id ASC
    LIMIT p_limite
  LOOP
    -- Classifica o evento (automação vs inbound). Fora disso => ignorado (noop).
    IF (r.raw ->> 'origem') = 'motor' THEN v_tipo := 'msg_automatica';
    ELSIF lower(coalesce(r.direcao,'')) = ANY (ARRAY['recebida','entrada','in','inbound','received']) THEN v_tipo := 'resposta_inbound';
    ELSE v_tipo := 'ignorado';
    END IF;

    v_neg := ncrm_private.resolver_negocio_por_conversa(r.conversa_id);
    v_idem := COALESCE(NULLIF(btrim(coalesce(r.wa_message_id,'')),''), r.id::text);  -- idempotência estável
    v_st := 'processado'; v_err := NULL; v_res := NULL;

    BEGIN
      IF v_tipo = 'ignorado' THEN
        v_st := 'noop';
      ELSIF v_neg IS NULL THEN
        -- inbound sem negócio: reconciliável por tempo limitado; automação sem negócio: noop
        IF v_tipo = 'resposta_inbound' AND r.criado_em > now() - p_janela_inbound THEN v_st := 'pendente'; v_err := 'sem_negocio_ainda';
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

-- Ação administrativa: reprocessa erros (idempotente) — só admin (can_manage_all).
CREATE FUNCTION public.ncrm_reprocessar_ingest(p_limite int DEFAULT 200)
  RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $fn$
BEGIN
  IF auth.uid() IS NULL THEN RETURN jsonb_build_object('ok',false,'erro','nao_autenticado'); END IF;
  IF COALESCE(public.can_manage_all(), false) IS NOT TRUE THEN RETURN jsonb_build_object('ok',false,'erro','sem_permissao'); END IF;
  -- 'erro'/'pendente' voltam a ser elegíveis no próximo passo da reconciliação.
  RETURN ncrm_private.reconciliar_mensagens(p_limite);
END $fn$;
REVOKE ALL ON FUNCTION public.ncrm_reprocessar_ingest(int) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ncrm_reprocessar_ingest(int) TO authenticated;

-- Agendamento: pg_cron se disponível (a cada minuto). Se não houver, usar Edge agendada (ver docs).
DO $do$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.schedule('ncrm_reconciliar', '* * * * *', $$ SELECT ncrm_private.reconciliar_mensagens(300); $$);
  END IF;
END $do$;
