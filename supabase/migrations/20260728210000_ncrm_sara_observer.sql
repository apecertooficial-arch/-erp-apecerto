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
-- PROVENIÊNCIA (P0-C): toda análise AUTOMÁTICA carrega origem/ator/run_id/versões e um
-- context_hash (idempotência: mesmo contexto não é reanalisado). É gravada SOMENTE pelo
-- serviço (runner service_role) — corretor não pode fabricar análise automática.
CREATE TABLE public.ncrm_sara_analise (
  id                    bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  negocio_id            bigint NOT NULL,
  origem                text NOT NULL DEFAULT 'sara_runner' CHECK (origem IN ('sara_runner')),
  ator                  text NOT NULL DEFAULT 'sara_runner',   -- identidade do SERVIÇO (nunca um corretor)
  run_id                uuid NOT NULL,
  context_hash          text NOT NULL,                          -- idempotência do contexto analisado
  etapa_atual           text NULL,
  etapa_sugerida        text NULL CHECK (etapa_sugerida IS NULL OR etapa_sugerida IN ('novo','tentando_contato','em_atendimento','em_acompanhamento')),
  proxima_acao_sugerida text NULL,
  prazo_sugerido        timestamptz NULL,
  justificativa         text NOT NULL,
  evidencias            jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(evidencias) = 'array' AND jsonb_array_length(evidencias) <= 30),
  confianca             numeric NOT NULL CHECK (confianca >= 0 AND confianca <= 1),
  cliente_aguardando    boolean NOT NULL DEFAULT false,
  promessa_retorno      boolean NOT NULL DEFAULT false,
  visita_mencionada     boolean NOT NULL DEFAULT false,
  proposta_mencionada   boolean NOT NULL DEFAULT false,
  versao_prompt         text NOT NULL,
  versao_modelo         text NULL,
  modo                  text NOT NULL CHECK (modo IN ('observer','suggest','execute')),
  analisado_em          timestamptz NOT NULL DEFAULT now(),     -- server-side (não confia no cliente)
  -- resultado futuro da aprovação/rejeição humana (Regra 5).
  decisao               text NOT NULL DEFAULT 'pendente' CHECK (decisao IN ('pendente','aprovada','rejeitada')),
  decidido_por          uuid NULL,
  decidido_em           timestamptz NULL,
  justificativa_decisao text NULL,
  criado_em             timestamptz NOT NULL DEFAULT now(),
  -- idempotência por NEGÓCIO + contexto: o mesmo texto em negócios diferentes NÃO colide.
  CONSTRAINT ux_ncrm_sara_context UNIQUE (negocio_id, context_hash)
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

-- Registra uma ANÁLISE AUTOMÁTICA da Sara. SERVICE-ONLY: só o runner (service_role) grava
-- — corretor autenticado NÃO consegue fabricar análise (nem por chamada direta). INSERT-ONLY:
-- jamais muta operacional. Idempotente por context_hash (mesmo contexto não é reanalisado).
-- Validação DURA no banco mesmo se a API for contornada. Timestamps server-side.
CREATE FUNCTION public.ncrm_sara_registrar_analise(
    p_run_id uuid, p_context_hash text, p_negocio_id bigint, p_etapa_atual text, p_etapa_sugerida text,
    p_proxima_acao_sugerida text, p_prazo_sugerido timestamptz, p_justificativa text, p_evidencias jsonb,
    p_confianca numeric, p_cliente_aguardando boolean, p_promessa_retorno boolean, p_visita_mencionada boolean,
    p_proposta_mencionada boolean, p_versao_prompt text, p_versao_modelo text)
  RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $fn$
