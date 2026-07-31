-- =============================================================================
-- TESTES A-N: reconhecimento de outbound manual e criterio canonico de SLA
--
-- Os testes A-F cobrem o reconhecedor. Sao os mais importantes: e ali que uma
-- mensagem do motor pode se passar por atuacao humana e inflar a metrica.
-- Os testes G-L cobrem a elegibilidade, um criterio por vez, para que a falha
-- diga qual regra quebrou. M e N cobrem intencao e as invariantes de dados.
-- =============================================================================

-- ---------------------------------------------------------------- A: aceita
SELECT public.test_assert(
  ncrm_private.eh_outbound_manual('{"fromMe":true,"id":"ABC"}'::jsonb, 'enviada'),
  'A: webhook D-API com fromMe=true e outbound manual');

SELECT public.test_assert(
  ncrm_private.eh_outbound_manual('{"from_me":"1"}'::jsonb, 'sent'),
  'A2: aceita from_me="1" e direcao sent');

-- ------------------------------------------------------- B: motor nao conta
SELECT public.test_assert(
  NOT ncrm_private.eh_outbound_manual('{"fromMe":true,"origem":"motor"}'::jsonb, 'enviada'),
  'B: mensagem do motor NAO e abordagem humana, mesmo com fromMe');

-- -------------------------------------------------- C: chat do ERP nao conta
SELECT public.test_assert(
  NOT ncrm_private.eh_outbound_manual('{"fromMe":true,"via":"crm"}'::jsonb, 'enviada'),
  'C: mensagem do chat do ERP NAO e abordagem humana');

-- ------------------------------------------------- D: espelho antigo nao conta
SELECT public.test_assert(
  NOT ncrm_private.eh_outbound_manual('{"fromMe":true,"status":"sent","wa_message_id":"X"}'::jsonb, 'enviada'),
  'D: espelho interno (status + wa_message_id) NAO e abordagem humana');

-- --------------------------------- E: ausencia de marca nunca e prova de envio
SELECT public.test_assert(
  NOT ncrm_private.eh_outbound_manual('{"id":"ABC"}'::jsonb, 'enviada'),
  'E: sem fromMe nao ha reconhecimento; ausencia de campo nao e prova');

SELECT public.test_assert(
  NOT ncrm_private.eh_outbound_manual('{"fromMe":false}'::jsonb, 'enviada'),
  'E2: fromMe=false nao e saida do corretor');

SELECT public.test_assert(
  NOT ncrm_private.eh_outbound_manual(NULL, 'enviada'),
  'E3: raw nulo nao e reconhecido');

-- ------------------------------------------------------- F: entrada nao conta
SELECT public.test_assert(
  NOT ncrm_private.eh_outbound_manual('{"fromMe":true}'::jsonb, 'recebida'),
  'F: mensagem recebida nunca e primeira abordagem do corretor');

-- =============================================================================
-- G-L: elegibilidade para a metrica oficial, um criterio por vez.
-- Faixa 73xxx, livre das fixtures 71xxx/72xxx ja usadas.
-- =============================================================================

INSERT INTO public.negocios (id, lead_id, corretor_id, status, stage_id, criado_em) VALUES
  (73001, 7101, 7001, 'aberto', 20, now() - interval '10 minutes')
ON CONFLICT (id) DO NOTHING;

-- ck_ativo_tem_proxima: card ativo sem proxima acao e card esquecido. A fixture
-- respeita a regra em vez de contorna-la.
INSERT INTO public.ncrm_estado (negocio_id, workflow_config_id, etapa,
  proxima_acao_tipo, proxima_acao_titulo, proxima_acao_em, origem_ultima, distribuido_em)
SELECT 73001, id, 'novo', 'tentativa_cadencia', 'Primeira abordagem',
       now() + interval '5 minutes', 'sistema', now() - interval '10 minutes'
  FROM public.ncrm_workflow_config WHERE status='publicada' ORDER BY versao DESC LIMIT 1
ON CONFLICT (negocio_id) DO NOTHING;

-- ------------------------------------------------- G: sem corte nao ha piloto
UPDATE public.ncrm_entrada_config SET vigente_desde = NULL WHERE id;

SELECT public.test_assert(
  (ncrm_private.elegivel_sla_piloto(73001, now())->>'motivo') = 'sem_corte_definido',
  'G: sem corte declarado, nenhum atendimento entra na metrica');

