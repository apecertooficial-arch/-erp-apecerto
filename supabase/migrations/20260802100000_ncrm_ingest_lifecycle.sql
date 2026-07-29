-- CRM Nova Era — FASE 6.1: ciclo de vida da fila de entrada de conversas.
-- PROBLEMA REAL: itens que atingiam o teto de tentativas ficavam 'pendente' para sempre,
-- porque a própria consulta da reconciliação os excluía (tentativas < max). A fila crescia
-- sem fim e misturava pendência real, item fora do escopo e falha técnica.
-- CORREÇÃO: todo item termina em um estado final auditável; noop deixa de contaminar erro.
-- ADITIVA/CORRETIVA: só objetos ncrm_*. Não envia WhatsApp, não cria visita/proposta,
-- não altera venda, não move o CRM antigo e não liga a Sara em execute.

-- ------------------------------------------------------------------ configuração
CREATE TABLE public.ncrm_ingest_lifecycle_config (
  id                     boolean PRIMARY KEY DEFAULT true CHECK (id),
  janela_sem_negocio_min int NOT NULL DEFAULT 30  CHECK (janela_sem_negocio_min BETWEEN 1 AND 1440),
  janela_fora_escopo_min int NOT NULL DEFAULT 30  CHECK (janela_fora_escopo_min BETWEEN 1 AND 1440),
  max_tentativas         int NOT NULL DEFAULT 8   CHECK (max_tentativas BETWEEN 1 AND 50),
  backoff_base_seg       int NOT NULL DEFAULT 60  CHECK (backoff_base_seg BETWEEN 5 AND 3600),
  backoff_max_seg        int NOT NULL DEFAULT 1800 CHECK (backoff_max_seg BETWEEN 30 AND 86400),
  atualizado_em          timestamptz NOT NULL DEFAULT now(),
  atualizado_por         uuid NULL
);
INSERT INTO public.ncrm_ingest_lifecycle_config (id) VALUES (true) ON CONFLICT (id) DO NOTHING;
REVOKE ALL ON public.ncrm_ingest_lifecycle_config FROM PUBLIC, anon, authenticated;
ALTER TABLE public.ncrm_ingest_lifecycle_config ENABLE ROW LEVEL SECURITY;

-- ------------------------------------------------------- ciclo de vida do checkpoint
ALTER TABLE public.ncrm_ingest_checkpoint
  ADD COLUMN IF NOT EXISTS proxima_tentativa_em timestamptz,
  ADD COLUMN IF NOT EXISTS motivo_final         text,
  ADD COLUMN IF NOT EXISTS finalizado_em        timestamptz;

-- Dois estados finais novos, explícitos. Nada é apagado: o histórico permanece.
ALTER TABLE public.ncrm_ingest_checkpoint DROP CONSTRAINT IF EXISTS ncrm_ingest_checkpoint_status_check;
ALTER TABLE public.ncrm_ingest_checkpoint ADD CONSTRAINT ncrm_ingest_checkpoint_status_check
  CHECK (status IN ('pendente','processado','noop','erro','noop_fora_do_escopo','noop_sem_negocio_expirado'));
ALTER TABLE public.ncrm_ingest_checkpoint ADD CONSTRAINT ck_ncrm_ingest_final_coerente
  CHECK ((finalizado_em IS NULL) OR (status <> 'pendente'));

-- A fila operacional é só o que ainda exige processamento.
CREATE INDEX IF NOT EXISTS ix_ncrm_ingest_fila_aberta
  ON public.ncrm_ingest_checkpoint (proxima_tentativa_em NULLS FIRST, criado_em)
  WHERE finalizado_em IS NULL AND status IN ('pendente','erro');
CREATE INDEX IF NOT EXISTS ix_ncrm_ingest_status_criado
  ON public.ncrm_ingest_checkpoint (status, criado_em DESC);

-- Retrocompatibilidade: o que já estava concluído antes desta correção ganha marca final.
UPDATE public.ncrm_ingest_checkpoint
   SET finalizado_em = COALESCE(processado_em, atualizado_em, criado_em),
       motivo_final  = COALESCE(motivo_final, CASE WHEN status = 'processado' THEN 'processado' ELSE COALESCE(ultimo_erro,'noop') END)
 WHERE status IN ('processado','noop') AND finalizado_em IS NULL;

