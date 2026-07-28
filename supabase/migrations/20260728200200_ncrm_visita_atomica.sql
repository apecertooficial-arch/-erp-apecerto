-- CRM Nova Era — VISITA ATÔMICA (aditivo; só ncrm_* + INSERT em public.visitas como o createVisit).
-- Uma transação: insere a visita REAL, encaminha o estado e grava o evento. Se o encaminhamento
-- falhar, a visita também sofre rollback (nada de "visita órfã"). Idempotente pelo p_idem.

CREATE FUNCTION public.ncrm_agendar_visita_e_encaminhar(
    p_negocio_id bigint, p_versao int, p_lead_id bigint, p_data date, p_hora_inicio text,
    p_empreendimento_id uuid, p_produto text, p_com_gerente boolean, p_gerente_id bigint, p_idem text)
  RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $fn$
DECLARE v_uid uuid := auth.uid(); v_lead bigint; v_corretor bigint; v_antes int; v_cfg bigint;
        v_saida text; v_nome text; v_visita uuid;
BEGIN
  PERFORM ncrm_private.assert_idem(p_idem);
  IF v_uid IS NULL THEN RETURN jsonb_build_object('ok',false,'erro','nao_autenticado'); END IF;
  SELECT n.lead_id, n.corretor_id INTO v_lead, v_corretor FROM public.negocios n WHERE n.id = p_negocio_id;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok',false,'erro','negocio_inexistente'); END IF;
  IF ncrm_private.pode_operar_negocio(p_negocio_id) IS NOT TRUE THEN RETURN jsonb_build_object('ok',false,'erro','sem_permissao'); END IF;  -- fail-closed
  IF p_lead_id IS NULL OR p_lead_id <> v_lead THEN RETURN jsonb_build_object('ok',false,'erro','lead_incoerente'); END IF;
  IF p_data IS NULL OR p_hora_inicio IS NULL OR btrim(p_hora_inicio) = '' THEN RETURN jsonb_build_object('ok',false,'erro','data_hora_obrigatorias'); END IF;
  IF p_data < current_date THEN RETURN jsonb_build_object('ok',false,'erro','data_no_passado'); END IF;
  IF EXISTS (SELECT 1 FROM public.ncrm_evento WHERE idempotency_key = p_idem) THEN
    RETURN jsonb_build_object('ok',true,'ja_processado',true); END IF;

  SELECT versao, workflow_config_id, saida INTO v_antes, v_cfg, v_saida FROM public.ncrm_estado WHERE negocio_id = p_negocio_id FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok',false,'erro','estado_inexistente'); END IF;
  IF p_versao <> v_antes THEN RETURN jsonb_build_object('ok',false,'erro','versao_conflito'); END IF;
  IF v_saida IS NOT NULL THEN RETURN jsonb_build_object('ok',false,'erro','ja_em_saida'); END IF;

  SELECT nome INTO v_nome FROM public.leads WHERE id = v_lead;

  -- 1) cria a visita REAL (mesmas regras do createVisit: corretor do negócio, produto, gerente).
  INSERT INTO public.visitas (created_by, lead_id, negocio_id, corretor_id, cliente_nome, empreendimento_id, produto,
     data, hora_inicio, com_gerente, gerente_id, status)
  VALUES (v_uid, v_lead, p_negocio_id, v_corretor, v_nome, p_empreendimento_id, p_produto,
     p_data, p_hora_inicio, COALESCE(p_com_gerente,false), p_gerente_id, 'agendada')
  RETURNING id INTO v_visita;

  -- 2) encaminha o estado + evento (se falhar, a visita acima é revertida junto)
  UPDATE public.ncrm_estado SET saida='pipeline_visitas', saida_em=now(), visita_id=v_visita,
     proxima_acao_tipo=NULL, proxima_acao_titulo=NULL, proxima_acao_em=NULL, resposta_pendente=false,
     versao=v_antes+1, atualizado_em=now(), atualizado_por=v_uid, origem_ultima='usuario', ultima_decisao_humana_em=now()
  WHERE negocio_id=p_negocio_id AND versao=v_antes;
  INSERT INTO public.ncrm_evento (negocio_id, lead_id, corretor_id_no_evento, workflow_config_id, tipo, payload, origem, executado_por, idempotency_key, estado_versao_antes, estado_versao_apos)
  VALUES (p_negocio_id, v_lead, v_corretor, v_cfg, 'visita_agendada', jsonb_build_object('visita_id', v_visita, 'data', p_data), 'usuario', v_uid, p_idem, v_antes, v_antes+1);
  RETURN jsonb_build_object('ok',true,'versao', v_antes+1, 'visita_id', v_visita);
EXCEPTION WHEN unique_violation THEN
  IF EXISTS (SELECT 1 FROM public.ncrm_evento WHERE idempotency_key = p_idem) THEN
    RETURN jsonb_build_object('ok',true,'ja_processado',true);
  ELSE RAISE; END IF;
END $fn$;
REVOKE ALL ON FUNCTION public.ncrm_agendar_visita_e_encaminhar(bigint,int,bigint,date,text,uuid,text,boolean,bigint,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ncrm_agendar_visita_e_encaminhar(bigint,int,bigint,date,text,uuid,text,boolean,bigint,text) TO authenticated;
