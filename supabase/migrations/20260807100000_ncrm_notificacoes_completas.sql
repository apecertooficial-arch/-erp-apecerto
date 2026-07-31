-- =============================================================================
-- NOTIFICACOES IN-APP: o que faltava
--
-- A base ja existia e esta correta: dedupe real por indice unico parcial em
-- chave, prioridade 1..5, resolucao automatica quando a pendencia some, leitura
-- por RPC SECURITY DEFINER com escopo de corretor/gestor. Nada disso e refeito.
--
-- Esta migration fecha as lacunas:
--   . deep_link, para a notificacao levar a algum lugar em vez de so avisar;
--   . tres geradores que faltavam: visita proxima, falha de sincronizacao e
--     escalonamento;
--   . marcar todas como lidas;
--   . anti-spam: uma pendencia resolvida e reaberta nao volta a piscar antes de
--     uma janela minima;
--   . acionamento por cron, para o contador nao depender de alguem abrir a tela.
-- =============================================================================

ALTER TABLE public.ncrm_notificacao
  ADD COLUMN IF NOT EXISTS deep_link      text NULL,
  ADD COLUMN IF NOT EXISTS silenciar_ate  timestamptz NULL,
  ADD COLUMN IF NOT EXISTS repeticoes     integer NOT NULL DEFAULT 0;

COMMENT ON COLUMN public.ncrm_notificacao.deep_link IS
  'Rota do aplicativo que resolve a pendencia. Notificacao sem destino e so ruido.';
COMMENT ON COLUMN public.ncrm_notificacao.silenciar_ate IS
  'Anti-spam: a mesma chave nao volta a aparecer antes disto.';
COMMENT ON COLUMN public.ncrm_notificacao.repeticoes IS
  'Quantas vezes esta pendencia ja foi aberta, resolvida e reaberta.';

-- Vocabulario: acrescenta os tres tipos que faltavam, preservando os existentes.
ALTER TABLE public.ncrm_notificacao DROP CONSTRAINT IF EXISTS ncrm_notificacao_tipo_check;
ALTER TABLE public.ncrm_notificacao ADD CONSTRAINT ncrm_notificacao_tipo_check
  CHECK (tipo = ANY (ARRAY[
    'lead_novo','primeira_abordagem_pendente','cliente_respondeu','acao_vencida',
    'retorno_proximo','canal_indisponivel','orientacao_sara','lead_sem_corretor',
    'corretor_sobrecarregado','abordagem_fora_do_prazo','falha_entrada','falha_sara',
    'falha_rotina','qualidade_dados',
    'visita_proxima','falha_sincronizacao','escalonamento']));

-- Backfill: notificacoes abertas criadas antes desta migration nasceram sem
-- destino. Deixa-las assim manteria exatamente o problema que deep_link resolve
-- -- o corretor recebe o aviso e nao sabe para onde ir. O destino e derivado do
-- prefixo da chave, que ja identifica o tipo de pendencia.
UPDATE public.ncrm_notificacao
   SET deep_link = CASE
     WHEN chave LIKE 'resp:%'   THEN '/negocio/' || negocio_id || '/conversa'
     WHEN chave LIKE 'novo:%'   THEN '/negocio/' || negocio_id
     WHEN chave LIKE 'venc:%'   THEN '/negocio/' || negocio_id
     WHEN chave LIKE 'sla:%'    THEN '/gestao/sla'
     WHEN chave LIKE 'semcor:%' THEN '/gestao/distribuicao'
     WHEN chave LIKE 'visita:%' THEN '/agenda'
     WHEN chave LIKE 'sync:%'   THEN '/gestao/saude'
     WHEN chave LIKE 'escal:%'  THEN '/gestao/escalonamentos'
     ELSE '/notificacoes'
   END
 WHERE resolvida_em IS NULL AND deep_link IS NULL;

-- O historico de repeticao sobrevive a resolucao: e como sabemos que uma
-- pendencia e cronica em vez de pontual.
CREATE TABLE IF NOT EXISTS public.ncrm_notificacao_silencio (
  chave          text PRIMARY KEY,
  silenciar_ate  timestamptz NOT NULL,
  repeticoes     integer NOT NULL DEFAULT 0,
  atualizado_em  timestamptz NOT NULL DEFAULT now()
);
REVOKE ALL ON public.ncrm_notificacao_silencio FROM PUBLIC, anon, authenticated;
ALTER TABLE public.ncrm_notificacao_silencio ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE public.ncrm_notificacao_silencio IS
  'Janela anti-spam por chave. Sobrevive a resolucao, que e o que permite contar reaberturas.';