DECLARE v_modo text; v_id bigint;
BEGIN
  -- PROVENIÊNCIA: só o SERVIÇO (runner) grava análise automática. Nunca um corretor.
  IF COALESCE(auth.role(),'') <> 'service_role' THEN RETURN jsonb_build_object('ok',false,'erro','somente_servico'); END IF;
  SELECT modo INTO v_modo FROM public.ncrm_sara_config WHERE id = true;
  -- Registro automático SOMENTE em observer (não apenas "diferente de off"). execute segue bloqueado.
  IF COALESCE(v_modo,'observer') <> 'observer' THEN RETURN jsonb_build_object('ok',false,'erro','sara_nao_em_observer','modo',COALESCE(v_modo,'observer')); END IF;
  -- validação dura (rejeita valores inesperados independentemente da API)
  IF p_run_id IS NULL THEN RETURN jsonb_build_object('ok',false,'erro','run_id_obrigatorio'); END IF;
  IF p_context_hash IS NULL OR length(btrim(p_context_hash)) NOT BETWEEN 8 AND 200 THEN RETURN jsonb_build_object('ok',false,'erro','context_hash_invalido'); END IF;
  IF p_confianca IS NULL OR p_confianca < 0 OR p_confianca > 1 THEN RETURN jsonb_build_object('ok',false,'erro','confianca_invalida'); END IF;
  IF p_justificativa IS NULL OR length(btrim(p_justificativa)) NOT BETWEEN 1 AND 2000 THEN RETURN jsonb_build_object('ok',false,'erro','justificativa_invalida'); END IF;
  IF p_versao_prompt IS NULL OR length(btrim(p_versao_prompt)) NOT BETWEEN 1 AND 100 THEN RETURN jsonb_build_object('ok',false,'erro','versao_prompt_invalida'); END IF;
  IF p_proxima_acao_sugerida IS NOT NULL AND length(p_proxima_acao_sugerida) > 200 THEN RETURN jsonb_build_object('ok',false,'erro','proxima_acao_invalida'); END IF;
  IF p_etapa_sugerida IS NOT NULL AND p_etapa_sugerida NOT IN ('novo','tentando_contato','em_atendimento','em_acompanhamento') THEN RETURN jsonb_build_object('ok',false,'erro','etapa_sugerida_invalida'); END IF;
  IF p_evidencias IS NOT NULL AND (jsonb_typeof(p_evidencias) <> 'array' OR jsonb_array_length(p_evidencias) > 30) THEN RETURN jsonb_build_object('ok',false,'erro','evidencias_invalidas'); END IF;
  IF NOT EXISTS (SELECT 1 FROM public.negocios WHERE id = p_negocio_id) THEN RETURN jsonb_build_object('ok',false,'erro','negocio_inexistente'); END IF;

  INSERT INTO public.ncrm_sara_analise (negocio_id, origem, ator, run_id, context_hash, etapa_atual, etapa_sugerida,
     proxima_acao_sugerida, prazo_sugerido, justificativa, evidencias, confianca, cliente_aguardando, promessa_retorno,
     visita_mencionada, proposta_mencionada, versao_prompt, versao_modelo, modo, analisado_em)
  VALUES (p_negocio_id, 'sara_runner', 'sara_runner', p_run_id, btrim(p_context_hash), p_etapa_atual, p_etapa_sugerida,
     p_proxima_acao_sugerida, p_prazo_sugerido, p_justificativa, COALESCE(p_evidencias,'[]'::jsonb), p_confianca,
     COALESCE(p_cliente_aguardando,false), COALESCE(p_promessa_retorno,false), COALESCE(p_visita_mencionada,false),
     COALESCE(p_proposta_mencionada,false), p_versao_prompt, p_versao_modelo, COALESCE(v_modo,'observer'), now())
  ON CONFLICT (negocio_id, context_hash) DO NOTHING
  RETURNING id INTO v_id;

  IF v_id IS NULL THEN RETURN jsonb_build_object('ok',true,'ja_analisado',true); END IF;  -- idempotência
  RETURN jsonb_build_object('ok',true,'analise_id',v_id,'modo',COALESCE(v_modo,'observer'));
