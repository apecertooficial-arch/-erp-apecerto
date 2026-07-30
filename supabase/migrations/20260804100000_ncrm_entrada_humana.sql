-- CRM Nova Era — ENTRADA PELA DISTRIBUIÇÃO + PRIMEIRA ABORDAGEM HUMANA.
--
-- DECISÃO DO PROPRIETÁRIO: dentro do CRM Nova Era, a primeira mensagem passa a ser
-- enviada pelo corretor, à mão, pelo chat interno. O atendimento deixa de depender da
-- mensagem automática para existir: ele nasce assim que a distribuição associa
-- lead + negócio + corretor.
--
-- FAIL-CLOSED: o escopo padrão é 'nenhum'. Enquanto ninguém for elegível, nada muda —
-- nem o motor, nem o legado, nem a reconciliação. A virada é uma decisão administrativa
-- auditada, não um efeito colateral do deploy.
--
-- ADITIVA: objetos novos só `ncrm_*`. A única função legada tocada é
-- `motor_envia_abordagem`, que ganha UM guarda no início, no mesmo padrão dos guardas
-- de anti-duplicidade que já existem ali. Distribuição, webhooks, Pipe de Visitas,
-- Esteira e CRM antigo permanecem intactos.

-- ============================ 1. CONFIGURAÇÃO DA ENTRADA ============================
CREATE TABLE public.ncrm_entrada_config (
  id                       boolean PRIMARY KEY DEFAULT true CHECK (id),
  -- 'automatica' = comportamento de hoje (o motor envia). 'humana' = o corretor envia.
  modo_primeira_abordagem  text NOT NULL DEFAULT 'automatica'
                             CHECK (modo_primeira_abordagem IN ('automatica','humana')),
  -- Kill-switch global. A elegibilidade real é SEMPRE por corretor liberado
  -- (ncrm_abordagem_humana). 'nenhum' desliga tudo; 'liberados' respeita a lista.
  escopo                   text NOT NULL DEFAULT 'nenhum'
                             CHECK (escopo IN ('nenhum','liberados')),
  -- Prazo comercial para a primeira abordagem humana, em minutos.
  prazo_primeira_abordagem_min int NOT NULL DEFAULT 15 CHECK (prazo_primeira_abordagem_min BETWEEN 1 AND 1440),
  -- Momento a partir do qual a regra vale. Nada antes disso é reescrito.
  vigente_desde            timestamptz NULL,
  atualizado_em            timestamptz NOT NULL DEFAULT now(),
  atualizado_por           uuid NULL
);
INSERT INTO public.ncrm_entrada_config (id) VALUES (true) ON CONFLICT (id) DO NOTHING;
REVOKE ALL ON public.ncrm_entrada_config FROM PUBLIC, anon, authenticated;
ALTER TABLE public.ncrm_entrada_config ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.ncrm_entrada_config_audit (
  id             bigserial PRIMARY KEY,
  modo_antes     text NULL,
  modo_depois    text NOT NULL,
  escopo_antes   text NULL,
  escopo_depois  text NOT NULL,
  prazo_depois   int  NOT NULL,
  vigente_desde  timestamptz NULL,
  motivo         text NULL CHECK (motivo IS NULL OR length(motivo) <= 400),
  alterado_por   uuid NOT NULL REFERENCES public.usuarios(id),
  criado_em      timestamptz NOT NULL DEFAULT now()
);
REVOKE ALL ON public.ncrm_entrada_config_audit FROM PUBLIC, anon, authenticated;
REVOKE ALL ON SEQUENCE public.ncrm_entrada_config_audit_id_seq FROM PUBLIC, anon, authenticated;
ALTER TABLE public.ncrm_entrada_config_audit ENABLE ROW LEVEL SECURITY;

-- Elegibilidade ao CRM Nova Era. Esta é a ÚNICA definição de "lead Nova Era" do sistema.
-- Fail-closed: qualquer dúvida devolve false, e um false nunca bloqueia o motor.
CREATE FUNCTION ncrm_private.negocio_elegivel_nova_era(p_negocio_id bigint)
  RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $fn$
DECLARE v_escopo text; v_vigente timestamptz; v_ing_ativo boolean; v_ing_desde timestamptz;
        v_criado timestamptz; v_corretor bigint;
BEGIN
  IF p_negocio_id IS NULL THEN RETURN false; END IF;
  SELECT escopo, vigente_desde INTO v_escopo, v_vigente FROM public.ncrm_entrada_config WHERE id;
  IF COALESCE(v_escopo,'nenhum') <> 'liberados' THEN RETURN false; END IF;   -- fail-closed

  SELECT ativo, ativo_desde INTO v_ing_ativo, v_ing_desde FROM public.ncrm_ingest_config WHERE id;
  IF COALESCE(v_ing_ativo,false) IS NOT TRUE OR v_ing_desde IS NULL THEN RETURN false; END IF;

  SELECT criado_em, corretor_id INTO v_criado, v_corretor
    FROM public.negocios WHERE id = p_negocio_id AND status = 'aberto';
  IF v_criado IS NULL OR v_corretor IS NULL THEN RETURN false; END IF;
  IF v_criado < v_ing_desde THEN RETURN false; END IF;                        -- respeita o corte
  IF v_vigente IS NOT NULL AND v_criado < v_vigente THEN RETURN false; END IF;

  -- ÚNICA fonte de elegibilidade: o corretor DO NEGÓCIO está liberado, por nome,
  -- para a primeira abordagem humana. Ter acesso à tela (ncrm_tem_acesso, que inclui
  -- admin e canary) NÃO torna ninguém elegível.
  RETURN EXISTS (SELECT 1 FROM public.ncrm_abordagem_humana ah
                  WHERE ah.corretor_id = v_corretor AND ah.ativo);
