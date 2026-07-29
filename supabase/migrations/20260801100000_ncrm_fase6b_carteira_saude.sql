-- CRM Nova Era — FASE 6 (PR B): treinamento, classificação assistida da carteira antiga
-- (PREVIEW somente leitura + aprovação individual) e saúde/monitoramento administrativo.
-- ADITIVA: só objetos ncrm_*. Nada aqui envia WhatsApp, cria visita/proposta, altera venda,
-- move o CRM antigo nem liga a Sara em execute.

-- ============================ 1. TREINAMENTO ============================
CREATE TABLE public.ncrm_treinamento (
  usuario_id  uuid NOT NULL REFERENCES public.usuarios(id),
  item        text NOT NULL CHECK (length(btrim(item)) BETWEEN 2 AND 60),
  concluido_em timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (usuario_id, item)
);
REVOKE ALL ON public.ncrm_treinamento FROM PUBLIC, anon, authenticated;
ALTER TABLE public.ncrm_treinamento ENABLE ROW LEVEL SECURITY;

-- Progresso do PRÓPRIO usuário (isolado). Admin/gestor vê a conclusão da equipe.
CREATE FUNCTION public.ncrm_treinamento_meu()
  RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $fn$
DECLARE v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL THEN RETURN jsonb_build_object('ok',false,'erro','nao_autenticado'); END IF;
  RETURN jsonb_build_object('ok',true,'concluidos',
    COALESCE((SELECT jsonb_agg(item ORDER BY item) FROM public.ncrm_treinamento WHERE usuario_id = v_uid), '[]'::jsonb));
END $fn$;
REVOKE ALL ON FUNCTION public.ncrm_treinamento_meu() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ncrm_treinamento_meu() TO authenticated;

CREATE FUNCTION public.ncrm_treinamento_marcar(p_item text, p_concluido boolean)
  RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $fn$
DECLARE v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL THEN RETURN jsonb_build_object('ok',false,'erro','nao_autenticado'); END IF;
  IF p_item IS NULL OR length(btrim(p_item)) NOT BETWEEN 2 AND 60 THEN RETURN jsonb_build_object('ok',false,'erro','item_invalido'); END IF;
  IF COALESCE(p_concluido,true) THEN
    INSERT INTO public.ncrm_treinamento (usuario_id, item) VALUES (v_uid, btrim(p_item)) ON CONFLICT DO NOTHING;
  ELSE
    DELETE FROM public.ncrm_treinamento WHERE usuario_id = v_uid AND item = btrim(p_item);
  END IF;
  RETURN public.ncrm_treinamento_meu();
