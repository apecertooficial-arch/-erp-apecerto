-- CRM Nova Era — SARA EM MODO OBSERVADOR (Fase 3, aditivo; só objetos ncrm_*).
-- ---------------------------------------------------------------------------
-- NÃO aplicada em produção nesta rodada. Aditiva: cria a configuração de modo da
-- Sara (off/observer/suggest/execute; inicial OBLIGATÓRIO observer) e a tabela de
-- ANÁLISES da Sara (auditoria). No modo observer a Sara só LÊ e REGISTRA análise —
-- a RPC de registro é INSERT-ONLY e NUNCA muta estado/evento operacional, não move
-- lead, não cria visita/proposta, não envia WhatsApp, não ativa ingestão.
-- Reforça no banco o que o módulo puro saraModo.ts garante no app.

-- Configuração singleton do modo da Sara.
CREATE TABLE public.ncrm_sara_config (
  id             boolean PRIMARY KEY DEFAULT true,
  modo           text NOT NULL DEFAULT 'observer' CHECK (modo IN ('off','observer','suggest','execute')),
  atualizado_em  timestamptz NOT NULL DEFAULT now(),
  atualizado_por uuid NULL,
  CONSTRAINT ck_ncrm_sara_cfg_singleton CHECK (id = true)
);
INSERT INTO public.ncrm_sara_config (id, modo) VALUES (true, 'observer') ON CONFLICT (id) DO NOTHING;
REVOKE ALL ON public.ncrm_sara_config FROM PUBLIC, anon, authenticated;
ALTER TABLE public.ncrm_sara_config ENABLE ROW LEVEL SECURITY;
COMMENT ON TABLE public.ncrm_sara_config IS 'CRM Nova Era: modo de operação da Sara. Inicial observer. execute é bloqueado nesta fase.';

