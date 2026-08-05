-- Notificacoes do Funil 2.0: lead novo e acao vencida. So essas duas.
-- JA APLICADA EM PRODUCAO em 04/08/2026. Espelho fiel do banco (item 12 do contrato).
--
-- POR QUE
-- O gerador de avisos lia EXCLUSIVAMENTE o CRM legado (ncrm_estado): 698 avisos em
-- 24h, nenhum olhando f2_lead. Lead que entrava pelo Funil 2.0 nao gerava aviso.
-- Como o Funil 2.0 passa a ser o unico funil, o gerador tinha que ler dele.
--
-- OS DOIS TIPOS (decisao do operador; qualquer outro fica para depois)
--   primeira_abordagem_pendente -> lead novo esperando a primeira abordagem
--   acao_vencida                -> prazo da proxima acao passou sem confirmacao
-- Ambos ja estao em TAGS_URGENTES no sw.js: chegam com som e vibracao, e cada
-- ocorrencia vira um aviso proprio (tag ganha timestamp, nao colapsam).
--
-- QUEM RECEBE: duas vias por evento, com chave distinta (:cor e :ges), porque o
-- indice ux_ncrm_notif_chave_aberta permite uma aberta por chave.
--   'corretor' -> dono do card, via corretores.usuario_id
--   'gestao'   -> usuarios.role in (admin,diretor,gerente,executivo)
--
-- DEEP LINK: ck_ncrm_notif_deep_link so aceita allowlist (/negocio/<id>, /agenda,
-- /gestao/<x>, /meu-dia, /notificacoes). '/crm' e recusado - usamos /negocio/<id>.
--
-- ROLLBACK
--   SELECT cron.unschedule('f2_notificacoes_sincronizar');
--   SELECT cron.schedule('ncrm_notificacoes_sincronizar','*/5 * * * *',
--                        'SELECT ncrm_private.notificacoes_sincronizar();');
--   DROP FUNCTION IF EXISTS public.f2_notificacoes_sincronizar();

CREATE OR REPLACE FUNCTION public.f2_notificacoes_sincronizar()
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE v_novas int := 0; v_resolvidas int := 0;
BEGIN
  CREATE TEMP TABLE _alvo ON COMMIT DROP AS
  WITH base AS (
    SELECT f.id, f.origem_negocio_id, f.corretor_id,
           (f.etapa = 'novo' AND f.momento_codigo = 'PRIMEIRA_ABORDAGEM'
            AND f.ultima_acao_confirmada_em IS NULL) AS eh_novo,
           (f.proxima_acao_em IS NOT NULL AND f.proxima_acao_em < now()
            AND (f.ultima_acao_confirmada_em IS NULL
                 OR f.ultima_acao_confirmada_em < f.proxima_acao_em)) AS eh_vencida,
           CASE WHEN f.origem_negocio_id IS NULL THEN '/notificacoes'
                ELSE '/negocio/'||f.origem_negocio_id::text END AS link
      FROM f2_lead f WHERE f.corretor_id IS NOT NULL
  )
  SELECT 'f2novo:'||b.id::text||':cor' AS chave, 'primeira_abordagem_pendente' AS tipo,
         'corretor' AS publico, 1::smallint AS prioridade,
         'Lead novo esperando' AS titulo, 'Faca a primeira abordagem' AS detalhe,
         b.origem_negocio_id AS negocio_id, b.corretor_id, b.link AS deep_link
    FROM base b WHERE b.eh_novo
  UNION ALL
  SELECT 'f2novo:'||b.id::text||':ges', 'primeira_abordagem_pendente', 'gestao', 1::smallint,
         'Lead novo esperando', 'Faca a primeira abordagem', b.origem_negocio_id, b.corretor_id, b.link
    FROM base b WHERE b.eh_novo
  UNION ALL
  SELECT 'f2venc:'||b.id::text||':cor', 'acao_vencida', 'corretor', 1::smallint,
         'Combinado vencido', 'A proxima acao venceu', b.origem_negocio_id, b.corretor_id, b.link
    FROM base b WHERE b.eh_vencida
  UNION ALL
  SELECT 'f2venc:'||b.id::text||':ges', 'acao_vencida', 'gestao', 1::smallint,
         'Combinado vencido', 'A proxima acao venceu', b.origem_negocio_id, b.corretor_id, b.link
    FROM base b WHERE b.eh_vencida;

  INSERT INTO ncrm_notificacao(chave, tipo, publico, prioridade, titulo, detalhe,
                               negocio_id, corretor_id, deep_link, criada_em)
  SELECT a.chave, a.tipo, a.publico, a.prioridade, a.titulo, a.detalhe,
         a.negocio_id, a.corretor_id, a.deep_link, now()
    FROM _alvo a
  ON CONFLICT (chave) WHERE resolvida_em IS NULL DO NOTHING;
  GET DIAGNOSTICS v_novas = ROW_COUNT;

  UPDATE ncrm_notificacao n SET resolvida_em = now(), resolvida_por = 'f2_sync'
   WHERE n.resolvida_em IS NULL
     AND (n.chave LIKE 'f2novo:%' OR n.chave LIKE 'f2venc:%')
     AND NOT EXISTS (SELECT 1 FROM _alvo a WHERE a.chave = n.chave);
  GET DIAGNOSTICS v_resolvidas = ROW_COUNT;

  RETURN jsonb_build_object('ok', true, 'novas', v_novas, 'resolvidas', v_resolvidas);
END;
$function$;

-- O corpo do push de gestao nao conhecia esses dois tipos e cairia no generico
-- "Abra o aplicativo para ver". Acrescenta os dois ao CASE, sem tocar no resto.
DO $mig$
DECLARE d text; alvo text := 'WHEN ''falha_sincronizacao'' THEN ''Uma conversa nao entrou no CRM''';
BEGIN
  SELECT pg_get_functiondef(p.oid) INTO d FROM pg_proc p
    JOIN pg_namespace n ON n.oid=p.pronamespace
   WHERE n.nspname='ncrm_private' AND p.proname='push_enfileirar';
  IF d IS NULL THEN RAISE EXCEPTION 'push_enfileirar nao encontrada'; END IF;
  IF position('Um lead novo esta esperando no funil' in d) > 0 THEN
    RAISE NOTICE 'corpos de gestao ja ajustados'; RETURN;
  END IF;
  IF strpos(d, alvo) = 0 THEN RAISE EXCEPTION 'ancora do CASE de gestao nao encontrada'; END IF;
  d := replace(d, alvo,
       alvo || E'\n           WHEN ''primeira_abordagem_pendente'' THEN ''Um lead novo esta esperando no funil'''
             || E'\n           WHEN ''acao_vencida'' THEN ''Um combinado venceu no funil''');
  EXECUTE d;
END
$mig$;

-- Cron: desliga o gerador do legado, liga o do Funil 2.0.
SELECT cron.unschedule('ncrm_notificacoes_sincronizar')
 WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname='ncrm_notificacoes_sincronizar');
SELECT cron.schedule('f2_notificacoes_sincronizar', '* * * * *',
                     'SELECT public.f2_notificacoes_sincronizar();')
 WHERE NOT EXISTS (SELECT 1 FROM cron.job WHERE jobname='f2_notificacoes_sincronizar');