END $fn$;
REVOKE ALL ON FUNCTION public.ncrm_treinamento_marcar(text,boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ncrm_treinamento_marcar(text,boolean) TO authenticated;

CREATE FUNCTION public.ncrm_treinamento_equipe()
  RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $fn$
DECLARE v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL THEN RETURN jsonb_build_object('ok',false,'erro','nao_autenticado'); END IF;
  IF COALESCE(public.can_manage_all(), false) IS NOT TRUE THEN RETURN jsonb_build_object('ok',false,'erro','sem_permissao'); END IF;
  RETURN jsonb_build_object('ok',true,'usuarios', COALESCE((
    SELECT jsonb_agg(jsonb_build_object('nome', u.nome, 'papel', u.role,
             'concluidos', (SELECT count(*) FROM public.ncrm_treinamento t WHERE t.usuario_id = u.id),
             'ultimo_em', (SELECT max(concluido_em) FROM public.ncrm_treinamento t WHERE t.usuario_id = u.id)) ORDER BY u.nome)
    FROM public.usuarios u WHERE u.ativo AND (u.role IN ('admin','executivo')
      OR EXISTS (SELECT 1 FROM public.ncrm_piloto p WHERE p.usuario_id = u.id AND p.ativo))), '[]'::jsonb));
END $fn$;
REVOKE ALL ON FUNCTION public.ncrm_treinamento_equipe() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ncrm_treinamento_equipe() TO authenticated;

-- ===================== 2. CLASSIFICAÇÃO ASSISTIDA DA CARTEIRA ANTIGA =====================
-- Análise sugerida pela Sara para negócios que ainda não estão no CRM Nova Era.
-- Tabela puramente informativa: nada aqui altera o CRM antigo nem cria atendimento.
CREATE TABLE public.ncrm_migracao_analise (
  negocio_id            bigint PRIMARY KEY,
  context_hash          text NOT NULL CHECK (length(btrim(context_hash)) BETWEEN 4 AND 200),
  resumo                text NULL CHECK (resumo IS NULL OR length(resumo) <= 1200),
  etapa_sugerida        text NULL CHECK (etapa_sugerida IS NULL OR etapa_sugerida IN ('novo','tentando_contato','em_atendimento','em_acompanhamento')),
  temperatura_sugerida  text NULL CHECK (temperatura_sugerida IS NULL OR temperatura_sugerida IN ('frio','morno','quente','negociando')),
  risco                 text NULL CHECK (risco IS NULL OR risco IN ('baixo','medio','alto')),
  proxima_acao_sugerida text NULL CHECK (proxima_acao_sugerida IS NULL OR length(proxima_acao_sugerida) <= 400),
  prazo_sugerido        timestamptz NULL,
  justificativa         text NULL CHECK (justificativa IS NULL OR length(justificativa) <= 1200),
  evidencias            jsonb NOT NULL DEFAULT '[]'::jsonb
                          CHECK (jsonb_typeof(evidencias) = 'array' AND jsonb_array_length(evidencias) <= 30),
  confianca             numeric NULL CHECK (confianca IS NULL OR (confianca >= 0 AND confianca <= 1)),
  contexto_qualidade    text NOT NULL DEFAULT 'insuficiente' CHECK (contexto_qualidade IN ('insuficiente','parcial','boa')),
  evidencia_insuficiente boolean NOT NULL DEFAULT true,
  versao_modelo         text NULL,
  versao_prompt         text NULL,
  analisado_em          timestamptz NOT NULL DEFAULT now(),
  criado_por            uuid NULL
);
REVOKE ALL ON public.ncrm_migracao_analise FROM PUBLIC, anon, authenticated;
ALTER TABLE public.ncrm_migracao_analise ENABLE ROW LEVEL SECURITY;

-- Auditoria da migração assistida. O atendimento só nasce por aprovação individual do admin.
CREATE TABLE public.ncrm_migracao_item (
  negocio_id            bigint PRIMARY KEY REFERENCES public.negocios(id),
  origem                text NOT NULL DEFAULT 'migracao_assistida' CHECK (origem = 'migracao_assistida'),
  analise               jsonb NOT NULL DEFAULT '{}'::jsonb,
  etapa_sugerida        text NULL,
  etapa_aprovada        text NOT NULL,
  proxima_acao_sugerida text NULL,
  proxima_acao_aprovada text NOT NULL,
  prazo_aprovado        timestamptz NOT NULL,
  workflow_config_id    bigint NOT NULL,
  versao_analise        text NULL,
  responsavel_id        bigint NULL,
  aprovado_por          uuid NOT NULL,
  aprovado_em           timestamptz NOT NULL DEFAULT now(),
  ativo                 boolean NOT NULL DEFAULT true,
  desativado_por        uuid NULL,
  desativado_em         timestamptz NULL
);
CREATE INDEX ix_ncrm_migracao_item_ativo ON public.ncrm_migracao_item (ativo, aprovado_em DESC);
REVOKE ALL ON public.ncrm_migracao_item FROM PUBLIC, anon, authenticated;
ALTER TABLE public.ncrm_migracao_item ENABLE ROW LEVEL SECURITY;

-- PRÉVIA — SOMENTE LEITURA. Declarada STABLE: o Postgres impede qualquer escrita aqui.
-- Teto rígido de 10 itens por lote. Não cria atendimento, não move negócio, não envia mensagem.
CREATE FUNCTION public.ncrm_migracao_preview(p_filtros jsonb DEFAULT '{}'::jsonb)
  RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $fn$
DECLARE v_uid uuid := auth.uid(); v_lim int; v_itens jsonb;
        v_corretor bigint; v_stage bigint; v_respondeu boolean; v_busca text;
        v_atraso_h int; v_origem text; v_conversa boolean; v_transcricao boolean;
BEGIN
  IF v_uid IS NULL THEN RETURN jsonb_build_object('ok',false,'erro','nao_autenticado'); END IF;
  IF COALESCE(public.can_manage_all(), false) IS NOT TRUE THEN RETURN jsonb_build_object('ok',false,'erro','sem_permissao'); END IF;

  v_lim        := LEAST(GREATEST(COALESCE(NULLIF(p_filtros->>'quantidade','')::int, 10), 1), 10);
  v_corretor   := NULLIF(p_filtros->>'corretor','')::bigint;
  v_stage      := NULLIF(p_filtros->>'etapa_antiga','')::bigint;
  v_busca      := NULLIF(btrim(COALESCE(p_filtros->>'busca','')), '');
  v_atraso_h   := NULLIF(p_filtros->>'atraso_horas','')::int;
  v_origem     := NULLIF(btrim(COALESCE(p_filtros->>'origem','')), '');
  v_respondeu  := CASE WHEN p_filtros->>'respondeu'  = 'sim' THEN true WHEN p_filtros->>'respondeu'  = 'nao' THEN false ELSE NULL END;
  v_conversa   := CASE WHEN p_filtros->>'conversa'   = 'sim' THEN true WHEN p_filtros->>'conversa'   = 'nao' THEN false ELSE NULL END;
  v_transcricao:= CASE WHEN p_filtros->>'transcricao'= 'sim' THEN true WHEN p_filtros->>'transcricao'= 'nao' THEN false ELSE NULL END;

  WITH base AS (
    SELECT n.id AS negocio_id, n.corretor_id, l.id AS lead_id, l.nome AS cliente, l.origem AS origem_lead,
           COALESCE(c.apelido, c.nome, '—') AS corretor,
           COALESCE(s.rotulo, s.nome, '—')  AS etapa_antiga,
           GREATEST(n.ultima_movimentacao, n.criado_em) AS ultima_interacao,
           (SELECT count(*) FROM public.wa_contatos ct
              JOIN public.wa_conversas cv ON cv.contato_id = ct.id
              JOIN public.wa_mensagens m  ON m.conversa_id = cv.id
             WHERE ct.lead_id = l.id) AS mensagens,
           (SELECT count(*) FROM public.wa_contatos ct
              JOIN public.wa_conversas cv ON cv.contato_id = ct.id
              JOIN public.wa_mensagens m  ON m.conversa_id = cv.id
             WHERE ct.lead_id = l.id AND m.transcricao IS NOT NULL) AS transcricoes,
           (SELECT count(*) FROM public.wa_contatos ct
              JOIN public.wa_conversas cv ON cv.contato_id = ct.id
              JOIN public.wa_mensagens m  ON m.conversa_id = cv.id
             WHERE ct.lead_id = l.id
               AND lower(coalesce(m.direcao,'')) = ANY (ARRAY['recebida','entrada','in','inbound','received'])) AS recebidas,
           (SELECT count(*) FROM public.wa_contatos ct
              JOIN public.wa_conversas cv ON cv.contato_id = ct.id
              JOIN public.wa_mensagens m  ON m.conversa_id = cv.id
             WHERE ct.lead_id = l.id AND m.tipo IN ('audio','ptt') AND m.transcricao IS NULL) AS audios_sem_transcricao
      FROM public.negocios n
      JOIN public.leads l ON l.id = n.lead_id
      LEFT JOIN public.corretores c ON c.id = n.corretor_id
      LEFT JOIN public.pipeline_stages s ON s.id = n.stage_id
     WHERE n.status = 'aberto'
       AND NOT EXISTS (SELECT 1 FROM public.ncrm_estado e WHERE e.negocio_id = n.id)   -- nunca duplica
       AND (v_corretor IS NULL OR n.corretor_id = v_corretor)
       AND (v_stage    IS NULL OR n.stage_id    = v_stage)
       AND (v_origem   IS NULL OR l.origem = v_origem)
       AND (v_busca    IS NULL OR l.nome ILIKE '%' || v_busca || '%')
       AND (v_atraso_h IS NULL OR GREATEST(n.ultima_movimentacao, n.criado_em) < now() - make_interval(hours => v_atraso_h))
     ORDER BY GREATEST(n.ultima_movimentacao, n.criado_em) DESC NULLS LAST
     LIMIT 400
  ), filtrado AS (
    SELECT * FROM base
     WHERE (v_respondeu   IS NULL OR v_respondeu   = (recebidas > 0))
       AND (v_conversa    IS NULL OR v_conversa    = (mensagens > 0))
       AND (v_transcricao IS NULL OR v_transcricao = (transcricoes > 0))
     ORDER BY ultima_interacao DESC NULLS LAST
     LIMIT v_lim
  )
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
      'negocio_id', f.negocio_id, 'cliente', f.cliente, 'corretor', f.corretor,
      'corretor_id', f.corretor_id, 'etapa_antiga', f.etapa_antiga, 'origem', f.origem_lead,
      'ultima_interacao', f.ultima_interacao,
      'mensagens', f.mensagens, 'respondeu', (f.recebidas > 0),
      'tem_conversa', (f.mensagens > 0), 'tem_transcricao', (f.transcricoes > 0),
      'audios_sem_transcricao', f.audios_sem_transcricao,
      'ja_migrado', EXISTS (SELECT 1 FROM public.ncrm_migracao_item mi WHERE mi.negocio_id = f.negocio_id AND mi.ativo),
      'analise', CASE WHEN a.negocio_id IS NULL THEN NULL ELSE jsonb_build_object(
          'resumo', a.resumo, 'etapa_sugerida', a.etapa_sugerida, 'temperatura', a.temperatura_sugerida,
          'risco', a.risco, 'proxima_acao', a.proxima_acao_sugerida, 'prazo', a.prazo_sugerido,
          'justificativa', a.justificativa, 'evidencias', a.evidencias, 'confianca', a.confianca,
          'contexto_qualidade', a.contexto_qualidade, 'evidencia_insuficiente', a.evidencia_insuficiente,
          'versao_modelo', a.versao_modelo, 'analisado_em', a.analisado_em) END
    ) ORDER BY f.ultima_interacao DESC NULLS LAST), '[]'::jsonb)
    INTO v_itens
    FROM filtrado f
    LEFT JOIN public.ncrm_migracao_analise a ON a.negocio_id = f.negocio_id;

  RETURN jsonb_build_object('ok',true,'limite',v_lim,'somente_leitura',true,'itens',v_itens);
