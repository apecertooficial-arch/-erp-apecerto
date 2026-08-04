-- SLA de primeira abordagem passa a respeitar a PROTECAO DO DONO DO LEAD.
--
-- DEFEITO: public.motor_roleta protege o dono quando existe venda em processo,
-- visita agendada/confirmada ou visita realizada. ncrm_private.sla_redistribuir
-- nao olhava nada disso: bastava etapa='novo', zero tentativas, sem resposta e
-- prazo estourado para transferir o lead a outro corretor.
--
-- Efeito real observado em 04/08/2026 17:05: o negocio 18013 (cliente com visita
-- AGENDADA com a Tica em 31/07) foi transferido para a Edrisia pelo SLA, dois
-- minutos depois de o motor_roleta ter recusado a redistribuicao do mesmo lead
-- justamente por estar protegido. Duas regras de posse divergentes no mesmo
-- sistema, e a mais fraca ganhava por rodar de cron.
--
-- Um lead com visita marcada nao pode trocar de dono por falta de "primeira
-- abordagem": a abordagem ja aconteceu, o relacionamento existe, e quem marcou
-- a visita e quem tem que atender. Comissao depende disso.
--
-- Correcao: mesmo criterio de protecao do motor_roleta, aplicado no WHERE.
-- Lead protegido simplesmente nao entra na fila de redistribuicao.
--
-- A transferencia indevida do negocio 18013 foi revertida manualmente em
-- 04/08/2026, com evento auditavel de idempotency_key
-- 'fix:reversao_sla_protegido:18013'. Foi a unica ocorrencia no historico.

BEGIN;