END $fn$;
REVOKE ALL ON FUNCTION public.ncrm_sara_registrar_analise(uuid,text,bigint,text,text,text,timestamptz,text,jsonb,numeric,boolean,boolean,boolean,boolean,text,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ncrm_sara_registrar_analise(uuid,text,bigint,text,text,text,timestamptz,text,jsonb,numeric,boolean,boolean,boolean,boolean,text,text) TO service_role;

-- DECISÃO HUMANA sobre uma análise automática (aprovar/rejeitar). Authenticated + pode_operar
-- no negócio (fail-closed). NÃO muta operacional: só marca a decisão e registra evento auditável
-- classificacao_sara vinculado à análise (liga ncrm_sara_analise ↔ ncrm_evento). Idempotente.
CREATE FUNCTION public.ncrm_sara_decidir_analise(p_analise_id bigint, p_decisao text, p_justificativa text)
  RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $fn$
DECLARE v_uid uuid := auth.uid(); v_neg bigint; v_lead bigint; v_corretor bigint; v_cfg bigint; v_dec text;
BEGIN
  IF v_uid IS NULL THEN RETURN jsonb_build_object('ok',false,'erro','nao_autenticado'); END IF;
  IF p_decisao NOT IN ('aprovada','rejeitada') THEN RETURN jsonb_build_object('ok',false,'erro','decisao_invalida'); END IF;
  SELECT negocio_id, decisao INTO v_neg, v_dec FROM public.ncrm_sara_analise WHERE id = p_analise_id;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok',false,'erro','analise_inexistente'); END IF;
  IF ncrm_private.pode_operar_negocio(v_neg) IS NOT TRUE THEN RETURN jsonb_build_object('ok',false,'erro','sem_permissao'); END IF;  -- fail-closed
  IF v_dec <> 'pendente' THEN RETURN jsonb_build_object('ok',true,'ja_decidido',true,'decisao',v_dec); END IF;  -- idempotente
  SELECT n.lead_id, n.corretor_id INTO v_lead, v_corretor FROM public.negocios n WHERE n.id = v_neg;
  SELECT workflow_config_id INTO v_cfg FROM public.ncrm_estado WHERE negocio_id = v_neg;

  UPDATE public.ncrm_sara_analise SET decisao = p_decisao, decidido_por = v_uid, decidido_em = now(),
     justificativa_decisao = NULLIF(btrim(COALESCE(p_justificativa,'')),'') WHERE id = p_analise_id;
  -- Evento auditável, NÃO aplicado (aplicado=false): liga a análise à decisão humana.
  INSERT INTO public.ncrm_evento (negocio_id, lead_id, corretor_id_no_evento, workflow_config_id, tipo, payload, origem, executado_por, idempotency_key)
  VALUES (v_neg, v_lead, v_corretor, v_cfg, 'classificacao_sara',
     jsonb_build_object('aplicado', false, 'origem_analise', 'sara_runner', 'analise_id', p_analise_id, 'decisao', p_decisao),
     'usuario', v_uid, 'sara_analise_decisao:'||p_analise_id||':'||p_decisao);
  RETURN jsonb_build_object('ok',true,'analise_id',p_analise_id,'decisao',p_decisao);
EXCEPTION WHEN unique_violation THEN
  RETURN jsonb_build_object('ok',true,'ja_decidido',true);
END $fn$;
REVOKE ALL ON FUNCTION public.ncrm_sara_decidir_analise(bigint,text,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ncrm_sara_decidir_analise(bigint,text,text) TO authenticated;

-- ============================ FILA JUSTA + CURSOR (P0-B #3) ============================
-- Estado/cursor do runner (última execução, último negócio, run_id, contagem).
CREATE TABLE public.ncrm_sara_runner_estado (
  id               boolean PRIMARY KEY DEFAULT true,
  ultima_execucao  timestamptz NULL,
  ultimo_run_id    uuid NULL,
  ultimo_negocio_id bigint NULL,
  processados      integer NOT NULL DEFAULT 0,
  CONSTRAINT ck_ncrm_sara_runner_estado_singleton CHECK (id = true)
);
INSERT INTO public.ncrm_sara_runner_estado (id) VALUES (true) ON CONFLICT (id) DO NOTHING;
REVOKE ALL ON public.ncrm_sara_runner_estado FROM PUBLIC, anon, authenticated;
ALTER TABLE public.ncrm_sara_runner_estado ENABLE ROW LEVEL SECURITY;

-- Elegíveis do runner: negócios com estado, ordenados pelos MENOS RECENTEMENTE analisados
-- (nunca analisados primeiro), determinístico por negócio. Ninguém fica eternamente de fora.
CREATE FUNCTION public.ncrm_sara_elegiveis(p_lote int DEFAULT 100)
  RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $fn$
DECLARE v_lim int := LEAST(GREATEST(COALESCE(p_lote,100),1),500);
BEGIN
  IF COALESCE(auth.role(),'') <> 'service_role' THEN RETURN jsonb_build_object('ok',false,'erro','somente_servico'); END IF;
  RETURN jsonb_build_object('ok',true,'negocios', COALESCE((
    SELECT jsonb_agg(x.negocio_id ORDER BY x.ult NULLS FIRST, x.negocio_id)
    FROM (
      SELECT e.negocio_id, max(a.analisado_em) AS ult
      FROM public.ncrm_estado e
      LEFT JOIN public.ncrm_sara_analise a ON a.negocio_id = e.negocio_id
      GROUP BY e.negocio_id
      ORDER BY max(a.analisado_em) NULLS FIRST, e.negocio_id
      LIMIT v_lim
    ) x), '[]'::jsonb));
END $fn$;
REVOKE ALL ON FUNCTION public.ncrm_sara_elegiveis(int) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ncrm_sara_elegiveis(int) TO service_role;

-- Marca a execução (cursor) — service-only.
CREATE FUNCTION public.ncrm_sara_runner_marcar_execucao(p_run_id uuid, p_ultimo_negocio_id bigint, p_processados int)
  RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $fn$
BEGIN
  IF COALESCE(auth.role(),'') <> 'service_role' THEN RETURN jsonb_build_object('ok',false,'erro','somente_servico'); END IF;
  UPDATE public.ncrm_sara_runner_estado
     SET ultima_execucao = now(), ultimo_run_id = p_run_id, ultimo_negocio_id = p_ultimo_negocio_id,
         processados = COALESCE(p_processados,0)
   WHERE id = true;
  RETURN jsonb_build_object('ok',true);
END $fn$;
REVOKE ALL ON FUNCTION public.ncrm_sara_runner_marcar_execucao(uuid,bigint,int) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ncrm_sara_runner_marcar_execucao(uuid,bigint,int) TO service_role;

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