-- ---------------------------------------------------------------------------
-- Sincronizador: os cinco geradores de antes, mais tres, todos com destino.
--
-- ESCALONAMENTO nao e "mais uma acao vencida". E a acao que venceu ha tempo
-- suficiente para deixar de ser problema do corretor e virar problema da gestao.
-- Por isso publico 'gestao' e chave propria: o corretor continua vendo a dele.
--
-- FALHA DE SINCRONIZACAO olha o checkpoint de ingest. Uma mensagem presa em erro
-- persistente significa que o CRM esta cego para aquela conversa, e ninguem
-- descobre isso sozinho.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION ncrm_private.notificacoes_sincronizar()
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $fn$
DECLARE v_novas int := 0; v_resolvidas int := 0;
BEGIN
  -- 1. Cria o que esta pendente e ainda nao tem notificacao aberta. O indice
  --    unico parcial faz o dedupe; o LEFT JOIN no silencio impede que uma
  --    pendencia cronica volte a piscar logo depois de resolvida.
  WITH candidatas AS (
    SELECT 'resp:'||e.negocio_id AS chave, 'cliente_respondeu' AS tipo, 'corretor' AS publico, 1 AS prioridade,
           'Cliente respondeu' AS titulo, 'Responda agora para nao esfriar' AS detalhe,
           e.negocio_id, n.corretor_id, '/negocio/'||e.negocio_id||'/conversa' AS deep_link
      FROM public.ncrm_estado e JOIN public.negocios n ON n.id = e.negocio_id
     WHERE e.saida IS NULL AND e.resposta_pendente
    UNION ALL
    SELECT 'novo:'||e.negocio_id, 'primeira_abordagem_pendente', 'corretor', 1,
           'Lead novo esperando o primeiro contato', 'Chame o cliente pelo WhatsApp',
           e.negocio_id, n.corretor_id, '/negocio/'||e.negocio_id
      FROM public.ncrm_estado e JOIN public.negocios n ON n.id = e.negocio_id
     WHERE e.saida IS NULL AND e.etapa = 'novo'
    UNION ALL
    SELECT 'venc:'||e.negocio_id, 'acao_vencida', 'corretor', 2,
           'Combinado vencido', e.proxima_acao_titulo,
           e.negocio_id, n.corretor_id, '/negocio/'||e.negocio_id
      FROM public.ncrm_estado e JOIN public.negocios n ON n.id = e.negocio_id
     WHERE e.saida IS NULL AND e.proxima_acao_em IS NOT NULL AND e.proxima_acao_em < now()
    UNION ALL
    SELECT 'sla:'||e.negocio_id, 'abordagem_fora_do_prazo', 'gestao', 2,
           'Primeira abordagem atrasada', 'O lead entrou e ainda nao foi contatado',
           e.negocio_id, n.corretor_id, '/gestao/sla'
      FROM public.ncrm_estado e JOIN public.negocios n ON n.id = e.negocio_id
     WHERE e.saida IS NULL AND e.etapa = 'novo'
       AND e.proxima_acao_em IS NOT NULL AND e.proxima_acao_em < now()
    UNION ALL
    SELECT 'semcor:'||e.negocio_id, 'lead_sem_corretor', 'gestao', 1,
           'Cliente sem corretor', 'Precisa de distribuicao',
           e.negocio_id, NULL::bigint, '/gestao/distribuicao'
      FROM public.ncrm_estado e JOIN public.negocios n ON n.id = e.negocio_id
     WHERE e.saida IS NULL AND n.corretor_id IS NULL
    UNION ALL
    -- NOVO: visita nas proximas 24 horas.
    SELECT 'visita:'||v.id::text, 'visita_proxima', 'corretor', 2,
           'Visita chegando', 'Confirme com o cliente antes de sair',
           v.negocio_id, v.corretor_id, '/agenda'
      FROM public.visitas v
     WHERE coalesce(v.status,'') NOT IN ('cancelada','realizada','nao_compareceu')
       AND v.data IS NOT NULL
       AND (v.data::date + coalesce(nullif(v.hora_inicio::text,''),'00:00')::time) BETWEEN now() AND now() + interval '24 hours'
    UNION ALL
    -- NOVO: conversa que o CRM nao conseguiu processar. Cegueira silenciosa.
    SELECT 'sync:'||cp.id::text, 'falha_sincronizacao', 'gestao', 2,
           'Mensagem nao sincronizada', 'Uma conversa nao entrou no CRM',
           cp.negocio_id, NULL::bigint, '/gestao/saude'
      FROM public.ncrm_ingest_checkpoint cp
     WHERE cp.status = 'erro'
       AND coalesce(cp.motivo_final,'') LIKE '%persistente%'
       AND cp.atualizado_em > now() - interval '7 days'
    UNION ALL
    -- NOVO: escalonamento. Deixou de ser problema do corretor.
    SELECT 'escal:'||e.negocio_id, 'escalonamento', 'gestao', 1,
           'Atendimento parado ha muito tempo', 'A acao combinada venceu e ninguem retomou',
           e.negocio_id, n.corretor_id, '/gestao/escalonamentos'
      FROM public.ncrm_estado e JOIN public.negocios n ON n.id = e.negocio_id
     WHERE e.saida IS NULL AND e.proxima_acao_em IS NOT NULL
       AND e.proxima_acao_em < now() - interval '48 hours'
  )
  INSERT INTO public.ncrm_notificacao
    (chave, tipo, publico, prioridade, titulo, detalhe, negocio_id, corretor_id, deep_link, repeticoes)
  SELECT c.chave, c.tipo, c.publico, c.prioridade, c.titulo, c.detalhe,
         c.negocio_id, c.corretor_id, c.deep_link, coalesce(s.repeticoes, 0)
    FROM candidatas c
    LEFT JOIN public.ncrm_notificacao_silencio s ON s.chave = c.chave
   WHERE s.silenciar_ate IS NULL OR s.silenciar_ate <= now()
  ON CONFLICT DO NOTHING;
  GET DIAGNOSTICS v_novas = ROW_COUNT;

  -- 2. Resolucao automatica: a pendencia sumiu, a notificacao sai do contador.
  WITH vivas AS (
    SELECT 'resp:'||negocio_id AS chave FROM public.ncrm_estado WHERE saida IS NULL AND resposta_pendente
    UNION ALL SELECT 'novo:'||negocio_id FROM public.ncrm_estado WHERE saida IS NULL AND etapa='novo'
    UNION ALL SELECT 'venc:'||negocio_id FROM public.ncrm_estado
               WHERE saida IS NULL AND proxima_acao_em IS NOT NULL AND proxima_acao_em < now()
    UNION ALL SELECT 'sla:'||e.negocio_id FROM public.ncrm_estado e
               WHERE e.saida IS NULL AND e.etapa='novo' AND e.proxima_acao_em IS NOT NULL AND e.proxima_acao_em < now()
    UNION ALL SELECT 'semcor:'||e.negocio_id FROM public.ncrm_estado e JOIN public.negocios n ON n.id=e.negocio_id
               WHERE e.saida IS NULL AND n.corretor_id IS NULL
    UNION ALL SELECT 'visita:'||v.id::text FROM public.visitas v
               WHERE coalesce(v.status,'') NOT IN ('cancelada','realizada','nao_compareceu')
                 AND v.data IS NOT NULL
                 AND (v.data::date + coalesce(nullif(v.hora_inicio::text,''),'00:00')::time) BETWEEN now() AND now() + interval '24 hours'
    UNION ALL SELECT 'sync:'||cp.id::text FROM public.ncrm_ingest_checkpoint cp
               WHERE cp.status='erro' AND coalesce(cp.motivo_final,'') LIKE '%persistente%'
                 AND cp.atualizado_em > now() - interval '7 days'
    UNION ALL SELECT 'escal:'||e.negocio_id FROM public.ncrm_estado e
               WHERE e.saida IS NULL AND e.proxima_acao_em IS NOT NULL
                 AND e.proxima_acao_em < now() - interval '48 hours'
  ), fechadas AS (
    UPDATE public.ncrm_notificacao n
       SET resolvida_em = now(), resolvida_por = 'automatica'
     WHERE n.resolvida_em IS NULL AND n.chave NOT IN (SELECT chave FROM vivas)
    RETURNING n.chave, n.repeticoes
  )
  -- 3. Anti-spam: ao fechar, a chave entra em silencio. Quanto mais a mesma
  --    pendencia reabre, maior a janela, ate um teto de 6 horas.
  INSERT INTO public.ncrm_notificacao_silencio (chave, silenciar_ate, repeticoes, atualizado_em)
  SELECT f.chave,
         now() + make_interval(mins => LEAST(15 * (f.repeticoes + 1), 360)),
         f.repeticoes + 1, now()
    FROM fechadas f
  ON CONFLICT (chave) DO UPDATE
    SET silenciar_ate = EXCLUDED.silenciar_ate,
        repeticoes    = public.ncrm_notificacao_silencio.repeticoes + 1,
        atualizado_em = now();
  GET DIAGNOSTICS v_resolvidas = ROW_COUNT;

  -- 4. Higiene: silencios vencidos ha muito tempo nao precisam ficar.
  DELETE FROM public.ncrm_notificacao_silencio
   WHERE silenciar_ate < now() - interval '30 days';

  RETURN jsonb_build_object('ok', true, 'novas', v_novas, 'resolvidas', v_resolvidas);