END $fn$;
REVOKE ALL ON FUNCTION public.ncrm_migracao_preview(jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ncrm_migracao_preview(jsonb) TO authenticated;

-- Contexto textual (somente leitura) usado para pedir a leitura da Sara. Máximo 10 negócios.
CREATE FUNCTION public.ncrm_migracao_contexto(p_ids bigint[])
  RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $fn$
DECLARE v_uid uuid := auth.uid(); v_out jsonb;
BEGIN
  IF v_uid IS NULL THEN RETURN jsonb_build_object('ok',false,'erro','nao_autenticado'); END IF;
  IF COALESCE(public.can_manage_all(), false) IS NOT TRUE THEN RETURN jsonb_build_object('ok',false,'erro','sem_permissao'); END IF;
  IF p_ids IS NULL OR array_length(p_ids,1) IS NULL THEN RETURN jsonb_build_object('ok',false,'erro','sem_itens'); END IF;
  IF array_length(p_ids,1) > 10 THEN RETURN jsonb_build_object('ok',false,'erro','limite_10'); END IF;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
      'negocio_id', n.id, 'cliente', l.nome,
      'etapa_antiga', COALESCE(s.rotulo, s.nome, '—'),
      'criado_em', n.criado_em, 'ultima_interacao', GREATEST(n.ultima_movimentacao, n.criado_em),
      'mensagens', COALESCE((
        SELECT jsonb_agg(jsonb_build_object('de', CASE WHEN lower(coalesce(m.direcao,'')) = ANY (ARRAY['recebida','entrada','in','inbound','received']) THEN 'cliente' ELSE 'corretor' END,
                                            'em', m.criado_em,
                                            'texto', left(COALESCE(NULLIF(btrim(m.conteudo),''), m.transcricao, '[' || COALESCE(m.tipo,'midia') || ']'), 600))
                         ORDER BY m.criado_em)
          FROM (SELECT m2.* FROM public.wa_contatos ct
                  JOIN public.wa_conversas cv ON cv.contato_id = ct.id
                  JOIN public.wa_mensagens m2 ON m2.conversa_id = cv.id
                 WHERE ct.lead_id = l.id AND NOT COALESCE(m2.is_grupo,false)
                 ORDER BY m2.criado_em DESC LIMIT 40) m), '[]'::jsonb)
    )), '[]'::jsonb) INTO v_out
    FROM public.negocios n
    JOIN public.leads l ON l.id = n.lead_id
    LEFT JOIN public.pipeline_stages s ON s.id = n.stage_id
   WHERE n.id = ANY (p_ids) AND n.status = 'aberto'
     AND NOT EXISTS (SELECT 1 FROM public.ncrm_estado e WHERE e.negocio_id = n.id);

  RETURN jsonb_build_object('ok',true,'itens',v_out);
