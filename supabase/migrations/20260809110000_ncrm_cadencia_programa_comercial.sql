-- =====================================================================
-- CRM Nova Era — PROGRAMA COMERCIAL DA CADÊNCIA (decisões de 31/07)
-- ---------------------------------------------------------------------
-- 1. Workflow v2 publicado: 6 tentativas (5min, +2h, D+1 útil, D+3, D+5,
--    D+7), janela 09:00–19:00, SEG–SEX. Negócios existentes seguem a v1
--    (regra não muda no meio do jogo); os novos entram na v2.
-- 2. clamp_janela passa a respeitar fim de semana quando o workflow diz
--    fds_operacional = false (antes só olhava a hora do dia).
-- 3. Primeira abordagem: prazo de 5 minutos (era 15).
-- 4. Reativação automática: cliente que responde DEPOIS do encerramento
--    'sem_resposta' volta sozinho ao funil com ação urgente.
-- 5. Redistribuição por SLA estourado: lead novo sem abordagem além da
--    tolerância (15min, configurável) vai para outro corretor elegível,
--    pelo MESMO critério do resgate de órfãos. Com kill-switch.
-- =====================================================================
BEGIN;
SET LOCAL check_function_bodies = off;

-- ---------------------------------------------------------------------
-- 2. clamp_janela v2: fim de semana fora quando fds_operacional = false
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION ncrm_private.clamp_janela(p_ts timestamptz, p_config_id bigint)
  RETURNS timestamptz LANGUAGE plpgsql STABLE SET search_path TO '' AS $fn$
DECLARE c public.ncrm_workflow_config%ROWTYPE; v_local timestamp; v_min int; v_ini int; v_fim int; v_guard int := 0;
BEGIN
  SELECT * INTO c FROM public.ncrm_workflow_config WHERE id = p_config_id;
  IF c IS NULL THEN RETURN p_ts; END IF;
  v_local := p_ts AT TIME ZONE c.timezone;
  v_ini := extract(hour FROM c.janela_inicio)::int*60 + extract(minute FROM c.janela_inicio)::int;
  v_fim := extract(hour FROM c.janela_fim)::int*60 + extract(minute FROM c.janela_fim)::int;
  LOOP
    v_guard := v_guard + 1; EXIT WHEN v_guard > 14;
    -- Fim de semana só quando o workflow opera de segunda a sexta.
    IF COALESCE(c.fds_operacional, true) = false AND extract(isodow FROM v_local)::int IN (6, 7) THEN
      v_local := date_trunc('day', v_local) + interval '1 day' + make_interval(mins => v_ini);
      CONTINUE;
    END IF;
    v_min := extract(hour FROM v_local)::int*60 + extract(minute FROM v_local)::int;
    IF v_min > v_fim THEN
      v_local := date_trunc('day', v_local) + interval '1 day' + make_interval(mins => v_ini);
      CONTINUE;                    -- o dia seguinte ainda pode cair no fim de semana
    ELSIF v_min < v_ini THEN
      v_local := date_trunc('day', v_local) + make_interval(mins => v_ini);
      CONTINUE;                    -- reavalia: hoje pode ser sábado
    END IF;
    EXIT;
  END LOOP;
  RETURN v_local AT TIME ZONE c.timezone;
END $fn$;

