-- =====================================================================
-- CRM Nova Era — registrar o resultado da visita e devolver o cliente ao funil
-- ---------------------------------------------------------------------
-- Regra comercial: depois da visita, NINGUÉM fica parado. Cada um dos sete
-- resultados leva a algum lugar, e todo lugar que mantém o cliente vivo exige
-- próxima ação COM DATA.
--
-- Dois pontos onde esta função é mais conservadora que o desenho, de propósito:
--
--  * "nao_gostou" NÃO descarta sozinho. Descarte exige motivo estruturado, e
--    motivo é decisão humana. A função devolve o lead ao funil com a ação
--    "avaliar_descarte" — o corretor escolhe o motivo em seguida. Descartar
--    automaticamente inventaria um motivo que ninguém disse.
--
--  * "fara_proposta" NÃO cria proposta. Proposta tem produto e valor, que a
--    visita não conhece. A função marca "preparar_proposta" com prazo de 24h;
--    quem cria a solicitação na Esteira continua sendo ncrm_registrar_proposta_esteira.
--
-- Prazos: não compareceu tem 4h (é o que esfria mais rápido); interessado,
-- quer outra opção, remarcar e fará proposta têm 24h; precisa conversar tem 72h.
-- =====================================================================

BEGIN;

CREATE OR REPLACE FUNCTION public.ncrm_registrar_resultado_visita(
  p_visita_id uuid, p_negocio_id bigint, p_versao int, p_resultado text, p_obs text, p_idem text)
  RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $fn$
DECLARE
  v_uid uuid := auth.uid();
  v_lead bigint; v_corretor bigint; v_antes int; v_cfg bigint; v_saida text;
  v_tipo text; v_titulo text; v_horas int; v_nova_saida text; v_etapa text;
