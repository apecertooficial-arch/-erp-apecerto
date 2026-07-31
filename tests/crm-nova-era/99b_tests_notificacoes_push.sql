-- =============================================================================
-- NOTIFICACOES IN-APP E WEB PUSH
--
-- Reaproveita as fixtures do harness: corretor 7001 (usuario ...0002, do piloto),
-- corretor 7002 (usuario ...0003, fora), lead 7101.
-- =============================================================================

INSERT INTO public.negocios (id, lead_id, corretor_id, status, stage_id, criado_em)
VALUES (75001, 7101, 7001, 'aberto', 20, now() - interval '3 hours')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.ncrm_estado (negocio_id, workflow_config_id, etapa,
  proxima_acao_tipo, proxima_acao_titulo, proxima_acao_em, origem_ultima, distribuido_em)
SELECT 75001, id, 'novo', 'tentativa_cadencia', 'Primeira abordagem',
       now() - interval '72 hours', 'sistema', now() - interval '3 hours'
  FROM public.ncrm_workflow_config WHERE status='publicada' ORDER BY versao DESC LIMIT 1
ON CONFLICT (negocio_id) DO NOTHING;

-- negocio sem corretor, para as notificacoes de gestao
INSERT INTO public.leads (id, nome, telefone) VALUES (7502,'Cliente Sem Dono','5511900007502')
ON CONFLICT (id) DO NOTHING;
INSERT INTO public.negocios (id, lead_id, corretor_id, status, stage_id, criado_em)
VALUES (75002, 7502, NULL, 'aberto', 20, now() - interval '2 hours')
ON CONFLICT (id) DO NOTHING;
INSERT INTO public.ncrm_estado (negocio_id, workflow_config_id, etapa,
  proxima_acao_tipo, proxima_acao_titulo, proxima_acao_em, origem_ultima, distribuido_em)
SELECT 75002, id, 'novo', 'tentativa_cadencia', 'Distribuir',
       now() + interval '1 hour', 'sistema', now() - interval '2 hours'
  FROM public.ncrm_workflow_config WHERE status='publicada' ORDER BY versao DESC LIMIT 1
ON CONFLICT (negocio_id) DO NOTHING;

-- visita nas proximas horas
INSERT INTO public.visitas (id, corretor_id, negocio_id, lead_id, data, hora_inicio, status)
VALUES ('75000000-0000-0000-0000-000000000001', 7001, 75001, 7101,
        (now() + interval '6 hours')::date, '10:00', 'agendada')
ON CONFLICT (id) DO NOTHING;

SELECT ncrm_private.notificacoes_sincronizar();

-- ------------------------------------------------------------------ geradores
SELECT public.test_assert(
  EXISTS (SELECT 1 FROM public.ncrm_notificacao WHERE chave='novo:75001' AND resolvida_em IS NULL),
  'NT1: lead novo gera notificacao');

SELECT public.test_assert(
  EXISTS (SELECT 1 FROM public.ncrm_notificacao WHERE chave='venc:75001' AND resolvida_em IS NULL),
  'NT2: acao vencida gera notificacao');

SELECT public.test_assert(
  EXISTS (SELECT 1 FROM public.ncrm_notificacao
           WHERE chave='escal:75001' AND publico='gestao' AND tipo='escalonamento'
             AND resolvida_em IS NULL),
  'NT3: escalonamento e de gestao, com chave separada da do corretor');

SELECT public.test_assert(
  EXISTS (SELECT 1 FROM public.ncrm_notificacao
           WHERE chave='semcor:75002' AND publico='gestao' AND resolvida_em IS NULL),
  'NT4: atendimento sem corretor avisa a gestao');

SELECT public.test_assert(
  EXISTS (SELECT 1 FROM public.ncrm_notificacao
           WHERE tipo='visita_proxima' AND resolvida_em IS NULL),
  'NT5: visita nas proximas 24h gera notificacao');

-- falha de sincronizacao: checkpoint preso em erro persistente
INSERT INTO public.ncrm_ingest_checkpoint
  (mensagem_id, wa_message_id, tipo, negocio_id, status, tentativas, motivo_final, atualizado_em)
