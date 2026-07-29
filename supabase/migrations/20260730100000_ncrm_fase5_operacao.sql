-- CRM Nova Era — FASE 5 (PR A): cadência configurável, fila de trabalho, aderência e gestão.
-- ---------------------------------------------------------------------------
-- ADITIVA: só objetos ncrm_*. Nenhum disparo automático novo; o sistema RECOMENDA e
-- FISCALIZA — mensagens externas continuam humanas ou pelas automações já existentes.
-- Colunas do quadro permanecem as 4 etapas; a cadência vive em estado/eventos/config.

-- ============================ 1. CONFIGURAÇÃO ADMINISTRATIVA ============================
CREATE TABLE public.ncrm_cadencia_config (
  id              boolean PRIMARY KEY DEFAULT true,
  max_tentativas  integer NOT NULL DEFAULT 5 CHECK (max_tentativas BETWEEN 1 AND 12),
  -- intervalos em minutos a partir do marco anterior (contrato do PLANO_CADENCIA_OFICIAL)
  intervalos_min  jsonb   NOT NULL DEFAULT '[15, 120, 1440, 2880, 5760]'::jsonb,
  dias_uteis      int[]   NOT NULL DEFAULT '{1,2,3,4,5}',      -- ISO: 1=segunda … 7=domingo
  hora_inicio     smallint NOT NULL DEFAULT 9  CHECK (hora_inicio BETWEEN 0 AND 23),
  hora_fim        smallint NOT NULL DEFAULT 19 CHECK (hora_fim BETWEEN 1 AND 24),
  tolerancia_min  integer NOT NULL DEFAULT 15 CHECK (tolerancia_min BETWEEN 0 AND 240),
  escalonar_apos_horas integer NOT NULL DEFAULT 24 CHECK (escalonar_apos_horas BETWEEN 1 AND 168),
  atualizado_em   timestamptz NOT NULL DEFAULT now(),
  atualizado_por  uuid NULL,
  CONSTRAINT ck_ncrm_cad_cfg_singleton CHECK (id = true),
  CONSTRAINT ck_ncrm_cad_cfg_janela CHECK (hora_fim > hora_inicio)
);
INSERT INTO public.ncrm_cadencia_config (id) VALUES (true) ON CONFLICT (id) DO NOTHING;
REVOKE ALL ON public.ncrm_cadencia_config FROM PUBLIC, anon, authenticated;
ALTER TABLE public.ncrm_cadencia_config ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.ncrm_cadencia_config_audit (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  alteracao jsonb NOT NULL, criado_por uuid NOT NULL, criado_em timestamptz NOT NULL DEFAULT now()
);
REVOKE ALL ON public.ncrm_cadencia_config_audit FROM PUBLIC, anon, authenticated;
ALTER TABLE public.ncrm_cadencia_config_audit ENABLE ROW LEVEL SECURITY;

CREATE FUNCTION public.ncrm_cadencia_config_get()
  RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $fn$
DECLARE v record;
BEGIN
  IF auth.uid() IS NULL THEN RETURN jsonb_build_object('ok',false,'erro','nao_autenticado'); END IF;
  SELECT * INTO v FROM public.ncrm_cadencia_config WHERE id = true;
  RETURN jsonb_build_object('ok',true,'max_tentativas',v.max_tentativas,'intervalos_min',v.intervalos_min,
    'dias_uteis',to_jsonb(v.dias_uteis),'hora_inicio',v.hora_inicio,'hora_fim',v.hora_fim,
    'tolerancia_min',v.tolerancia_min,'escalonar_apos_horas',v.escalonar_apos_horas,'atualizado_em',v.atualizado_em);
END $fn$;
REVOKE ALL ON FUNCTION public.ncrm_cadencia_config_get() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ncrm_cadencia_config_get() TO authenticated;

CREATE FUNCTION public.ncrm_cadencia_config_set(p jsonb)
  RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $fn$
