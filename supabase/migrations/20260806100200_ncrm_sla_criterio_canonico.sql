-- =============================================================================
-- CRITERIO CANONICO DO SLA DE PRIMEIRA ABORDAGEM
--
-- A versao anterior decidia com uma unica pergunta: "o card esta em novo?".
-- Isso nao e criterio. Etapa e consequencia de muita coisa — importacao,
-- movimentacao manual, automacao — e nao diz nada sobre o lead pertencer ao
-- piloto. Card em 'novo' fora do piloto entrava na metrica; card do piloto que
-- ja tinha saido de 'novo' por qualquer motivo ficava de fora.
--
-- Aqui os dois julgamentos ficam separados, porque respondem perguntas
-- diferentes:
--
--   RECONHECIMENTO (historico tecnico)
--     "esta mensagem e, comprovadamente, a primeira saida humana neste
--      atendimento?" — vale para qualquer negocio, dentro ou fora do piloto.
--      Registra quando, qual message_id e move 'novo' -> 'tentando_contato',
--      porque um card em 'novo' com conversa iniciada e uma contradicao.
--
--   METRICA OFICIAL DO PILOTO (SLA)
--     "este atendimento pode ser cobrado pelo prazo de primeira abordagem?"
--      — exige, em conjunto, todos os criterios abaixo. Falhou um, sla_minutos
--      fica NULL e a evidencia registra QUAL criterio falhou.
--
-- So o segundo produz numero. O primeiro produz fato.
-- =============================================================================

-- Qual prazo valia no momento da medicao. Sem isto, mudar o prazo na config
-- reescreveria retroativamente o julgamento de meses anteriores.
ALTER TABLE public.ncrm_estado
  ADD COLUMN IF NOT EXISTS sla_prazo_min integer NULL;

COMMENT ON COLUMN public.ncrm_estado.sla_prazo_min IS
  'Prazo de primeira abordagem vigente quando este SLA foi medido. Congelado de proposito.';
COMMENT ON COLUMN public.ncrm_estado.sla_dentro_5min IS
  'Nome historico. Significa: dentro do prazo vigente, que esta em sla_prazo_min.';

-- ---------------------------------------------------------------------------
-- Elegibilidade para a metrica oficial. Isolada para poder ser testada sozinha
-- e para que a razao da recusa seja sempre nomeada, nunca implicita.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION ncrm_private.elegivel_sla_piloto(
  p_negocio_id bigint, p_quando timestamptz
) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $fn$
DECLARE
  v_corte    timestamptz;
  v_prazo    int;
  v_dist     timestamptz;
  v_auto     timestamptz;
  v_ja       timestamptz;
  v_corretor bigint;
