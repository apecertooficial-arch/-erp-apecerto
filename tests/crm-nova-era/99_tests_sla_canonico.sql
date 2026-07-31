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

-- liberado_por e NOT NULL de proposito: entrar na abordagem humana e uma
-- decisao de alguem, nao um estado que aparece sozinho.
INSERT INTO public.ncrm_abordagem_humana (corretor_id, ativo, liberado_por, liberado_em)
VALUES (7001, true, '77777777-0000-0000-0000-000000000001', now())
ON CONFLICT (corretor_id) DO UPDATE SET ativo = true, removido_em = NULL;

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

-- ------------------------------------------------- devolve a config ao estado
-- neutro para nao contaminar as fases seguintes do harness.
UPDATE public.ncrm_entrada_config
   SET vigente_desde = NULL, prazo_primeira_abordagem_min = 15 WHERE id;
DELETE FROM public.ncrm_abordagem_humana WHERE corretor_id = 7001;

SELECT 'testes A-N do criterio canonico de SLA concluidos' AS resultado;
