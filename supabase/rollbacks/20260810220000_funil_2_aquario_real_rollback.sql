-- Reverte apenas a seleção/entrada do Aquário para as definições anteriores.
BEGIN;

CREATE OR REPLACE FUNCTION public.f2_listar_aquario()
RETURNS TABLE(negocio_id bigint,nome text,corretor_nome text,momento text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO '' AS $fn$
  SELECT n.id,l.nome,c.nome,e.momento_codigo
  FROM public.ncrm_estado e
  JOIN public.negocios n ON n.id=e.negocio_id
  JOIN public.leads l ON l.id=n.lead_id
  LEFT JOIN public.corretores c ON c.id=n.corretor_id
  WHERE public.f2_admin()
    AND NOT EXISTS(SELECT 1 FROM public.f2_lead f WHERE f.origem_negocio_id=n.id)
  ORDER BY e.ultima_interacao_em DESC NULLS LAST,n.id DESC LIMIT 20;
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
BEGIN
  IF v_uid IS NULL OR public.f2_admin() IS NOT TRUE THEN
    RETURN jsonb_build_object('ok',false,'erro','sem_permissao');
  END IF;
  IF p_negocio_id IS NULL OR p_negocio_id<=0 THEN
    RETURN jsonb_build_object('ok',false,'erro','negocio_invalido');
  END IF;
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext('f2_pescar_negocio'));
  IF EXISTS(SELECT 1 FROM public.f2_lead WHERE origem_negocio_id=p_negocio_id) THEN
    RETURN jsonb_build_object('ok',false,'erro','ja_esta_no_funil');
  END IF;
  IF (SELECT count(*) FROM public.f2_lead)>=2 THEN
    SELECT id INTO v_substituido FROM public.f2_lead ORDER BY criado_em,id LIMIT 1;
    DELETE FROM public.f2_lead WHERE id=v_substituido;
  END IF;
  v_novo:=public.f2_importar_negocio(p_negocio_id);
  UPDATE public.f2_lead SET
    etapa='novo',momento_codigo='PRIMEIRA_ABORDAGEM',
    acao_codigo='PRIMEIRA_ABORDAGEM',acao_rotulo='Fazer a primeira abordagem',
    proxima_acao_em=now()+interval '5 minutes',cadencia_passo=0,
    ultima_acao_confirmada_em=NULL,ultima_acao_fonte=NULL,
    ultima_reavaliacao_sara_em=NULL,ultima_reavaliacao_resumo=NULL,
    versao=versao+1,atualizado_em=now(),atualizado_por=v_uid
  WHERE id=v_novo;
  INSERT INTO public.f2_evento(funil_lead_id,tipo,titulo,detalhe,payload,criado_por)
  VALUES(v_novo,'momento_alterado','Lead pescado: primeira abordagem',
    'Entrou em Novo com prazo de cinco minutos.',
    jsonb_build_object('etapa','novo','momento','PRIMEIRA_ABORDAGEM'),v_uid);
  INSERT INTO public.f2_config_audit(tipo,chave,acao,depois,criado_por)
  VALUES('pesca',p_negocio_id::text,'pescar_lead',
    jsonb_build_object('novo_id',v_novo,'copia_anterior_removida',v_substituido),v_uid);
  RETURN jsonb_build_object('ok',true,'id',v_novo,'etapa','novo','momento','PRIMEIRA_ABORDAGEM');
END;
$fn$;

REVOKE ALL ON FUNCTION public.f2_listar_aquario() FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.f2_pescar_negocio(bigint,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.f2_listar_aquario() TO authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.f2_pescar_negocio(bigint,uuid) TO authenticated,service_role;

COMMIT;