-- Agora existe corte, mas o corretor ainda nao esta na abordagem humana.
UPDATE public.ncrm_entrada_config
   SET vigente_desde = now() - interval '1 day', prazo_primeira_abordagem_min = 5 WHERE id;
DELETE FROM public.ncrm_abordagem_humana WHERE corretor_id = 7001;

-- ------------------------------------- I: corretor fora da abordagem humana
SELECT public.test_assert(
  (ncrm_private.elegivel_sla_piloto(73001, now())->>'motivo') = 'corretor_fora_da_abordagem_humana',
  'I: corretor fora da abordagem humana nao produz SLA do piloto');

-- =============================================================================
-- PARTICIPACAO HISTORICA NO PILOTO (casos A-F do P0-2)
--
-- A pergunta nao e "o corretor esta no piloto?", e "estava no piloto quando a
-- mensagem saiu?". Se fosse o estado atual, a medicao de julho mudaria de valor
-- toda vez que alguem entrasse ou saisse do piloto depois.
--
-- Referencia de tempo: a mensagem saiu ha 30 minutos.
-- =============================================================================

-- A mensagem de referencia destes casos saiu ha 30 minutos, entao a
-- distribuicao precisa ser anterior a isso. Sem este ajuste o criterio 4
-- (mensagem posterior a distribuicao) recusa antes de chegar na participacao,
-- e o teste mediria outra coisa.
UPDATE public.ncrm_estado SET distribuido_em = now() - interval '1 hour' WHERE negocio_id = 73001;

-- liberado_por e NOT NULL de proposito: entrar na abordagem humana e uma
-- decisao de alguem, nao um estado que aparece sozinho.
INSERT INTO public.ncrm_abordagem_humana (corretor_id, ativo, liberado_por, liberado_em)
VALUES (7001, true, '77777777-0000-0000-0000-000000000001', now() - interval '2 hours')
ON CONFLICT (corretor_id) DO UPDATE SET ativo = true,
  liberado_em = now() - interval '2 hours', removido_em = NULL;

-- A. liberado ANTES da mensagem -> elegivel
SELECT public.test_assert(
  (ncrm_private.elegivel_sla_piloto(73001, now() - interval '30 minutes')->>'elegivel')::boolean,
  'PA: liberado antes da mensagem, elegivel');

-- B. liberado DEPOIS da mensagem -> nao elegivel
UPDATE public.ncrm_abordagem_humana SET liberado_em = now() - interval '10 minutes' WHERE corretor_id = 7001;
SELECT public.test_assert(
  (ncrm_private.elegivel_sla_piloto(73001, now() - interval '30 minutes')->>'motivo')
    = 'corretor_fora_da_abordagem_humana',
  'PB: liberado depois da mensagem, nao elegivel');

-- C. removido ANTES da mensagem -> nao elegivel
UPDATE public.ncrm_abordagem_humana
   SET liberado_em = now() - interval '3 hours', removido_em = now() - interval '2 hours'
 WHERE corretor_id = 7001;
SELECT public.test_assert(
  (ncrm_private.elegivel_sla_piloto(73001, now() - interval '30 minutes')->>'motivo')
    = 'corretor_fora_da_abordagem_humana',
  'PC: removido antes da mensagem, nao elegivel');

-- D. removido DEPOIS da mensagem -> elegivel
UPDATE public.ncrm_abordagem_humana
   SET liberado_em = now() - interval '3 hours', removido_em = now() - interval '10 minutes'
 WHERE corretor_id = 7001;
SELECT public.test_assert(
  (ncrm_private.elegivel_sla_piloto(73001, now() - interval '30 minutes')->>'elegivel')::boolean,
  'PD: removido depois da mensagem, elegivel');

-- E. removido antes do PROCESSAMENTO mas depois da MENSAGEM -> continua elegivel.
-- Este e o caso que o booleano ah.ativo erraria: hoje ele esta fora do piloto,
-- e mesmo assim o fato de 30 minutos atras continua valendo.
UPDATE public.ncrm_abordagem_humana
   SET ativo = false, liberado_em = now() - interval '3 hours', removido_em = now() - interval '5 minutes'
 WHERE corretor_id = 7001;
SELECT public.test_assert(
  (ncrm_private.elegivel_sla_piloto(73001, now() - interval '30 minutes')->>'elegivel')::boolean,
  'PE: removido depois da mensagem e antes do processamento, continua elegivel');
