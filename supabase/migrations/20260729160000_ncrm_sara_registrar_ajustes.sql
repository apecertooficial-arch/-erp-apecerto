-- CRM Nova Era - AJUSTE de validacao do registro de analise da Sara (Fase 4; corretivo).
-- Causa raiz (producao): contextHashEstavel (djb2->base36) gera hashes de ate 7 caracteres,
-- mas a guarda exigia length>=8 => toda analise era recusada (context_hash_invalido).
-- Alinha tambem proxima_acao_sugerida (<=400) ao contrato do saraSchema. Validacao segue dura.
-- Registra uma ANÁLISE AUTOMÁTICA da Sara. SERVICE-ONLY: só o runner (service_role) grava
-- — corretor autenticado NÃO consegue fabricar análise (nem por chamada direta). INSERT-ONLY:
-- jamais muta operacional. Idempotente por context_hash (mesmo contexto não é reanalisado).
-- Validação DURA no banco mesmo se a API for contornada. Timestamps server-side.
CREATE OR REPLACE FUNCTION public.ncrm_sara_registrar_analise(
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
  IF p_context_hash IS NULL OR length(btrim(p_context_hash)) NOT BETWEEN 4 AND 200 THEN RETURN jsonb_build_object('ok',false,'erro','context_hash_invalido'); END IF;
  IF p_confianca IS NULL OR p_confianca < 0 OR p_confianca > 1 THEN RETURN jsonb_build_object('ok',false,'erro','confianca_invalida'); END IF;
  IF p_justificativa IS NULL OR length(btrim(p_justificativa)) NOT BETWEEN 1 AND 2000 THEN RETURN jsonb_build_object('ok',false,'erro','justificativa_invalida'); END IF;
  IF p_versao_prompt IS NULL OR length(btrim(p_versao_prompt)) NOT BETWEEN 1 AND 100 THEN RETURN jsonb_build_object('ok',false,'erro','versao_prompt_invalida'); END IF;
  IF p_proxima_acao_sugerida IS NOT NULL AND length(p_proxima_acao_sugerida) > 400 THEN RETURN jsonb_build_object('ok',false,'erro','proxima_acao_invalida'); END IF;
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

-- Reabre a fila do runner para itens recusados pela guarda antiga (bookkeeping).
UPDATE public.ncrm_sara_runner_item SET proxima_tentativa_em = now(), ultimo_erro = NULL WHERE ultimo_status = 'erro' AND ultimo_erro = 'registro_recusado';