VALUES (gen_random_uuid(), 'SYNC-TRAVADA', 'saida_humana', 75001, 'erro', 8,
        'excecao:persistente', now())
ON CONFLICT (mensagem_id) DO NOTHING;
SELECT ncrm_private.notificacoes_sincronizar();

SELECT public.test_assert(
  EXISTS (SELECT 1 FROM public.ncrm_notificacao
           WHERE tipo='falha_sincronizacao' AND publico='gestao' AND resolvida_em IS NULL),
  'NT6: conversa presa em erro persistente vira aviso de sincronizacao');

-- ----------------------------------------------------------------- deep-link
SELECT public.test_assert(
  (SELECT deep_link='/negocio/75001' FROM public.ncrm_notificacao WHERE chave='novo:75001'),
  'NT7: notificacao leva a algum lugar');

SELECT public.test_assert(
  NOT EXISTS (SELECT 1 FROM public.ncrm_notificacao WHERE resolvida_em IS NULL AND deep_link IS NULL),
  'NT8: nenhuma notificacao aberta ficou sem destino');

SELECT public.test_assert(
  ncrm_private.deep_link_valido('/negocio/75001')
  AND ncrm_private.deep_link_valido('/gestao/sla')
  AND ncrm_private.deep_link_valido('/meu-dia'),
  'NT9: rotas canonicas do ERP sao aceitas');

SELECT public.test_assert(
  NOT ncrm_private.deep_link_valido('https://exemplo.com/x')
  AND NOT ncrm_private.deep_link_valido('//exemplo.com/x')
  AND NOT ncrm_private.deep_link_valido('/negocio/5511987654321')
  AND NOT ncrm_private.deep_link_valido('/rota-que-nao-existe')
  AND NOT ncrm_private.deep_link_valido('/negocio/1?u=a@b.com'),
  'NT10: URL externa, telefone, e-mail e rota desconhecida sao recusados');

-- CHECK no banco, nao so na funcao
SELECT public.test_expect_error(
  $$UPDATE public.ncrm_notificacao SET deep_link='https://malicioso.example' WHERE chave='novo:75001'$$,
  'ck_ncrm_notif_deep_link',
  'NT11: o banco recusa deep-link externo, nao so a aplicacao');

-- --------------------------------------------------------------------- dedupe
SELECT ncrm_private.notificacoes_sincronizar();
SELECT ncrm_private.notificacoes_sincronizar();
SELECT public.test_assert(
  (SELECT count(*) FROM public.ncrm_notificacao WHERE chave='novo:75001' AND resolvida_em IS NULL)=1,
  'NT12: sincronizar varias vezes nao duplica a mesma pendencia');

-- -------------------------------------------------------------- marcar lida
DO $m$
DECLARE v_id bigint;
BEGIN
  SELECT id INTO v_id FROM public.ncrm_notificacao WHERE chave='venc:75001';
  UPDATE public.ncrm_notificacao SET vista_em = now() WHERE id = v_id;
END $m$;

SELECT public.test_assert(
  (SELECT vista_em IS NOT NULL FROM public.ncrm_notificacao WHERE chave='venc:75001'),
  'NT13: marcar uma como lida funciona');

SELECT public.test_assert(
  (SELECT resolvida_em IS NULL FROM public.ncrm_notificacao WHERE chave='venc:75001'),
  'NT14: marcar como lida nao resolve a pendencia -- ela continua existindo');

-- --------------------------------------------------- resolucao automatica
UPDATE public.ncrm_estado SET etapa='tentando_contato' WHERE negocio_id=75001;
SELECT ncrm_private.notificacoes_sincronizar();

SELECT public.test_assert(
  (SELECT resolvida_em IS NOT NULL AND resolvida_por='automatica'
     FROM public.ncrm_notificacao WHERE chave='novo:75001'),
  'NT15: pendencia que sumiu fecha a notificacao sozinha');

-- ------------------------------------------------------------------ anti-spam
SELECT public.test_assert(
  (SELECT silenciar_ate > now() FROM public.ncrm_notificacao_silencio WHERE chave='novo:75001'),
  'NT16: chave resolvida entra em janela de silencio');

