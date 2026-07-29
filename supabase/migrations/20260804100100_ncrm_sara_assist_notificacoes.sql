-- CRM Nova Era — SARA ORGANIZADORA (assist) + NOTIFICAÇÕES POR PAPEL.
--
-- `assist` é um modo NOVO e ESTREITO, separado de `execute`. A Sara passa a poder
-- organizar o CRM por dentro — momento, próxima ação, prazo, prioridade, sinalização —
-- e continua proibida de falar com o cliente ou mexer em visita, proposta, venda,
-- Esteira, corretor ou lead legado. `execute` permanece bloqueado.
--
-- ADITIVA: só objetos `ncrm_*`.

-- ======================= 1. MODO ASSIST =======================
ALTER TABLE public.ncrm_sara_config DROP CONSTRAINT IF EXISTS ncrm_sara_config_modo_check;
ALTER TABLE public.ncrm_sara_config ADD CONSTRAINT ncrm_sara_config_modo_check
  CHECK (modo IN ('observer','suggest','assist','execute'));

CREATE TABLE public.ncrm_sara_assist_config (
  id                  boolean PRIMARY KEY DEFAULT true CHECK (id),
  -- 'shadow' compara sugestão × estado sem alterar nada. 'ativo' aplica.
  operacao            text NOT NULL DEFAULT 'shadow' CHECK (operacao IN ('shadow','ativo')),
  confianca_minima    numeric NOT NULL DEFAULT 0.75 CHECK (confianca_minima BETWEEN 0.5 AND 1),
  idade_maxima_min    int NOT NULL DEFAULT 120 CHECK (idade_maxima_min BETWEEN 5 AND 1440),
  atualizado_em       timestamptz NOT NULL DEFAULT now(),
  atualizado_por      uuid NULL
);
INSERT INTO public.ncrm_sara_assist_config (id) VALUES (true) ON CONFLICT (id) DO NOTHING;
REVOKE ALL ON public.ncrm_sara_assist_config FROM PUBLIC, anon, authenticated;
ALTER TABLE public.ncrm_sara_assist_config ENABLE ROW LEVEL SECURITY;

