-- DRAFT NÃO APLICADO — confirmar ação manual sem forjar evidência D-API.
--
-- Baseline remoto sanitizado em 2026-09-21:
--   public.f2_confirmar_acao(uuid,integer,text,text)
--     sha256 7d1fd56bd3bd79045f11c3e6c4aadd9e2e810ea8851bf0ee181d03660e9127f0
--   public.motor_enfileirar(bigint,jsonb)
--     sha256 ab30bfa7742765910f4cc48c270ecda8bff6bc8a9e70e04bb038645094448b4a
--   automação 49 mapa
--     sha256 576ea391acdeae18293083bb90ee2cce468fb54fd0dbd942634abf03570fa991
--     versão publicada 130; versão lógica máxima 6.
--
-- A confirmação D-API pertence ao webhook canônico. Esta RPC registra apenas
-- uma ação operacional manual do corretor dono, cria evidência idempotente e
-- enfileira uma leitura real da Sara. O ensaio termina sempre em ROLLBACK.

BEGIN;

DO $preflight$
DECLARE
  v_hash text;
  v_mapa_hash text;
  v_publicada bigint;
  v_versao integer;
  v_gatilhos integer;
BEGIN
  SELECT pg_catalog.encode(
    extensions.digest(pg_catalog.pg_get_functiondef(
      'public.f2_confirmar_acao(uuid,integer,text,text)'::regprocedure::oid
    ), 'sha256'), 'hex'
  ) INTO v_hash;
  IF v_hash <> '7d1fd56bd3bd79045f11c3e6c4aadd9e2e810ea8851bf0ee181d03660e9127f0' THEN
    RAISE EXCEPTION 'f2_confirmar_acao_divergiu: %', v_hash;
  END IF;

  SELECT pg_catalog.encode(
    extensions.digest(pg_catalog.pg_get_functiondef(
      'public.motor_enfileirar(bigint,jsonb)'::regprocedure::oid
    ), 'sha256'), 'hex'
  ) INTO v_hash;
  IF v_hash <> 'ab30bfa7742765910f4cc48c270ecda8bff6bc8a9e70e04bb038645094448b4a' THEN
    RAISE EXCEPTION 'motor_enfileirar_divergiu: %', v_hash;
  END IF;

  SELECT pg_catalog.encode(extensions.digest(a.mapa::text, 'sha256'), 'hex'),
         a.versao_publicada_id,
         (SELECT pg_catalog.max(v.versao)
            FROM public.automacao_versoes v
           WHERE v.automacao_id = a.id)
    INTO v_mapa_hash, v_publicada, v_versao
    FROM public.automacoes a
   WHERE a.id = 49
   FOR UPDATE;
  IF v_mapa_hash <> '576ea391acdeae18293083bb90ee2cce468fb54fd0dbd942634abf03570fa991'
     OR v_publicada <> 130 OR v_versao <> 6 THEN
    RAISE EXCEPTION 'automacao_49_divergiu: mapa %, publicada %, versao %',
      v_mapa_hash, v_publicada, v_versao;
  END IF;

  SELECT pg_catalog.count(*) INTO v_gatilhos
    FROM public.automacoes a
    CROSS JOIN LATERAL pg_catalog.jsonb_array_elements(a.mapa#>'{automation,blocks}') b
    CROSS JOIN LATERAL pg_catalog.jsonb_array_elements(
      pg_catalog.coalesce(b#>'{options,triggers}', '[]'::jsonb)
    ) t
   WHERE a.id = 49
     AND t->>'name' = 'sara-ciclo-event-trigger';
  IF v_gatilhos <> 1 THEN
    RAISE EXCEPTION 'automacao_49_gatilho_inesperado: %', v_gatilhos;
  END IF;
  IF EXISTS (
    SELECT 1
      FROM public.automacoes a
      CROSS JOIN LATERAL pg_catalog.jsonb_array_elements(a.mapa#>'{automation,blocks}') b
      CROSS JOIN LATERAL pg_catalog.jsonb_array_elements(
        pg_catalog.coalesce(b#>'{options,triggers}', '[]'::jsonb)
      ) t
     WHERE a.id = 49
       AND t->>'name' = 'sara-ciclo-event-trigger'
       AND t#>'{options,eventTypes}' @> '["lead.action_confirmed"]'::jsonb
  ) THEN
    RAISE EXCEPTION 'automacao_49_evento_ja_publicado';
  END IF;

  IF pg_catalog.to_regclass('public.f2_lead') IS NULL
     OR pg_catalog.to_regclass('public.f2_evento') IS NULL
     OR pg_catalog.to_regclass('public.motor_fila') IS NULL THEN
    RAISE EXCEPTION 'dependencia_estrutural_ausente';
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_catalog.pg_class c
    JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relname IN (
        'f2_evento_acao_confirmada_versao_uniq',
        'motor_fila_sara_acao_confirmada_uniq'
      )
  ) THEN
    RAISE EXCEPTION 'indice_do_pacote_ja_existe';
  END IF;
  IF NOT pg_catalog.has_function_privilege(
       'authenticated', 'public.f2_confirmar_acao(uuid,integer,text,text)', 'EXECUTE'
     ) OR pg_catalog.has_function_privilege(
       'anon', 'public.f2_confirmar_acao(uuid,integer,text,text)', 'EXECUTE'
     ) THEN
    RAISE EXCEPTION 'acl_baseline_f2_confirmar_acao_divergiu';
  END IF;
END
$preflight$;

CREATE UNIQUE INDEX f2_evento_acao_confirmada_versao_uniq
  ON public.f2_evento(funil_lead_id, (payload->>'versao_base'))
  WHERE tipo = 'acao_confirmada'
    AND payload->>'versao_base' ~ '^[1-9][0-9]*$';

CREATE UNIQUE INDEX motor_fila_sara_acao_confirmada_uniq
  ON public.motor_fila(
    automacao_id,
    (lead->>'__funil_lead_id'),
    (lead->>'__sara_event_type'),
    (lead->>'__sara_source_id')
  )
  WHERE lead->>'__sara_event_type' = 'lead.action_confirmed';

COMMENT ON INDEX public.f2_evento_acao_confirmada_versao_uniq IS
  'Uma confirmação operacional por card e versão-base.';
COMMENT ON INDEX public.motor_fila_sara_acao_confirmada_uniq IS
  'Uma execução Sara por evento auditável de ação confirmada.';

CREATE OR REPLACE FUNCTION public.f2_confirmar_acao(
  p_id uuid,
  p_versao integer,
  p_fonte text,
  p_observacao text DEFAULT NULL::text
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_uid uuid := (SELECT auth.uid());
  v_broker_id bigint := public.current_broker_id();
  v_atual public.f2_lead%ROWTYPE;
  v_m public.f2_momento_config%ROWTYPE;
  v_existente public.f2_evento%ROWTYPE;
  v_passo smallint;
  v_dias smallint;
  v_prazo timestamptz;
  v_sem_cobranca boolean;
  v_resumo text;
  v_email text := '';
  v_evento_id bigint;
  v_fila_id bigint;
  v_dias_cadencia constant smallint[] := ARRAY[1,2,4,6,7];
BEGIN
  IF v_uid IS NULL OR v_broker_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'erro', 'sem_permissao');
  END IF;
  IF p_versao IS NULL OR p_versao < 1 THEN
    RETURN jsonb_build_object('ok', false, 'erro', 'versao_invalida');
  END IF;
  IF p_fonte <> 'registro_operacional' THEN
    RETURN jsonb_build_object('ok', false, 'erro', 'confirmacao_dapi_pelo_webhook');
  END IF;

  SELECT * INTO v_atual
    FROM public.f2_lead
   WHERE id = p_id
   FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'erro', 'lead_inexistente');
  END IF;
  IF v_atual.corretor_id IS DISTINCT FROM v_broker_id THEN
    RETURN jsonb_build_object('ok', false, 'erro', 'sem_permissao');
  END IF;
  IF v_atual.descartado_em IS NOT NULL THEN
    RETURN jsonb_build_object('ok', false, 'erro', 'lead_descartado');
  END IF;

  -- Retry de rede: a mesma pessoa e versão-base recebem o mesmo resultado,
  -- sem novo evento, novo prazo ou segunda execução da Sara.
  IF v_atual.versao = p_versao + 1 THEN
    SELECT * INTO v_existente
      FROM public.f2_evento e
     WHERE e.funil_lead_id = p_id
       AND e.tipo = 'acao_confirmada'
       AND e.criado_por = v_uid
       AND e.payload->>'versao_base' = p_versao::text
     ORDER BY e.id DESC
     LIMIT 1;
    IF FOUND THEN
      RETURN jsonb_build_object(
        'ok', true,
        'idempotente', true,
        'versao', v_atual.versao,
        'prazo', v_atual.proxima_acao_em,
        'cadencia_passo', v_atual.cadencia_passo,
        'sem_prazo', (v_existente.payload->>'sem_prazo')::boolean,
        'sara_em_fila', true,
        'fila_id', (v_existente.payload->>'fila_id')::bigint,
        'evento_id', v_existente.id
      );
    END IF;
  END IF;
  IF v_atual.versao <> p_versao THEN
    RETURN jsonb_build_object('ok', false, 'erro', 'versao_conflito');
  END IF;

  SELECT * INTO v_m
    FROM public.f2_momento_config
   WHERE codigo = v_atual.momento_codigo;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'erro', 'momento_invalido');
  END IF;
  IF v_m.exige_dapi THEN
    RETURN jsonb_build_object('ok', false, 'erro', 'confirmacao_dapi_obrigatoria');
  END IF;

  v_sem_cobranca := pg_catalog.coalesce(v_m.cobra_no_meu_dia, true) IS FALSE;
  IF v_sem_cobranca THEN
    v_passo := pg_catalog.greatest(v_atual.cadencia_passo, 1)::smallint;
    v_prazo := public.f2_sem_prazo();
    v_resumo := 'Ação operacional registrada; o card continua sem prazo até nova evidência.';
  ELSIF v_atual.momento_codigo = 'CADENCIA_SEM_RESPOSTA' THEN
    IF v_atual.cadencia_passo < 4 THEN
      v_passo := v_atual.cadencia_passo + 1;
      v_dias := v_dias_cadencia[v_passo + 1] - v_dias_cadencia[v_passo];
      v_prazo := pg_catalog.date_trunc('day', pg_catalog.now() AT TIME ZONE 'America/Sao_Paulo')
        AT TIME ZONE 'America/Sao_Paulo'
        + pg_catalog.make_interval(days => v_dias) + interval '9 hours';
      v_resumo := 'A ação foi registrada; a cadência manteve o próximo dia oficial.';
    ELSE
      v_passo := 5;
      v_prazo := pg_catalog.now() + interval '24 hours';
      v_resumo := 'A cadência terminou; o lead precisa de nova avaliação.';
    END IF;
  ELSE
    v_passo := v_atual.cadencia_passo;
    v_prazo := pg_catalog.now()
      + pg_catalog.make_interval(mins => pg_catalog.coalesce(v_m.prazo_minutos, 1440));
    v_resumo := 'A ação operacional foi registrada e aguarda uma nova leitura auditável.';
  END IF;

  UPDATE public.f2_lead
     SET cadencia_passo = v_passo,
         proxima_acao_em = v_prazo,
         ultima_acao_confirmada_em = pg_catalog.now(),
         ultima_acao_fonte = 'registro_operacional',
         versao = versao + 1,
         atualizado_em = pg_catalog.now(),
         atualizado_por = v_uid
   WHERE id = p_id;

  INSERT INTO public.f2_evento(
    funil_lead_id, tipo, titulo, detalhe, payload, criado_por
  ) VALUES (
    p_id, 'acao_confirmada', 'Ação confirmada por registro operacional',
    pg_catalog.nullif(pg_catalog.left(pg_catalog.btrim(pg_catalog.coalesce(p_observacao, '')), 500), ''),
    jsonb_build_object(
      'acao', v_atual.acao_codigo,
      'versao_base', p_versao,
      'proximo_prazo', CASE WHEN v_sem_cobranca THEN NULL ELSE to_jsonb(v_prazo) END,
      'sem_prazo', v_sem_cobranca,
      'cadencia_passo', v_passo,
      'estado', 'aguardando_sara'
    ),
    v_uid
  ) RETURNING id INTO v_evento_id;

  UPDATE public.motor_fila
     SET status = 'cancelado',
         processado_em = pg_catalog.now(),
         ultimo_erro = 'checkpoint_substituido_por_acao_confirmada'
   WHERE automacao_id = 49
     AND status = 'pendente'
     AND lead->>'__sara_checkpoint' = 'true'
     AND lead->>'__funil_lead_id' = p_id::text;

  SELECT pg_catalog.coalesce(l.email, '') INTO v_email
    FROM public.negocios n
    LEFT JOIN public.leads l ON l.id = n.lead_id
   WHERE n.id = v_atual.origem_negocio_id;

  v_fila_id := public.motor_enfileirar(49, jsonb_build_object(
    'nome', pg_catalog.coalesce(v_atual.nome, 'Lead'),
    'telefone', pg_catalog.coalesce(v_atual.telefone, ''),
    'email', pg_catalog.coalesce(v_email, ''),
    '__funil_lead_id', p_id,
    '__motor_priority', 0,
    '__motor_evento', 'lead.action_confirmed',
    '__sara_event_type', 'lead.action_confirmed',
    '__sara_source_id', v_evento_id,
    '__sara_proxima_acao', jsonb_build_object(
      'codigo', v_atual.acao_codigo,
      'responsavel', 'corretor_atual',
      'executar_em', v_atual.proxima_acao_em,
      'evidencia', 'evento:' || v_evento_id::text
    )
  ));

  UPDATE public.f2_evento
     SET payload = payload || jsonb_build_object('fila_id', v_fila_id)
   WHERE id = v_evento_id;

  RETURN jsonb_build_object(
    'ok', true,
    'idempotente', false,
    'versao', v_atual.versao + 1,
    'prazo', v_prazo,
    'cadencia_passo', v_passo,
    'sem_prazo', v_sem_cobranca,
    'sara_em_fila', true,
    'fila_id', v_fila_id,
    'evento_id', v_evento_id,
    'resumo_operacional', v_resumo
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.f2_confirmar_acao(uuid,integer,text,text)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.f2_confirmar_acao(uuid,integer,text,text)
  TO authenticated, service_role;

-- Publica uma versão imutável da automação 49. O editor atual mantém
-- editor.blocks como objeto vazio; somente automation.blocks é a autoridade
-- executável, e editor.uid recebe uma nova revisão para evitar cache antigo.
DO $publicar_evento_acao_confirmada$
DECLARE
  v_auto public.automacoes%ROWTYPE;
  v_mapa jsonb;
  v_blocos jsonb;
  v_validacao jsonb;
  v_versao integer;
  v_versao_id bigint;
BEGIN
  SELECT * INTO STRICT v_auto
    FROM public.automacoes
   WHERE id = 49
   FOR UPDATE;
  v_mapa := v_auto.mapa;

  SELECT jsonb_agg(
    CASE WHEN EXISTS (
      SELECT 1
        FROM pg_catalog.jsonb_array_elements(
          pg_catalog.coalesce(b#>'{options,triggers}', '[]'::jsonb)
        ) t
       WHERE t->>'name' = 'sara-ciclo-event-trigger'
    ) THEN jsonb_set(
      b,
      '{options,triggers}',
      (
        SELECT jsonb_agg(
          CASE WHEN t->>'name' = 'sara-ciclo-event-trigger'
            THEN jsonb_set(
              t,
              '{options,eventTypes}',
              pg_catalog.coalesce(t#>'{options,eventTypes}', '[]'::jsonb)
                || '["lead.action_confirmed"]'::jsonb,
              true
            )
            ELSE t END
          ORDER BY trigger_ord
        )
          FROM pg_catalog.jsonb_array_elements(
            pg_catalog.coalesce(b#>'{options,triggers}', '[]'::jsonb)
          ) WITH ORDINALITY AS trigger_item(t, trigger_ord)
      ),
      true
    ) ELSE b END
    ORDER BY bloco_ord
  ) INTO v_blocos
    FROM pg_catalog.jsonb_array_elements(v_mapa#>'{automation,blocks}')
      WITH ORDINALITY AS bloco_item(b, bloco_ord);

  v_mapa := jsonb_set(v_mapa, '{automation,blocks}', v_blocos, false);
  v_mapa := jsonb_set(
    v_mapa,
    '{editor,uid}',
    to_jsonb(pg_catalog.coalesce((v_mapa#>>'{editor,uid}')::integer, 0) + 1),
    true
  );

  v_validacao := public.automacao_validar_mapa(v_mapa);
  IF pg_catalog.coalesce((v_validacao->>'ok')::boolean, false) IS NOT TRUE THEN
    RAISE EXCEPTION 'AUTOMATION_INVALID: %', v_validacao->'erros';
  END IF;

  SELECT pg_catalog.coalesce(pg_catalog.max(versao), 0) + 1 INTO v_versao
    FROM public.automacao_versoes
   WHERE automacao_id = 49;

  INSERT INTO public.automacao_versoes(
    automacao_id, versao, nome, mapa, observacao, criado_por
  ) VALUES (
    49, v_versao, 'Inteligencia de Conversa', v_mapa,
    'Inclui evento auditável lead.action_confirmed sem forjar reavaliação',
    'migration:p0_f2_confirmar_acao'
  ) RETURNING id INTO v_versao_id;

  UPDATE public.automacoes
     SET mapa = v_mapa,
         mapa_rascunho = v_mapa,
         versao_publicada_id = v_versao_id,
         status = 'publicado',
         ativa = true,
         arquivada = false,
         publicado_em = pg_catalog.now(),
         atualizada_em = pg_catalog.now()
   WHERE id = 49;

  IF NOT EXISTS (
    SELECT 1
      FROM pg_catalog.jsonb_array_elements(v_mapa#>'{automation,blocks}') b
      CROSS JOIN LATERAL pg_catalog.jsonb_array_elements(
        pg_catalog.coalesce(b#>'{options,triggers}', '[]'::jsonb)
      ) t
     WHERE t->>'name' = 'sara-ciclo-event-trigger'
       AND t#>'{options,eventTypes}' @> '["lead.action_confirmed"]'::jsonb
  ) THEN
    RAISE EXCEPTION 'VERIFY_FAILED: lead.action_confirmed ausente da automacao 49';
  END IF;
END
$publicar_evento_acao_confirmada$;

DO $verify$
DECLARE
  v_def text;
  v_eventos integer;
BEGIN
  SELECT pg_catalog.pg_get_functiondef(
    'public.f2_confirmar_acao(uuid,integer,text,text)'::regprocedure::oid
  ) INTO v_def;
  IF pg_catalog.position('lead.action_confirmed' IN v_def) = 0
     OR pg_catalog.position('versao_base' IN v_def) = 0
     OR pg_catalog.position('ultima_reavaliacao_sara_em' IN v_def) > 0
     OR pg_catalog.position('sara_reavaliou' IN v_def) > 0 THEN
    RAISE EXCEPTION 'verify_f2_confirmar_acao_failed';
  END IF;
  IF pg_catalog.has_function_privilege(
       'anon', 'public.f2_confirmar_acao(uuid,integer,text,text)', 'EXECUTE'
     ) OR NOT pg_catalog.has_function_privilege(
       'authenticated', 'public.f2_confirmar_acao(uuid,integer,text,text)', 'EXECUTE'
     ) OR NOT pg_catalog.has_function_privilege(
       'service_role', 'public.f2_confirmar_acao(uuid,integer,text,text)', 'EXECUTE'
     ) THEN
    RAISE EXCEPTION 'verify_f2_confirmar_acao_acl_failed';
  END IF;
  SELECT pg_catalog.count(*) INTO v_eventos
    FROM public.automacoes a
    CROSS JOIN LATERAL pg_catalog.jsonb_array_elements(a.mapa#>'{automation,blocks}') b
    CROSS JOIN LATERAL pg_catalog.jsonb_array_elements(
      pg_catalog.coalesce(b#>'{options,triggers}', '[]'::jsonb)
    ) t
   WHERE a.id = 49
     AND t->>'name' = 'sara-ciclo-event-trigger'
     AND t#>'{options,eventTypes}' @> '["lead.action_confirmed"]'::jsonb;
  IF v_eventos <> 1 THEN
    RAISE EXCEPTION 'verify_automacao_49_evento_failed: %', v_eventos;
  END IF;
END
$verify$;

-- Este arquivo é um pacote de ensaio, não uma migration publicável.
-- A migration canônica só será gerada após testes positivos/negativos em
-- Supabase isolado, incluindo retry idempotente e worker/Edge sem efeitos.
ROLLBACK;