DECLARE v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL THEN RETURN jsonb_build_object('ok',false,'erro','nao_autenticado'); END IF;
  IF COALESCE(public.can_manage_all(), false) IS NOT TRUE THEN RETURN jsonb_build_object('ok',false,'erro','sem_permissao'); END IF;
  UPDATE public.ncrm_cadencia_config SET
    max_tentativas = COALESCE((p->>'max_tentativas')::int, max_tentativas),
    intervalos_min = COALESCE(p->'intervalos_min', intervalos_min),
    dias_uteis     = COALESCE((SELECT array_agg(x::int) FROM jsonb_array_elements_text(p->'dias_uteis') x), dias_uteis),
    hora_inicio    = COALESCE((p->>'hora_inicio')::smallint, hora_inicio),
    hora_fim       = COALESCE((p->>'hora_fim')::smallint, hora_fim),
    tolerancia_min = COALESCE((p->>'tolerancia_min')::int, tolerancia_min),
    escalonar_apos_horas = COALESCE((p->>'escalonar_apos_horas')::int, escalonar_apos_horas),
    atualizado_em = now(), atualizado_por = v_uid
  WHERE id = true;
  INSERT INTO public.ncrm_cadencia_config_audit (alteracao, criado_por) VALUES (p, v_uid);
  RETURN public.ncrm_cadencia_config_get();