BEGIN
  SELECT c.vigente_desde, c.prazo_primeira_abordagem_min
    INTO v_corte, v_prazo
    FROM public.ncrm_entrada_config c WHERE c.id;

  -- 1. Sem corte declarado nao existe piloto com inicio conhecido. Medir aqui
  --    seria atribuir ao piloto atendimentos anteriores a ele.
  IF v_corte IS NULL THEN
    RETURN jsonb_build_object('elegivel', false, 'motivo', 'sem_corte_definido');
  END IF;

  SELECT e.distribuido_em, e.msg_automatica_em, e.primeira_saida_humana_em, n.corretor_id
    INTO v_dist, v_auto, v_ja, v_corretor
    FROM public.ncrm_estado e
    JOIN public.negocios n ON n.id = e.negocio_id
   WHERE e.negocio_id = p_negocio_id;

  -- 2. Entrada oficial: sem distribuicao registrada nao ha relogio para contar.
  IF v_dist IS NULL THEN
    RETURN jsonb_build_object('elegivel', false, 'motivo', 'sem_distribuicao_registrada');
  END IF;

  -- 3. Distribuicao posterior ao corte.
  IF v_dist < v_corte THEN
    RETURN jsonb_build_object('elegivel', false, 'motivo', 'distribuido_antes_do_corte');
  END IF;

  -- 4. A mensagem tem que vir depois da distribuicao. Antes disso e conversa
  --    preexistente, nao atendimento deste lead.
  IF p_quando < v_dist THEN
    RETURN jsonb_build_object('elegivel', false, 'motivo', 'mensagem_anterior_a_distribuicao');
  END IF;

  -- 5. O corretor precisa estar de fato na abordagem humana.
  IF v_corretor IS NULL THEN
    RETURN jsonb_build_object('elegivel', false, 'motivo', 'negocio_sem_corretor');
  END IF;
  -- Participacao HISTORICA, nao estado atual. ah.ativo responde "o corretor esta
  -- no piloto agora"; a metrica precisa de "estava no piloto quando a mensagem
  -- saiu". Usar o booleano faria a medicao de julho mudar de valor quando alguem
  -- entrasse ou saisse do piloto em agosto.
  --
  -- A janela canonica e liberado_em/removido_em, que sao as colunas temporais da
  -- tabela. liberado_em <= p_quando e (removido_em nulo ou posterior a p_quando).
  -- Removido depois da mensagem continua elegivel: o fato aconteceu sob a regra
  -- vigente na epoca.
  IF NOT EXISTS (SELECT 1 FROM public.ncrm_abordagem_humana ah
                  WHERE ah.corretor_id = v_corretor
                    AND ah.liberado_em IS NOT NULL
                    AND ah.liberado_em <= p_quando
                    AND (ah.removido_em IS NULL OR ah.removido_em > p_quando)) THEN
    RETURN jsonb_build_object('elegivel', false, 'motivo', 'corretor_fora_da_abordagem_humana');
  END IF;

  -- 6. Se o motor ja abordou, a primeira abordagem nao foi humana.
  IF v_auto IS NOT NULL THEN
    RETURN jsonb_build_object('elegivel', false, 'motivo', 'ja_houve_abordagem_automatica');
  END IF;

  -- 7. Uma primeira abordagem por atendimento.
  IF v_ja IS NOT NULL THEN
    RETURN jsonb_build_object('elegivel', false, 'motivo', 'primeira_saida_ja_registrada');
  END IF;

  RETURN jsonb_build_object('elegivel', true, 'motivo', 'elegivel',
                            'prazo_min', COALESCE(v_prazo, 5), 'distribuido_em', v_dist);
END $fn$;

REVOKE ALL ON FUNCTION ncrm_private.elegivel_sla_piloto(bigint,timestamptz) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION ncrm_private.elegivel_sla_piloto(bigint,timestamptz) TO service_role;

-- ---------------------------------------------------------------------------
-- Varre as mensagens recentes e confirma a primeira atuacao humana.
--
-- A associacao precisa ser inequivoca. Nao basta "existe um negocio para este
-- lead": se houver dois abertos, nao sabemos a qual atendimento a mensagem
-- pertence, e chutar contamina a metrica. Do mesmo modo, a instancia que
-- recebeu a mensagem tem que ser a do corretor daquele negocio — senao estamos
-- creditando a um corretor a conversa que saiu do telefone de outro.
--
-- Idempotente por wa_message_id e por primeira_saida_humana_em: reprocessar nao
-- duplica evento nem reescreve a primeira saida ja registrada.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION ncrm_private.confirmar_primeiras_saidas(p_limite int DEFAULT 200)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $fn$
DECLARE
  r record;
  v_conf int := 0; v_visto int := 0; v_com_sla int := 0;
  v_min int; v_eleg jsonb; v_elegivel boolean; v_motivo text; v_prazo int;
  v_cfg bigint; v_evid text;