-- ---------------------------------------------------------------------
-- 1. Workflow v2: o programa comercial
-- ---------------------------------------------------------------------
-- A config é uma máquina de estados: rascunho -> publicada -> encerrada,
-- e os passos só entram em RASCUNHO. Uma publicada por vez (unique parcial).
DO $$
DECLARE v_id bigint;
BEGIN
  IF EXISTS (SELECT 1 FROM public.ncrm_workflow_config WHERE versao = 2) THEN RETURN; END IF;

  -- 1. Nasce em rascunho.
  INSERT INTO public.ncrm_workflow_config
    (status, versao, timezone, janela_inicio, janela_fim, max_tentativas, fds_operacional,
     espera_apos_automacao_min, vigencia_inicio)
  VALUES ('rascunho', 2, 'America/Sao_Paulo', '09:00', '19:00', 6, false, 120, now())
  RETURNING id INTO v_id;

  -- 2. Os 6 passos do programa.
  INSERT INTO public.ncrm_workflow_passo (config_id, ordem, rotulo, canal_sugerido, intervalo_min) VALUES
    (v_id, 1, 'Primeira abordagem — apresentar-se e entender o interesse', 'whatsapp', 5),
    (v_id, 2, 'Facilitar uma resposta curta',                              'whatsapp', 120),
    (v_id, 3, 'Ligação curta + WhatsApp — mostrar que existe gente aqui',  'ligacao',  1440),
    (v_id, 4, 'Entregar informação ou alternativa útil',                   'whatsapp', 2880),
    (v_id, 5, 'Nova entrega de valor',                                     'whatsapp', 2880),
    (v_id, 6, 'Encerramento elegante, canal aberto',                       'whatsapp', 2880);

  -- 3. Encerra a publicada anterior e publica a v2.
  UPDATE public.ncrm_workflow_config SET status = 'encerrada', vigencia_fim = now()
   WHERE status = 'publicada' AND versao < 2;
  UPDATE public.ncrm_workflow_config SET status = 'publicada' WHERE id = v_id;
END $$;

-- ---------------------------------------------------------------------
-- 3. Primeira abordagem em 5 minutos + espelho na config da Fase 5
-- ---------------------------------------------------------------------
-- Defensivo: no harness local o recorte pode não ter a tabela da entrada.
DO $$
BEGIN
  IF to_regclass('public.ncrm_entrada_config') IS NOT NULL THEN
    UPDATE public.ncrm_entrada_config SET prazo_primeira_abordagem_min = 5, atualizado_em = now() WHERE id;
  END IF;
END $$;
UPDATE public.ncrm_cadencia_config
   SET max_tentativas = 6, intervalos_min = '[5,120,1440,2880,2880,2880]'::jsonb,
       hora_inicio = 9, hora_fim = 19, dias_uteis = ARRAY[1,2,3,4,5], tolerancia_min = 15,
       atualizado_em = now()
 WHERE id = true;

-- ---------------------------------------------------------------------
-- 4. Reativação automática: resposta depois do encerramento reabre o lead
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION ncrm_private.reativar_por_resposta(p_limite int DEFAULT 50)
  RETURNS int LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $fn$
DECLARE v int := 0; r record; v_msg_em timestamptz; v_idem text;
BEGIN
  FOR r IN
    SELECT e.negocio_id, e.versao, e.saida_em, e.workflow_config_id, n.lead_id, n.corretor_id
      FROM public.ncrm_estado e
      JOIN public.negocios n ON n.id = e.negocio_id
     WHERE e.saida = 'descartado' AND e.descarte_motivo = 'sem_resposta'
       AND e.saida_em > now() - interval '90 days'
     LIMIT GREATEST(1, LEAST(COALESCE(p_limite, 50), 200))
  LOOP
    -- Existe mensagem DO CLIENTE depois do encerramento?
    SELECT max(COALESCE(m.enviado_em, m.criado_em)) INTO v_msg_em
      FROM public.wa_contatos ct
      JOIN public.wa_conversas cv ON cv.contato_id = ct.id
      JOIN public.wa_mensagens m ON m.conversa_id = cv.id
     WHERE ct.lead_id = r.lead_id
       AND lower(COALESCE(m.direcao,'')) IN ('recebida','entrada','in','inbound','received')
       AND COALESCE(m.enviado_em, m.criado_em) > r.saida_em;
    CONTINUE WHEN v_msg_em IS NULL;

    v_idem := 'auto:reativa:' || r.negocio_id || ':' || extract(epoch FROM v_msg_em)::bigint;
    CONTINUE WHEN EXISTS (SELECT 1 FROM public.ncrm_evento WHERE idempotency_key = v_idem);

    UPDATE public.ncrm_estado SET
      saida = NULL, saida_em = NULL, descarte_motivo = NULL, descarte_detalhe = NULL,
      etapa = 'em_atendimento', respondeu = true, resposta_pendente = true,
      primeira_resposta_em = COALESCE(primeira_resposta_em, v_msg_em),
      proxima_acao_tipo = 'retornar_contato',
      proxima_acao_titulo = 'Cliente voltou a falar — responder agora',
      proxima_acao_em = ncrm_private.clamp_janela(now(), workflow_config_id),
      proxima_acao_motivo = 'reativação automática: o cliente respondeu depois do encerramento',
      proxima_acao_origem = 'sistema',
      ultima_interacao_em = v_msg_em,
      versao = versao + 1, atualizado_em = now(), origem_ultima = 'automacao'
    WHERE negocio_id = r.negocio_id AND versao = r.versao;
    CONTINUE WHEN NOT FOUND;

    INSERT INTO public.ncrm_evento (negocio_id, lead_id, corretor_id_no_evento, workflow_config_id,
      tipo, payload, origem, idempotency_key, estado_versao_antes, estado_versao_apos)
    VALUES (r.negocio_id, r.lead_id, r.corretor_id, r.workflow_config_id,
      'reativacao', jsonb_build_object('motivo','resposta_apos_encerramento','mensagem_em', v_msg_em),
      'automacao', v_idem, r.versao, r.versao + 1);
    v := v + 1;
  END LOOP;
  RETURN v;