BEGIN
  PERFORM ncrm_private.assert_idem(p_idem);
  IF v_uid IS NULL THEN RETURN jsonb_build_object('ok',false,'erro','nao_autenticado'); END IF;

  IF p_resultado NOT IN ('interessado','quer_outra_opcao','precisa_conversar','nao_gostou',
                         'nao_compareceu','remarcar','fara_proposta') THEN
    RETURN jsonb_build_object('ok',false,'erro','resultado_invalido'); END IF;

  SELECT n.lead_id, n.corretor_id INTO v_lead, v_corretor FROM public.negocios n WHERE n.id = p_negocio_id;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok',false,'erro','negocio_inexistente'); END IF;
  IF ncrm_private.pode_operar_negocio(p_negocio_id) IS NOT TRUE THEN
    RETURN jsonb_build_object('ok',false,'erro','sem_permissao'); END IF;

  -- A visita precisa existir e pertencer a este negócio. Sem isso, um id solto
  -- carimbaria resultado em visita de outro corretor.
  IF NOT EXISTS (SELECT 1 FROM public.visitas v WHERE v.id = p_visita_id AND v.negocio_id = p_negocio_id) THEN
    RETURN jsonb_build_object('ok',false,'erro','visita_invalida'); END IF;

  IF EXISTS (SELECT 1 FROM public.ncrm_evento WHERE idempotency_key = p_idem) THEN
    RETURN jsonb_build_object('ok',true,'ja_processado',true); END IF;

  SELECT versao, workflow_config_id, saida INTO v_antes, v_cfg, v_saida
    FROM public.ncrm_estado WHERE negocio_id = p_negocio_id FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok',false,'erro','estado_inexistente'); END IF;
  IF p_versao <> v_antes THEN RETURN jsonb_build_object('ok',false,'erro','versao_conflito'); END IF;

  -- Destino, próxima ação e prazo por resultado.
  CASE p_resultado
    WHEN 'fara_proposta'    THEN v_tipo:='preparar_proposta';  v_titulo:='Preparar a proposta';                 v_horas:=24;  v_nova_saida:=NULL;
    WHEN 'interessado'      THEN v_tipo:='ligar_retorno';      v_titulo:='Retornar enquanto está quente';       v_horas:=24;  v_nova_saida:=NULL;
    WHEN 'quer_outra_opcao' THEN v_tipo:='enviar_opcoes';      v_titulo:='Enviar as novas opções';              v_horas:=24;  v_nova_saida:=NULL;
    WHEN 'precisa_conversar'THEN v_tipo:='retornar_contato';   v_titulo:='Retornar após a conversa do cliente'; v_horas:=72;  v_nova_saida:=NULL;
    WHEN 'nao_compareceu'   THEN v_tipo:='ligar_retorno';      v_titulo:='Entender o que houve';                v_horas:=4;   v_nova_saida:=NULL;
    -- Remarcar continua no Pipe: só sai quando a nova visita existir de verdade.
    WHEN 'remarcar'         THEN v_tipo:='agendar_visita';     v_titulo:='Remarcar a visita';                   v_horas:=24;  v_nova_saida:='pipeline_visitas';
    -- Não gostou volta ao funil para o humano escolher o motivo do descarte.
    WHEN 'nao_gostou'       THEN v_tipo:='avaliar_descarte';   v_titulo:='Avaliar descarte com motivo';         v_horas:=24;  v_nova_saida:=NULL;
  END CASE;

  v_etapa := CASE WHEN v_nova_saida IS NULL THEN 'em_acompanhamento' ELSE NULL END;

  UPDATE public.visitas
     SET resultado = p_resultado, resultado_em = now(), resultado_por = v_uid,
         status = CASE WHEN p_resultado = 'nao_compareceu' THEN 'nao_compareceu' ELSE 'realizada' END
   WHERE id = p_visita_id;

  UPDATE public.ncrm_estado
     SET saida = v_nova_saida,
         saida_em = CASE WHEN v_nova_saida IS NULL THEN NULL ELSE now() END,
         etapa = COALESCE(v_etapa, etapa),
         respondeu = true,               -- quem foi à visita respondeu; cadência não volta
         resposta_pendente = false,
         proxima_acao_tipo = v_tipo,
         proxima_acao_titulo = v_titulo,
         proxima_acao_em = now() + (v_horas || ' hours')::interval,
         proxima_acao_motivo = 'resultado da visita: ' || p_resultado,
         proxima_acao_origem = 'visita',
         ultima_interacao_em = now(),
         versao = v_antes + 1, atualizado_em = now(), atualizado_por = v_uid,
         origem_ultima = 'usuario', ultima_decisao_humana_em = now()
   WHERE negocio_id = p_negocio_id AND versao = v_antes;

  INSERT INTO public.ncrm_evento (negocio_id, lead_id, corretor_id_no_evento, workflow_config_id, tipo,
                                  resultado, payload, origem, executado_por, idempotency_key,
                                  estado_versao_antes, estado_versao_apos)
  VALUES (p_negocio_id, v_lead, v_corretor, v_cfg, 'acao_comercial', p_resultado,
          jsonb_build_object('visita_id', p_visita_id, 'obs', p_obs, 'origem', 'resultado_visita'),
          'usuario', v_uid, p_idem, v_antes, v_antes + 1);

  RETURN jsonb_build_object('ok', true, 'versao', v_antes + 1,
                            'etapa', COALESCE(v_etapa, 'pipeline_visitas'),
                            'proxima_acao', v_titulo);
EXCEPTION WHEN unique_violation THEN
  IF EXISTS (SELECT 1 FROM public.ncrm_evento WHERE idempotency_key = p_idem) THEN
    RETURN jsonb_build_object('ok',true,'ja_processado',true);
  ELSE RAISE; END IF;
END $fn$;

REVOKE ALL ON FUNCTION public.ncrm_registrar_resultado_visita(uuid,bigint,int,text,text,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ncrm_registrar_resultado_visita(uuid,bigint,int,text,text,text) TO authenticated;

-- Visitas que já passaram e continuam sem desfecho. A cobrança começa às 9h
-- da manhã seguinte: cobrar logo depois do horário marcado pegaria o corretor
-- ainda sentado com o cliente.
CREATE OR REPLACE FUNCTION public.ncrm_visitas_sem_resultado(p_limite int DEFAULT 100)
  RETURNS TABLE (visita_id uuid, negocio_id bigint, cliente_nome text, data date, hora_inicio time, cobrar_desde timestamptz)
  LANGUAGE sql STABLE SECURITY INVOKER SET search_path = '' AS $fn$
  SELECT v.id, v.negocio_id, v.cliente_nome, v.data, v.hora_inicio,
         ((v.data + 1)::timestamp + time '09:00') AT TIME ZONE 'America/Sao_Paulo'
    FROM public.visitas v
   WHERE v.resultado IS NULL
     AND v.status NOT IN ('cancelada')
     AND ((v.data + 1)::timestamp + time '09:00') AT TIME ZONE 'America/Sao_Paulo' <= now()
   ORDER BY v.data ASC
   LIMIT greatest(1, least(coalesce(p_limite, 100), 500));
$fn$;

COMMIT;