-- Auditoria das ANÁLISES da Sara (observer registra aqui; nunca muta operacional).
CREATE TABLE public.ncrm_sara_analise (
  id                    bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  negocio_id            bigint NOT NULL,
  etapa_atual           text NULL,
  etapa_sugerida        text NULL,
  proxima_acao_sugerida text NULL,
  prazo_sugerido        timestamptz NULL,
  justificativa         text NOT NULL,
  evidencias            jsonb NOT NULL DEFAULT '[]'::jsonb,
  confianca             numeric NOT NULL CHECK (confianca >= 0 AND confianca <= 1),
  cliente_aguardando    boolean NOT NULL DEFAULT false,
  promessa_retorno      boolean NOT NULL DEFAULT false,
  visita_mencionada     boolean NOT NULL DEFAULT false,
  proposta_mencionada   boolean NOT NULL DEFAULT false,
  versao_prompt         text NOT NULL,
  modo                  text NOT NULL CHECK (modo IN ('observer','suggest','execute')),
  analisado_em          timestamptz NOT NULL,
  -- resultado futuro da aprovação/rejeição humana (Regra 5).
  decisao               text NOT NULL DEFAULT 'pendente' CHECK (decisao IN ('pendente','aprovada','rejeitada')),
  decidido_por          uuid NULL,
  decidido_em           timestamptz NULL,
  justificativa_decisao text NULL,
  criado_em             timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ix_ncrm_sara_analise_negocio ON public.ncrm_sara_analise (negocio_id, id DESC);
CREATE INDEX ix_ncrm_sara_analise_pendentes ON public.ncrm_sara_analise (decisao, id DESC) WHERE decisao = 'pendente';
REVOKE ALL ON public.ncrm_sara_analise FROM PUBLIC, anon, authenticated;
ALTER TABLE public.ncrm_sara_analise ENABLE ROW LEVEL SECURITY;

-- Status do modo (admin autenticado).
CREATE FUNCTION public.ncrm_sara_modo_status()
  RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $fn$
DECLARE v_uid uuid := auth.uid(); v_modo text; v_em timestamptz; v_por uuid;
        v_pend int; v_total int;
BEGIN
  IF v_uid IS NULL THEN RETURN jsonb_build_object('ok',false,'erro','nao_autenticado'); END IF;
  IF COALESCE(public.can_manage_all(), false) IS NOT TRUE THEN RETURN jsonb_build_object('ok',false,'erro','sem_permissao'); END IF;
  SELECT modo, atualizado_em, atualizado_por INTO v_modo, v_em, v_por FROM public.ncrm_sara_config WHERE id = true;
  SELECT count(*) FILTER (WHERE decisao='pendente'), count(*) INTO v_pend, v_total FROM public.ncrm_sara_analise;
  RETURN jsonb_build_object('ok',true,'modo',COALESCE(v_modo,'observer'),'atualizado_em',v_em,'atualizado_por',v_por,
                            'analises_total',v_total,'analises_pendentes',v_pend);
END $fn$;
REVOKE ALL ON FUNCTION public.ncrm_sara_modo_status() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ncrm_sara_modo_status() TO authenticated;

-- Define o modo (admin, confirmação). execute é BLOQUEADO nesta fase (não ativar Sara execute).
CREATE FUNCTION public.ncrm_sara_definir_modo(p_modo text, p_confirmar boolean DEFAULT false)
  RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $fn$
DECLARE v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL THEN RETURN jsonb_build_object('ok',false,'erro','nao_autenticado'); END IF;
  IF COALESCE(public.can_manage_all(), false) IS NOT TRUE THEN RETURN jsonb_build_object('ok',false,'erro','sem_permissao'); END IF;
  IF p_confirmar IS NOT TRUE THEN RETURN jsonb_build_object('ok',false,'erro','confirmacao_obrigatoria'); END IF;
  IF p_modo IS NULL OR p_modo NOT IN ('off','observer','suggest','execute') THEN RETURN jsonb_build_object('ok',false,'erro','modo_invalido'); END IF;
  IF p_modo = 'execute' THEN RETURN jsonb_build_object('ok',false,'erro','execute_bloqueado_nesta_fase'); END IF;  -- Regra 6
  UPDATE public.ncrm_sara_config SET modo = p_modo, atualizado_em = now(), atualizado_por = v_uid WHERE id = true;
  RETURN jsonb_build_object('ok',true,'modo',p_modo);
END $fn$;
REVOKE ALL ON FUNCTION public.ncrm_sara_definir_modo(text,boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ncrm_sara_definir_modo(text,boolean) TO authenticated;

-- Registra uma ANÁLISE da Sara. INSERT-ONLY: jamais muta operacional. Só em modos
-- que produzem análise (observer/suggest/execute); em off é recusada. Exige pode_operar
-- no negócio (fail-closed) — a Sara analisa apenas negócios visíveis/autorizados.
CREATE FUNCTION public.ncrm_sara_registrar_analise(
    p_negocio_id bigint, p_etapa_atual text, p_etapa_sugerida text, p_proxima_acao_sugerida text,
    p_prazo_sugerido timestamptz, p_justificativa text, p_evidencias jsonb, p_confianca numeric,
    p_cliente_aguardando boolean, p_promessa_retorno boolean, p_visita_mencionada boolean,
    p_proposta_mencionada boolean, p_versao_prompt text)
  RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $fn$
DECLARE v_uid uuid := auth.uid(); v_modo text; v_id bigint;
BEGIN
  IF v_uid IS NULL THEN RETURN jsonb_build_object('ok',false,'erro','nao_autenticado'); END IF;
  IF ncrm_private.pode_operar_negocio(p_negocio_id) IS NOT TRUE THEN RETURN jsonb_build_object('ok',false,'erro','sem_permissao'); END IF;
  SELECT modo INTO v_modo FROM public.ncrm_sara_config WHERE id = true;
  IF COALESCE(v_modo,'observer') = 'off' THEN RETURN jsonb_build_object('ok',false,'erro','sara_desligada'); END IF;
  IF p_confianca IS NULL OR p_confianca < 0 OR p_confianca > 1 THEN RETURN jsonb_build_object('ok',false,'erro','confianca_invalida'); END IF;
  IF p_justificativa IS NULL OR btrim(p_justificativa) = '' THEN RETURN jsonb_build_object('ok',false,'erro','justificativa_obrigatoria'); END IF;
  IF p_versao_prompt IS NULL OR btrim(p_versao_prompt) = '' THEN RETURN jsonb_build_object('ok',false,'erro','versao_prompt_obrigatoria'); END IF;
  INSERT INTO public.ncrm_sara_analise (negocio_id, etapa_atual, etapa_sugerida, proxima_acao_sugerida, prazo_sugerido,
     justificativa, evidencias, confianca, cliente_aguardando, promessa_retorno, visita_mencionada, proposta_mencionada,
     versao_prompt, modo, analisado_em)
  VALUES (p_negocio_id, p_etapa_atual, p_etapa_sugerida, p_proxima_acao_sugerida, p_prazo_sugerido,
     p_justificativa, COALESCE(p_evidencias,'[]'::jsonb), p_confianca, COALESCE(p_cliente_aguardando,false),
     COALESCE(p_promessa_retorno,false), COALESCE(p_visita_mencionada,false), COALESCE(p_proposta_mencionada,false),
     p_versao_prompt, COALESCE(v_modo,'observer'), now())
  RETURNING id INTO v_id;
  RETURN jsonb_build_object('ok',true,'analise_id',v_id,'modo',COALESCE(v_modo,'observer'));
END $fn$;
REVOKE ALL ON FUNCTION public.ncrm_sara_registrar_analise(bigint,text,text,text,timestamptz,text,jsonb,numeric,boolean,boolean,boolean,boolean,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ncrm_sara_registrar_analise(bigint,text,text,text,timestamptz,text,jsonb,numeric,boolean,boolean,boolean,boolean,text) TO authenticated;

-- Leitura das análises recentes (admin).
CREATE FUNCTION public.ncrm_sara_analises_recentes(p_limite int DEFAULT 50)
  RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $fn$
DECLARE v_uid uuid := auth.uid(); v_lim int := LEAST(GREATEST(COALESCE(p_limite,50),1),200);
BEGIN
  IF v_uid IS NULL THEN RETURN jsonb_build_object('ok',false,'erro','nao_autenticado'); END IF;
  IF COALESCE(public.can_manage_all(), false) IS NOT TRUE THEN RETURN jsonb_build_object('ok',false,'erro','sem_permissao'); END IF;
  RETURN jsonb_build_object('ok',true,'analises', COALESCE((
    SELECT jsonb_agg(to_jsonb(a) ORDER BY a.id DESC)
    FROM (SELECT id, negocio_id, etapa_atual, etapa_sugerida, proxima_acao_sugerida, prazo_sugerido,
                 justificativa, confianca, modo, decisao, analisado_em, criado_em
          FROM public.ncrm_sara_analise ORDER BY id DESC LIMIT v_lim) a), '[]'::jsonb));
END $fn$;
REVOKE ALL ON FUNCTION public.ncrm_sara_analises_recentes(int) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ncrm_sara_analises_recentes(int) TO authenticated;