SELECT public.test_assert(
  NOT (SELECT ativo FROM public.ncrm_abordagem_humana WHERE corretor_id = 7001),
  'PE2: e o corretor esta com ativo=false agora, provando que a regra nao le o booleano');

-- F. nunca liberado -> nao elegivel
DELETE FROM public.ncrm_abordagem_humana WHERE corretor_id = 7001;
SELECT public.test_assert(
  (ncrm_private.elegivel_sla_piloto(73001, now() - interval '30 minutes')->>'motivo')
    = 'corretor_fora_da_abordagem_humana',
  'PF: nunca liberado, nao elegivel');

-- estado final para os testes seguintes: liberado ha 2 horas, nunca removido
INSERT INTO public.ncrm_abordagem_humana (corretor_id, ativo, liberado_por, liberado_em)
VALUES (7001, true, '77777777-0000-0000-0000-000000000001', now() - interval '2 hours')
ON CONFLICT (corretor_id) DO UPDATE SET ativo = true,
  liberado_em = now() - interval '2 hours', removido_em = NULL;

-- devolve a distribuicao ao valor que os testes H, K e J esperam
UPDATE public.ncrm_estado SET distribuido_em = now() - interval '10 minutes' WHERE negocio_id = 73001;

-- ------------------------------------------- H: distribuicao antes do corte
UPDATE public.ncrm_estado SET distribuido_em = now() - interval '3 days' WHERE negocio_id = 73001;

SELECT public.test_assert(
  (ncrm_private.elegivel_sla_piloto(73001, now())->>'motivo') = 'distribuido_antes_do_corte',
  'H: lead distribuido antes do corte nao pertence ao piloto');

UPDATE public.ncrm_estado SET distribuido_em = now() - interval '10 minutes' WHERE negocio_id = 73001;

-- --------------------------------------- K: mensagem anterior a distribuicao
SELECT public.test_assert(
  (ncrm_private.elegivel_sla_piloto(73001, now() - interval '30 minutes')->>'motivo')
    = 'mensagem_anterior_a_distribuicao',
  'K: conversa anterior a distribuicao nao e atendimento deste lead');

-- ----------------------------------------- J: ja houve abordagem automatica
UPDATE public.ncrm_estado SET msg_automatica_em = now() - interval '8 minutes' WHERE negocio_id = 73001;

SELECT public.test_assert(
  (ncrm_private.elegivel_sla_piloto(73001, now())->>'motivo') = 'ja_houve_abordagem_automatica',
  'J: se o motor ja abordou, a primeira abordagem nao foi humana');

UPDATE public.ncrm_estado SET msg_automatica_em = NULL WHERE negocio_id = 73001;

-- ------------------------------------ L: todos os criterios juntos = elegivel
SELECT public.test_assert(
  (ncrm_private.elegivel_sla_piloto(73001, now())->>'elegivel')::boolean,
  'L: com corte, distribuicao posterior, corretor no piloto e sem automatica, e elegivel');

SELECT public.test_assert(
  (ncrm_private.elegivel_sla_piloto(73001, now())->>'prazo_min')::int = 5,
  'L2: o prazo vem da configuracao, nao de numero fixo no codigo');

UPDATE public.ncrm_entrada_config SET prazo_primeira_abordagem_min = 15 WHERE id;
SELECT public.test_assert(
  (ncrm_private.elegivel_sla_piloto(73001, now())->>'prazo_min')::int = 15,
  'L3: mudar o prazo na config muda o prazo aplicado');

-- ---------------------------- L4: uma primeira abordagem por atendimento
UPDATE public.ncrm_estado SET primeira_saida_humana_em = now() WHERE negocio_id = 73001;
SELECT public.test_assert(
  (ncrm_private.elegivel_sla_piloto(73001, now())->>'motivo') = 'primeira_saida_ja_registrada',
  'L4: primeira saida ja registrada nao e medida de novo');
UPDATE public.ncrm_estado SET primeira_saida_humana_em = NULL WHERE negocio_id = 73001;

-- =============================================================================
-- M: abrir o WhatsApp e intencao. Nunca contato.
-- =============================================================================
SELECT public.test_assert(
  (SELECT primeira_saida_humana_em IS NULL FROM public.ncrm_estado WHERE negocio_id = 73001),
  'M0: card comeca sem primeira saida humana');