UPDATE public.ncrm_estado SET etapa='novo' WHERE negocio_id=75001;
SELECT ncrm_private.notificacoes_sincronizar();
SELECT public.test_assert(
  NOT EXISTS (SELECT 1 FROM public.ncrm_notificacao WHERE chave='novo:75001' AND resolvida_em IS NULL),
  'NT17: dentro do silencio a pendencia nao volta a piscar');

UPDATE public.ncrm_notificacao_silencio SET silenciar_ate = now() - interval '1 minute'
 WHERE chave='novo:75001';
SELECT ncrm_private.notificacoes_sincronizar();
SELECT public.test_assert(
  EXISTS (SELECT 1 FROM public.ncrm_notificacao WHERE chave='novo:75001' AND resolvida_em IS NULL),
  'NT18: passada a janela, a pendencia real volta a avisar');

SELECT public.test_assert(
  (SELECT repeticoes >= 1 FROM public.ncrm_notificacao WHERE chave='novo:75001' AND resolvida_em IS NULL),
  'NT19: reabertura fica contada, para distinguir cronico de pontual');

-- =============================================================================
-- WEB PUSH
-- =============================================================================

-- dispositivo do corretor do piloto (7001 -> usuario ...0002)
INSERT INTO public.ncrm_push_subscription (usuario_id, endpoint, p256dh, auth, user_agent)
VALUES ('77777777-0000-0000-0000-000000000002','https://push.exemplo/celular','k1','a1','celular')
ON CONFLICT (endpoint) WHERE revogada_em IS NULL DO NOTHING;
-- segundo dispositivo do MESMO usuario
INSERT INTO public.ncrm_push_subscription (usuario_id, endpoint, p256dh, auth, user_agent)
VALUES ('77777777-0000-0000-0000-000000000002','https://push.exemplo/notebook','k2','a2','notebook')
ON CONFLICT (endpoint) WHERE revogada_em IS NULL DO NOTHING;
-- dispositivo de um corretor comum, que NAO pode receber push de gestao
INSERT INTO public.ncrm_push_subscription (usuario_id, endpoint, p256dh, auth, user_agent)
VALUES ('77777777-0000-0000-0000-000000000003','https://push.exemplo/outro','k3','a3','outro')
ON CONFLICT (endpoint) WHERE revogada_em IS NULL DO NOTHING;

SELECT ncrm_private.push_enfileirar(200);

SELECT public.test_assert(
  EXISTS (SELECT 1 FROM public.ncrm_push_fila f
           JOIN public.ncrm_notificacao n ON n.id=f.notificacao_id
          WHERE n.chave='novo:75001'),
  'PU1: notificacao urgente do corretor vira push');

SELECT public.test_assert(
  NOT EXISTS (SELECT 1 FROM public.ncrm_push_fila f
               JOIN public.ncrm_notificacao n ON n.id=f.notificacao_id
              WHERE n.prioridade > 1),
  'PU2: so prioridade 1 vira push; o resto fica para o aplicativo');

-- ---- push de gestao chega a gestor e nao chega a corretor comum
SELECT public.test_assert(
  EXISTS (SELECT 1 FROM public.ncrm_push_fila f
           JOIN public.ncrm_notificacao n ON n.id=f.notificacao_id
           JOIN public.ncrm_push_subscription s ON s.id=f.subscription_id
           JOIN public.usuarios u ON u.id=s.usuario_id
          WHERE n.publico='gestao' AND u.role IN ('admin','diretor','gerente')),
  'PU3: notificacao de gestao chega a quem responde pela operacao');

SELECT public.test_assert(
  NOT EXISTS (SELECT 1 FROM public.ncrm_push_fila f
               JOIN public.ncrm_notificacao n ON n.id=f.notificacao_id
               JOIN public.ncrm_push_subscription s ON s.id=f.subscription_id
               JOIN public.usuarios u ON u.id=s.usuario_id
              WHERE n.publico='gestao' AND u.role NOT IN ('admin','diretor','gerente')),
  'PU4: corretor comum NAO recebe push de gestao');