-- ------------------------------------------------------------ leitura/escrita da config
CREATE FUNCTION public.ncrm_ingest_lifecycle_get()
  RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $fn$
DECLARE v_uid uuid := auth.uid(); c public.ncrm_ingest_lifecycle_config%ROWTYPE;
BEGIN
  IF v_uid IS NULL THEN RETURN jsonb_build_object('ok',false,'erro','nao_autenticado'); END IF;
  IF COALESCE(public.can_manage_all(), false) IS NOT TRUE THEN RETURN jsonb_build_object('ok',false,'erro','sem_permissao'); END IF;
  SELECT * INTO c FROM public.ncrm_ingest_lifecycle_config WHERE id;
  RETURN jsonb_build_object('ok',true,'config', to_jsonb(c));
END $fn$;
REVOKE ALL ON FUNCTION public.ncrm_ingest_lifecycle_get() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ncrm_ingest_lifecycle_get() TO authenticated;

CREATE FUNCTION public.ncrm_ingest_lifecycle_set(p jsonb)
  RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $fn$
DECLARE v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL THEN RETURN jsonb_build_object('ok',false,'erro','nao_autenticado'); END IF;
  IF COALESCE(public.can_manage_all(), false) IS NOT TRUE THEN RETURN jsonb_build_object('ok',false,'erro','sem_permissao'); END IF;
  UPDATE public.ncrm_ingest_lifecycle_config SET
    janela_sem_negocio_min = COALESCE(NULLIF(p->>'janela_sem_negocio_min','')::int, janela_sem_negocio_min),
    janela_fora_escopo_min = COALESCE(NULLIF(p->>'janela_fora_escopo_min','')::int, janela_fora_escopo_min),
    max_tentativas         = COALESCE(NULLIF(p->>'max_tentativas','')::int, max_tentativas),
    backoff_base_seg       = COALESCE(NULLIF(p->>'backoff_base_seg','')::int, backoff_base_seg),
    backoff_max_seg        = COALESCE(NULLIF(p->>'backoff_max_seg','')::int, backoff_max_seg),
    atualizado_em = now(), atualizado_por = v_uid
  WHERE id;
  RETURN public.ncrm_ingest_lifecycle_get();
