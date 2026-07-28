-- CRM Nova Era — correção mínima: DECISÃO HUMANA sobre sugestão da Sara (auditável).
-- ---------------------------------------------------------------------------
-- Contexto: ncrm_sara_classificar (papel `sara`) registra a SUGESTÃO da Sara.
-- Falta persistir a DECISÃO do humano (aceita/rejeitada) de forma auditável.
-- Arquitetura correta: quem decide é o CORRETOR autenticado — NÃO a service_role
-- se passando por Sara. Por isso esta RPC é `authenticated` + pode_operar (fail-closed),
-- SECURITY DEFINER, e grava um evento classificacao_sara com origem='usuario'.
-- NÃO altera ncrm_estado (a aplicação da ação usa as RPCs operacionais já existentes).
-- Idempotente por p_idem. Somente objetos ncrm_*.

CREATE FUNCTION public.ncrm_registrar_decisao_sara(
    p_negocio_id bigint, p_base_versao int, p_decisao text, p_sugestao jsonb,
    p_confianca numeric, p_justificativa text, p_idem text)
  RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $fn$
DECLARE v_uid uuid := auth.uid(); v_lead bigint; v_corretor bigint; v_cfg bigint; v_atual int;
BEGIN
  PERFORM ncrm_private.assert_idem(p_idem);
  IF v_uid IS NULL THEN RETURN jsonb_build_object('ok',false,'erro','nao_autenticado'); END IF;
  IF p_decisao NOT IN ('aceita','rejeitada') THEN RETURN jsonb_build_object('ok',false,'erro','decisao_invalida'); END IF;
  IF p_confianca IS NULL OR p_confianca < 0 OR p_confianca > 1 THEN RETURN jsonb_build_object('ok',false,'erro','confianca_invalida'); END IF;
  IF jsonb_typeof(COALESCE(p_sugestao,'null'::jsonb)) <> 'object' THEN RETURN jsonb_build_object('ok',false,'erro','sugestao_invalida'); END IF;
  SELECT n.lead_id, n.corretor_id INTO v_lead, v_corretor FROM public.negocios n WHERE n.id = p_negocio_id;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok',false,'erro','negocio_inexistente'); END IF;
  IF ncrm_private.pode_operar_negocio(p_negocio_id) IS NOT TRUE THEN RETURN jsonb_build_object('ok',false,'erro','sem_permissao'); END IF;  -- fail-closed
  IF EXISTS (SELECT 1 FROM public.ncrm_evento WHERE idempotency_key = p_idem) THEN
    RETURN jsonb_build_object('ok',true,'ja_processado',true); END IF;
  SELECT versao, workflow_config_id INTO v_atual, v_cfg FROM public.ncrm_estado WHERE negocio_id = p_negocio_id;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok',false,'erro','estado_inexistente'); END IF;

  -- Evento auditável da DECISÃO HUMANA (não altera estado; aplicado=false).
  INSERT INTO public.ncrm_evento (negocio_id, lead_id, corretor_id_no_evento, workflow_config_id, tipo,
     payload, origem, executado_por, idempotency_key)
  VALUES (p_negocio_id, v_lead, v_corretor, v_cfg, 'classificacao_sara',
     jsonb_build_object('aplicado', false, 'decisao', p_decisao, 'sugestao', p_sugestao,
                        'confianca', p_confianca, 'justificativa', p_justificativa,
                        'base_versao', p_base_versao, 'versao_atual', v_atual,
                        'decidido_por', v_uid, 'decidido_em', now()),
     'usuario', v_uid, p_idem);
  RETURN jsonb_build_object('ok',true,'decisao',p_decisao);
EXCEPTION WHEN unique_violation THEN
  IF EXISTS (SELECT 1 FROM public.ncrm_evento WHERE idempotency_key = p_idem) THEN
    RETURN jsonb_build_object('ok',true,'ja_processado',true);
  ELSE RAISE; END IF;
END $fn$;
REVOKE ALL ON FUNCTION public.ncrm_registrar_decisao_sara(bigint,int,text,jsonb,numeric,text,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ncrm_registrar_decisao_sara(bigint,int,text,jsonb,numeric,text,text) TO authenticated;
