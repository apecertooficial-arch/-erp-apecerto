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

-- =========================================================================
-- CORTE DE ATIVAÇÃO (kill-switch): a reconciliação NUNCA varre o histórico.
-- Singleton (id=true). Nasce ativo=false: o cron pode existir e rodar, mas a
-- função retorna imediatamente sem processar nada até ativação explícita.
-- =========================================================================
CREATE TABLE public.ncrm_ingest_config (
  id             boolean PRIMARY KEY DEFAULT true,
  ativo          boolean NOT NULL DEFAULT false,
  ativo_desde    timestamptz NULL,                 -- corte: só mensagens com criado_em >= este instante
  atualizado_em  timestamptz NOT NULL DEFAULT now(),
  atualizado_por uuid NULL,
  CONSTRAINT ck_ncrm_ingest_cfg_singleton CHECK (id = true)
);
INSERT INTO public.ncrm_ingest_config (id, ativo) VALUES (true, false) ON CONFLICT (id) DO NOTHING;
REVOKE ALL ON public.ncrm_ingest_config FROM PUBLIC, anon, authenticated;
ALTER TABLE public.ncrm_ingest_config ENABLE ROW LEVEL SECURITY;
COMMENT ON TABLE public.ncrm_ingest_config IS 'CRM Nova Era: kill-switch da reconciliação. ativo=false => não processa nada. ativo_desde = corte histórico.';

-- Trilha de auditoria das ativações/desativações (histórico, não só o estado atual).
CREATE TABLE public.ncrm_ingest_audit (
  id             bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  acao           text NOT NULL CHECK (acao IN ('ativar','desativar')),
  ativo_desde    timestamptz NULL,
  atualizado_por uuid NULL,
  criado_em      timestamptz NOT NULL DEFAULT now()
);
REVOKE ALL ON public.ncrm_ingest_audit FROM PUBLIC, anon, authenticated;
ALTER TABLE public.ncrm_ingest_audit ENABLE ROW LEVEL SECURITY;

-- Ativação: admin, confirmação explícita, sem retroação acidental (default now()).
CREATE FUNCTION public.ncrm_ativar_ingest(p_confirmar boolean DEFAULT false, p_ativo_desde timestamptz DEFAULT NULL)
  RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $fn$
DECLARE v_uid uuid := auth.uid(); v_desde timestamptz;
BEGIN
  IF v_uid IS NULL THEN RETURN jsonb_build_object('ok',false,'erro','nao_autenticado'); END IF;
  IF COALESCE(public.can_manage_all(), false) IS NOT TRUE THEN RETURN jsonb_build_object('ok',false,'erro','sem_permissao'); END IF;
  IF p_confirmar IS NOT TRUE THEN RETURN jsonb_build_object('ok',false,'erro','confirmacao_obrigatoria'); END IF;
  v_desde := COALESCE(p_ativo_desde, now());                                   -- padrão: agora
  IF v_desde < now() - interval '2 minutes' THEN                              -- bloqueia varredura retroativa acidental
    RETURN jsonb_build_object('ok',false,'erro','ativo_desde_retroativo_nao_permitido');
  END IF;
  IF v_desde > now() + interval '1 day' THEN
    RETURN jsonb_build_object('ok',false,'erro','ativo_desde_futuro_invalido');
  END IF;
  UPDATE public.ncrm_ingest_config SET ativo=true, ativo_desde=v_desde, atualizado_em=now(), atualizado_por=v_uid WHERE id=true;
  INSERT INTO public.ncrm_ingest_audit (acao, ativo_desde, atualizado_por) VALUES ('ativar', v_desde, v_uid);
  RETURN jsonb_build_object('ok',true,'ativo',true,'ativo_desde',v_desde);
END $fn$;
REVOKE ALL ON FUNCTION public.ncrm_ativar_ingest(boolean,timestamptz) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ncrm_ativar_ingest(boolean,timestamptz) TO authenticated;

CREATE FUNCTION public.ncrm_desativar_ingest(p_confirmar boolean DEFAULT false)
  RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $fn$
DECLARE v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL THEN RETURN jsonb_build_object('ok',false,'erro','nao_autenticado'); END IF;
  IF COALESCE(public.can_manage_all(), false) IS NOT TRUE THEN RETURN jsonb_build_object('ok',false,'erro','sem_permissao'); END IF;
  IF p_confirmar IS NOT TRUE THEN RETURN jsonb_build_object('ok',false,'erro','confirmacao_obrigatoria'); END IF;
  UPDATE public.ncrm_ingest_config SET ativo=false, atualizado_em=now(), atualizado_por=v_uid WHERE id=true;
  INSERT INTO public.ncrm_ingest_audit (acao, ativo_desde, atualizado_por)
    SELECT 'desativar', ativo_desde, v_uid FROM public.ncrm_ingest_config WHERE id=true;
  RETURN jsonb_build_object('ok',true,'ativo',false);
END $fn$;
REVOKE ALL ON FUNCTION public.ncrm_desativar_ingest(boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ncrm_desativar_ingest(boolean) TO authenticated;

-- Resolve o negócio ABERTO mais recente a partir da conversa (conversa->contato->lead->negocio).
-- Nunca seleciona ganho/perdido; determinístico (mais recente por criado_em, desempate por id).
CREATE FUNCTION ncrm_private.resolver_negocio_por_conversa(p_conversa_id uuid)
  RETURNS bigint LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $fn$
  SELECT n.id
  FROM public.wa_conversas c
  JOIN public.wa_contatos ct ON ct.id = c.contato_id
  JOIN public.negocios n ON n.lead_id = ct.lead_id
  WHERE c.id = p_conversa_id AND ct.lead_id IS NOT NULL
    AND n.status = 'aberto'
  ORDER BY n.criado_em DESC, n.id DESC
  LIMIT 1
$fn$;
REVOKE ALL ON FUNCTION ncrm_private.resolver_negocio_por_conversa(uuid) FROM PUBLIC;

-- Reconciliação idempotente. Nunca modifica wa_mensagens. Nunca atrasa WhatsApp.
CREATE FUNCTION ncrm_private.reconciliar_mensagens(p_limite int DEFAULT 200, p_max_tentativas int DEFAULT 5, p_janela_inbound interval DEFAULT interval '2 days')
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