CREATE OR REPLACE FUNCTION ncrm_private.sla_redistribuir(p_limite integer DEFAULT 20)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE v int := 0; cfg record; v_vigente bigint; r record; v_novo bigint; v_nome text; v_idem text; v_transf int;
BEGIN
  SELECT * INTO cfg FROM public.ncrm_sla_redistribuicao_config WHERE id = true;
  IF cfg IS NULL OR cfg.ativo IS NOT TRUE THEN RETURN 0; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.ncrm_operacao_config op WHERE op.id=true
    AND (now() AT TIME ZONE op.timezone)::time >= op.horario_oficial_inicio
    AND (now() AT TIME ZONE op.timezone)::time < op.horario_oficial_fim) THEN
    RETURN 0; /* NCRM31_SLA_SOMENTE_OFICIAL */
  END IF;

  SELECT id INTO v_vigente FROM public.ncrm_workflow_config WHERE status = 'publicada' ORDER BY versao DESC LIMIT 1;
  IF v_vigente IS NOT NULL AND ncrm_private.clamp_janela(now(), v_vigente) > now() + interval '1 minute' THEN
    RETURN 0;
  END IF;

  FOR r IN
    SELECT e.negocio_id, e.versao, e.workflow_config_id, n.lead_id, n.corretor_id AS corretor_antigo
      FROM public.ncrm_estado e
      JOIN public.negocios n ON n.id = e.negocio_id
     WHERE e.saida IS NULL AND e.etapa = 'novo'
       AND NOT EXISTS (SELECT 1 FROM public.ncrm_leads_guardados g WHERE g.negocio_id = e.negocio_id)
       AND e.tentativas_feitas = 0 AND e.respondeu = false
       AND e.proxima_acao_em IS NOT NULL
       AND e.proxima_acao_em < now() - make_interval(mins => cfg.tolerancia_min)
       AND ncrm_private.clamp_janela(now(), e.workflow_config_id) <= now() + interval '1 minute'
       /* PROTECAO DO DONO DO LEAD — mesmo criterio de public.motor_roleta. */
       AND NOT EXISTS (
         SELECT 1 FROM public.negocios n2
          WHERE n2.lead_id = n.lead_id
            AND (n2.venda_id IS NOT NULL OR lower(coalesce(n2.status,'')) = 'ganho'))
       AND NOT EXISTS (
         SELECT 1 FROM public.visitas vi
          WHERE (vi.lead_id = n.lead_id
                 OR vi.negocio_id IN (SELECT id FROM public.negocios WHERE lead_id = n.lead_id))
            AND vi.status IN ('agendada','confirmada','realizada'))
     ORDER BY e.proxima_acao_em
     LIMIT GREATEST(1, LEAST(COALESCE(p_limite, 20), 100))
  LOOP
    SELECT count(*) INTO v_transf FROM public.ncrm_evento ev
     WHERE ev.negocio_id = r.negocio_id AND ev.tipo = 'transferencia'
       AND ev.payload->>'motivo' = 'sla_primeira_abordagem_estourado';

    IF v_transf >= 3 THEN
      v_idem := 'auto:sla_escalado:' || r.negocio_id;
      IF NOT EXISTS (SELECT 1 FROM public.ncrm_evento WHERE idempotency_key = v_idem) THEN
        INSERT INTO public.ncrm_evento (negocio_id, lead_id, corretor_id_no_evento, workflow_config_id,
          tipo, payload, origem, idempotency_key, estado_versao_antes, estado_versao_apos)
        VALUES (r.negocio_id, r.lead_id, r.corretor_antigo, r.workflow_config_id,
          'alerta_gestor',
          jsonb_build_object('motivo','sla_redistribuicao_esgotada','transferencias', v_transf),
          'automacao', v_idem, NULL, NULL);
        INSERT INTO public.motor_execucoes (automacao_id, automacao_nome, bloco_id, evento, status, detalhe)
        VALUES (NULL, 'SLA primeira abordagem', 'SLA', 'escalada', 'alerta',
                'Negócio ' || r.negocio_id || ' já foi transferido ' || v_transf || 'x sem abordagem — parou de girar; precisa de decisão do gestor (abordar ou descartar).');
      END IF;
      CONTINUE;
    END IF;

    CONTINUE WHEN EXISTS (
      SELECT 1 FROM public.ncrm_evento ev
       WHERE ev.negocio_id = r.negocio_id AND ev.tipo = 'transferencia'
         AND ev.payload->>'motivo' = 'sla_primeira_abordagem_estourado'
         AND ev.criado_em > now() - interval '24 hours');

    SELECT c.id, c.nome INTO v_novo, v_nome
      FROM public.corretores c
     WHERE COALESCE(c.ativo, true) = true
       AND public.corretor_pode_receber(c.id)
       AND c.id IS DISTINCT FROM r.corretor_antigo
     ORDER BY
       (EXISTS (SELECT 1 FROM public.instancias i WHERE i.corretor_id = c.id
                  AND COALESCE(i.conectada,false) = true AND i.status_dapi = 'connected')) DESC,
       (SELECT count(*) FROM public.leads l2 WHERE l2.corretor_id = c.id
          AND l2.criado_em > now() - interval '24 hours') ASC,
       random()
     LIMIT 1;
    CONTINUE WHEN v_novo IS NULL;

    v_idem := 'auto:sla_redistribui:' || r.negocio_id || ':' || r.versao;
    CONTINUE WHEN EXISTS (SELECT 1 FROM public.ncrm_evento WHERE idempotency_key = v_idem);

    UPDATE public.negocios SET corretor_id = v_novo WHERE id = r.negocio_id;
    UPDATE public.leads SET corretor_id = v_novo WHERE id = r.lead_id;
    UPDATE public.ncrm_estado SET
      proxima_acao_em = ncrm_private.clamp_janela(now() + interval '5 minutes', workflow_config_id),
      proxima_acao_motivo = 'redistribuído: primeira abordagem não aconteceu no prazo',
      proxima_acao_origem = 'sistema',
      versao = versao + 1, atualizado_em = now(), origem_ultima = 'automacao'
    WHERE negocio_id = r.negocio_id AND versao = r.versao;
    CONTINUE WHEN NOT FOUND;

    INSERT INTO public.ncrm_evento (negocio_id, lead_id, corretor_id_no_evento, workflow_config_id,
      tipo, payload, origem, idempotency_key, estado_versao_antes, estado_versao_apos)
    VALUES (r.negocio_id, r.lead_id, v_novo, r.workflow_config_id,
      'transferencia',
      jsonb_build_object('motivo','sla_primeira_abordagem_estourado',
                         'corretor_anterior', r.corretor_antigo, 'corretor_novo', v_novo,
                         'tolerancia_min', cfg.tolerancia_min),
      'automacao', v_idem, r.versao, r.versao + 1);

    INSERT INTO public.motor_execucoes (automacao_id, automacao_nome, bloco_id, evento, status, detalhe)
    VALUES (NULL, 'SLA primeira abordagem', 'SLA', 'redistribuicao', 'alerta',
            'Lead do negócio ' || r.negocio_id || ' sem abordagem no prazo — transferido para ' || COALESCE(v_nome, '?'));
    v := v + 1;
  END LOOP;
  RETURN v;
END $function$;

COMMIT;
