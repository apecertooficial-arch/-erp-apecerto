-- Retorna temporariamente à identificação por chave da migration anterior.
BEGIN;

CREATE OR REPLACE FUNCTION public.f2_listar_aquario()
RETURNS TABLE(negocio_id bigint,nome text,corretor_nome text,momento text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO '' AS $fn$
  SELECT n.id,l.nome,NULL::text,NULL::text
  FROM public.negocios n
  JOIN public.leads l ON l.id=n.lead_id
  JOIN public.pipeline_stages s ON s.id=n.stage_id
  WHERE public.f2_admin()
    AND s.chave='operacao_aquario'
    AND s.visivel_operacao
    AND n.status='aberto'
    AND n.corretor_id IS NULL
    AND l.corretor_id IS NULL
    AND NOT EXISTS(SELECT 1 FROM public.f2_lead f WHERE f.origem_negocio_id=n.id)
  ORDER BY n.criado_em,n.id
  LIMIT 20;
$fn$;

CREATE OR REPLACE FUNCTION public.f2_pescar_negocio(
  p_negocio_id bigint,
  p_substituir_id uuid DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $fn$
DECLARE
  v_uid uuid := (SELECT auth.uid());
  v_novo uuid;
  v_substituido uuid;
  v_corte timestamptz := clock_timestamp();
BEGIN
  IF v_uid IS NULL OR public.f2_admin() IS NOT TRUE THEN
    RETURN jsonb_build_object('ok',false,'erro','sem_permissao');
  END IF;
  IF p_negocio_id IS NULL OR p_negocio_id<=0 THEN
    RETURN jsonb_build_object('ok',false,'erro','negocio_invalido');
  END IF;
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext('f2_pescar_negocio'));
  IF NOT EXISTS(
    SELECT 1 FROM public.negocios n
    JOIN public.leads l ON l.id=n.lead_id
    JOIN public.pipeline_stages s ON s.id=n.stage_id
    WHERE n.id=p_negocio_id AND s.chave='operacao_aquario'
      AND s.visivel_operacao AND n.status='aberto'
      AND n.corretor_id IS NULL AND l.corretor_id IS NULL
  ) THEN
    RETURN jsonb_build_object('ok',false,'erro','lead_nao_disponivel_no_aquario');
  END IF;
  IF EXISTS(SELECT 1 FROM public.f2_lead WHERE origem_negocio_id=p_negocio_id) THEN
    RETURN jsonb_build_object('ok',false,'erro','ja_esta_no_funil');
  END IF;
  IF (SELECT count(*) FROM public.f2_lead)>=2 THEN
    SELECT id INTO v_substituido FROM public.f2_lead ORDER BY criado_em,id LIMIT 1;
    DELETE FROM public.f2_lead WHERE id=v_substituido;
  END IF;
  INSERT INTO public.f2_lead(
    origem_negocio_id,nome,telefone,corretor_id,corretor_nome,
    etapa,momento_codigo,acao_codigo,acao_rotulo,proxima_acao_em,
    cadencia_passo,ultima_interacao_em,ultima_acao_confirmada_em,
    ultima_acao_fonte,ultima_reavaliacao_sara_em,
    ultima_reavaliacao_resumo,corte_conversa_em,atualizado_por
  )
  SELECT n.id,l.nome,l.telefone,NULL,NULL,
    'novo','PRIMEIRA_ABORDAGEM','PRIMEIRA_ABORDAGEM',
    'Fazer a primeira abordagem',v_corte+interval '5 minutes',
    0,NULL,NULL,NULL,NULL,NULL,v_corte,v_uid
  FROM public.negocios n JOIN public.leads l ON l.id=n.lead_id
  WHERE n.id=p_negocio_id RETURNING id INTO v_novo;
  INSERT INTO public.f2_evento(funil_lead_id,tipo,titulo,detalhe,payload,criado_por)
  VALUES(v_novo,'momento_alterado','Lead pescado do Aquário',
    'Entrou como Novo, sem histórico anterior e com primeira abordagem em cinco minutos.',
    jsonb_build_object('etapa','novo','momento','PRIMEIRA_ABORDAGEM','corte_conversa_em',v_corte),v_uid);
  INSERT INTO public.f2_config_audit(tipo,chave,acao,depois,criado_por)
  VALUES('pesca',p_negocio_id::text,'pescar_lead_aquario_real',
    jsonb_build_object('novo_id',v_novo,'copia_anterior_removida',v_substituido),v_uid);
  RETURN jsonb_build_object('ok',true,'id',v_novo,'etapa','novo','momento','PRIMEIRA_ABORDAGEM');
END;
$fn$;

REVOKE ALL ON FUNCTION public.f2_listar_aquario() FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.f2_pescar_negocio(bigint,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.f2_listar_aquario() TO authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.f2_pescar_negocio(bigint,uuid) TO authenticated,service_role;

COMMIT;