END $fn$;

REVOKE ALL ON FUNCTION ncrm_private.notificacoes_sincronizar() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION ncrm_private.notificacoes_sincronizar() TO service_role;

-- ---------------------------------------------------------------------------
-- Marcar todas como lidas. So marca o que o usuario realmente alcanca: a funcao
-- repete o escopo da leitura em vez de confiar num id vindo do app.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.ncrm_notificacoes_marcar_todas()
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $fn$
DECLARE v_uid uuid := auth.uid(); v_gestor boolean; v_corretor bigint; v_n int;
BEGIN
  IF v_uid IS NULL THEN RETURN jsonb_build_object('ok',false,'erro','nao_autenticado'); END IF;
  v_gestor   := COALESCE(public.can_manage_all(), false);
  v_corretor := public.current_broker_id();

  UPDATE public.ncrm_notificacao
     SET vista_em = now()
   WHERE resolvida_em IS NULL AND vista_em IS NULL
     AND ( (v_gestor AND publico = 'gestao')
        OR (publico = 'corretor' AND (v_gestor OR corretor_id = v_corretor
             OR COALESCE(public.manages_broker(corretor_id), false))) );
  GET DIAGNOSTICS v_n = ROW_COUNT;

  RETURN jsonb_build_object('ok', true, 'marcadas', v_n);