UPDATE public.ncrm_estado SET whatsapp_aberto_em = now() WHERE negocio_id = 73001;

SELECT public.test_assert(
  (SELECT primeira_saida_humana_em IS NULL AND sla_minutos IS NULL AND etapa = 'novo'
     FROM public.ncrm_estado WHERE negocio_id = 73001),
  'M: abrir o WhatsApp nao encerra o SLA, nao move etapa e nao vira contato');

-- A intencao abandonada expira e o card volta a cobrar o corretor.
UPDATE public.ncrm_estado SET whatsapp_aberto_em = now() - interval '3 hours' WHERE negocio_id = 73001;
SELECT ncrm_private.expirar_intencoes_abandonadas(60);

SELECT public.test_assert(
  (SELECT whatsapp_aberto_em IS NULL FROM public.ncrm_estado WHERE negocio_id = 73001),
  'M2: intencao abandonada expira e o card volta a pedir contato');

-- =============================================================================
-- N: invariantes de dados apos a reetiquetagem.
-- =============================================================================
SELECT public.test_assert(
  NOT EXISTS (SELECT 1 FROM public.ncrm_estado
               WHERE sla_evidencia = 'dapi_webhook_outbound_fora_primeira_abordagem'),
  'N: nenhum card ficou com o rotulo da regra anterior');

SELECT public.test_assert(
  NOT EXISTS (SELECT 1 FROM public.ncrm_estado
               WHERE sla_minutos IS NOT NULL AND sla_prazo_min IS NULL),
  'N2: todo SLA medido guarda o prazo que valia na medicao');

SELECT public.test_assert(
  NOT EXISTS (
    SELECT 1 FROM public.ncrm_evento WHERE idempotency_key LIKE 'humana:%'
     GROUP BY idempotency_key HAVING count(*) > 1),
  'N3: um evento de primeira abordagem humana por message_id');

-- A rotina roda sem encontrar nada no harness e nao inventa confirmacao.
SELECT public.test_assert(
  (ncrm_private.confirmar_primeiras_saidas(50)->>'ok')::boolean
  AND (ncrm_private.confirmar_primeiras_saidas(50)->>'confirmadas')::int = 0,
  'N4: sem outbound real sincronizado, nada e confirmado');

-- =============================================================================
-- ACIONAMENTO AUTOMATICO (P0-1)
--
-- Nao chamamos confirmar_primeiras_saidas diretamente. Chamamos o caminho real:
-- ncrm_private.reconciliar_mensagens, que e o que o cron executa a cada minuto.
-- Se a ligacao nao existir, estes testes falham - que e exatamente o ponto.
-- =============================================================================

-- corte declarado e prazo de 5 minutos
UPDATE public.ncrm_entrada_config
   SET vigente_desde = now() - interval '1 day', prazo_primeira_abordagem_min = 5 WHERE id;

-- a sessao da D-API pertence ao corretor 7001
INSERT INTO public.wa_instancias (id, session_id, corretor_id, telefone, status)
VALUES ('aaaaaaaa-0000-0000-0000-000000000001', 'sessao-7001', 7001, '5511900007001', 'connected')
ON CONFLICT (id) DO UPDATE SET corretor_id = 7001;

INSERT INTO public.leads (id, nome, telefone) VALUES (7302, 'Cliente Auto', '5511900007302')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.negocios (id, lead_id, corretor_id, status, stage_id, criado_em)
VALUES (73002, 7302, 7001, 'aberto', 20, now() - interval '10 minutes')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.ncrm_estado (negocio_id, workflow_config_id, etapa,
  proxima_acao_tipo, proxima_acao_titulo, proxima_acao_em, origem_ultima, distribuido_em)
SELECT 73002, id, 'novo', 'tentativa_cadencia', 'Primeira abordagem',
       now() + interval '5 minutes', 'sistema', now() - interval '10 minutes'
  FROM public.ncrm_workflow_config WHERE status='publicada' ORDER BY versao DESC LIMIT 1
ON CONFLICT (negocio_id) DO NOTHING;

INSERT INTO public.wa_contatos (id, lead_id, telefone)
VALUES ('bbbbbbbb-0000-0000-0000-000000000001', 7302, '5511900007302')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.wa_conversas (id, contato_id, instancia_id, status)
VALUES ('cccccccc-0000-0000-0000-000000000001', 'bbbbbbbb-0000-0000-0000-000000000001',
        'aaaaaaaa-0000-0000-0000-000000000001', 'aberta')