END $fn$;
REVOKE ALL ON FUNCTION public.ncrm_migracao_contexto(bigint[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ncrm_migracao_contexto(bigint[]) TO authenticated;

-- Registro idempotente da leitura da Sara (observação apenas). Não altera nada operacional.
CREATE FUNCTION public.ncrm_migracao_registrar_analise(p_analise jsonb)
  RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $fn$
DECLARE v_uid uuid := auth.uid(); v_neg bigint; v_hash text; v_ev jsonb; v_insuf boolean; v_qual text;
BEGIN
  IF v_uid IS NULL THEN RETURN jsonb_build_object('ok',false,'erro','nao_autenticado'); END IF;
  IF COALESCE(public.can_manage_all(), false) IS NOT TRUE THEN RETURN jsonb_build_object('ok',false,'erro','sem_permissao'); END IF;
  v_neg  := NULLIF(p_analise->>'negocio_id','')::bigint;
  v_hash := NULLIF(btrim(COALESCE(p_analise->>'context_hash','')), '');
  IF v_neg IS NULL OR v_hash IS NULL OR length(v_hash) < 4 THEN RETURN jsonb_build_object('ok',false,'erro','payload_invalido'); END IF;
  IF EXISTS (SELECT 1 FROM public.ncrm_estado e WHERE e.negocio_id = v_neg) THEN RETURN jsonb_build_object('ok',false,'erro','ja_no_crm_nova_era'); END IF;
  v_ev := COALESCE(p_analise->'evidencias', '[]'::jsonb);
  IF jsonb_typeof(v_ev) <> 'array' THEN v_ev := '[]'::jsonb; END IF;
  IF jsonb_array_length(v_ev) > 30 THEN v_ev := (SELECT jsonb_agg(x) FROM (SELECT x FROM jsonb_array_elements(v_ev) x LIMIT 30) t); END IF;
  v_qual  := COALESCE(NULLIF(p_analise->>'contexto_qualidade',''), 'insuficiente');
  IF v_qual NOT IN ('insuficiente','parcial','boa') THEN v_qual := 'insuficiente'; END IF;
  v_insuf := (v_qual = 'insuficiente') OR jsonb_array_length(v_ev) = 0 OR (p_analise->>'etapa_sugerida') IS NULL;

  INSERT INTO public.ncrm_migracao_analise (negocio_id, context_hash, resumo, etapa_sugerida, temperatura_sugerida,
      risco, proxima_acao_sugerida, prazo_sugerido, justificativa, evidencias, confianca,
      contexto_qualidade, evidencia_insuficiente, versao_modelo, versao_prompt, criado_por)
  VALUES (v_neg, v_hash, left(NULLIF(p_analise->>'resumo',''),1200), NULLIF(p_analise->>'etapa_sugerida',''),
      NULLIF(p_analise->>'temperatura',''), NULLIF(p_analise->>'risco',''),
      left(NULLIF(p_analise->>'proxima_acao',''),400), NULLIF(p_analise->>'prazo','')::timestamptz,
      left(NULLIF(p_analise->>'justificativa',''),1200), v_ev, NULLIF(p_analise->>'confianca','')::numeric,
      v_qual, v_insuf, NULLIF(p_analise->>'versao_modelo',''), NULLIF(p_analise->>'versao_prompt',''), v_uid)
  ON CONFLICT (negocio_id) DO UPDATE SET
      context_hash = EXCLUDED.context_hash, resumo = EXCLUDED.resumo, etapa_sugerida = EXCLUDED.etapa_sugerida,
      temperatura_sugerida = EXCLUDED.temperatura_sugerida, risco = EXCLUDED.risco,
      proxima_acao_sugerida = EXCLUDED.proxima_acao_sugerida, prazo_sugerido = EXCLUDED.prazo_sugerido,
      justificativa = EXCLUDED.justificativa, evidencias = EXCLUDED.evidencias, confianca = EXCLUDED.confianca,
      contexto_qualidade = EXCLUDED.contexto_qualidade, evidencia_insuficiente = EXCLUDED.evidencia_insuficiente,
      versao_modelo = EXCLUDED.versao_modelo, versao_prompt = EXCLUDED.versao_prompt,
      analisado_em = now(), criado_por = v_uid
    WHERE public.ncrm_migracao_analise.context_hash IS DISTINCT FROM EXCLUDED.context_hash;

  RETURN jsonb_build_object('ok',true,'negocio_id',v_neg,'evidencia_insuficiente',v_insuf);
END $fn$;
REVOKE ALL ON FUNCTION public.ncrm_migracao_registrar_analise(jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ncrm_migracao_registrar_analise(jsonb) TO authenticated;

-- APROVAÇÃO INDIVIDUAL — um negócio por chamada, com confirmação textual obrigatória.
-- Não remove do CRM antigo, não move o pipe antigo, não envia mensagem, não cria visita/proposta/venda.
CREATE FUNCTION public.ncrm_migracao_aprovar(
    p_negocio_id bigint, p_etapa text, p_proxima_acao_tipo text, p_proxima_acao_titulo text,
    p_prazo timestamptz, p_confirmacao text)
  RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $fn$
DECLARE v_uid uuid := auth.uid(); v_wf bigint; v_corretor bigint; v_lead bigint; v_a public.ncrm_migracao_analise%ROWTYPE;
BEGIN
  IF v_uid IS NULL THEN RETURN jsonb_build_object('ok',false,'erro','nao_autenticado'); END IF;
  IF COALESCE(public.can_manage_all(), false) IS NOT TRUE THEN RETURN jsonb_build_object('ok',false,'erro','sem_permissao'); END IF;
  IF upper(btrim(COALESCE(p_confirmacao,''))) <> 'MIGRAR' THEN RETURN jsonb_build_object('ok',false,'erro','confirmacao_obrigatoria'); END IF;
  IF p_etapa IS NULL OR p_etapa NOT IN ('novo','tentando_contato','em_atendimento','em_acompanhamento')
    THEN RETURN jsonb_build_object('ok',false,'erro','etapa_invalida'); END IF;
  IF p_proxima_acao_tipo IS NULL OR p_proxima_acao_tipo NOT IN ('tentativa_cadencia','retornar_contato','entender_necessidade',
      'enviar_opcoes','confirmar_recebimento','ligar_retorno','solicitar_documentacao','agendar_visita','preparar_proposta',
      'corrigir_cadastro','avaliar_descarte','outro')
    THEN RETURN jsonb_build_object('ok',false,'erro','proxima_acao_invalida'); END IF;
  IF NULLIF(btrim(COALESCE(p_proxima_acao_titulo,'')),'') IS NULL THEN RETURN jsonb_build_object('ok',false,'erro','proxima_acao_sem_titulo'); END IF;
  IF p_prazo IS NULL THEN RETURN jsonb_build_object('ok',false,'erro','prazo_obrigatorio'); END IF;

  SELECT corretor_id, lead_id INTO v_corretor, v_lead FROM public.negocios WHERE id = p_negocio_id AND status = 'aberto' FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok',false,'erro','negocio_invalido'); END IF;
  IF EXISTS (SELECT 1 FROM public.ncrm_estado WHERE negocio_id = p_negocio_id) THEN RETURN jsonb_build_object('ok',false,'erro','ja_existe_atendimento'); END IF;

  SELECT id INTO v_wf FROM public.ncrm_workflow_config WHERE status = 'publicada' ORDER BY versao DESC LIMIT 1;
  IF v_wf IS NULL THEN SELECT id INTO v_wf FROM public.ncrm_workflow_config ORDER BY id DESC LIMIT 1; END IF;
  IF v_wf IS NULL THEN RETURN jsonb_build_object('ok',false,'erro','sem_workflow'); END IF;

  SELECT * INTO v_a FROM public.ncrm_migracao_analise WHERE negocio_id = p_negocio_id;

  INSERT INTO public.ncrm_estado (negocio_id, workflow_config_id, etapa, proxima_acao_tipo, proxima_acao_titulo,
      proxima_acao_em, temperatura, ultima_interacao_em, origem_ultima, atualizado_por)
  VALUES (p_negocio_id, v_wf, p_etapa, p_proxima_acao_tipo, btrim(p_proxima_acao_titulo), p_prazo,
      v_a.temperatura_sugerida, now(), 'migracao', v_uid)
  ON CONFLICT (negocio_id) DO NOTHING;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok',false,'erro','ja_existe_atendimento'); END IF;

  INSERT INTO public.ncrm_migracao_item (negocio_id, analise, etapa_sugerida, etapa_aprovada,
      proxima_acao_sugerida, proxima_acao_aprovada, prazo_aprovado, workflow_config_id,
      versao_analise, responsavel_id, aprovado_por)
  VALUES (p_negocio_id, COALESCE(to_jsonb(v_a), '{}'::jsonb), v_a.etapa_sugerida, p_etapa,
      v_a.proxima_acao_sugerida, btrim(p_proxima_acao_titulo), p_prazo, v_wf,
      v_a.versao_modelo, v_corretor, v_uid)
  ON CONFLICT (negocio_id) DO UPDATE SET ativo = true, aprovado_por = v_uid, aprovado_em = now(),
      etapa_aprovada = EXCLUDED.etapa_aprovada, proxima_acao_aprovada = EXCLUDED.proxima_acao_aprovada,
      prazo_aprovado = EXCLUDED.prazo_aprovado, desativado_por = NULL, desativado_em = NULL;

  INSERT INTO public.ncrm_evento (negocio_id, lead_id, workflow_config_id, tipo, resultado, origem, executado_por,
      corretor_id_no_evento, idempotency_key, payload)
  VALUES (p_negocio_id, v_lead, v_wf, 'mudanca_etapa', 'ok', 'migracao', v_uid, v_corretor,
      'migracao_assistida:' || p_negocio_id::text,
      jsonb_build_object('acao','migracao_assistida','etapa_sugerida', v_a.etapa_sugerida,
                         'etapa_aprovada', p_etapa, 'aprovador', v_uid,
                         'versao_analise', v_a.versao_modelo, 'confianca', v_a.confianca))
  ON CONFLICT DO NOTHING;

  RETURN jsonb_build_object('ok',true,'negocio_id',p_negocio_id,'etapa',p_etapa);
END $fn$;
REVOKE ALL ON FUNCTION public.ncrm_migracao_aprovar(bigint,text,text,text,timestamptz,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ncrm_migracao_aprovar(bigint,text,text,text,timestamptz,text) TO authenticated;

-- ROLLBACK LÓGICO individual: remove o atendimento do CRM Nova Era e desativa o item,
-- preservando auditoria. O negócio no CRM antigo permanece intacto.
CREATE FUNCTION public.ncrm_migracao_rollback(p_negocio_id bigint)
  RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $fn$
DECLARE v_uid uuid := auth.uid(); v_saida text; v_ver int;
BEGIN
  IF v_uid IS NULL THEN RETURN jsonb_build_object('ok',false,'erro','nao_autenticado'); END IF;
  IF COALESCE(public.can_manage_all(), false) IS NOT TRUE THEN RETURN jsonb_build_object('ok',false,'erro','sem_permissao'); END IF;
  IF NOT EXISTS (SELECT 1 FROM public.ncrm_migracao_item WHERE negocio_id = p_negocio_id AND ativo)
    THEN RETURN jsonb_build_object('ok',false,'erro','nao_migrado'); END IF;
  SELECT saida, versao INTO v_saida, v_ver FROM public.ncrm_estado WHERE negocio_id = p_negocio_id FOR UPDATE;
  IF v_saida IS NOT NULL THEN RETURN jsonb_build_object('ok',false,'erro','atendimento_com_saida'); END IF;
  IF COALESCE(v_ver,1) > 1 THEN RETURN jsonb_build_object('ok',false,'erro','atendimento_ja_trabalhado'); END IF;
  DELETE FROM public.ncrm_estado WHERE negocio_id = p_negocio_id;
  UPDATE public.ncrm_migracao_item SET ativo = false, desativado_por = v_uid, desativado_em = now()
   WHERE negocio_id = p_negocio_id;
  RETURN jsonb_build_object('ok',true,'negocio_id',p_negocio_id);
END $fn$;
REVOKE ALL ON FUNCTION public.ncrm_migracao_rollback(bigint) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ncrm_migracao_rollback(bigint) TO authenticated;

-- ==================== 3. SAÚDE DO CRM NOVA ERA (monitoramento admin) ====================
-- Auditoria das ações administrativas seguras executadas no painel de saúde.
CREATE TABLE public.ncrm_saude_acao_audit (
  id            bigserial PRIMARY KEY,
  acao          text NOT NULL CHECK (acao IN ('reprocessar_item','retentar_analise','desligar_runner',
                                              'desligar_entrada','religar_runner_observador','atualizar_diagnostico')),
  alvo          text NULL CHECK (alvo IS NULL OR length(alvo) <= 120),
  resultado     text NOT NULL CHECK (resultado IN ('ok','ignorado','erro')),
  detalhe       text NULL CHECK (detalhe IS NULL OR length(detalhe) <= 400),
  executado_por uuid NOT NULL REFERENCES public.usuarios(id),
  criado_em     timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ix_ncrm_saude_acao_audit_em ON public.ncrm_saude_acao_audit (criado_em DESC);
REVOKE ALL ON public.ncrm_saude_acao_audit FROM PUBLIC, anon, authenticated;
REVOKE ALL ON SEQUENCE public.ncrm_saude_acao_audit_id_seq FROM PUBLIC, anon, authenticated;
ALTER TABLE public.ncrm_saude_acao_audit ENABLE ROW LEVEL SECURITY;

-- Diagnóstico consolidado. Somente leitura. Custo só aparece quando houver fonte confiável.
CREATE FUNCTION public.ncrm_saude()
  RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $fn$
DECLARE v_uid uuid := auth.uid(); v_ing jsonb; v_sara jsonb; v_qual jsonb; v_cron jsonb; v_wa jsonb;
BEGIN
  IF v_uid IS NULL THEN RETURN jsonb_build_object('ok',false,'erro','nao_autenticado'); END IF;
  IF COALESCE(public.can_manage_all(), false) IS NOT TRUE THEN RETURN jsonb_build_object('ok',false,'erro','sem_permissao'); END IF;

  -- Entrada de conversas
  SELECT jsonb_build_object(
    'ligada',  COALESCE((SELECT ativo FROM public.ncrm_ingest_config WHERE id), false),
    'desde',   (SELECT ativo_desde FROM public.ncrm_ingest_config WHERE id),
    'fila',    (SELECT count(*) FROM public.ncrm_ingest_checkpoint WHERE status = 'pendente'),
    'erros',   (SELECT count(*) FROM public.ncrm_ingest_checkpoint WHERE status = 'erro'),
    'reprocessaveis', (SELECT count(*) FROM public.ncrm_ingest_checkpoint WHERE status IN ('pendente','erro') AND tentativas >= 1),
    'ultimo_processado_em', (SELECT max(processado_em) FROM public.ncrm_ingest_checkpoint),
    'ultimo_erro', (SELECT ultimo_erro FROM public.ncrm_ingest_checkpoint WHERE ultimo_erro IS NOT NULL ORDER BY atualizado_em DESC LIMIT 1),
    'volume_24h', (SELECT count(*) FROM public.ncrm_ingest_checkpoint WHERE criado_em > now() - interval '24 hours')
  ) INTO v_ing;

  -- Leitura da Sara
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

  -- Qualidade dos dados
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

  -- Rotinas automáticas
  BEGIN
    EXECUTE $q$SELECT COALESCE(jsonb_agg(jsonb_build_object('nome', jobname, 'periodicidade', schedule, 'ligada', active)), '[]'::jsonb)
               FROM cron.job WHERE jobname LIKE 'ncrm%'$q$ INTO v_cron;
  EXCEPTION WHEN OTHERS THEN v_cron := '[]'::jsonb;
  END;

  -- Canais de WhatsApp (leitura apenas — nenhuma ação é oferecida aqui)
  SELECT COALESCE(jsonb_agg(jsonb_build_object('rotulo', COALESCE(rotulo, session_id), 'status', status,
           'ultimo_sinal', ultimo_heartbeat) ORDER BY COALESCE(rotulo, session_id)), '[]'::jsonb)
    INTO v_wa FROM public.wa_instancias;

  RETURN jsonb_build_object('ok',true,'gerado_em',now(),'entrada',v_ing,'sara',v_sara,
                            'qualidade',v_qual,'rotinas',v_cron,'canais',v_wa,
                            'acoes', COALESCE((SELECT jsonb_agg(jsonb_build_object('acao',acao,'alvo',alvo,
                                'resultado',resultado,'detalhe',detalhe,'em',criado_em) ORDER BY criado_em DESC)
                              FROM (SELECT * FROM public.ncrm_saude_acao_audit ORDER BY criado_em DESC LIMIT 20) a), '[]'::jsonb));
END $fn$;
REVOKE ALL ON FUNCTION public.ncrm_saude() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ncrm_saude() TO authenticated;

-- Ações administrativas SEGURAS. Nenhuma delas envia mensagem, cria visita/proposta,
-- altera venda, altera o CRM antigo ou liga a Sara em modo de execução.
CREATE FUNCTION public.ncrm_saude_acao(p_acao text, p_alvo text DEFAULT NULL, p_confirmacao text DEFAULT NULL)
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
    UPDATE public.ncrm_ingest_checkpoint SET status = 'pendente', ultimo_erro = NULL, atualizado_em = now()
     WHERE wa_message_id = p_alvo AND status = 'erro';
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
REVOKE ALL ON FUNCTION public.ncrm_saude_acao(text,text,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ncrm_saude_acao(text,text,text) TO authenticated;