END $fn$;

REVOKE ALL ON FUNCTION public.ncrm_notificacoes_marcar_todas() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ncrm_notificacoes_marcar_todas() TO authenticated, service_role;

COMMENT ON FUNCTION public.ncrm_notificacoes_marcar_todas() IS
  'Marca como lidas apenas as notificacoes que o proprio usuario alcanca. Nao aceita lista de ids do cliente.';

-- ---------------------------------------------------------------------------
-- Leitura: mesmo escopo de antes, agora devolvendo deep_link e reaberturas.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.ncrm_notificacoes()
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $fn$
DECLARE v_uid uuid := auth.uid(); v_gestor boolean; v_corretor bigint;
BEGIN
  IF v_uid IS NULL THEN RETURN jsonb_build_object('ok',false,'erro','nao_autenticado'); END IF;
  PERFORM ncrm_private.notificacoes_sincronizar();
  v_gestor := COALESCE(public.can_manage_all(), false);
  v_corretor := public.current_broker_id();

  RETURN (SELECT jsonb_build_object('ok',true,'gestor',v_gestor,
    'pendentes', count(*),
    'urgentes', count(*) FILTER (WHERE prioridade = 1),
    'nao_vistas', count(*) FILTER (WHERE vista_em IS NULL),
    'itens', COALESCE(jsonb_agg(jsonb_build_object(
        'id', id, 'tipo', tipo, 'titulo', titulo, 'detalhe', detalhe,
        'negocio_id', negocio_id, 'prioridade', prioridade, 'desde', criada_em,
        'deep_link', deep_link, 'reaberturas', repeticoes,
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
GRANT EXECUTE ON FUNCTION public.ncrm_notificacoes() TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Acionamento: ate agora o sincronizador so rodava quando alguem abria a tela.
-- Isso basta para o contador, mas nao para o Push, que precisa existir mesmo com
-- o aplicativo fechado.
-- ---------------------------------------------------------------------------
DO $cron$
BEGIN
  IF to_regclass('cron.job') IS NULL THEN
    RAISE NOTICE 'pg_cron ausente (harness); agendamento ignorado'; RETURN;
  END IF;
  PERFORM cron.unschedule('ncrm_notificacoes_sincronizar')
    WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'ncrm_notificacoes_sincronizar');
  PERFORM cron.schedule('ncrm_notificacoes_sincronizar', '*/5 * * * *',
                        'SELECT ncrm_private.notificacoes_sincronizar();');
  RAISE NOTICE 'sincronizacao de notificacoes agendada a cada 5 minutos';
END $cron$;