-- ---- payload minimo
SELECT public.test_assert(
  NOT EXISTS (SELECT 1 FROM public.ncrm_push_fila
               WHERE corpo ~* '(cliente sem dono|cliente piloto|55[0-9]{9,})'),
  'PU5: payload nao carrega nome nem telefone');

SELECT public.test_assert(
  NOT EXISTS (SELECT 1 FROM public.ncrm_push_fila
               WHERE deep_link IS NOT NULL AND NOT ncrm_private.deep_link_valido(deep_link)),
  'PU6: todo deep-link da fila respeita o contrato');

-- ---- idempotencia
SELECT ncrm_private.push_enfileirar(200);
SELECT ncrm_private.push_enfileirar(200);
SELECT public.test_assert(
  NOT EXISTS (SELECT 1 FROM (
    SELECT subscription_id, idempotency_key FROM public.ncrm_push_fila
     GROUP BY 1,2 HAVING count(*) > 1) d),
  'PU7: enfileirar varias vezes nao duplica push para o mesmo dispositivo');

-- ---- claim/lease: dois workers nao levam o mesmo item
DO $c$
DECLARE v_a jsonb; v_b jsonb; v_ids_a text; v_ids_b text;
BEGIN
  v_a := ncrm_private.push_reservar('worker-A', 50, 120);
  v_b := ncrm_private.push_reservar('worker-B', 50, 120);
  CREATE TEMP TABLE _claim (quem text, fila_id bigint) ON COMMIT DROP;
  INSERT INTO _claim SELECT 'A', (x->>'fila_id')::bigint FROM jsonb_array_elements(v_a->'itens') x;
  INSERT INTO _claim SELECT 'B', (x->>'fila_id')::bigint FROM jsonb_array_elements(v_b->'itens') x;
END $c$;

SELECT public.test_assert(
  (SELECT count(*) FROM _claim WHERE quem='A') > 0,
  'PU8: o primeiro worker reserva itens');

SELECT public.test_assert(
  NOT EXISTS (SELECT fila_id FROM _claim GROUP BY fila_id HAVING count(DISTINCT quem) > 1),
  'PU9: dois workers concorrentes nunca recebem o mesmo item');

SELECT public.test_assert(
  NOT EXISTS (SELECT 1 FROM public.ncrm_push_fila
               WHERE status='processando' AND (lease_ate IS NULL OR tentativa_id IS NULL)),
  'PU10: item reservado tem lease e identificador de tentativa');

-- resultado com tentativa errada nao conclui nada
DO $r$
DECLARE v_id bigint;
BEGIN
  SELECT fila_id INTO v_id FROM _claim WHERE quem='A' LIMIT 1;
  PERFORM ncrm_private.push_resultado(v_id, true, 201, NULL, gen_random_uuid());
END $r$;

SELECT public.test_assert(
  (SELECT status='processando' FROM public.ncrm_push_fila
    WHERE id = (SELECT fila_id FROM _claim WHERE quem='A' LIMIT 1)),
  'PU11: worker com reserva vencida nao conclui item de outro');

-- lease vencido devolve o item para a fila
UPDATE public.ncrm_push_fila SET lease_ate = now() - interval '1 minute' WHERE status='processando';
SELECT public.test_assert(
  ncrm_private.push_liberar_leases() > 0,
  'PU12: lease vencido devolve o item para a fila');

SELECT public.test_assert(
  NOT EXISTS (SELECT 1 FROM public.ncrm_push_fila WHERE status='processando'),
  'PU13: worker que morreu no meio nao trava a fila');

-- ---- retry limitado
DO $t$
DECLARE v jsonb; v_id bigint; v_tid uuid;
BEGIN
  FOR i IN 1..3 LOOP
    v := ncrm_private.push_reservar('worker-retry', 1, 120);
    IF jsonb_array_length(v->'itens') = 0 THEN EXIT; END IF;
    v_id  := ((v->'itens'->0)->>'fila_id')::bigint;
    v_tid := ((v->'itens'->0)->>'tentativa_id')::uuid;
    PERFORM ncrm_private.push_resultado(v_id, false, 500, 'erro temporario', v_tid);
    UPDATE public.ncrm_push_fila SET proxima_em = NULL WHERE id = v_id;
  END LOOP;