END $fn$;
REVOKE ALL ON FUNCTION public.ncrm_ingest_lifecycle_set(jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ncrm_ingest_lifecycle_set(jsonb) TO authenticated;

-- ------------------------------------------------------------------ reconciliação
-- Reescrita para dar FIM a todo item. Diferenças em relação à versão anterior:
--   * respeita proxima_tentativa_em (backoff exponencial com teto);
--   * nunca deixa item preso: ao atingir o teto de tentativas, finaliza com motivo;
--   * separa "fora do escopo" e "sem negócio expirado" de falha técnica;
--   * item finalizado sai da fila operacional, mas continua no histórico.
CREATE OR REPLACE FUNCTION ncrm_private.reconciliar_mensagens(
    p_limite integer DEFAULT 200, p_max_tentativas integer DEFAULT NULL, p_janela_inbound interval DEFAULT NULL)
  RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $function$
DECLARE r record; cfg public.ncrm_ingest_lifecycle_config%ROWTYPE;
        v_neg bigint; v_tipo text; v_idem text; v_res jsonb; v_st text; v_err text;
        v_tent int; v_prox timestamptz; v_final timestamptz; v_motivo text;
        v_proc int := 0; v_noop int := 0; v_err_ct int := 0; v_esp int := 0; v_fim int := 0;
        v_ativo boolean; v_desde timestamptz; v_max int; v_jsn interval; v_jfe interval;
BEGIN
  -- CORTE DE ATIVAÇÃO: enquanto inativo, não processa NADA (nem cria checkpoints).
  SELECT ativo, ativo_desde INTO v_ativo, v_desde FROM public.ncrm_ingest_config WHERE id = true;
  IF COALESCE(v_ativo, false) IS NOT TRUE OR v_desde IS NULL THEN
    RETURN jsonb_build_object('ok', true, 'inativo', true, 'processados', 0, 'noop', 0, 'erros', 0);
  END IF;

  SELECT * INTO cfg FROM public.ncrm_ingest_lifecycle_config WHERE id;
  v_max := COALESCE(p_max_tentativas, cfg.max_tentativas, 8);
  v_jsn := make_interval(mins => COALESCE(cfg.janela_sem_negocio_min, 30));
  v_jfe := COALESCE(p_janela_inbound, make_interval(mins => COALESCE(cfg.janela_fora_escopo_min, 30)));

  FOR r IN
    SELECT m.id, m.wa_message_id, m.conversa_id, m.direcao, m.raw, m.criado_em,
           COALESCE(m.enviado_em, m.criado_em) AS quando,
           cp.id AS cp_id, COALESCE(cp.tentativas,0) AS cp_tent, cp.status AS cp_status
    FROM public.wa_mensagens m
    LEFT JOIN public.ncrm_ingest_checkpoint cp ON cp.mensagem_id = m.id
    WHERE m.criado_em >= v_desde
      AND (
        (m.raw ->> 'origem') = 'motor'
        OR lower(coalesce(m.direcao,'')) = ANY (ARRAY['recebida','entrada','in','inbound','received'])
      )
      AND (cp.id IS NULL OR (cp.finalizado_em IS NULL AND cp.status IN ('pendente','erro')
           AND (cp.proxima_tentativa_em IS NULL OR cp.proxima_tentativa_em <= now())))
    ORDER BY m.criado_em ASC, m.id ASC
    LIMIT p_limite
  LOOP
    IF (r.raw ->> 'origem') = 'motor' THEN v_tipo := 'msg_automatica';
    ELSE v_tipo := 'resposta_inbound';
    END IF;

    v_neg  := ncrm_private.resolver_negocio_por_conversa(r.conversa_id);
    v_idem := COALESCE(NULLIF(btrim(coalesce(r.wa_message_id,'')),''), r.id::text);
    v_st := 'processado'; v_err := NULL; v_res := NULL; v_motivo := NULL;
    v_tent := r.cp_tent; v_prox := NULL; v_final := NULL;

    BEGIN
      IF v_neg IS NULL THEN
        -- Corrida real: o motor dispara antes de o negócio existir. Espera limitada.
        IF r.criado_em > now() - v_jsn AND r.cp_tent + 1 < v_max THEN
          v_st := 'pendente'; v_err := 'sem_negocio_ainda'; v_motivo := 'aguardando_negocio';
        ELSE
          v_st := 'noop_sem_negocio_expirado'; v_motivo := 'sem_negocio_apos_janela'; v_final := now();
        END IF;

      ELSIF v_tipo = 'msg_automatica' THEN
        v_res := public.ncrm_registrar_msg_automatica(v_neg, v_idem, r.quando);
        IF (v_res->>'ok')::boolean THEN v_st := 'processado'; v_motivo := 'processado'; v_final := now();
        ELSIF v_res->>'erro' = 'estado_ja_existe' THEN v_st := 'noop'; v_motivo := 'estado_ja_existe'; v_final := now();
        ELSE v_st := 'erro'; v_err := v_res->>'erro'; v_motivo := v_res->>'erro'; END IF;

      ELSE -- resposta_inbound
        v_res := public.ncrm_registrar_resposta_cliente(v_neg, v_idem, r.quando);
        IF (v_res->>'ok')::boolean THEN
          v_st := 'processado'; v_motivo := 'processado'; v_final := now();
        ELSIF v_res->>'erro' = 'estado_inexistente' THEN
          -- O negócio existe, mas não entrou no CRM Nova Era. A entrada só acontece pela
          -- mensagem automática do motor; damos uma janela curta para essa corrida e,
          -- passada ela, o item é encerrado como fora do escopo — sem criar estado.
          IF r.criado_em > now() - v_jfe AND r.cp_tent + 1 < v_max THEN
            v_st := 'pendente'; v_err := 'estado_inexistente'; v_motivo := 'aguardando_entrada_no_piloto';
          ELSE
            v_st := 'noop_fora_do_escopo'; v_motivo := 'negocio_fora_do_piloto'; v_final := now();
          END IF;
        ELSIF v_res->>'erro' = 'estado_em_saida' THEN
          v_st := 'noop'; v_motivo := 'estado_em_saida'; v_final := now();
        ELSE
          v_st := 'erro'; v_err := v_res->>'erro'; v_motivo := v_res->>'erro';
        END IF;
      END IF;
    EXCEPTION WHEN others THEN
      v_st := 'erro'; v_err := SQLERRM; v_motivo := 'excecao';
    END;

    -- Falha técnica continua VISÍVEL como erro. Ao esgotar as tentativas ela para de girar,
    -- mas não vira noop: o indicador de erro não é maquiado.
    IF v_st IN ('pendente','erro') THEN
      v_tent := r.cp_tent + 1;
      IF v_st = 'erro' AND v_tent >= v_max THEN
        v_final := now(); v_motivo := COALESCE(v_motivo,'erro') || ':persistente'; v_prox := NULL;
      ELSE
        v_prox := now() + make_interval(secs => LEAST(
          COALESCE(cfg.backoff_base_seg,60) * power(2, LEAST(v_tent, 12))::int,
          COALESCE(cfg.backoff_max_seg,1800)));
      END IF;
    END IF;

    INSERT INTO public.ncrm_ingest_checkpoint (mensagem_id, wa_message_id, tipo, negocio_id, status,
        tentativas, ultimo_erro, processado_em, proxima_tentativa_em, motivo_final, finalizado_em)
    VALUES (r.id, r.wa_message_id, v_tipo, v_neg, v_st, v_tent, v_err,
            CASE WHEN v_st = 'processado' THEN now() ELSE NULL END, v_prox, v_motivo, v_final)
    ON CONFLICT (mensagem_id) DO UPDATE SET
      status = EXCLUDED.status, negocio_id = EXCLUDED.negocio_id, ultimo_erro = EXCLUDED.ultimo_erro,
      tentativas = EXCLUDED.tentativas, processado_em = COALESCE(EXCLUDED.processado_em, public.ncrm_ingest_checkpoint.processado_em),
      proxima_tentativa_em = EXCLUDED.proxima_tentativa_em, motivo_final = EXCLUDED.motivo_final,
      finalizado_em = EXCLUDED.finalizado_em, atualizado_em = now();

    IF    v_st = 'processado' THEN v_proc := v_proc + 1;
    ELSIF v_st = 'erro'       THEN v_err_ct := v_err_ct + 1;
    ELSIF v_st = 'pendente'   THEN v_esp := v_esp + 1;
    ELSIF v_st = 'noop'       THEN v_noop := v_noop + 1;
    ELSE  v_fim := v_fim + 1;  -- noop_fora_do_escopo / noop_sem_negocio_expirado
    END IF;
  END LOOP;

  RETURN jsonb_build_object('ok',true,'processados',v_proc,'noop',v_noop,'erros',v_err_ct,
                            'aguardando',v_esp,'finalizados',v_fim);
END $function$;

-- --------------------------------------------------- classificação do backlog existente
-- Aplica as MESMAS regras aos itens que já estavam presos. É pura reclassificação:
-- não chama nenhuma RPC de escrita, não cria ncrm_estado, não aciona a Sara,
-- não envia mensagem e não apaga nada. Idempotente: rodar de novo não muda o resultado.
CREATE FUNCTION public.ncrm_ingest_classificar_backlog(p_limite int DEFAULT 1000, p_confirmacao text DEFAULT NULL)
  RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $fn$
DECLARE v_uid uuid := auth.uid(); cfg public.ncrm_ingest_lifecycle_config%ROWTYPE;
        v_lim int; v_fora int := 0; v_sem int := 0; v_mantidos int := 0;
BEGIN
  IF v_uid IS NULL THEN RETURN jsonb_build_object('ok',false,'erro','nao_autenticado'); END IF;
  IF COALESCE(public.can_manage_all(), false) IS NOT TRUE THEN RETURN jsonb_build_object('ok',false,'erro','sem_permissao'); END IF;
  IF upper(btrim(COALESCE(p_confirmacao,''))) <> 'CLASSIFICAR' THEN RETURN jsonb_build_object('ok',false,'erro','confirmacao_obrigatoria'); END IF;
  SELECT * INTO cfg FROM public.ncrm_ingest_lifecycle_config WHERE id;
  v_lim := LEAST(GREATEST(COALESCE(p_limite,1000), 1), 5000);

  -- 1) Sem negócio e fora da janela => encerrado como "sem negócio após expiração".
  WITH alvo AS (
    SELECT cp.id FROM public.ncrm_ingest_checkpoint cp
     WHERE cp.finalizado_em IS NULL AND cp.status = 'pendente' AND cp.negocio_id IS NULL
       AND cp.criado_em <= now() - make_interval(mins => cfg.janela_sem_negocio_min)
     ORDER BY cp.criado_em LIMIT v_lim
  )
  UPDATE public.ncrm_ingest_checkpoint c
     SET status = 'noop_sem_negocio_expirado', motivo_final = 'sem_negocio_apos_janela',
         finalizado_em = now(), proxima_tentativa_em = NULL, atualizado_em = now()
    FROM alvo WHERE c.id = alvo.id;
  GET DIAGNOSTICS v_sem = ROW_COUNT;

  -- 2) Negócio existe, mas nunca entrou no CRM Nova Era => encerrado como fora do escopo.
  --    Só encerra o que já passou da janela de corrida; nada de estado é criado.
  WITH alvo AS (
    SELECT cp.id FROM public.ncrm_ingest_checkpoint cp
     WHERE cp.finalizado_em IS NULL AND cp.status = 'pendente' AND cp.negocio_id IS NOT NULL
       AND NOT EXISTS (SELECT 1 FROM public.ncrm_estado e WHERE e.negocio_id = cp.negocio_id)
       AND cp.criado_em <= now() - make_interval(mins => cfg.janela_fora_escopo_min)
     ORDER BY cp.criado_em LIMIT v_lim
  )
  UPDATE public.ncrm_ingest_checkpoint c
     SET status = 'noop_fora_do_escopo', motivo_final = 'negocio_fora_do_piloto',
         finalizado_em = now(), proxima_tentativa_em = NULL, atualizado_em = now()
    FROM alvo WHERE c.id = alvo.id;
  GET DIAGNOSTICS v_fora = ROW_COUNT;

  -- 3) O que sobrou pendente volta a ser elegível para a reconciliação (destrava o teto).
  UPDATE public.ncrm_ingest_checkpoint
     SET tentativas = 0, proxima_tentativa_em = NULL, atualizado_em = now()
   WHERE finalizado_em IS NULL AND status = 'pendente' AND tentativas >= cfg.max_tentativas;
  GET DIAGNOSTICS v_mantidos = ROW_COUNT;

  RETURN jsonb_build_object('ok',true,'fora_do_escopo',v_fora,'sem_negocio_expirado',v_sem,
                            'reabilitados',v_mantidos);
