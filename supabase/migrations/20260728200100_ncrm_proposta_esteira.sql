-- CRM Nova Era — PROPOSTA ATÔMICA NA ESTEIRA REAL (aditivo; só ncrm_* + reuso de solicitar_venda).
-- Proposta ≠ venda: usa venda_solicitacoes (status pendente). NÃO insere em vendas, NÃO altera
-- negocios.status, NÃO preenche negocios.venda_id. Tudo em UMA transação (rollback integral em falha).

ALTER TABLE public.ncrm_proposta
  ADD COLUMN venda_solicitacao_id uuid NULL REFERENCES public.venda_solicitacoes(id);
CREATE INDEX ix_ncrm_proposta_solicitacao ON public.ncrm_proposta (venda_solicitacao_id);
-- impede vincular a mesma solicitação a duas propostas
CREATE UNIQUE INDEX ux_ncrm_proposta_solicitacao ON public.ncrm_proposta (venda_solicitacao_id) WHERE venda_solicitacao_id IS NOT NULL;

CREATE FUNCTION public.ncrm_registrar_proposta_esteira(
    p_negocio_id bigint, p_versao int, p_produto_id uuid, p_valor numeric, p_forma text, p_obs text, p_idem text)
  RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $fn$
DECLARE v_uid uuid := auth.uid(); v_lead bigint; v_corretor bigint; v_antes int; v_cfg bigint;
        v_saida text; v_sol uuid; v_prop uuid; v_venda jsonb;
BEGIN
  PERFORM ncrm_private.assert_idem(p_idem);
  IF v_uid IS NULL THEN RETURN jsonb_build_object('ok',false,'erro','nao_autenticado'); END IF;
  SELECT n.lead_id, n.corretor_id INTO v_lead, v_corretor FROM public.negocios n WHERE n.id = p_negocio_id;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok',false,'erro','negocio_inexistente'); END IF;
  IF ncrm_private.pode_operar_negocio(p_negocio_id) IS NOT TRUE THEN RETURN jsonb_build_object('ok',false,'erro','sem_permissao'); END IF;  -- fail-closed
  IF p_produto_id IS NULL THEN RETURN jsonb_build_object('ok',false,'erro','produto_obrigatorio'); END IF;
  IF p_valor IS NULL OR p_valor <= 0 THEN RETURN jsonb_build_object('ok',false,'erro','valor_invalido'); END IF;
  IF EXISTS (SELECT 1 FROM public.ncrm_evento WHERE idempotency_key = p_idem) THEN
    RETURN jsonb_build_object('ok',true,'ja_processado',true); END IF;

  SELECT versao, workflow_config_id, saida INTO v_antes, v_cfg, v_saida FROM public.ncrm_estado WHERE negocio_id = p_negocio_id FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok',false,'erro','estado_inexistente'); END IF;
  IF p_versao <> v_antes THEN RETURN jsonb_build_object('ok',false,'erro','versao_conflito'); END IF;
  IF v_saida IS NOT NULL THEN RETURN jsonb_build_object('ok',false,'erro','ja_em_saida'); END IF;

  -- 1) reutiliza solicitação PENDENTE existente; senão cria via a RPC oficial da Esteira.
  SELECT id INTO v_sol FROM public.venda_solicitacoes WHERE negocio_id = p_negocio_id AND status = 'pendente' ORDER BY criado_em DESC LIMIT 1;
  IF v_sol IS NULL THEN
    v_venda := public.solicitar_venda(p_negocio_id, p_produto_id, p_valor, p_forma, p_obs);  -- só insere venda_solicitacoes
    IF COALESCE((v_venda->>'ok')::boolean, false) IS TRUE AND (v_venda->>'id') IS NOT NULL THEN
      v_sol := (v_venda->>'id')::uuid;
    ELSE
      SELECT id INTO v_sol FROM public.venda_solicitacoes WHERE negocio_id = p_negocio_id AND status = 'pendente' ORDER BY criado_em DESC LIMIT 1;
    END IF;
    IF v_sol IS NULL THEN
      RAISE EXCEPTION 'falha_ao_criar_solicitacao_esteira: %', COALESCE(v_venda->>'erro', 'desconhecido');  -- rollback integral
    END IF;
  END IF;

  -- 2) cria/vincula ncrm_proposta -> solicitação real
  SELECT id INTO v_prop FROM public.ncrm_proposta WHERE negocio_id = p_negocio_id AND status IN ('registrada','em_negociacao','aceita');
  IF v_prop IS NULL THEN
    INSERT INTO public.ncrm_proposta (negocio_id, lead_id, corretor_id, valor, data_proposta, status, observacao, idempotency_key, criada_por, venda_solicitacao_id)
    VALUES (p_negocio_id, v_lead, v_corretor, p_valor, now(), 'registrada', p_obs, p_idem || ':prop', v_uid, v_sol)
    RETURNING id INTO v_prop;
  ELSE
    UPDATE public.ncrm_proposta SET venda_solicitacao_id = COALESCE(venda_solicitacao_id, v_sol), atualizada_em = now() WHERE id = v_prop;
  END IF;

  -- 3) encaminha o estado + evento (mesma transação)
  UPDATE public.ncrm_estado SET saida='esteira_vendas', saida_em=now(), proposta_id=v_prop,
     proxima_acao_tipo=NULL, proxima_acao_titulo=NULL, proxima_acao_em=NULL, resposta_pendente=false,
     versao=v_antes+1, atualizado_em=now(), atualizado_por=v_uid, origem_ultima='usuario', ultima_decisao_humana_em=now()
  WHERE negocio_id=p_negocio_id AND versao=v_antes;
  INSERT INTO public.ncrm_evento (negocio_id, lead_id, corretor_id_no_evento, workflow_config_id, tipo, payload, origem, executado_por, idempotency_key, estado_versao_antes, estado_versao_apos)
  VALUES (p_negocio_id, v_lead, v_corretor, v_cfg, 'proposta_registrada',
     jsonb_build_object('proposta_id', v_prop, 'valor', p_valor, 'venda_solicitacao_id', v_sol), 'usuario', v_uid, p_idem, v_antes, v_antes+1);
  RETURN jsonb_build_object('ok',true,'versao', v_antes+1, 'proposta_id', v_prop, 'venda_solicitacao_id', v_sol);
EXCEPTION WHEN unique_violation THEN
  IF EXISTS (SELECT 1 FROM public.ncrm_evento WHERE idempotency_key = p_idem) THEN
    RETURN jsonb_build_object('ok',true,'ja_processado',true);
  ELSE RAISE; END IF;
END $fn$;
REVOKE ALL ON FUNCTION public.ncrm_registrar_proposta_esteira(bigint,int,uuid,numeric,text,text,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ncrm_registrar_proposta_esteira(bigint,int,uuid,numeric,text,text,text) TO authenticated;