BEGIN
  FOR r IN
    SELECT m.wa_message_id, m.direcao, m.raw,
           coalesce(m.enviado_em, m.criado_em) AS quando,
           e.negocio_id, e.distribuido_em, e.etapa, e.versao,
           n.corretor_id, n.lead_id
      FROM public.wa_mensagens m
      JOIN public.wa_conversas cv ON cv.id = m.conversa_id
      JOIN public.wa_contatos  ct ON ct.id = cv.contato_id
      JOIN public.negocios     n  ON n.lead_id = ct.lead_id AND n.status = 'aberto'
      JOIN public.ncrm_estado  e  ON e.negocio_id = n.id
      -- associacao inequivoca 1: a instancia que recebeu a mensagem e a do
      -- corretor deste negocio. A tabela certa e wa_instancias, nao instancias:
      -- wa_mensagens.instancia_id e uuid e aponta para o espelho das sessoes da
      -- D-API; public.instancias tem id bigint e e o cadastro do ERP. Cruzar as
      -- duas nao compila, e foi exatamente o que a primeira versao tentou fazer.
      JOIN public.wa_instancias wi ON wi.id = m.instancia_id AND wi.corretor_id = n.corretor_id
     WHERE m.criado_em > now() - interval '2 days'
       AND e.primeira_saida_humana_em IS NULL
       AND ncrm_private.eh_outbound_manual(m.raw, m.direcao)
       AND coalesce(m.wa_message_id,'') <> ''
       AND ct.lead_id IS NOT NULL
       -- associacao inequivoca 2: um unico atendimento aberto para este lead
       AND (SELECT count(*) FROM public.negocios n2
             WHERE n2.lead_id = ct.lead_id AND n2.status = 'aberto') = 1
       -- a mensagem tem que ser posterior a distribuicao
       AND (e.distribuido_em IS NULL OR coalesce(m.enviado_em, m.criado_em) >= e.distribuido_em)
       -- idempotencia por message_id, antes de qualquer escrita
       AND NOT EXISTS (SELECT 1 FROM public.ncrm_evento ev
                        WHERE ev.idempotency_key = 'humana:' || m.wa_message_id)
     ORDER BY m.criado_em
     LIMIT GREATEST(p_limite, 1)
  LOOP
    v_visto := v_visto + 1;

    v_eleg     := ncrm_private.elegivel_sla_piloto(r.negocio_id, r.quando);
    v_elegivel := coalesce((v_eleg->>'elegivel')::boolean, false);
    v_motivo   := coalesce(v_eleg->>'motivo', 'indeterminado');
    v_prazo    := coalesce((v_eleg->>'prazo_min')::int, 5);

    v_min  := GREATEST(0, floor(extract(epoch FROM (r.quando - coalesce(r.distribuido_em, r.quando))) / 60)::int);
    v_evid := CASE WHEN v_elegivel THEN 'dapi_webhook_outbound'
                   ELSE 'dapi_webhook_outbound_sem_sla:' || v_motivo END;

    UPDATE public.ncrm_estado e
       SET primeira_saida_humana_em  = r.quando,
           primeira_saida_message_id = r.wa_message_id,
           sla_minutos               = CASE WHEN v_elegivel THEN v_min ELSE NULL END,
           sla_dentro_5min           = CASE WHEN v_elegivel THEN (v_min <= v_prazo) ELSE NULL END,
           sla_prazo_min             = CASE WHEN v_elegivel THEN v_prazo ELSE NULL END,
           sla_evidencia             = v_evid,
           ultima_interacao_em       = GREATEST(coalesce(e.ultima_interacao_em, r.quando), r.quando),
           -- card em 'novo' com conversa iniciada e contradicao, dentro ou fora
           -- do piloto. Isto e fato, nao metrica.
           etapa                     = CASE WHEN e.etapa = 'novo' THEN 'tentando_contato' ELSE e.etapa END,
           ultima_decisao_humana_em  = r.quando,
           origem_ultima             = 'usuario',
           versao                    = e.versao + 1,
           atualizado_em             = now()
     WHERE e.negocio_id = r.negocio_id
       AND e.primeira_saida_humana_em IS NULL   -- idempotencia
    RETURNING e.workflow_config_id INTO v_cfg;

    IF FOUND THEN
      v_conf := v_conf + 1;
      IF v_elegivel THEN v_com_sla := v_com_sla + 1; END IF;

      UPDATE public.ncrm_whatsapp_intencao
         SET confirmada_em = r.quando
       WHERE negocio_id = r.negocio_id AND confirmada_em IS NULL AND expirada_em IS NULL;

      INSERT INTO public.ncrm_evento (negocio_id, lead_id, corretor_id_no_evento, workflow_config_id,
        tipo, numero_tentativa, canal, resultado, payload, origem, executado_por, idempotency_key,
        estado_versao_antes, estado_versao_apos)
      VALUES (r.negocio_id, r.lead_id, r.corretor_id, v_cfg,
        'tentativa', 1, 'whatsapp', 'sem_resposta',
        jsonb_build_object('message_id', r.wa_message_id, 'primeira_abordagem','humana',
                           'sla_min', CASE WHEN v_elegivel THEN v_min ELSE NULL END,
                           'prazo_min', CASE WHEN v_elegivel THEN v_prazo ELSE NULL END,
                           'conta_para_sla', v_elegivel, 'motivo_elegibilidade', v_motivo,
                           'evidencia','dapi_webhook_outbound',
                           -- quem mandou a mensagem e quem registrou o evento sao
                           -- coisas diferentes, e o payload diz as duas.
                           'enviado_por','whatsapp_nativo_do_corretor',
                           'confirmado_por','dapi_webhook',
                           'registrado_por','reconciliador_ncrm'),
        -- AUTORIA: quem executa esta rotina e o cron, nao o corretor. Gravar
        -- origem 'usuario' com o usuario_id do corretor so porque ele existe
        -- faria a auditoria afirmar que aquela pessoa rodou a RPC - e ela nao
        -- rodou; ela mandou uma mensagem pelo WhatsApp do celular dela.
        -- O corretor continua identificado em corretor_id_no_evento.
        'sistema',
        NULL,
        'humana:' || r.wa_message_id, r.versao, r.versao + 1);
    END IF;
  END LOOP;

  RETURN jsonb_build_object('ok', true, 'avaliadas', v_visto,
                            'confirmadas', v_conf, 'com_sla', v_com_sla);