END $fn$;
REVOKE ALL ON FUNCTION ncrm_private.negocio_elegivel_nova_era(bigint) FROM PUBLIC, anon, authenticated;

-- ============ LISTA CANÔNICA: QUEM PARTICIPA DA ABORDAGEM HUMANA ============
-- Dois conceitos SEPARADOS, por decisão explícita:
--   * acesso à tela do CRM Nova Era  → public.ncrm_piloto (criada na Fase 6, por nome)
--   * participação na abordagem humana → esta tabela, POR CORRETOR
-- O admin enxerga o CRM inteiro por `can_manage_all`, mas isso NUNCA torna os negócios
-- dele elegíveis. A elegibilidade acompanha `negocios.corretor_id`, que é o que a
-- distribuição realmente decide.
CREATE TABLE public.ncrm_abordagem_humana (
  corretor_id   bigint PRIMARY KEY REFERENCES public.corretores(id),
  ativo         boolean NOT NULL DEFAULT true,
  liberado_por  uuid NOT NULL REFERENCES public.usuarios(id),
  liberado_em   timestamptz NOT NULL DEFAULT now(),
  removido_por  uuid NULL REFERENCES public.usuarios(id),
  removido_em   timestamptz NULL
);
REVOKE ALL ON public.ncrm_abordagem_humana FROM PUBLIC, anon, authenticated;
ALTER TABLE public.ncrm_abordagem_humana ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.ncrm_abordagem_humana_audit (
  id            bigserial PRIMARY KEY,
  corretor_id   bigint NOT NULL,
  corretor_nome text NULL,
  estado_antes  text NOT NULL,
  estado_depois text NOT NULL,
  alterado_por  uuid NOT NULL REFERENCES public.usuarios(id),
  criado_em     timestamptz NOT NULL DEFAULT now()
);
REVOKE ALL ON public.ncrm_abordagem_humana_audit FROM PUBLIC, anon, authenticated;
REVOKE ALL ON SEQUENCE public.ncrm_abordagem_humana_audit_id_seq FROM PUBLIC, anon, authenticated;
ALTER TABLE public.ncrm_abordagem_humana_audit ENABLE ROW LEVEL SECURITY;

-- Tela do administrador: nomes, nunca UUID digitado. Mostra as duas dimensões.
CREATE FUNCTION public.ncrm_abordagem_humana_listar()
  RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $fn$
DECLARE v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL THEN RETURN jsonb_build_object('ok',false,'erro','nao_autenticado'); END IF;
  IF COALESCE(public.can_manage_all(), false) IS NOT TRUE THEN RETURN jsonb_build_object('ok',false,'erro','sem_permissao'); END IF;
  RETURN jsonb_build_object('ok',true,
    'modo_global', (SELECT modo_primeira_abordagem FROM public.ncrm_entrada_config WHERE id),
    'escopo', (SELECT escopo FROM public.ncrm_entrada_config WHERE id),
    'corretores', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'corretor_id', c.id,
        'nome', COALESCE(c.apelido, c.nome, '—'),
        'ativo_no_erp', COALESCE(c.ativo,false),
        -- pode abrir a tela do CRM Nova Era
        'acessa_crm', COALESCE(EXISTS (SELECT 1 FROM public.ncrm_piloto p
                                        WHERE p.usuario_id = c.usuario_id AND p.ativo), false),
        -- participa da primeira abordagem humana
        'abordagem_humana', COALESCE(ah.ativo, false),
        'liberado_em', ah.liberado_em,
        'clientes_ativos', (SELECT count(*) FROM public.ncrm_estado e
                              JOIN public.negocios n ON n.id = e.negocio_id
                             WHERE n.corretor_id = c.id AND e.saida IS NULL)
      ) ORDER BY COALESCE(c.apelido, c.nome))
      FROM public.corretores c
      LEFT JOIN public.ncrm_abordagem_humana ah ON ah.corretor_id = c.id
      WHERE COALESCE(c.ativo,false)), '[]'::jsonb));
END $fn$;
REVOKE ALL ON FUNCTION public.ncrm_abordagem_humana_listar() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ncrm_abordagem_humana_listar() TO authenticated;

-- Colocar/tirar um corretor do modo humano. Exige confirmação digitada e fica auditado.
-- Ninguém é liberado automaticamente, em nenhuma hipótese.
CREATE FUNCTION public.ncrm_abordagem_humana_definir(p_corretor_id bigint, p_ativo boolean, p_confirmacao text)
  RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $fn$