ON CONFLICT (id) DO NOTHING;

-- outbound REAL: veio pelo webhook da D-API, com fromMe. Saiu 3 minutos depois
-- da distribuicao, entao esta dentro do prazo de 5.
INSERT INTO public.wa_mensagens (id, wa_message_id, conversa_id, instancia_id, direcao, tipo,
  conteudo, raw, criado_em, enviado_em)
VALUES ('dddddddd-0000-0000-0000-000000000001', 'MSG-AUTO-1',
        'cccccccc-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001',
        'enviada', 'texto', 'oi, tudo bem?', '{"fromMe":true,"id":"MSG-AUTO-1"}'::jsonb,
        now() - interval '7 minutes', now() - interval '7 minutes')
ON CONFLICT (id) DO NOTHING;

-- ---- roda o caminho automatico real, o mesmo que o cron chama
SELECT ncrm_private.reconciliar_mensagens(100);

SELECT public.test_assert(
  (SELECT primeira_saida_humana_em IS NOT NULL FROM public.ncrm_estado WHERE negocio_id = 73002),
  'AUTO1: o caminho automatico confirmou a primeira saida humana');

SELECT public.test_assert(
  (SELECT primeira_saida_message_id = 'MSG-AUTO-1' FROM public.ncrm_estado WHERE negocio_id = 73002),
  'AUTO2: gravou o message_id que veio da D-API');

SELECT public.test_assert(
  (SELECT sla_evidencia = 'dapi_webhook_outbound' FROM public.ncrm_estado WHERE negocio_id = 73002),
  'AUTO3: evidencia e o webhook da D-API, nao o clique');

SELECT public.test_assert(
  (SELECT sla_minutos = 3 AND sla_dentro_5min AND sla_prazo_min = 5
     FROM public.ncrm_estado WHERE negocio_id = 73002),
  'AUTO4: SLA de 3 minutos, dentro do prazo de 5 congelado no registro');

SELECT public.test_assert(
  (SELECT etapa <> 'novo' FROM public.ncrm_estado WHERE negocio_id = 73002),
  'AUTO5: card saiu de novo, porque ha conversa iniciada');

-- ---- autoria do evento (P0-3)
SELECT public.test_assert(
  EXISTS (SELECT 1 FROM public.ncrm_evento
           WHERE idempotency_key = 'humana:MSG-AUTO-1'
             AND origem = 'sistema' AND executado_por IS NULL),
  'AUTO6: evento registrado pela integracao, sem afirmar que um usuario executou');

SELECT public.test_assert(
  (SELECT corretor_id_no_evento = 7001 FROM public.ncrm_evento
    WHERE idempotency_key = 'humana:MSG-AUTO-1'),
  'AUTO7: o corretor continua identificado no evento');

SELECT public.test_assert(
  (SELECT payload->>'enviado_por' = 'whatsapp_nativo_do_corretor'
      AND payload->>'confirmado_por' = 'dapi_webhook'
     FROM public.ncrm_evento WHERE idempotency_key = 'humana:MSG-AUTO-1'),
  'AUTO8: payload diz que a mensagem saiu do WhatsApp do corretor e foi confirmada pela D-API');

-- ---- idempotencia: rodar de novo nao pode duplicar nada
SELECT ncrm_private.reconciliar_mensagens(100);
SELECT ncrm_private.reconciliar_mensagens(100);

SELECT public.test_assert(
  (SELECT count(*) FROM public.ncrm_evento WHERE idempotency_key = 'humana:MSG-AUTO-1') = 1,
  'AUTO9: tres passagens do reconciliador, um unico evento');

SELECT public.test_assert(
  (SELECT count(*) FROM public.ncrm_evento
    WHERE negocio_id = 73002 AND tipo = 'tentativa' AND numero_tentativa = 1) = 1,
  'AUTO10: nenhuma tentativa duplicada pelo caminho legado de reconhecimento');

-- ------------------------------------------------- devolve a config ao estado
-- neutro para nao contaminar as fases seguintes do harness.
UPDATE public.ncrm_entrada_config
   SET vigente_desde = NULL, prazo_primeira_abordagem_min = 15 WHERE id;
DELETE FROM public.ncrm_abordagem_humana WHERE corretor_id = 7001;

SELECT 'testes A-N do criterio canonico de SLA concluidos' AS resultado;
