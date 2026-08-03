-- =====================================================================
-- AVISO ANTES DE VENCER + DEEP LINKS QUE EXISTEM + PUSH PARA VENCIDAS
-- ---------------------------------------------------------------------
-- Tres mudancas, um motivo: o push do corretor tem que chegar NA HORA em
-- que da para agir, e o toque nele tem que abrir uma tela que existe.
--
-- 1. Tipo novo `acao_vencendo` (prioridade 1, publico corretor): dispara
--    quando o combinado vence nos proximos 30 minutos. Avisar so DEPOIS
--    de vencido (acao_vencida) e avisar tarde -- o corretor ja falhou
--    quando fica sabendo.
--
-- 2. Deep links do corretor viram /crm?lead=N. Os antigos apontavam para
--    /negocio/N, rota que NAO EXISTE no aplicativo: tocar no push caia
--    numa tela de erro. Os de gestao viram /notificacoes pelo mesmo
--    motivo (/gestao/* tambem nao existe).
--
-- 3. push_enfileirar passa a enfileirar tambem `acao_vencida` (prio 2).
--    "Vai vencer" merece barulho; "venceu" com mais razao ainda. A janela
--    de 1 hora sobre criada_em impede que o historico de vencidas antigas
--    vire uma rajada no primeiro aparelho que se inscrever.
--
-- A lista de tipos urgentes daqui casa com TAGS_URGENTES do sw.js e com
-- TIPOS_URGENTES da edge function ncrm-web-push. Mudou aqui, muda la.
-- =====================================================================

CREATE OR REPLACE FUNCTION ncrm_private.notificacoes_sincronizar()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE v_novas int := 0; v_resolvidas int := 0;
BEGIN
  WITH candidatas AS (
    SELECT 'resp:'||e.negocio_id AS chave, 'cliente_respondeu' AS tipo, 'corretor' AS publico, 1 AS prioridade,
           'Cliente respondeu' AS titulo, 'Responda agora para nao esfriar' AS detalhe,
           e.negocio_id, n.corretor_id, '/crm?lead='||e.negocio_id AS deep_link
      FROM public.ncrm_estado e JOIN public.negocios n ON n.id = e.negocio_id
     WHERE e.saida IS NULL AND e.resposta_pendente
    UNION ALL
    SELECT 'novo:'||e.negocio_id, 'primeira_abordagem_pendente', 'corretor', 1,
           'Lead novo esperando o primeiro contato', 'Chame o cliente pelo WhatsApp',
           e.negocio_id, n.corretor_id, '/crm?lead='||e.negocio_id
      FROM public.ncrm_estado e JOIN public.negocios n ON n.id = e.negocio_id
     WHERE e.saida IS NULL AND e.etapa = 'novo'
    UNION ALL
    -- ANTES de vencer: 30 minutos e tempo de terminar um atendimento e
    -- ainda cumprir o combinado. Prioridade 1 = entra no push.
    SELECT 'vencendo:'||e.negocio_id, 'acao_vencendo', 'corretor', 1,
           'Combinado vence em breve', e.proxima_acao_titulo,
           e.negocio_id, n.corretor_id, '/crm?lead='||e.negocio_id
      FROM public.ncrm_estado e JOIN public.negocios n ON n.id = e.negocio_id
     WHERE e.saida IS NULL AND e.proxima_acao_em IS NOT NULL
       AND e.proxima_acao_em > now()
       AND e.proxima_acao_em <= now() + interval '30 minutes'
    UNION ALL
    SELECT 'venc:'||e.negocio_id, 'acao_vencida', 'corretor', 2,
           'Combinado vencido', e.proxima_acao_titulo,
           e.negocio_id, n.corretor_id, '/crm?lead='||e.negocio_id
      FROM public.ncrm_estado e JOIN public.negocios n ON n.id = e.negocio_id
     WHERE e.saida IS NULL AND e.proxima_acao_em IS NOT NULL AND e.proxima_acao_em < now()
    UNION ALL
    SELECT 'sla:'||e.negocio_id, 'abordagem_fora_do_prazo', 'gestao', 2,
           'Primeira abordagem atrasada', 'O lead entrou e ainda nao foi contatado',
           e.negocio_id, n.corretor_id, '/notificacoes'
      FROM public.ncrm_estado e JOIN public.negocios n ON n.id = e.negocio_id
     WHERE e.saida IS NULL AND e.etapa = 'novo'
       AND e.proxima_acao_em IS NOT NULL AND e.proxima_acao_em < now()
    UNION ALL
    SELECT 'semcor:'||e.negocio_id, 'lead_sem_corretor', 'gestao', 1,
           'Cliente sem corretor', 'Precisa de distribuicao',
           e.negocio_id, NULL::bigint, '/notificacoes'
      FROM public.ncrm_estado e JOIN public.negocios n ON n.id = e.negocio_id
     WHERE e.saida IS NULL AND n.corretor_id IS NULL
    UNION ALL
    SELECT 'visita:'||v.id::text, 'visita_proxima', 'corretor', 2,
           'Visita chegando', 'Confirme com o cliente antes de sair',
           v.negocio_id, v.corretor_id, '/agenda'
      FROM public.visitas v
     WHERE coalesce(v.status,'') NOT IN ('cancelada','realizada','nao_compareceu')
       AND v.data IS NOT NULL
       AND (v.data::date + coalesce(nullif(v.hora_inicio::text,''),'00:00')::time) BETWEEN now() AND now() + interval '24 hours'
    UNION ALL
    SELECT 'sync:'||cp.id::text, 'falha_sincronizacao', 'gestao', 2,
           'Mensagem nao sincronizada', 'Uma conversa nao entrou no CRM',
           cp.negocio_id, NULL::bigint, '/notificacoes'
      FROM public.ncrm_ingest_checkpoint cp
     WHERE cp.status = 'erro'
       AND coalesce(cp.motivo_final,'') LIKE '%persistente%'
       AND cp.atualizado_em > now() - interval '7 days'
    UNION ALL
    SELECT 'escal:'||e.negocio_id, 'escalonamento', 'gestao', 1,
           'Atendimento parado ha muito tempo', 'A acao combinada venceu e ninguem retomou',
           e.negocio_id, n.corretor_id, '/notificacoes'
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

  WITH vivas AS (
    SELECT 'resp:'||negocio_id AS chave FROM public.ncrm_estado WHERE saida IS NULL AND resposta_pendente
    UNION ALL SELECT 'novo:'||negocio_id FROM public.ncrm_estado WHERE saida IS NULL AND etapa='novo'
    UNION ALL SELECT 'vencendo:'||negocio_id FROM public.ncrm_estado
               WHERE saida IS NULL AND proxima_acao_em IS NOT NULL
                 AND proxima_acao_em > now() AND proxima_acao_em <= now() + interval '30 minutes'
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

  DELETE FROM public.ncrm_notificacao_silencio
   WHERE silenciar_ate < now() - interval '30 days';

  RETURN jsonb_build_object('ok', true, 'novas', v_novas, 'resolvidas', v_resolvidas);
END $function$;

CREATE OR REPLACE FUNCTION ncrm_private.push_enfileirar(p_limite integer DEFAULT 200)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE v_corretor int := 0; v_gestao int := 0;
BEGIN
  -- CORRETOR: prioridade 1 (lead novo, cliente respondeu, combinado
  -- vencendo) e tambem acao_vencida -- vencer sem barulho e falhar duas
  -- vezes. O corpo NUNCA leva nome, telefone ou conversa: o pacote passa
  -- por servidor de terceiro antes de chegar ao aparelho.
  INSERT INTO public.ncrm_push_fila
    (subscription_id, notificacao_id, idempotency_key, titulo, corpo, deep_link, tipo)
  SELECT s.id, n.id, 'notif:'||n.id::text,
         n.titulo,
         CASE n.tipo
           WHEN 'cliente_respondeu' THEN 'Um cliente respondeu'
           WHEN 'primeira_abordagem_pendente' THEN 'Um lead novo esta esperando'
           WHEN 'acao_vencendo' THEN 'Um combinado vence em breve'
           WHEN 'acao_vencida' THEN 'Um combinado venceu'
           ELSE 'Abra o aplicativo para ver'
         END,
         n.deep_link, n.tipo
    FROM public.ncrm_notificacao n
    JOIN public.corretores c ON c.id = n.corretor_id
    JOIN public.ncrm_push_subscription s ON s.usuario_id = c.usuario_id AND s.revogada_em IS NULL
   WHERE n.resolvida_em IS NULL AND n.vista_em IS NULL
     AND (n.prioridade = 1 OR n.tipo = 'acao_vencida')
     AND n.publico = 'corretor'
     AND n.criada_em > now() - interval '1 hour'
   LIMIT GREATEST(p_limite, 1)
  ON CONFLICT (subscription_id, idempotency_key) DO NOTHING;
  GET DIAGNOSTICS v_corretor = ROW_COUNT;

  INSERT INTO public.ncrm_push_fila
    (subscription_id, notificacao_id, idempotency_key, titulo, corpo, deep_link, tipo)
  SELECT s.id, n.id, 'notif:'||n.id::text,
         n.titulo,
         CASE n.tipo
           WHEN 'lead_sem_corretor' THEN 'Um atendimento esta sem corretor'
           WHEN 'escalonamento' THEN 'Um atendimento parou'
           WHEN 'falha_sincronizacao' THEN 'Uma conversa nao entrou no CRM'
           ELSE 'Abra o aplicativo para ver'
         END,
         n.deep_link, n.tipo
    FROM public.ncrm_notificacao n
    JOIN public.usuarios u ON coalesce(u.ativo, true)
                          AND u.role IN ('admin','diretor','gerente','executivo')
    JOIN public.ncrm_push_subscription s ON s.usuario_id = u.id AND s.revogada_em IS NULL
   WHERE n.resolvida_em IS NULL AND n.vista_em IS NULL
     AND n.prioridade = 1 AND n.publico = 'gestao'
     AND n.criada_em > now() - interval '1 hour'
   LIMIT GREATEST(p_limite, 1)
  ON CONFLICT (subscription_id, idempotency_key) DO NOTHING;
  GET DIAGNOSTICS v_gestao = ROW_COUNT;

  UPDATE public.ncrm_push_fila f
     SET status = 'descartado', ultimo_erro = 'ja_vista_no_app'
    FROM public.ncrm_notificacao n
   WHERE n.id = f.notificacao_id AND f.status = 'pendente'
     AND (n.vista_em IS NOT NULL OR n.resolvida_em IS NOT NULL);

  RETURN jsonb_build_object('ok', true, 'corretor', v_corretor, 'gestao', v_gestao,
                            'enfileiradas', v_corretor + v_gestao);
END $function$;