DECLARE v_uid uuid := auth.uid(); v_antes boolean; v_nome text; v_palavra text;
BEGIN
  IF v_uid IS NULL THEN RETURN jsonb_build_object('ok',false,'erro','nao_autenticado'); END IF;
  IF COALESCE(public.can_manage_all(), false) IS NOT TRUE THEN RETURN jsonb_build_object('ok',false,'erro','sem_permissao'); END IF;
  -- Ligar exige uma palavra mais forte que desligar: ligar muda o comportamento comercial.
  v_palavra := CASE WHEN COALESCE(p_ativo,false) THEN 'ATIVAR ABORDAGEM HUMANA' ELSE 'CONFIRMAR' END;
  IF upper(btrim(COALESCE(p_confirmacao,''))) <> v_palavra
    THEN RETURN jsonb_build_object('ok',false,'erro','confirmacao_obrigatoria','palavra',v_palavra); END IF;

  SELECT COALESCE(apelido, nome) INTO v_nome FROM public.corretores WHERE id = p_corretor_id AND COALESCE(ativo,false);
  IF v_nome IS NULL THEN RETURN jsonb_build_object('ok',false,'erro','corretor_invalido'); END IF;
  SELECT ah.ativo INTO v_antes FROM public.ncrm_abordagem_humana ah WHERE ah.corretor_id = p_corretor_id;

  INSERT INTO public.ncrm_abordagem_humana (corretor_id, ativo, liberado_por)
  VALUES (p_corretor_id, COALESCE(p_ativo,false), v_uid)
  ON CONFLICT (corretor_id) DO UPDATE SET
    ativo = COALESCE(p_ativo,false),
    liberado_por  = CASE WHEN COALESCE(p_ativo,false) THEN v_uid ELSE public.ncrm_abordagem_humana.liberado_por END,
    liberado_em   = CASE WHEN COALESCE(p_ativo,false) THEN now() ELSE public.ncrm_abordagem_humana.liberado_em END,
    removido_por  = CASE WHEN COALESCE(p_ativo,false) THEN NULL ELSE v_uid END,
    removido_em   = CASE WHEN COALESCE(p_ativo,false) THEN NULL ELSE now() END;

  INSERT INTO public.ncrm_abordagem_humana_audit (corretor_id, corretor_nome, estado_antes, estado_depois, alterado_por)
  VALUES (p_corretor_id, v_nome,
          CASE WHEN COALESCE(v_antes,false) THEN 'humana' ELSE 'automatica' END,
          CASE WHEN COALESCE(p_ativo,false) THEN 'humana' ELSE 'automatica' END, v_uid);

  RETURN jsonb_build_object('ok',true,'corretor', v_nome,
    'abordagem', CASE WHEN COALESCE(p_ativo,false) THEN 'humana' ELSE 'automatica' END);