END $fn$;
REVOKE ALL ON FUNCTION ncrm_private.reativar_por_resposta(int) FROM PUBLIC, anon, authenticated;

-- ---------------------------------------------------------------------
-- 5. Redistribuição por SLA estourado (kill-switch + tolerância própria)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.ncrm_sla_redistribuicao_config (
  id boolean PRIMARY KEY DEFAULT true CHECK (id),
  ativo boolean NOT NULL DEFAULT true,
  tolerancia_min int NOT NULL DEFAULT 15 CHECK (tolerancia_min BETWEEN 1 AND 240),
  atualizado_em timestamptz NOT NULL DEFAULT now(),
  atualizado_por uuid
);
INSERT INTO public.ncrm_sla_redistribuicao_config (id) VALUES (true) ON CONFLICT (id) DO NOTHING;
REVOKE ALL ON public.ncrm_sla_redistribuicao_config FROM PUBLIC, anon;
GRANT SELECT ON public.ncrm_sla_redistribuicao_config TO authenticated;

CREATE OR REPLACE FUNCTION ncrm_private.sla_redistribuir(p_limite int DEFAULT 20)
  RETURNS int LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $fn$
DECLARE v int := 0; cfg record; r record; v_novo bigint; v_nome text; v_idem text;
BEGIN
  SELECT * INTO cfg FROM public.ncrm_sla_redistribuicao_config WHERE id = true;
  IF cfg IS NULL OR cfg.ativo IS NOT TRUE THEN RETURN 0; END IF;

  FOR r IN
    SELECT e.negocio_id, e.versao, e.workflow_config_id, n.lead_id, n.corretor_id AS corretor_antigo
      FROM public.ncrm_estado e
      JOIN public.negocios n ON n.id = e.negocio_id
     WHERE e.saida IS NULL AND e.etapa = 'novo'
       AND e.tentativas_feitas = 0 AND e.respondeu = false
       AND e.proxima_acao_em IS NOT NULL
       AND e.proxima_acao_em < now() - make_interval(mins => cfg.tolerancia_min)
       -- só redistribui DENTRO da janela: fora dela ninguém poderia ter agido
       AND ncrm_private.clamp_janela(now(), e.workflow_config_id) <= now() + interval '1 minute'
     ORDER BY e.proxima_acao_em
     LIMIT GREATEST(1, LEAST(COALESCE(p_limite, 20), 100))
  LOOP
    -- MESMO critério do resgate de órfãos: elegível, conectado, menos carga, sorteio.
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

    -- Alerta operacional no mesmo log que o gestor já acompanha.
    INSERT INTO public.motor_execucoes (automacao_id, automacao_nome, bloco_id, evento, status, detalhe)
    VALUES (NULL, 'SLA primeira abordagem', 'SLA', 'redistribuicao', 'alerta',
            'Lead do negócio ' || r.negocio_id || ' sem abordagem no prazo — transferido para ' || COALESCE(v_nome, '?'));
    v := v + 1;
  END LOOP;
  RETURN v;
END $fn$;
REVOKE ALL ON FUNCTION ncrm_private.sla_redistribuir(int) FROM PUBLIC, anon, authenticated;

COMMIT;
