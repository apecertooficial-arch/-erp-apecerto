-- Rollback: volta a pesca ao contrato anterior (só admin, card sem dono).
--
-- Restaura exatamente as definições vigentes antes de 20260813020000.
-- ATENÇÃO: ao voltar, o card volta a nascer com corretor_id NULL e o trigger
-- f2_lead_notificar_primeira_abordagem volta a ignorá-lo — ou seja, a pesca
-- volta a não notificar ninguém. É o comportamento antigo, não um defeito novo.

BEGIN;

CREATE OR REPLACE FUNCTION public.f2_listar_aquario()
RETURNS TABLE(negocio_id bigint, nome text, corretor_nome text, momento text)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO ''
AS $fn$
  SELECT n.id,l.nome,NULL::text,NULL::text
  FROM public.negocios n
  JOIN public.leads l ON l.id=n.lead_id
  WHERE public.f2_admin()
    AND n.stage_id=public.aquario_stage_id()
    AND n.status='aberto'
    AND n.corretor_id IS NULL
    AND l.corretor_id IS NULL
    AND NOT EXISTS(
      SELECT 1 FROM public.f2_lead f WHERE f.origem_negocio_id=n.id
    )
  ORDER BY n.criado_em,n.id
  LIMIT 20;
$fn$;

CREATE OR REPLACE FUNCTION public.f2_pescar_negocio(p_negocio_id bigint, p_substituir_id uuid DEFAULT NULL::uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $fn$
DECLARE
  v_uid uuid := (SELECT auth.uid());
  v_novo uuid;
  v_corte timestamptz := clock_timestamp();
BEGIN
  IF v_uid IS NULL OR public.f2_admin() IS NOT TRUE THEN
    RETURN jsonb_build_object('ok',false,'erro','sem_permissao');
  END IF;
  IF p_substituir_id IS NOT NULL THEN
    RETURN jsonb_build_object('ok',false,'erro','substituicao_desativada');
  END IF;
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext('f2_pescar_negocio'));
  IF NOT EXISTS(
    SELECT 1 FROM public.negocios n JOIN public.leads l ON l.id=n.lead_id
    WHERE n.id=p_negocio_id AND n.stage_id=public.aquario_stage_id()
      AND n.status='aberto' AND n.corretor_id IS NULL AND l.corretor_id IS NULL
  ) THEN
    RETURN jsonb_build_object('ok',false,'erro','lead_nao_disponivel_no_aquario');
  END IF;
  IF EXISTS(SELECT 1 FROM public.f2_lead WHERE origem_negocio_id=p_negocio_id) THEN
    RETURN jsonb_build_object('ok',false,'erro','ja_esta_no_funil');
  END IF;

  INSERT INTO public.f2_lead(
    origem_negocio_id,nome,telefone,corretor_id,corretor_nome,
    etapa,momento_codigo,acao_codigo,acao_rotulo,proxima_acao_em,
    cadencia_passo,ultima_reavaliacao_resumo,corte_conversa_em,atualizado_por
  )
  SELECT n.id,l.nome,l.telefone,NULL,NULL,
    'novo','PRIMEIRA_ABORDAGEM','PRIMEIRA_ABORDAGEM','Fazer a primeira abordagem',
    v_corte+interval '5 minutes',0,
    'Lead pescado; aguarda a primeira leitura da Sara.',v_corte,v_uid
  FROM public.negocios n JOIN public.leads l ON l.id=n.lead_id
  WHERE n.id=p_negocio_id
  RETURNING id INTO v_novo;

  INSERT INTO public.f2_evento(funil_lead_id,tipo,titulo,detalhe,payload,criado_por)
  VALUES(v_novo,'momento_alterado','Lead pescado do Aquário',
    'Entrou como Novo, sem histórico anterior e com primeira abordagem em cinco minutos.',
    jsonb_build_object('etapa','novo','momento','PRIMEIRA_ABORDAGEM','corte_conversa_em',v_corte),v_uid);
  INSERT INTO public.f2_config_audit(tipo,chave,acao,depois,criado_por)
  VALUES('pesca',p_negocio_id::text,'pescar_lead_aquario',
    jsonb_build_object('novo_id',v_novo,'substituiu',false),v_uid);
  RETURN jsonb_build_object('ok',true,'id',v_novo,'etapa','novo','momento','PRIMEIRA_ABORDAGEM');
END;
$fn$;

COMMIT;