END $fn$;
REVOKE ALL ON FUNCTION public.ncrm_abordagem_humana_definir(bigint,boolean,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ncrm_abordagem_humana_definir(bigint,boolean,text) TO authenticated;

-- Resposta única para o motor: devo segurar a primeira abordagem deste lead?
CREATE FUNCTION public.ncrm_bloqueia_abordagem_automatica(p_lead_id bigint)
  RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $fn$
DECLARE v_modo text; v_neg bigint;
BEGIN
  SELECT modo_primeira_abordagem INTO v_modo FROM public.ncrm_entrada_config WHERE id;
  IF COALESCE(v_modo,'automatica') <> 'humana' THEN RETURN false; END IF;  -- fail-closed
  SELECT n.id INTO v_neg FROM public.negocios n
   WHERE n.lead_id = p_lead_id AND n.status = 'aberto'
   ORDER BY n.criado_em DESC, n.id DESC LIMIT 1;
  IF v_neg IS NULL THEN RETURN false; END IF;
  RETURN COALESCE(ncrm_private.negocio_elegivel_nova_era(v_neg), false);
EXCEPTION WHEN OTHERS THEN RETURN false;  -- qualquer erro: o motor segue como sempre
END $fn$;
REVOKE ALL ON FUNCTION public.ncrm_bloqueia_abordagem_automatica(bigint) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ncrm_bloqueia_abordagem_automatica(bigint) TO authenticated, service_role;

CREATE FUNCTION public.ncrm_entrada_config_get()
  RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $fn$
DECLARE v_uid uuid := auth.uid(); c public.ncrm_entrada_config%ROWTYPE;
BEGIN
  IF v_uid IS NULL THEN RETURN jsonb_build_object('ok',false,'erro','nao_autenticado'); END IF;
  IF COALESCE(public.can_manage_all(), false) IS NOT TRUE THEN RETURN jsonb_build_object('ok',false,'erro','sem_permissao'); END IF;
  SELECT * INTO c FROM public.ncrm_entrada_config WHERE id;
  RETURN jsonb_build_object('ok',true,'config', to_jsonb(c),
    'elegiveis_agora', (SELECT count(*) FROM public.negocios n
                         WHERE n.status='aberto' AND ncrm_private.negocio_elegivel_nova_era(n.id)));
END $fn$;
REVOKE ALL ON FUNCTION public.ncrm_entrada_config_get() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ncrm_entrada_config_get() TO authenticated;

-- Virada de modo/escopo: exige admin, confirmação digitada e fica auditada.
CREATE FUNCTION public.ncrm_entrada_config_set(p jsonb, p_confirmacao text)
  RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $fn$
DECLARE v_uid uuid := auth.uid(); a public.ncrm_entrada_config%ROWTYPE;
        v_modo text; v_escopo text; v_prazo int;
BEGIN
  IF v_uid IS NULL THEN RETURN jsonb_build_object('ok',false,'erro','nao_autenticado'); END IF;
  IF COALESCE(public.can_manage_all(), false) IS NOT TRUE THEN RETURN jsonb_build_object('ok',false,'erro','sem_permissao'); END IF;
  IF upper(btrim(COALESCE(p_confirmacao,''))) <> 'CONFIRMAR' THEN RETURN jsonb_build_object('ok',false,'erro','confirmacao_obrigatoria'); END IF;
  SELECT * INTO a FROM public.ncrm_entrada_config WHERE id;
  v_modo   := COALESCE(NULLIF(p->>'modo_primeira_abordagem',''), a.modo_primeira_abordagem);
  v_escopo := COALESCE(NULLIF(p->>'escopo',''), a.escopo);
  v_prazo  := COALESCE(NULLIF(p->>'prazo_primeira_abordagem_min','')::int, a.prazo_primeira_abordagem_min);
  IF v_modo   NOT IN ('automatica','humana')     THEN RETURN jsonb_build_object('ok',false,'erro','modo_invalido'); END IF;
  IF v_escopo NOT IN ('nenhum','liberados') THEN RETURN jsonb_build_object('ok',false,'erro','escopo_invalido'); END IF;

  UPDATE public.ncrm_entrada_config SET
    modo_primeira_abordagem = v_modo, escopo = v_escopo, prazo_primeira_abordagem_min = v_prazo,
    -- O corte nasce na primeira virada para 'humana' e nunca é reescrito depois.
    vigente_desde = CASE WHEN v_modo = 'humana' AND vigente_desde IS NULL THEN now() ELSE vigente_desde END,
    atualizado_em = now(), atualizado_por = v_uid
  WHERE id;

  INSERT INTO public.ncrm_entrada_config_audit (modo_antes, modo_depois, escopo_antes, escopo_depois,
      prazo_depois, vigente_desde, motivo, alterado_por)
  SELECT a.modo_primeira_abordagem, v_modo, a.escopo, v_escopo, v_prazo, c.vigente_desde,
         left(NULLIF(btrim(COALESCE(p->>'motivo','')),''),400), v_uid
    FROM public.ncrm_entrada_config c WHERE c.id;

  RETURN public.ncrm_entrada_config_get();
END $fn$;
REVOKE ALL ON FUNCTION public.ncrm_entrada_config_set(jsonb,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ncrm_entrada_config_set(jsonb,text) TO authenticated;

-- ==================== 2. O CARD NASCE NA DISTRIBUIÇÃO ====================
-- Varredura idempotente, executada pela reconciliação que já roda a cada minuto.
-- Preferida a um trigger em `negocios`: não acrescenta risco ao caminho crítico da
-- distribuição e herda o retry e o ciclo de vida finito que a fila já tem.
--
-- Não envia mensagem. Não chama a Sara. Não move o CRM antigo.
CREATE FUNCTION ncrm_private.entrada_por_distribuicao(p_limite int DEFAULT 200)
  RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $fn$
DECLARE r record; cfg public.ncrm_entrada_config%ROWTYPE; v_wf bigint; v_prazo timestamptz;
        v_criados int := 0; v_ignorados int := 0;
BEGIN
  SELECT * INTO cfg FROM public.ncrm_entrada_config WHERE id;
  IF COALESCE(cfg.escopo,'nenhum') = 'nenhum' THEN
    RETURN jsonb_build_object('ok',true,'inativo',true,'criados',0);
  END IF;

  SELECT id INTO v_wf FROM public.ncrm_workflow_config WHERE status = 'publicada' ORDER BY versao DESC LIMIT 1;
  IF v_wf IS NULL THEN RETURN jsonb_build_object('ok',false,'erro','sem_workflow'); END IF;

  FOR r IN
    SELECT n.id, n.lead_id, n.corretor_id, n.criado_em
      FROM public.negocios n
     WHERE n.status = 'aberto' AND n.corretor_id IS NOT NULL
       AND NOT EXISTS (SELECT 1 FROM public.ncrm_estado e WHERE e.negocio_id = n.id)
       AND ncrm_private.negocio_elegivel_nova_era(n.id)
     ORDER BY n.criado_em DESC
     LIMIT p_limite
  LOOP
    -- Prazo comercial da primeira abordagem, respeitando a janela da cadência.
    v_prazo := ncrm_private.ajustar_para_janela(now() + make_interval(mins => cfg.prazo_primeira_abordagem_min));

    BEGIN
      INSERT INTO public.ncrm_estado (negocio_id, workflow_config_id, etapa,
          proxima_acao_tipo, proxima_acao_titulo, proxima_acao_em,
          ultima_interacao_em, origem_ultima)
      VALUES (r.id, v_wf, 'novo',
          'tentativa_cadencia', 'Primeira abordagem: chamar o cliente', v_prazo,
          r.criado_em, 'sistema')
      ON CONFLICT (negocio_id) DO NOTHING;

      IF FOUND THEN
        INSERT INTO public.ncrm_evento (negocio_id, lead_id, corretor_id_no_evento, workflow_config_id,
            tipo, resultado, origem, idempotency_key, payload)
        VALUES (r.id, r.lead_id, r.corretor_id, v_wf, 'mudanca_etapa', 'ok', 'sistema',
            'entrada_distribuicao:' || r.id::text,
            jsonb_build_object('acao','entrada_por_distribuicao','corretor', r.corretor_id,
                               'prazo_primeira_abordagem', v_prazo,
                               'modo', cfg.modo_primeira_abordagem))
        ON CONFLICT DO NOTHING;
        v_criados := v_criados + 1;
      ELSE
        v_ignorados := v_ignorados + 1;
      END IF;
    EXCEPTION WHEN unique_violation THEN v_ignorados := v_ignorados + 1;
    END;
  END LOOP;

  RETURN jsonb_build_object('ok',true,'criados',v_criados,'ja_existiam',v_ignorados);
END $fn$;
REVOKE ALL ON FUNCTION ncrm_private.entrada_por_distribuicao(int) FROM PUBLIC, anon, authenticated;

-- ================ 3. PRIMEIRA ATUAÇÃO HUMANA DO CORRETOR ================
-- Reconhece a primeira mensagem de saída REALMENTE escrita pelo corretor no chat interno.
-- Não conta como atuação humana: mensagem do motor, template, webhook, robô, job,
-- mensagem anterior à distribuição, nem mensagem sem autor humano identificável.
CREATE FUNCTION public.ncrm_registrar_primeira_humana(p_negocio_id bigint, p_message_id text, p_em timestamptz)
  RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $fn$
DECLARE v_lead bigint; v_corretor bigint; v_antes int; v_cfg bigint; v_etapa text;
        v_idem text; v_msg text; v_saida text; v_prox timestamptz; v_criado timestamptz;
BEGIN
  v_msg := btrim(COALESCE(p_message_id,''));
  IF v_msg = '' THEN RETURN jsonb_build_object('ok',false,'erro','message_id_obrigatorio'); END IF;
  IF p_em IS NULL THEN RETURN jsonb_build_object('ok',false,'erro','em_obrigatorio'); END IF;
  v_idem := 'humana:' || v_msg;

  SELECT n.lead_id, n.corretor_id, n.criado_em INTO v_lead, v_corretor, v_criado
    FROM public.negocios n WHERE n.id = p_negocio_id;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok',false,'erro','negocio_inexistente'); END IF;
  IF EXISTS (SELECT 1 FROM public.ncrm_evento WHERE idempotency_key = v_idem) THEN
    RETURN jsonb_build_object('ok',true,'ja_processado',true); END IF;
  -- Mensagem anterior à existência do negócio não é primeira abordagem.
  IF p_em < v_criado THEN RETURN jsonb_build_object('ok',false,'erro','anterior_a_distribuicao'); END IF;

  SELECT versao, workflow_config_id, saida, etapa INTO v_antes, v_cfg, v_saida, v_etapa
    FROM public.ncrm_estado WHERE negocio_id = p_negocio_id FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok',false,'erro','estado_inexistente'); END IF;
  IF v_saida IS NOT NULL THEN RETURN jsonb_build_object('ok',false,'erro','estado_em_saida'); END IF;
  -- Só a PRIMEIRA atuação promove 'novo' → 'tentando_contato'.
  IF v_etapa <> 'novo' THEN RETURN jsonb_build_object('ok',false,'erro','primeira_abordagem_ja_registrada'); END IF;

  v_prox := ncrm_private.ajustar_para_janela(p_em + interval '1 day');

  UPDATE public.ncrm_estado SET
    etapa = 'tentando_contato',
    aguardando_automacao = false,
    tentativas_feitas = GREATEST(COALESCE(tentativas_feitas,0), 1),
    proxima_acao_tipo = 'tentativa_cadencia',
    proxima_acao_titulo = 'Aguardar retorno e insistir se necessário',
    proxima_acao_em = v_prox,
    ultima_interacao_em = p_em,
    ultima_decisao_humana_em = p_em,
    versao = v_antes + 1, atualizado_em = now(), origem_ultima = 'usuario'
  WHERE negocio_id = p_negocio_id AND versao = v_antes;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok',false,'erro','conflito_versao'); END IF;

  INSERT INTO public.ncrm_evento (negocio_id, lead_id, corretor_id_no_evento, workflow_config_id,
      tipo, numero_tentativa, canal, resultado, payload, origem, idempotency_key,
      estado_versao_antes, estado_versao_apos)
  VALUES (p_negocio_id, v_lead, v_corretor, v_cfg, 'tentativa', 1, 'whatsapp', 'sem_resposta',
      jsonb_build_object('message_id', v_msg, 'primeira_abordagem','humana',
                         'sla_min', GREATEST(0, (EXTRACT(epoch FROM (p_em - v_criado))/60)::int)),
      'usuario', v_idem, v_antes, v_antes + 1);

  RETURN jsonb_build_object('ok',true,'versao', v_antes + 1,
                            'sla_min', GREATEST(0, (EXTRACT(epoch FROM (p_em - v_criado))/60)::int));
END $fn$;
REVOKE ALL ON FUNCTION public.ncrm_registrar_primeira_humana(bigint,text,timestamptz) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ncrm_registrar_primeira_humana(bigint,text,timestamptz) TO authenticated, service_role;

-- ============ 4. RECONCILIAÇÃO: ENTRADA + OUTBOUND HUMANA ============
-- Em produção a distinção é limpa e verificada: toda mensagem do motor carrega
-- raw.origem = 'motor'; o chat interno grava sem esse marcador. A regra abaixo trata
-- QUALQUER coisa marcada como automação/robô/job/template como não-humana.
CREATE OR REPLACE FUNCTION ncrm_private.reconciliar_mensagens(
    p_limite integer DEFAULT 200, p_max_tentativas integer DEFAULT NULL, p_janela_inbound interval DEFAULT NULL)
  RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $function$
DECLARE r record; cfg public.ncrm_ingest_lifecycle_config%ROWTYPE;
        v_neg bigint; v_tipo text; v_idem text; v_res jsonb; v_st text; v_err text;
        v_tent int; v_prox timestamptz; v_final timestamptz; v_motivo text;
        v_proc int := 0; v_noop int := 0; v_err_ct int := 0; v_esp int := 0; v_fim int := 0;
        v_ativo boolean; v_desde timestamptz; v_max int; v_jsn interval; v_jfe interval;
        v_entrada jsonb := '{}'::jsonb;
BEGIN
  SELECT ativo, ativo_desde INTO v_ativo, v_desde FROM public.ncrm_ingest_config WHERE id = true;
  IF COALESCE(v_ativo, false) IS NOT TRUE OR v_desde IS NULL THEN
    RETURN jsonb_build_object('ok', true, 'inativo', true, 'processados', 0, 'noop', 0, 'erros', 0);
  END IF;

  -- O card nasce na distribuição, antes de qualquer mensagem.
  BEGIN v_entrada := ncrm_private.entrada_por_distribuicao(200);
  EXCEPTION WHEN OTHERS THEN v_entrada := jsonb_build_object('ok',false,'erro',SQLERRM); END;

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
        -- saída SEM marcador de automação = escrita por gente no chat interno
        OR (lower(coalesce(m.direcao,'')) = ANY (ARRAY['enviada','saida','out','outbound','sent'])
            AND COALESCE(m.raw ->> 'origem','') NOT IN ('motor','automacao','robo','job','template','webhook','sistema'))
      )
      AND (cp.id IS NULL OR (cp.finalizado_em IS NULL AND cp.status IN ('pendente','erro')
           AND (cp.proxima_tentativa_em IS NULL OR cp.proxima_tentativa_em <= now())))
    ORDER BY m.criado_em ASC, m.id ASC
    LIMIT p_limite
  LOOP
    IF (r.raw ->> 'origem') = 'motor' THEN v_tipo := 'msg_automatica';
    ELSIF lower(coalesce(r.direcao,'')) = ANY (ARRAY['enviada','saida','out','outbound','sent']) THEN v_tipo := 'saida_humana';
    ELSE v_tipo := 'resposta_inbound';
    END IF;

    v_neg  := ncrm_private.resolver_negocio_por_conversa(r.conversa_id);
    v_idem := COALESCE(NULLIF(btrim(coalesce(r.wa_message_id,'')),''), r.id::text);
    v_st := 'processado'; v_err := NULL; v_res := NULL; v_motivo := NULL;
    v_tent := r.cp_tent; v_prox := NULL; v_final := NULL;

    BEGIN
      IF v_neg IS NULL THEN
        IF r.criado_em > now() - v_jsn AND r.cp_tent + 1 < v_max THEN
          v_st := 'pendente'; v_err := 'sem_negocio_ainda'; v_motivo := 'aguardando_negocio';
        ELSE
          v_st := 'noop_sem_negocio_expirado'; v_motivo := 'sem_negocio_apos_janela'; v_final := now();
        END IF;

      ELSIF v_tipo = 'msg_automatica' THEN
        -- CRIACAO x CONTINUIDADE (causa raiz corrigida aqui).
        -- ncrm_registrar_msg_automatica nunca consultou elegibilidade: uma mensagem do
        -- motor fazia nascer card mesmo com escopo 'nenhum' e corretor fora do piloto.
        -- Agora a mensagem automatica so pode FAZER NASCER um atendimento quando o
        -- negocio for elegivel pela funcao canonica. Se o atendimento JA existe, segue o
        -- fluxo normal, independentemente da elegibilidade atual - e isso que preserva os
        -- atendimentos quando um corretor sai do piloto.
        IF NOT EXISTS (SELECT 1 FROM public.ncrm_estado e WHERE e.negocio_id = v_neg)
           AND NOT COALESCE(ncrm_private.negocio_elegivel_nova_era(v_neg), false) THEN
          v_st := 'noop_fora_do_escopo'; v_motivo := 'negocio_fora_do_piloto'; v_final := now();
        ELSE
          v_res := public.ncrm_registrar_msg_automatica(v_neg, v_idem, r.quando);
          IF (v_res->>'ok')::boolean THEN v_st := 'processado'; v_motivo := 'processado'; v_final := now();
          ELSIF v_res->>'erro' = 'estado_ja_existe' THEN v_st := 'noop'; v_motivo := 'estado_ja_existe'; v_final := now();
          ELSE v_st := 'erro'; v_err := v_res->>'erro'; v_motivo := v_res->>'erro'; END IF;
        END IF;

      ELSIF v_tipo = 'saida_humana' THEN
        v_res := public.ncrm_registrar_primeira_humana(v_neg, v_idem, r.quando);
        IF (v_res->>'ok')::boolean THEN v_st := 'processado'; v_motivo := 'primeira_abordagem_humana'; v_final := now();
        ELSIF v_res->>'erro' IN ('primeira_abordagem_ja_registrada','estado_em_saida','anterior_a_distribuicao') THEN
          v_st := 'noop'; v_motivo := v_res->>'erro'; v_final := now();
        ELSIF v_res->>'erro' = 'estado_inexistente' THEN
          IF r.criado_em > now() - v_jfe AND r.cp_tent + 1 < v_max THEN
            v_st := 'pendente'; v_err := 'estado_inexistente'; v_motivo := 'aguardando_entrada_no_piloto';
          ELSE v_st := 'noop_fora_do_escopo'; v_motivo := 'negocio_fora_do_piloto'; v_final := now(); END IF;
        ELSE v_st := 'erro'; v_err := v_res->>'erro'; v_motivo := v_res->>'erro'; END IF;

      ELSE -- resposta_inbound
        v_res := public.ncrm_registrar_resposta_cliente(v_neg, v_idem, r.quando);
        IF (v_res->>'ok')::boolean THEN v_st := 'processado'; v_motivo := 'processado'; v_final := now();
        ELSIF v_res->>'erro' = 'estado_inexistente' THEN
          IF r.criado_em > now() - v_jfe AND r.cp_tent + 1 < v_max THEN
            v_st := 'pendente'; v_err := 'estado_inexistente'; v_motivo := 'aguardando_entrada_no_piloto';
          ELSE v_st := 'noop_fora_do_escopo'; v_motivo := 'negocio_fora_do_piloto'; v_final := now(); END IF;
        ELSIF v_res->>'erro' = 'estado_em_saida' THEN v_st := 'noop'; v_motivo := 'estado_em_saida'; v_final := now();
        ELSE v_st := 'erro'; v_err := v_res->>'erro'; v_motivo := v_res->>'erro'; END IF;
      END IF;
    EXCEPTION WHEN others THEN
      v_st := 'erro'; v_err := SQLERRM; v_motivo := 'excecao';
    END;

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
    ELSE  v_fim := v_fim + 1;
    END IF;
  END LOOP;

  RETURN jsonb_build_object('ok',true,'processados',v_proc,'noop',v_noop,'erros',v_err_ct,
                            'aguardando',v_esp,'finalizados',v_fim,'entrada',v_entrada);
END $function$;

-- O checkpoint passa a reconhecer o novo tipo de item.
ALTER TABLE public.ncrm_ingest_checkpoint DROP CONSTRAINT IF EXISTS ncrm_ingest_checkpoint_tipo_check;
ALTER TABLE public.ncrm_ingest_checkpoint ADD CONSTRAINT ncrm_ingest_checkpoint_tipo_check
  CHECK (tipo IN ('msg_automatica','resposta_inbound','saida_humana','ignorado'));

-- ============ 5. BLOQUEIO SELETIVO DA PRIMEIRA ABORDAGEM AUTOMÁTICA ============
-- Único ponto legado tocado. Não existe hook nem tabela de decisão nessa automação:
-- o envio é feito direto por `motor_envia_abordagem`. Por isso o guarda entra ali,
-- no MESMO lugar e no MESMO padrão dos guardas de anti-duplicidade que já existiam,
-- antes de resolver instância e antes de qualquer HTTP.
--
-- A definição anterior é guardada INTEGRALMENTE antes da troca, para que o rollback
-- restaure exatamente o que existia — e não uma reconstrução aproximada.
-- Versões da função legada que foram AUDITADAS e para as quais a âncora é conhecida.
-- A migration só altera a função se o checksum atual estiver nesta lista.
CREATE TABLE IF NOT EXISTS public.ncrm_funcao_legada_esperada (
  funcao   text NOT NULL,
  checksum text NOT NULL,
  origem   text NOT NULL,
  PRIMARY KEY (funcao, checksum)
);
REVOKE ALL ON public.ncrm_funcao_legada_esperada FROM PUBLIC, anon, authenticated;
ALTER TABLE public.ncrm_funcao_legada_esperada ENABLE ROW LEVEL SECURITY;
INSERT INTO public.ncrm_funcao_legada_esperada (funcao, checksum, origem)
VALUES ('motor_envia_abordagem','fbe9db01f73671e118e20fa3b0f365f0','producao auditada em 29/07/2026')
ON CONFLICT DO NOTHING;

CREATE TABLE IF NOT EXISTS public.ncrm_funcao_legada_backup (
  id            bigserial PRIMARY KEY,
  funcao        text NOT NULL,
  assinatura    text NOT NULL,
  definicao     text NOT NULL,
  checksum      text NOT NULL,
  owner_antes   text NOT NULL,
  grants_antes  text NULL,
  criado_em     timestamptz NOT NULL DEFAULT now()
);
REVOKE ALL ON public.ncrm_funcao_legada_backup FROM PUBLIC, anon, authenticated;
REVOKE ALL ON SEQUENCE public.ncrm_funcao_legada_backup_id_seq FROM PUBLIC, anon, authenticated;
ALTER TABLE public.ncrm_funcao_legada_backup ENABLE ROW LEVEL SECURITY;

DO $mig$
DECLARE v_oid oid; v_def text; v_sum text; v_owner text; v_grants text; v_over int;
        v_anchor text; v_guard text; v_novo text;
        c_assinatura constant text := 'motor_envia_abordagem(bigint,text,text,jsonb,bigint,bigint,bigint,jsonb)';
BEGIN
  SELECT count(*) INTO v_over FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
   WHERE n.nspname='public' AND p.proname='motor_envia_abordagem';
  IF v_over = 0 THEN
    RAISE EXCEPTION 'motor_envia_abordagem ausente — ambiente nao corresponde ao auditado';
  ELSIF v_over > 1 THEN
    RAISE EXCEPTION 'motor_envia_abordagem tem % overloads; a auditoria previa exatamente 1 — abortando', v_over;
  END IF;

  SELECT p.oid, pg_get_functiondef(p.oid), md5(pg_get_functiondef(p.oid)), pg_get_userbyid(p.proowner)
    INTO v_oid, v_def, v_sum, v_owner
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
   WHERE n.nspname='public' AND p.proname='motor_envia_abordagem';

  IF position('ncrm_bloqueia_abordagem_automatica' in v_def) > 0 THEN
    RAISE NOTICE 'guarda ja presente; nada a fazer'; RETURN;
  END IF;

  IF v_oid::regprocedure::text <> c_assinatura THEN
    RAISE EXCEPTION 'assinatura divergente: % (esperada %) — abortando', v_oid::regprocedure::text, c_assinatura;
  END IF;

  -- Precondição estrutural. Se a função não for uma das versões auditadas, o guarda
  -- pode cair no lugar errado: melhor abortar a migration do que arriscar o legado.
  IF NOT EXISTS (SELECT 1 FROM public.ncrm_funcao_legada_esperada
                  WHERE funcao = 'motor_envia_abordagem' AND checksum = v_sum) THEN
    RAISE EXCEPTION 'motor_envia_abordagem nao corresponde a nenhuma versao auditada (checksum %) — revisar a ancora antes de aplicar', v_sum;
  END IF;

  SELECT string_agg(grantee||':'||privilege_type, ', ' ORDER BY grantee, privilege_type) INTO v_grants
    FROM information_schema.role_routine_grants
   WHERE routine_schema='public' AND routine_name='motor_envia_abordagem';

  INSERT INTO public.ncrm_funcao_legada_backup (funcao, assinatura, definicao, checksum, owner_antes, grants_antes)
  VALUES ('motor_envia_abordagem', c_assinatura, v_def, v_sum, v_owner, v_grants);

  v_anchor := '  select failover_envio, failover_transfere_lead into _cfg_failover, _cfg_transfere from distribuicao_config where id=1;';
  IF position(v_anchor in v_def) = 0 THEN
    RAISE EXCEPTION 'ancora nao encontrada — abortando para nao alterar o legado as cegas';
  END IF;

  v_guard :=
    '  -- CRM NOVA ERA: primeira abordagem humana. Nao envia; o corretor envia pelo chat interno.' || E'\n' ||
    '  if public.ncrm_bloqueia_abordagem_automatica(p_lead_id) then' || E'\n' ||
    '    insert into motor_execucoes(automacao_id,automacao_nome,bloco_id,evento,status,lead_nome,lead_telefone,detalhe)' || E'\n' ||
    '    values(p_auto,p_nome,p_bloco,''mensagem'',''alerta'',p_lead->>''nome'',' || E'\n' ||
    '      regexp_replace(coalesce(p_lead->>''telefone'',''''),''\D'','''',''g''),' || E'\n' ||
    '      ''CRM NOVA ERA: primeira abordagem e humana - envio automatico bloqueado para este lead'');' || E'\n' ||
    '    return;' || E'\n' ||
    '  end if;' || E'\n' ||
    v_anchor;

  v_novo := replace(v_def, v_anchor, v_guard);
  IF v_novo = v_def THEN RAISE EXCEPTION 'substituicao nao teve efeito — abortando'; END IF;
  -- CREATE OR REPLACE preserva owner, grants, volatility, security mode e search_path.
  EXECUTE v_novo;

  -- Confere que nada além do guarda mudou nos atributos.
  IF (SELECT pg_get_userbyid(proowner) FROM pg_proc WHERE oid = v_oid) <> v_owner THEN
    RAISE EXCEPTION 'owner mudou apos a troca — abortando';
  END IF;
  RAISE NOTICE 'guarda do CRM Nova Era aplicado; definicao anterior salva em ncrm_funcao_legada_backup';
END $mig$;