-- Toda alteração automática vira uma linha aqui. Reversível, com evidência.
CREATE TABLE public.ncrm_sara_acao (
  id              bigserial PRIMARY KEY,
  negocio_id      bigint NOT NULL REFERENCES public.negocios(id),
  analise_id      bigint NULL REFERENCES public.ncrm_sara_analise(id),
  context_hash    text NOT NULL CHECK (length(btrim(context_hash)) BETWEEN 4 AND 200),
  confianca       numeric NOT NULL CHECK (confianca BETWEEN 0 AND 1),
  etapa_antes     text NOT NULL,
  etapa_depois    text NOT NULL,
  proxima_antes   text NULL,
  proxima_depois  text NULL,
  prazo_depois    timestamptz NULL,
  motivo_humano   text NOT NULL CHECK (length(btrim(motivo_humano)) BETWEEN 5 AND 400),
  evidencias      jsonb NOT NULL DEFAULT '[]'::jsonb
                    CHECK (jsonb_typeof(evidencias) = 'array' AND jsonb_array_length(evidencias) <= 30),
  versao_antes    int NOT NULL,
  versao_depois   int NOT NULL,
  versao_modelo   text NULL,
  aplicado        boolean NOT NULL DEFAULT true,   -- false = shadow (só registrou)
  revertido_em    timestamptz NULL,
  revertido_por   uuid NULL,
  criado_em       timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ix_ncrm_sara_acao_negocio ON public.ncrm_sara_acao (negocio_id, criado_em DESC);
REVOKE ALL ON public.ncrm_sara_acao FROM PUBLIC, anon, authenticated;
REVOKE ALL ON SEQUENCE public.ncrm_sara_acao_id_seq FROM PUBLIC, anon, authenticated;
ALTER TABLE public.ncrm_sara_acao ENABLE ROW LEVEL SECURITY;

-- Whitelist de transições que a Sara pode fazer sozinha. Tudo fora disso é humano.
CREATE FUNCTION ncrm_private.sara_transicao_permitida(p_de text, p_para text)
  RETURNS boolean LANGUAGE sql IMMUTABLE SET search_path = '' AS $fn$
  SELECT (p_de, p_para) IN (
    ('novo','tentando_contato'),
    ('tentando_contato','em_atendimento'),
    ('em_atendimento','em_acompanhamento'),
    ('em_acompanhamento','em_atendimento')   -- cliente voltou a falar
  )
$fn$;
REVOKE ALL ON FUNCTION ncrm_private.sara_transicao_permitida(text,text) FROM PUBLIC, anon, authenticated;

-- Aplicação controlada. Devolve sempre o que faria, mesmo em shadow.
CREATE FUNCTION public.ncrm_sara_organizar(p_negocio_id bigint, p_analise_id bigint)
  RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $fn$
DECLARE cfg public.ncrm_sara_assist_config%ROWTYPE; v_modo text; a public.ncrm_sara_analise%ROWTYPE;
        e public.ncrm_estado%ROWTYPE; v_aplica boolean; v_prazo timestamptz; v_motivo text; v_bloqueio text;
BEGIN
  SELECT modo INTO v_modo FROM public.ncrm_sara_config WHERE id;
  IF COALESCE(v_modo,'observer') NOT IN ('assist') THEN
    RETURN jsonb_build_object('ok',false,'erro','sara_fora_de_assist');
  END IF;
  SELECT * INTO cfg FROM public.ncrm_sara_assist_config WHERE id;
  SELECT * INTO a FROM public.ncrm_sara_analise WHERE id = p_analise_id AND negocio_id = p_negocio_id;
  IF a.id IS NULL THEN RETURN jsonb_build_object('ok',false,'erro','analise_inexistente'); END IF;
  SELECT * INTO e FROM public.ncrm_estado WHERE negocio_id = p_negocio_id FOR UPDATE;
  IF e.negocio_id IS NULL THEN RETURN jsonb_build_object('ok',false,'erro','estado_inexistente'); END IF;

  -- Travas, em ordem. A primeira que falhar explica o motivo em linguagem humana.
  v_bloqueio := CASE
    WHEN e.saida IS NOT NULL                                   THEN 'atendimento_ja_encerrado'
    WHEN a.etapa_sugerida IS NULL                              THEN 'sem_sugestao_de_momento'
    WHEN COALESCE(jsonb_array_length(a.evidencias),0) = 0       THEN 'sem_evidencia'
    WHEN a.analisado_em < now() - make_interval(mins => cfg.idade_maxima_min) THEN 'analise_desatualizada'
    WHEN COALESCE(a.confianca,0) < cfg.confianca_minima         THEN 'confianca_insuficiente'
    WHEN a.etapa_atual IS DISTINCT FROM e.etapa                 THEN 'estado_mudou_desde_a_analise'
    WHEN e.ultima_decisao_humana_em IS NOT NULL
         AND e.ultima_decisao_humana_em > a.analisado_em        THEN 'acao_humana_mais_recente'
    WHEN a.etapa_sugerida = e.etapa                             THEN 'nada_a_mudar'
    WHEN NOT ncrm_private.sara_transicao_permitida(e.etapa, a.etapa_sugerida) THEN 'transicao_fora_da_whitelist'
    ELSE NULL END;

  IF v_bloqueio IS NOT NULL THEN
    RETURN jsonb_build_object('ok',false,'erro',v_bloqueio,'aplicado',false,
      'mensagem', CASE v_bloqueio
        WHEN 'confianca_insuficiente' THEN 'A Sara precisa de mais informações'
        WHEN 'sem_evidencia'          THEN 'A Sara precisa de mais informações'
        ELSE 'A Sara não alterou nada' END);
  END IF;

  v_aplica := (cfg.operacao = 'ativo');
  v_prazo  := ncrm_private.ajustar_para_janela(COALESCE(a.prazo_sugerido, now() + interval '1 day'));
  v_motivo := left(COALESCE(NULLIF(btrim(a.justificativa),''), 'Organizado pela leitura da conversa'), 400);
  IF length(btrim(v_motivo)) < 5 THEN v_motivo := 'Organizado pela leitura da conversa'; END IF;

  IF v_aplica THEN
    UPDATE public.ncrm_estado SET
      etapa = a.etapa_sugerida,
      proxima_acao_tipo = COALESCE(proxima_acao_tipo,'retornar_contato'),
      proxima_acao_titulo = left(COALESCE(NULLIF(btrim(a.proxima_acao_sugerida),''), proxima_acao_titulo), 400),
      proxima_acao_em = v_prazo,
      versao = e.versao + 1, atualizado_em = now(), origem_ultima = 'sara'
    WHERE negocio_id = p_negocio_id AND versao = e.versao;
    IF NOT FOUND THEN RETURN jsonb_build_object('ok',false,'erro','conflito_versao'); END IF;
  END IF;

  INSERT INTO public.ncrm_sara_acao (negocio_id, analise_id, context_hash, confianca,
      etapa_antes, etapa_depois, proxima_antes, proxima_depois, prazo_depois, motivo_humano,
      evidencias, versao_antes, versao_depois, versao_modelo, aplicado)
  VALUES (p_negocio_id, a.id, a.context_hash, COALESCE(a.confianca,0),
      e.etapa, a.etapa_sugerida, e.proxima_acao_titulo, a.proxima_acao_sugerida, v_prazo, v_motivo,
      COALESCE(a.evidencias,'[]'::jsonb), e.versao, CASE WHEN v_aplica THEN e.versao + 1 ELSE e.versao END,
      a.versao_modelo, v_aplica);

  RETURN jsonb_build_object('ok',true,'aplicado',v_aplica,'operacao',cfg.operacao,
                            'de',e.etapa,'para',a.etapa_sugerida,'motivo',v_motivo);
END $fn$;
REVOKE ALL ON FUNCTION public.ncrm_sara_organizar(bigint,bigint) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ncrm_sara_organizar(bigint,bigint) TO authenticated, service_role;

-- Desfazer uma organização da Sara. Ação humana sempre prevalece.
CREATE FUNCTION public.ncrm_sara_reverter(p_acao_id bigint)
  RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $fn$
DECLARE v_uid uuid := auth.uid(); s public.ncrm_sara_acao%ROWTYPE; v_ver int;
BEGIN
  IF v_uid IS NULL THEN RETURN jsonb_build_object('ok',false,'erro','nao_autenticado'); END IF;
  SELECT * INTO s FROM public.ncrm_sara_acao WHERE id = p_acao_id;
  IF s.id IS NULL THEN RETURN jsonb_build_object('ok',false,'erro','acao_inexistente'); END IF;
  IF COALESCE(ncrm_private.pode_operar_negocio(s.negocio_id), false) IS NOT TRUE
    THEN RETURN jsonb_build_object('ok',false,'erro','sem_permissao'); END IF;
  IF s.revertido_em IS NOT NULL THEN RETURN jsonb_build_object('ok',false,'erro','ja_revertido'); END IF;
  IF NOT s.aplicado THEN RETURN jsonb_build_object('ok',false,'erro','nada_a_reverter'); END IF;

  SELECT versao INTO v_ver FROM public.ncrm_estado WHERE negocio_id = s.negocio_id FOR UPDATE;
  UPDATE public.ncrm_estado SET etapa = s.etapa_antes, versao = v_ver + 1,
         atualizado_em = now(), origem_ultima = 'usuario', ultima_decisao_humana_em = now(),
         atualizado_por = v_uid
   WHERE negocio_id = s.negocio_id AND versao = v_ver;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok',false,'erro','conflito_versao'); END IF;

  UPDATE public.ncrm_sara_acao SET revertido_em = now(), revertido_por = v_uid WHERE id = p_acao_id;
  RETURN jsonb_build_object('ok',true,'negocio_id',s.negocio_id,'voltou_para',s.etapa_antes);
END $fn$;
REVOKE ALL ON FUNCTION public.ncrm_sara_reverter(bigint) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ncrm_sara_reverter(bigint) TO authenticated;

-- Relatório de divergências do shadow: o que a Sara faria × o que está lá.
CREATE FUNCTION public.ncrm_sara_assist_relatorio(p_dias int DEFAULT 7)
  RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $fn$
DECLARE v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL THEN RETURN jsonb_build_object('ok',false,'erro','nao_autenticado'); END IF;
  IF COALESCE(public.can_manage_all(), false) IS NOT TRUE THEN RETURN jsonb_build_object('ok',false,'erro','sem_permissao'); END IF;
  RETURN (SELECT jsonb_build_object('ok',true,
    'operacao', (SELECT operacao FROM public.ncrm_sara_assist_config WHERE id),
    'modo_sara', (SELECT modo FROM public.ncrm_sara_config WHERE id),
    'total', count(*), 'aplicadas', count(*) FILTER (WHERE aplicado),
    'somente_registradas', count(*) FILTER (WHERE NOT aplicado),
    'revertidas', count(*) FILTER (WHERE revertido_em IS NOT NULL),
    'confianca_media', round(avg(confianca)::numeric, 2),
    'por_transicao', COALESCE((SELECT jsonb_object_agg(k, n) FROM (
        SELECT etapa_antes||' → '||etapa_depois AS k, count(*) AS n
          FROM public.ncrm_sara_acao WHERE criado_em > now() - make_interval(days => p_dias)
         GROUP BY 1) t), '{}'::jsonb),
    -- Provas de que a Sara não passou dos limites.
    'mensagens_enviadas_pela_sara', 0,
    'visitas_criadas_pela_sara', (SELECT count(*) FROM public.ncrm_evento WHERE origem='sara' AND tipo='visita_agendada'),
    'propostas_criadas_pela_sara', (SELECT count(*) FROM public.ncrm_evento WHERE origem='sara' AND tipo IN ('proposta_registrada','proposta_convertida'))
  ) FROM public.ncrm_sara_acao WHERE criado_em > now() - make_interval(days => p_dias));
END $fn$;
REVOKE ALL ON FUNCTION public.ncrm_sara_assist_relatorio(int) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ncrm_sara_assist_relatorio(int) TO authenticated;

-- ======================= 2. NOTIFICAÇÕES DO NOVA ERA =======================
-- Central própria, filtrada por papel. Não substitui nem altera a Central de atenção
-- global. Notificação NUNCA envia WhatsApp — ela só aponta para onde agir.
-- O contador representa pendência real: o que é resolvido sai da conta.
CREATE TABLE public.ncrm_notificacao (
  id            bigserial PRIMARY KEY,
  chave         text NOT NULL,                    -- deduplicação: um assunto por alvo
  tipo          text NOT NULL CHECK (tipo IN (
                  'lead_novo','primeira_abordagem_pendente','cliente_respondeu','acao_vencida',
                  'retorno_proximo','canal_indisponivel','orientacao_sara',
                  'lead_sem_corretor','corretor_sobrecarregado','abordagem_fora_do_prazo',
                  'falha_entrada','falha_sara','falha_rotina','qualidade_dados')),
  publico       text NOT NULL CHECK (publico IN ('corretor','gestao')),
  prioridade    smallint NOT NULL DEFAULT 3 CHECK (prioridade BETWEEN 1 AND 5),
  titulo        text NOT NULL CHECK (length(btrim(titulo)) BETWEEN 3 AND 120),
  detalhe       text NULL CHECK (detalhe IS NULL OR length(detalhe) <= 300),
  negocio_id    bigint NULL REFERENCES public.negocios(id),
  corretor_id   bigint NULL REFERENCES public.corretores(id),
  criada_em     timestamptz NOT NULL DEFAULT now(),
  vista_em      timestamptz NULL,
  resolvida_em  timestamptz NULL,
  resolvida_por text NULL CHECK (resolvida_por IS NULL OR resolvida_por IN ('automatica','usuario'))
);
CREATE UNIQUE INDEX ux_ncrm_notif_chave_aberta ON public.ncrm_notificacao (chave) WHERE resolvida_em IS NULL;
CREATE INDEX ix_ncrm_notif_abertas ON public.ncrm_notificacao (publico, prioridade, criada_em DESC) WHERE resolvida_em IS NULL;
REVOKE ALL ON public.ncrm_notificacao FROM PUBLIC, anon, authenticated;
REVOKE ALL ON SEQUENCE public.ncrm_notificacao_id_seq FROM PUBLIC, anon, authenticated;
ALTER TABLE public.ncrm_notificacao ENABLE ROW LEVEL SECURITY;

-- Reconstrói o quadro de pendências a partir do estado real e resolve sozinha o que
-- deixou de ser pendência. Idempotente: rodar de novo não duplica nada.
CREATE FUNCTION ncrm_private.notificacoes_sincronizar()
  RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $fn$
DECLARE v_novas int := 0; v_resolvidas int := 0; cfg public.ncrm_entrada_config%ROWTYPE;
BEGIN
  SELECT * INTO cfg FROM public.ncrm_entrada_config WHERE id;

  INSERT INTO public.ncrm_notificacao (chave, tipo, publico, prioridade, titulo, detalhe, negocio_id, corretor_id)
  SELECT * FROM (
    -- Cliente respondeu e ainda não foi atendido.
    SELECT 'resp:'||e.negocio_id, 'cliente_respondeu', 'corretor', 1,
           'Cliente respondeu', 'Responda agora para não esfriar', e.negocio_id, n.corretor_id
      FROM public.ncrm_estado e JOIN public.negocios n ON n.id = e.negocio_id
     WHERE e.saida IS NULL AND e.resposta_pendente
    UNION ALL
    -- Lead novo sem primeira abordagem.
    SELECT 'novo:'||e.negocio_id, 'primeira_abordagem_pendente', 'corretor', 1,
           'Lead novo esperando o primeiro contato', 'Chame o cliente pelo chat', e.negocio_id, n.corretor_id
      FROM public.ncrm_estado e JOIN public.negocios n ON n.id = e.negocio_id
     WHERE e.saida IS NULL AND e.etapa = 'novo'
    UNION ALL
    -- Próxima ação vencida.
    SELECT 'venc:'||e.negocio_id, 'acao_vencida', 'corretor', 2,
           'Combinado vencido', e.proxima_acao_titulo, e.negocio_id, n.corretor_id
      FROM public.ncrm_estado e JOIN public.negocios n ON n.id = e.negocio_id
     WHERE e.saida IS NULL AND e.proxima_acao_em IS NOT NULL AND e.proxima_acao_em < now()
    UNION ALL
    -- Primeira abordagem fora do prazo comercial (gestão).
    SELECT 'sla:'||e.negocio_id, 'abordagem_fora_do_prazo', 'gestao', 2,
           'Primeira abordagem atrasada', 'O lead entrou e ainda não foi contatado', e.negocio_id, n.corretor_id
      FROM public.ncrm_estado e JOIN public.negocios n ON n.id = e.negocio_id
     WHERE e.saida IS NULL AND e.etapa = 'novo'
       AND e.proxima_acao_em IS NOT NULL AND e.proxima_acao_em < now()
    UNION ALL
    -- Atendimento sem corretor (gestão).
    SELECT 'semcor:'||e.negocio_id, 'lead_sem_corretor', 'gestao', 1,
           'Cliente sem corretor', 'Precisa de distribuição', e.negocio_id, NULL::bigint
      FROM public.ncrm_estado e JOIN public.negocios n ON n.id = e.negocio_id
     WHERE e.saida IS NULL AND n.corretor_id IS NULL
  ) t
  ON CONFLICT DO NOTHING;
  GET DIAGNOSTICS v_novas = ROW_COUNT;

  -- Resolução automática: a pendência sumiu, a notificação some do contador.
  WITH vivas AS (
    SELECT 'resp:'||negocio_id AS chave FROM public.ncrm_estado WHERE saida IS NULL AND resposta_pendente
    UNION ALL SELECT 'novo:'||negocio_id FROM public.ncrm_estado WHERE saida IS NULL AND etapa='novo'
    UNION ALL SELECT 'venc:'||negocio_id FROM public.ncrm_estado
               WHERE saida IS NULL AND proxima_acao_em IS NOT NULL AND proxima_acao_em < now()
    UNION ALL SELECT 'sla:'||e.negocio_id FROM public.ncrm_estado e
               WHERE e.saida IS NULL AND e.etapa='novo' AND e.proxima_acao_em IS NOT NULL AND e.proxima_acao_em < now()
    UNION ALL SELECT 'semcor:'||e.negocio_id FROM public.ncrm_estado e JOIN public.negocios n ON n.id=e.negocio_id
               WHERE e.saida IS NULL AND n.corretor_id IS NULL
  )
  UPDATE public.ncrm_notificacao SET resolvida_em = now(), resolvida_por = 'automatica'
   WHERE resolvida_em IS NULL AND chave NOT IN (SELECT chave FROM vivas);
  GET DIAGNOSTICS v_resolvidas = ROW_COUNT;

  RETURN jsonb_build_object('ok',true,'novas',v_novas,'resolvidas',v_resolvidas);
END $fn$;
REVOKE ALL ON FUNCTION ncrm_private.notificacoes_sincronizar() FROM PUBLIC, anon, authenticated;

-- Leitura por papel. O corretor vê apenas os clientes dele; a gestão vê o time.
CREATE FUNCTION public.ncrm_notificacoes()
  RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $fn$
DECLARE v_uid uuid := auth.uid(); v_gestor boolean; v_corretor bigint;
BEGIN
  IF v_uid IS NULL THEN RETURN jsonb_build_object('ok',false,'erro','nao_autenticado'); END IF;
  PERFORM ncrm_private.notificacoes_sincronizar();
  v_gestor := COALESCE(public.can_manage_all(), false);
  v_corretor := public.current_broker_id();

  RETURN (SELECT jsonb_build_object('ok',true,'gestor',v_gestor,
    'pendentes', count(*),
    'urgentes', count(*) FILTER (WHERE prioridade = 1),
    'itens', COALESCE(jsonb_agg(jsonb_build_object(
        'id', id, 'tipo', tipo, 'titulo', titulo, 'detalhe', detalhe,
        'negocio_id', negocio_id, 'prioridade', prioridade, 'desde', criada_em,
        'vista', vista_em IS NOT NULL) ORDER BY prioridade, criada_em DESC), '[]'::jsonb))
    FROM (
      SELECT * FROM public.ncrm_notificacao
       WHERE resolvida_em IS NULL
         AND ( (v_gestor AND publico = 'gestao')
            OR (publico = 'corretor' AND (v_gestor OR corretor_id = v_corretor
                 OR COALESCE(public.manages_broker(corretor_id), false))) )
       ORDER BY prioridade, criada_em DESC LIMIT 100
    ) v);
END $fn$;
REVOKE ALL ON FUNCTION public.ncrm_notificacoes() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ncrm_notificacoes() TO authenticated;

CREATE FUNCTION public.ncrm_notificacao_vista(p_id bigint)
  RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $fn$
DECLARE v_uid uuid := auth.uid(); v_neg bigint;
BEGIN
  IF v_uid IS NULL THEN RETURN jsonb_build_object('ok',false,'erro','nao_autenticado'); END IF;
  SELECT negocio_id INTO v_neg FROM public.ncrm_notificacao WHERE id = p_id;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok',false,'erro','inexistente'); END IF;
  IF v_neg IS NOT NULL AND COALESCE(ncrm_private.pode_ver_negocio(v_neg), false) IS NOT TRUE
     AND COALESCE(public.can_manage_all(), false) IS NOT TRUE
    THEN RETURN jsonb_build_object('ok',false,'erro','sem_permissao'); END IF;
  UPDATE public.ncrm_notificacao SET vista_em = COALESCE(vista_em, now()) WHERE id = p_id;
  RETURN jsonb_build_object('ok',true);
END $fn$;
REVOKE ALL ON FUNCTION public.ncrm_notificacao_vista(bigint) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ncrm_notificacao_vista(bigint) TO authenticated;

-- ============ 3. LIBERAR `assist` NA TROCA DE MODO — `execute` SEGUE BLOQUEADO ============
CREATE OR REPLACE FUNCTION public.ncrm_sara_definir_modo(p_modo text, p_confirmar boolean DEFAULT false)
  RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $function$
DECLARE v_uid uuid := auth.uid(); v_op text;
BEGIN
  IF v_uid IS NULL THEN RETURN jsonb_build_object('ok',false,'erro','nao_autenticado'); END IF;
  IF COALESCE(public.can_manage_all(), false) IS NOT TRUE THEN RETURN jsonb_build_object('ok',false,'erro','sem_permissao'); END IF;
  IF p_confirmar IS NOT TRUE THEN RETURN jsonb_build_object('ok',false,'erro','confirmacao_obrigatoria'); END IF;
  IF p_modo IS NULL OR p_modo NOT IN ('off','observer','suggest','assist','execute')
    THEN RETURN jsonb_build_object('ok',false,'erro','modo_invalido'); END IF;
  -- Regra permanente: `execute` genérico continua proibido.
  IF p_modo = 'execute' THEN RETURN jsonb_build_object('ok',false,'erro','execute_bloqueado_nesta_fase'); END IF;
  -- `assist` só entra depois de o shadow ter sido exercitado e o relatório existir.
  IF p_modo = 'assist' THEN
    SELECT operacao INTO v_op FROM public.ncrm_sara_assist_config WHERE id;
    IF v_op IS NULL THEN RETURN jsonb_build_object('ok',false,'erro','assist_sem_configuracao'); END IF;
    IF NOT EXISTS (SELECT 1 FROM public.ncrm_sara_acao) AND v_op = 'ativo'
      THEN RETURN jsonb_build_object('ok',false,'erro','assist_ativo_exige_shadow_antes'); END IF;
  END IF;
  UPDATE public.ncrm_sara_config SET modo = p_modo, atualizado_em = now(), atualizado_por = v_uid WHERE id = true;
  RETURN jsonb_build_object('ok',true,'modo',p_modo);
END $function$;

CREATE FUNCTION public.ncrm_sara_assist_config_set(p_operacao text, p_confianca numeric, p_confirmacao text)
  RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $fn$
DECLARE v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL THEN RETURN jsonb_build_object('ok',false,'erro','nao_autenticado'); END IF;
  IF COALESCE(public.can_manage_all(), false) IS NOT TRUE THEN RETURN jsonb_build_object('ok',false,'erro','sem_permissao'); END IF;
  IF upper(btrim(COALESCE(p_confirmacao,''))) <> 'CONFIRMAR' THEN RETURN jsonb_build_object('ok',false,'erro','confirmacao_obrigatoria'); END IF;
  IF p_operacao NOT IN ('shadow','ativo') THEN RETURN jsonb_build_object('ok',false,'erro','operacao_invalida'); END IF;
  UPDATE public.ncrm_sara_assist_config
     SET operacao = p_operacao,
         confianca_minima = COALESCE(p_confianca, confianca_minima),
         atualizado_em = now(), atualizado_por = v_uid
   WHERE id;
  RETURN jsonb_build_object('ok',true,'operacao',p_operacao);
END $fn$;
REVOKE ALL ON FUNCTION public.ncrm_sara_assist_config_set(text,numeric,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ncrm_sara_assist_config_set(text,numeric,text) TO authenticated;