END $fn$;
REVOKE ALL ON FUNCTION public.ncrm_ingest_classificar_backlog(int,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ncrm_ingest_classificar_backlog(int,text) TO authenticated;

-- ------------------------------------------------------------- fila de entrada detalhada
-- Leitura única usada pelo painel de saúde. noop NUNCA é somado como erro.
CREATE FUNCTION public.ncrm_ingest_fila_resumo()
  RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $fn$
DECLARE v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL THEN RETURN jsonb_build_object('ok',false,'erro','nao_autenticado'); END IF;
  IF COALESCE(public.can_manage_all(), false) IS NOT TRUE THEN RETURN jsonb_build_object('ok',false,'erro','sem_permissao'); END IF;
  RETURN (SELECT jsonb_build_object(
    'ok', true,
    'processaveis',        count(*) FILTER (WHERE finalizado_em IS NULL AND status = 'pendente' AND negocio_id IS NOT NULL),
    'aguardando_negocio',  count(*) FILTER (WHERE finalizado_em IS NULL AND status = 'pendente' AND negocio_id IS NULL),
    'falhas_tecnicas',     count(*) FILTER (WHERE status = 'erro'),
    'fora_do_piloto',      count(*) FILTER (WHERE status = 'noop_fora_do_escopo'),
    'sem_negocio_expirado',count(*) FILTER (WHERE status = 'noop_sem_negocio_expirado'),
    'encerrados_outros',   count(*) FILTER (WHERE status = 'noop'),
    'processados',         count(*) FILTER (WHERE status = 'processado'),
    'total',               count(*),
    'mais_antigo_pendente_em', min(criado_em) FILTER (WHERE finalizado_em IS NULL AND status = 'pendente'),
    'idade_mais_antigo_min', (EXTRACT(epoch FROM now() - min(criado_em) FILTER (WHERE finalizado_em IS NULL AND status = 'pendente')) / 60)::int
  ) FROM public.ncrm_ingest_checkpoint);
END $fn$;
REVOKE ALL ON FUNCTION public.ncrm_ingest_fila_resumo() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ncrm_ingest_fila_resumo() TO authenticated;

-- --------------------------------------------- painel de saúde: entrada por situação real
CREATE OR REPLACE FUNCTION public.ncrm_saude()
  RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $fn$
DECLARE v_uid uuid := auth.uid(); v_ing jsonb; v_sara jsonb; v_qual jsonb; v_cron jsonb; v_wa jsonb;
BEGIN
  IF v_uid IS NULL THEN RETURN jsonb_build_object('ok',false,'erro','nao_autenticado'); END IF;
  IF COALESCE(public.can_manage_all(), false) IS NOT TRUE THEN RETURN jsonb_build_object('ok',false,'erro','sem_permissao'); END IF;

  -- Entrada de conversas: cada situação separada. noop NUNCA entra na conta de erro.
  SELECT jsonb_build_object(
    'ligada',  COALESCE((SELECT ativo FROM public.ncrm_ingest_config WHERE id), false),
    'desde',   (SELECT ativo_desde FROM public.ncrm_ingest_config WHERE id),
    'processaveis',         count(*) FILTER (WHERE finalizado_em IS NULL AND status = 'pendente' AND negocio_id IS NOT NULL),
    'aguardando_negocio',   count(*) FILTER (WHERE finalizado_em IS NULL AND status = 'pendente' AND negocio_id IS NULL),
    'falhas_tecnicas',      count(*) FILTER (WHERE status = 'erro'),
    'fora_do_piloto',       count(*) FILTER (WHERE status = 'noop_fora_do_escopo'),
    'sem_negocio_expirado', count(*) FILTER (WHERE status = 'noop_sem_negocio_expirado'),
    'encerrados_outros',    count(*) FILTER (WHERE status = 'noop'),
    'processados',          count(*) FILTER (WHERE status = 'processado'),
    'reprocessaveis',       count(*) FILTER (WHERE status = 'erro' AND finalizado_em IS NULL),
    'idade_mais_antigo_min',(EXTRACT(epoch FROM now() - min(criado_em) FILTER (WHERE finalizado_em IS NULL AND status = 'pendente')) / 60)::int,
    'ultimo_processado_em', max(processado_em),
    'ultimo_erro',          (SELECT ultimo_erro FROM public.ncrm_ingest_checkpoint
                              WHERE status = 'erro' AND ultimo_erro IS NOT NULL ORDER BY atualizado_em DESC LIMIT 1),
    'volume_24h',           count(*) FILTER (WHERE criado_em > now() - interval '24 hours')
  ) INTO v_ing FROM public.ncrm_ingest_checkpoint;

  SELECT jsonb_build_object(
    'modo',            (SELECT modo FROM public.ncrm_sara_config WHERE id),
    'leitura_ligada',  COALESCE((SELECT enabled FROM public.ncrm_sara_runner_config WHERE id), false),
    'ultima_execucao', (SELECT ultima_execucao FROM public.ncrm_sara_runner_estado WHERE id),
    'processados_ultima', (SELECT processados FROM public.ncrm_sara_runner_estado WHERE id),
    'fila',            (SELECT count(*) FROM public.ncrm_sara_runner_item WHERE proxima_tentativa_em <= now()),
    'em_espera',       (SELECT count(*) FROM public.ncrm_sara_runner_item WHERE proxima_tentativa_em > now()),
    'com_erro',        (SELECT count(*) FROM public.ncrm_sara_runner_item WHERE ultimo_status <> 'ok'),
    'retentativas',    (SELECT COALESCE(sum(tentativas_consecutivas),0) FROM public.ncrm_sara_runner_item WHERE ultimo_status <> 'ok'),
    'ultimo_erro',     (SELECT ultimo_erro FROM public.ncrm_sara_runner_item WHERE ultimo_erro IS NOT NULL ORDER BY ultima_tentativa_em DESC LIMIT 1),
    'analises_24h',    (SELECT count(*) FROM public.ncrm_sara_analise WHERE criado_em > now() - interval '24 hours'),
    'analises_total',  (SELECT count(*) FROM public.ncrm_sara_analise),
    'modelo',          (SELECT versao_modelo FROM public.ncrm_sara_analise ORDER BY criado_em DESC LIMIT 1),
    'versao_prompt',   (SELECT versao_prompt FROM public.ncrm_sara_analise ORDER BY criado_em DESC LIMIT 1),
    'custo_disponivel', false
  ) INTO v_sara;

  SELECT jsonb_build_object(
    'atendimentos_ativos', (SELECT count(*) FROM public.ncrm_estado WHERE saida IS NULL),
    'sem_corretor',   (SELECT count(*) FROM public.ncrm_estado e JOIN public.negocios n ON n.id = e.negocio_id
                        WHERE e.saida IS NULL AND n.corretor_id IS NULL),
    'sem_conversa',   (SELECT count(*) FROM public.ncrm_estado e JOIN public.negocios n ON n.id = e.negocio_id
                        WHERE e.saida IS NULL AND NOT EXISTS (
                          SELECT 1 FROM public.wa_contatos ct JOIN public.wa_conversas cv ON cv.contato_id = ct.id
                           WHERE ct.lead_id = n.lead_id)),
    'leads_sem_negocio_24h', (SELECT count(*) FROM public.leads l
                        WHERE l.criado_em > now() - interval '24 hours'
                          AND NOT EXISTS (SELECT 1 FROM public.negocios n WHERE n.lead_id = l.id)),
    'audios_sem_transcricao_7d', (SELECT count(*) FROM public.wa_mensagens m
                        WHERE m.tipo IN ('audio','ptt') AND m.transcricao IS NULL
                          AND m.criado_em > now() - interval '7 days'),
    'analises_sem_evidencia', (SELECT count(*) FROM public.ncrm_sara_analise
                        WHERE jsonb_array_length(COALESCE(evidencias,'[]'::jsonb)) = 0),
    'duplicidades_impedidas', (SELECT count(*) FROM public.ncrm_migracao_item WHERE NOT ativo)
  ) INTO v_qual;

  BEGIN
    EXECUTE $q$SELECT COALESCE(jsonb_agg(jsonb_build_object('nome', jobname, 'periodicidade', schedule, 'ligada', active)), '[]'::jsonb)
               FROM cron.job WHERE jobname LIKE 'ncrm%'$q$ INTO v_cron;
  EXCEPTION WHEN OTHERS THEN v_cron := '[]'::jsonb;
  END;

  SELECT COALESCE(jsonb_agg(jsonb_build_object('rotulo', COALESCE(rotulo, session_id), 'status', status,
           'ultimo_sinal', ultimo_heartbeat) ORDER BY COALESCE(rotulo, session_id)), '[]'::jsonb)
    INTO v_wa FROM public.wa_instancias;

  RETURN jsonb_build_object('ok',true,'gerado_em',now(),'entrada',v_ing,'sara',v_sara,
                            'qualidade',v_qual,'rotinas',v_cron,'canais',v_wa,
                            'acoes', COALESCE((SELECT jsonb_agg(jsonb_build_object('acao',acao,'alvo',alvo,
                                'resultado',resultado,'detalhe',detalhe,'em',criado_em) ORDER BY criado_em DESC)
                              FROM (SELECT * FROM public.ncrm_saude_acao_audit ORDER BY criado_em DESC LIMIT 20) a), '[]'::jsonb));
END $fn$;

-- Reprocessar um item passa a limpar também o ciclo de vida (destrava backoff e finalização).
CREATE OR REPLACE FUNCTION public.ncrm_saude_acao(p_acao text, p_alvo text DEFAULT NULL, p_confirmacao text DEFAULT NULL)
  RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $fn$
DECLARE v_uid uuid := auth.uid(); v_res text := 'ok'; v_det text := NULL; v_n int; v_modo text;
BEGIN
  IF v_uid IS NULL THEN RETURN jsonb_build_object('ok',false,'erro','nao_autenticado'); END IF;
  IF COALESCE(public.can_manage_all(), false) IS NOT TRUE THEN RETURN jsonb_build_object('ok',false,'erro','sem_permissao'); END IF;
  IF p_acao NOT IN ('reprocessar_item','retentar_analise','desligar_runner','desligar_entrada',
                    'religar_runner_observador','atualizar_diagnostico')
    THEN RETURN jsonb_build_object('ok',false,'erro','acao_invalida'); END IF;
  IF p_acao <> 'atualizar_diagnostico' AND upper(btrim(COALESCE(p_confirmacao,''))) <> 'CONFIRMAR'
    THEN RETURN jsonb_build_object('ok',false,'erro','confirmacao_obrigatoria'); END IF;

  IF p_acao = 'reprocessar_item' THEN
    UPDATE public.ncrm_ingest_checkpoint
       SET status = 'pendente', ultimo_erro = NULL, tentativas = 0,
           proxima_tentativa_em = NULL, motivo_final = NULL, finalizado_em = NULL, atualizado_em = now()
     WHERE wa_message_id = p_alvo AND status IN ('erro','noop_fora_do_escopo','noop_sem_negocio_expirado');
    GET DIAGNOSTICS v_n = ROW_COUNT;
    IF v_n = 0 THEN v_res := 'ignorado'; v_det := 'item nao encontrado ou ja processado';
    ELSE v_det := 'reenfileirado'; END IF;

  ELSIF p_acao = 'retentar_analise' THEN
    UPDATE public.ncrm_sara_runner_item SET proxima_tentativa_em = now(), ultimo_erro = NULL
     WHERE negocio_id = NULLIF(p_alvo,'')::bigint;
    GET DIAGNOSTICS v_n = ROW_COUNT;
    IF v_n = 0 THEN v_res := 'ignorado'; v_det := 'atendimento sem leitura pendente';
    ELSE v_det := 'nova leitura liberada'; END IF;

  ELSIF p_acao = 'desligar_runner' THEN
    UPDATE public.ncrm_sara_runner_config SET enabled = false, atualizado_em = now(), atualizado_por = v_uid WHERE id;
    v_det := 'leitura da Sara desligada';

  ELSIF p_acao = 'desligar_entrada' THEN
    UPDATE public.ncrm_ingest_config SET ativo = false, atualizado_em = now(), atualizado_por = v_uid WHERE id;
    v_det := 'entrada de conversas desligada';

  ELSIF p_acao = 'religar_runner_observador' THEN
    SELECT modo INTO v_modo FROM public.ncrm_sara_config WHERE id;
    IF COALESCE(v_modo,'') <> 'observer' THEN
      v_res := 'erro'; v_det := 'so pode religar com a Sara em modo de observacao';
      INSERT INTO public.ncrm_saude_acao_audit (acao, alvo, resultado, detalhe, executado_por)
      VALUES (p_acao, p_alvo, v_res, v_det, v_uid);
      RETURN jsonb_build_object('ok',false,'erro','sara_fora_de_observacao');
    END IF;
    UPDATE public.ncrm_sara_runner_config SET enabled = true, atualizado_em = now(), atualizado_por = v_uid WHERE id;
    v_det := 'leitura da Sara religada em modo de observacao';

  ELSE
    v_det := 'diagnostico atualizado';
  END IF;

  INSERT INTO public.ncrm_saude_acao_audit (acao, alvo, resultado, detalhe, executado_por)
  VALUES (p_acao, p_alvo, v_res, v_det, v_uid);

  RETURN jsonb_build_object('ok', v_res <> 'erro', 'acao', p_acao, 'resultado', v_res, 'detalhe', v_det);
END $fn$;