END $t$;

SELECT public.test_assert(
  EXISTS (SELECT 1 FROM public.ncrm_push_fila WHERE status='descartado' AND tentativas >= 3),
  'PU14: apos tres tentativas o push e descartado, nao fica tentando para sempre');

-- ---- 404/410 revoga o endpoint
INSERT INTO public.ncrm_push_subscription (usuario_id, endpoint, p256dh, auth)
VALUES ('77777777-0000-0000-0000-000000000002','https://push.exemplo/morto','k9','a9')
ON CONFLICT (endpoint) WHERE revogada_em IS NULL DO NOTHING;

INSERT INTO public.ncrm_push_fila (subscription_id, idempotency_key, titulo)
SELECT id, 'teste-410', 'Aviso' FROM public.ncrm_push_subscription
 WHERE endpoint='https://push.exemplo/morto' AND revogada_em IS NULL
ON CONFLICT DO NOTHING;

DO $g$
DECLARE v jsonb; v_id bigint; v_tid uuid;
BEGIN
  SELECT f.id INTO v_id FROM public.ncrm_push_fila f WHERE f.idempotency_key='teste-410';
  UPDATE public.ncrm_push_fila SET status='processando', tentativa_id=gen_random_uuid(),
         lease_ate=now()+interval '2 minutes' WHERE id=v_id RETURNING tentativa_id INTO v_tid;
  PERFORM ncrm_private.push_resultado(v_id, false, 410, 'gone', v_tid);
END $g$;

SELECT public.test_assert(
  (SELECT revogada_em IS NOT NULL AND revogada_motivo='endpoint_expirado'
     FROM public.ncrm_push_subscription WHERE endpoint='https://push.exemplo/morto'),
  'PU15: endpoint expirado e removido na primeira resposta 410');

SELECT public.test_assert(
  (SELECT status='descartado' FROM public.ncrm_push_fila WHERE idempotency_key='teste-410'),
  'PU16: item de endpoint morto nao fica em retry');

SELECT public.test_assert(
  NOT (ncrm_private.push_reservar('worker-check', 50, 60)::text LIKE '%push.exemplo/morto%'),
  'PU17: worker nao recebe endpoint revogado');

-- ---- logout por dispositivo
UPDATE public.ncrm_push_subscription
   SET revogada_em=now(), revogada_motivo='logout', atualizado_em=now()
 WHERE usuario_id='77777777-0000-0000-0000-000000000002'
   AND endpoint='https://push.exemplo/celular' AND revogada_em IS NULL;

SELECT public.test_assert(
  (SELECT revogada_em IS NOT NULL FROM public.ncrm_push_subscription
    WHERE endpoint='https://push.exemplo/celular'),
  'PU18: sair do celular revoga aquele dispositivo');

SELECT public.test_assert(
  (SELECT revogada_em IS NULL FROM public.ncrm_push_subscription
    WHERE endpoint='https://push.exemplo/notebook'),
  'PU19: sair do celular NAO desliga o push do notebook');

-- ---- troca de dono do endpoint
UPDATE public.ncrm_push_subscription
   SET revogada_em=now(), revogada_motivo='substituida'
 WHERE endpoint='https://push.exemplo/notebook' AND revogada_em IS NULL;
INSERT INTO public.ncrm_push_subscription (usuario_id, endpoint, p256dh, auth)
VALUES ('77777777-0000-0000-0000-000000000003','https://push.exemplo/notebook','k5','a5')
ON CONFLICT (endpoint) WHERE revogada_em IS NULL DO NOTHING;

SELECT public.test_assert(
  (SELECT count(*) FROM public.ncrm_push_subscription
    WHERE endpoint='https://push.exemplo/notebook' AND revogada_em IS NULL) = 1,
  'PU20: um endpoint ativo pertence a uma conta so');

-- ---- nada saiu de verdade
SELECT public.test_assert(
  NOT EXISTS (SELECT 1 FROM public.ncrm_push_fila WHERE status='entregue'),
  'PU21: nenhum push foi entregue de verdade durante o harness');

SELECT 'testes de notificacoes e web push concluidos' AS resultado;