END $fn$;
REVOKE ALL ON FUNCTION public.ncrm_cadencia_config_set(jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ncrm_cadencia_config_set(jsonb) TO authenticated;

-- ============================ 2. JANELA COMERCIAL (America/Sao_Paulo) ============================
-- Ajusta um prazo para DENTRO da janela comercial configurada (fim de semana/fora de hora =>
-- próxima abertura). Determinístico e puro em relação à config.
CREATE FUNCTION ncrm_private.ajustar_para_janela(p_quando timestamptz)
  RETURNS timestamptz LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $fn$
DECLARE cfg record; v_local timestamp; v_dow int; v_guard int := 0;
BEGIN
  SELECT * INTO cfg FROM public.ncrm_cadencia_config WHERE id = true;
  IF cfg IS NULL THEN RETURN p_quando; END IF;
  v_local := p_quando AT TIME ZONE 'America/Sao_Paulo';
  LOOP
    v_guard := v_guard + 1; EXIT WHEN v_guard > 14;
    v_dow := EXTRACT(isodow FROM v_local)::int;
    IF NOT (v_dow = ANY (cfg.dias_uteis)) THEN
      v_local := date_trunc('day', v_local) + interval '1 day' + make_interval(hours => cfg.hora_inicio);
      CONTINUE;
    END IF;
    IF EXTRACT(hour FROM v_local) < cfg.hora_inicio THEN
      v_local := date_trunc('day', v_local) + make_interval(hours => cfg.hora_inicio);
      EXIT;
    ELSIF EXTRACT(hour FROM v_local) >= cfg.hora_fim THEN
      v_local := date_trunc('day', v_local) + interval '1 day' + make_interval(hours => cfg.hora_inicio);
      CONTINUE;
    ELSE
      EXIT;
    END IF;
  END LOOP;
  RETURN v_local AT TIME ZONE 'America/Sao_Paulo';
END $fn$;
REVOKE ALL ON FUNCTION ncrm_private.ajustar_para_janela(timestamptz) FROM PUBLIC;

-- ============================ 3. JUSTIFICATIVAS (fiscalização sem punição) ============================
CREATE TABLE public.ncrm_justificativa (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  negocio_id bigint NOT NULL REFERENCES public.negocios(id),
  tipo text NOT NULL DEFAULT 'acao_vencida' CHECK (tipo IN ('acao_vencida','cadencia_vencida','compromisso_nao_cumprido')),
  justificativa text NOT NULL CHECK (length(btrim(justificativa)) BETWEEN 5 AND 1000),
  contexto jsonb NOT NULL DEFAULT '{}'::jsonb,
  criado_por uuid NOT NULL,
  criado_em timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ix_ncrm_justificativa_negocio ON public.ncrm_justificativa (negocio_id, criado_em DESC);
REVOKE ALL ON public.ncrm_justificativa FROM PUBLIC, anon, authenticated;
ALTER TABLE public.ncrm_justificativa ENABLE ROW LEVEL SECURITY;

CREATE FUNCTION public.ncrm_justificar_atraso(p_negocio_id bigint, p_tipo text, p_texto text)
  RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $fn$
DECLARE v_uid uuid := auth.uid(); v_id bigint; v_est record;
BEGIN
  IF v_uid IS NULL THEN RETURN jsonb_build_object('ok',false,'erro','nao_autenticado'); END IF;
  IF ncrm_private.pode_operar_negocio(p_negocio_id) IS NOT TRUE THEN RETURN jsonb_build_object('ok',false,'erro','sem_permissao'); END IF;
  IF p_tipo IS NULL OR p_tipo NOT IN ('acao_vencida','cadencia_vencida','compromisso_nao_cumprido') THEN RETURN jsonb_build_object('ok',false,'erro','tipo_invalido'); END IF;
  IF p_texto IS NULL OR length(btrim(p_texto)) NOT BETWEEN 5 AND 1000 THEN RETURN jsonb_build_object('ok',false,'erro','justificativa_invalida'); END IF;
  SELECT proxima_acao_tipo, proxima_acao_em INTO v_est FROM public.ncrm_estado WHERE negocio_id = p_negocio_id;
  INSERT INTO public.ncrm_justificativa (negocio_id, tipo, justificativa, contexto, criado_por)
  VALUES (p_negocio_id, p_tipo, btrim(p_texto),
          jsonb_build_object('proxima_acao_tipo', v_est.proxima_acao_tipo, 'proxima_acao_em', v_est.proxima_acao_em),
          v_uid)
  RETURNING id INTO v_id;
  RETURN jsonb_build_object('ok',true,'justificativa_id',v_id);
END $fn$;
REVOKE ALL ON FUNCTION public.ncrm_justificar_atraso(bigint,text,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ncrm_justificar_atraso(bigint,text,text) TO authenticated;

-- ============================ 4. FILA DE TRABALHO (server-side, por carteira/papel) ============================
-- "O que eu preciso fazer agora?" — prioridades:
--  1 cliente respondeu aguardando corretor · 2 novo sem primeira atuação · 3 próxima ação vencida
--  4 promessa de retorno vencendo · 5 cadência vencida · 6 sem próxima ação · 7 acompanhamentos futuros
CREATE FUNCTION public.ncrm_fila_trabalho(p_filtro text DEFAULT 'agora', p_corretor bigint DEFAULT NULL, p_limite int DEFAULT 100)
  RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $fn$
DECLARE v_uid uuid := auth.uid(); v_lim int := LEAST(GREATEST(COALESCE(p_limite,100),1),300);
        v_admin boolean; v_broker bigint; v_tol int; v_itens jsonb;
BEGIN
  IF v_uid IS NULL THEN RETURN jsonb_build_object('ok',false,'erro','nao_autenticado'); END IF;
  v_admin := COALESCE(public.can_manage_all(), false);
  v_broker := public.current_broker_id();
  SELECT tolerancia_min INTO v_tol FROM public.ncrm_cadencia_config WHERE id = true;
  v_tol := COALESCE(v_tol, 15);

  SELECT COALESCE(jsonb_agg(item ORDER BY (item->>'prioridade')::int, (item->>'espera_min')::numeric DESC), '[]'::jsonb)
    INTO v_itens
  FROM (
    SELECT item FROM (
    SELECT jsonb_build_object(
      'negocio_id', e.negocio_id,
      'lead_nome', l.nome,
      'etapa', e.etapa,
      'temperatura', e.temperatura,
      'corretor_id', n.corretor_id,
      'corretor_nome', COALESCE(u.nome, '—'),
      'proxima_acao_titulo', e.proxima_acao_titulo,
      'proxima_acao_em', e.proxima_acao_em,
      'respondeu', e.respondeu,
      'prioridade',
        CASE
          WHEN e.resposta_pendente THEN 1
          WHEN e.etapa = 'novo' AND e.tentativas_feitas = 0 AND NOT e.respondeu THEN 2
          WHEN e.proxima_acao_em IS NOT NULL AND e.proxima_acao_em < now()
               AND e.proxima_acao_tipo = 'tentativa_cadencia' THEN 5
          WHEN e.proxima_acao_em IS NOT NULL AND e.proxima_acao_em < now() THEN 3
          WHEN e.proxima_acao_tipo IN ('retornar_contato','ligar_retorno')
               AND e.proxima_acao_em IS NOT NULL
               AND e.proxima_acao_em < now() + make_interval(mins => v_tol) THEN 4
          WHEN e.proxima_acao_em IS NULL THEN 6
          ELSE 7
        END,
      'motivo',
        CASE
          WHEN e.resposta_pendente THEN 'Cliente respondeu — aguardando você'
          WHEN e.etapa = 'novo' AND e.tentativas_feitas = 0 AND NOT e.respondeu THEN 'Lead novo sem primeira atuação'
          WHEN e.proxima_acao_em IS NOT NULL AND e.proxima_acao_em < now()
               AND e.proxima_acao_tipo = 'tentativa_cadencia' THEN 'Cadência vencida'
          WHEN e.proxima_acao_em IS NOT NULL AND e.proxima_acao_em < now() THEN 'Próxima ação vencida'
          WHEN e.proxima_acao_tipo IN ('retornar_contato','ligar_retorno')
               AND e.proxima_acao_em < now() + make_interval(mins => v_tol) THEN 'Promessa de retorno vencendo'
          WHEN e.proxima_acao_em IS NULL THEN 'Sem próxima ação definida'
          ELSE 'Acompanhamento futuro'
        END,
      'espera_min', GREATEST(0, EXTRACT(epoch FROM (now() - COALESCE(
          CASE WHEN e.resposta_pendente THEN e.ultima_interacao_em END,
          e.proxima_acao_em, e.ultima_interacao_em, now()))) / 60)::numeric(12,1)
    ) AS item
    FROM public.ncrm_estado e
    JOIN public.negocios n ON n.id = e.negocio_id
    JOIN public.leads l ON l.id = n.lead_id
    LEFT JOIN public.corretores c ON c.id = n.corretor_id
    LEFT JOIN public.usuarios u ON u.id = c.usuario_id
    WHERE e.saida IS NULL
      AND (v_admin OR n.corretor_id = v_broker OR COALESCE(public.manages_broker(n.corretor_id), false))
      AND (p_corretor IS NULL OR n.corretor_id = p_corretor)
      AND (
        p_filtro IS NULL OR p_filtro = 'agora' OR
        (p_filtro = 'vencidos'     AND e.proxima_acao_em IS NOT NULL AND e.proxima_acao_em < now()) OR
        (p_filtro = 'hoje'         AND e.proxima_acao_em IS NOT NULL AND (e.proxima_acao_em AT TIME ZONE 'America/Sao_Paulo')::date = (now() AT TIME ZONE 'America/Sao_Paulo')::date) OR
        (p_filtro = 'proximos'     AND e.proxima_acao_em IS NOT NULL AND e.proxima_acao_em > now()) OR
        (p_filtro = 'respondeu'    AND e.respondeu) OR
        (p_filtro = 'sem_resposta' AND NOT e.respondeu) OR
        (p_filtro = 'risco'        AND e.proxima_acao_em IS NOT NULL AND e.proxima_acao_em < now() - interval '24 hours') OR
        (p_filtro = 'quente'       AND e.temperatura IN ('quente','negociando'))
      )
  ) semlimite
    ORDER BY (item->>'prioridade')::int, (item->>'espera_min')::numeric DESC
    LIMIT v_lim
  ) t;
  RETURN jsonb_build_object('ok',true,'itens',v_itens);
END $fn$;
REVOKE ALL ON FUNCTION public.ncrm_fila_trabalho(text,bigint,int) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ncrm_fila_trabalho(text,bigint,int) TO authenticated;

-- ============================ 5. ADERÊNCIA E PAINEL DE GESTÃO ============================
CREATE FUNCTION public.ncrm_gestao_painel()
  RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $fn$
DECLARE v_uid uuid := auth.uid(); v_admin boolean; v_esc int; v_corretores jsonb; v_tot jsonb;
BEGIN
  IF v_uid IS NULL THEN RETURN jsonb_build_object('ok',false,'erro','nao_autenticado'); END IF;
  v_admin := COALESCE(public.can_manage_all(), false);
  SELECT escalonar_apos_horas INTO v_esc FROM public.ncrm_cadencia_config WHERE id = true;
  v_esc := COALESCE(v_esc, 24);

  SELECT COALESCE(jsonb_agg(linha ORDER BY (linha->>'atrasados')::int DESC), '[]'::jsonb) INTO v_corretores
  FROM (
    SELECT jsonb_build_object(
      'corretor_id', n.corretor_id,
      'corretor_nome', COALESCE(max(u.nome), '—'),
      'carteira_ativa', count(*) FILTER (WHERE e.saida IS NULL),
      'novos', count(*) FILTER (WHERE e.etapa = 'novo' AND e.saida IS NULL),
      'respondidos', count(*) FILTER (WHERE e.respondeu AND e.saida IS NULL),
      'aguardando_corretor', count(*) FILTER (WHERE e.resposta_pendente AND e.saida IS NULL),
      'atrasados', count(*) FILTER (WHERE e.saida IS NULL AND e.proxima_acao_em IS NOT NULL AND e.proxima_acao_em < now()),
      'sem_proxima_acao', count(*) FILTER (WHERE e.saida IS NULL AND e.proxima_acao_em IS NULL),
      'escalar', count(*) FILTER (WHERE e.saida IS NULL AND e.proxima_acao_em IS NOT NULL AND e.proxima_acao_em < now() - make_interval(hours => v_esc)),
      'visitas', count(*) FILTER (WHERE e.saida = 'pipeline_visitas'),
      'propostas', count(*) FILTER (WHERE e.saida = 'esteira_vendas'),
      'sla_min_medio', COALESCE(avg(EXTRACT(epoch FROM (e.primeira_resposta_em - e.msg_automatica_em))/60) FILTER (WHERE e.primeira_resposta_em IS NOT NULL AND e.msg_automatica_em IS NOT NULL), 0)::numeric(12,1),
      'aderencia',
        CASE
          WHEN count(*) FILTER (WHERE e.saida IS NULL) = 0 THEN 'em_dia'
          WHEN (count(*) FILTER (WHERE e.saida IS NULL AND e.proxima_acao_em IS NOT NULL AND e.proxima_acao_em < now() - make_interval(hours => v_esc)))::numeric > 0 THEN 'critico'
          WHEN ((count(*) FILTER (WHERE e.saida IS NULL AND e.proxima_acao_em IS NOT NULL AND e.proxima_acao_em < now()))::numeric
                / GREATEST(count(*) FILTER (WHERE e.saida IS NULL),1)) > 0.25 THEN 'atencao'
          ELSE 'em_dia'
        END
    ) AS linha
    FROM public.ncrm_estado e
    JOIN public.negocios n ON n.id = e.negocio_id
    LEFT JOIN public.corretores c ON c.id = n.corretor_id
    LEFT JOIN public.usuarios u ON u.id = c.usuario_id
    WHERE v_admin OR n.corretor_id = public.current_broker_id() OR COALESCE(public.manages_broker(n.corretor_id), false)
    GROUP BY n.corretor_id
  ) t;

  SELECT jsonb_build_object(
    'estados_total', count(*),
    'ativos', count(*) FILTER (WHERE e.saida IS NULL),
    'respondidos', count(*) FILTER (WHERE e.respondeu),
    'taxa_resposta_pct', round(100.0 * count(*) FILTER (WHERE e.respondeu) / GREATEST(count(*),1), 1),
    'visitas', count(*) FILTER (WHERE e.saida = 'pipeline_visitas'),
    'propostas', count(*) FILTER (WHERE e.saida = 'esteira_vendas'),
    'sara_pendentes', (SELECT count(*) FROM public.ncrm_sara_analise WHERE decisao = 'pendente'),
    'sara_aprovadas', (SELECT count(*) FROM public.ncrm_sara_analise WHERE decisao = 'aprovada'),
    'sara_rejeitadas', (SELECT count(*) FROM public.ncrm_sara_analise WHERE decisao = 'rejeitada'),
    'justificativas_7d', (SELECT count(*) FROM public.ncrm_justificativa WHERE criado_em > now() - interval '7 days')
  ) INTO v_tot
  FROM public.ncrm_estado e
  JOIN public.negocios n ON n.id = e.negocio_id
  WHERE v_admin OR n.corretor_id = public.current_broker_id() OR COALESCE(public.manages_broker(n.corretor_id), false);

  RETURN jsonb_build_object('ok',true,'totais',v_tot,'corretores',v_corretores);
END $fn$;
REVOKE ALL ON FUNCTION public.ncrm_gestao_painel() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ncrm_gestao_painel() TO authenticated;

-- ============================ 6. ÍNDICES DAS CONSULTAS NOVAS ============================
CREATE INDEX ix_ncrm_estado_fila ON public.ncrm_estado (proxima_acao_em) WHERE saida IS NULL;
CREATE INDEX ix_ncrm_estado_resposta ON public.ncrm_estado (resposta_pendente) WHERE saida IS NULL AND resposta_pendente;