END $fn$;

REVOKE ALL ON FUNCTION ncrm_private.confirmar_primeiras_saidas(int) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION ncrm_private.confirmar_primeiras_saidas(int) TO service_role;

-- ---------------------------------------------------------------------------
-- Reetiquetagem dos registros produzidos pela regra anterior.
--
-- Em 31/07 a rotina antiga marcou 19 cards com a evidencia
-- 'dapi_webhook_outbound_fora_primeira_abordagem'. Esse rotulo veio do criterio
-- "etapa = novo", que nao e criterio. Nenhum deles recebeu sla_minutos, entao a
-- metrica oficial nao foi contaminada — mas o rotulo descreve um julgamento que
-- nao existe mais.
--
-- Aqui o rotulo e trocado por um que diz a verdade: foram reconhecidos sob a
-- regra anterior e nao entram na metrica. Nao apagamos a primeira saida humana,
-- nao mexemos em etapa, nao criamos evento, nao incrementamos versao e nao
-- reprocessamos nada. Trocar o rotulo nao e reprocessar.
--
-- Reaplicavel: a condicao so encontra o rotulo antigo, que some depois da
-- primeira passagem.
UPDATE public.ncrm_estado
   SET sla_evidencia = 'dapi_webhook_outbound_sem_sla:regra_anterior_revisada'
 WHERE sla_evidencia = 'dapi_webhook_outbound_fora_primeira_abordagem';

-- ---------------------------------------------------------------------------
-- Verificacoes. Falham a migration inteira se a invariante nao valer.
DO $v$
DECLARE v_n int; v_dup int;
BEGIN
  -- 1. Ninguem pode ter SLA gravado sem o prazo que valia na medicao.
  SELECT count(*) INTO v_n FROM public.ncrm_estado
   WHERE sla_minutos IS NOT NULL AND sla_prazo_min IS NULL;
  IF v_n > 0 THEN
    RAISE EXCEPTION 'ABORTADO: % card(s) com SLA sem prazo de referencia', v_n;
  END IF;

  -- 2. O rotulo da regra antiga nao pode ter sobrado.
  SELECT count(*) INTO v_n FROM public.ncrm_estado
   WHERE sla_evidencia = 'dapi_webhook_outbound_fora_primeira_abordagem';
  IF v_n > 0 THEN
    RAISE EXCEPTION 'ABORTADO: % card(s) ainda com o rotulo da regra anterior', v_n;
  END IF;

  -- 3. Um evento de primeira abordagem humana por mensagem. Se a migration
  --    tivesse reprocessado os 19, isto acusaria.
  SELECT count(*) INTO v_dup FROM (
    SELECT idempotency_key FROM public.ncrm_evento
     WHERE idempotency_key LIKE 'humana:%'
     GROUP BY idempotency_key HAVING count(*) > 1
  ) d;
  IF v_dup > 0 THEN
    RAISE EXCEPTION 'ABORTADO: % message_id com evento humano duplicado', v_dup;
  END IF;
END $v$;
