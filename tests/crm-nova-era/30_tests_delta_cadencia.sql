-- Testes do ÚLTIMO DELTA OPERACIONAL: cadência calculada pelo banco, última tentativa,
-- contador de tentativas, resposta durante tentativa, prazo adulterado ignorado, imutabilidade
-- de passo (mover publicada->rascunho), publicada com vigencia_fim, timestamps NULL.
-- Roda DEPOIS de 20_tests_correcoes.sql (que encerra a config v1). Cria uma config v2 própria.
\set ON_ERROR_STOP on
\set QUIET on
SET client_min_messages TO notice;
\set A '''cccccccc-0000-0000-0000-000000000001'''

-- ---------------------------------------------------------------------------
-- Setup: config v2 publicada (janela larga p/ o clamp não empurrar), passos determinísticos,
-- e negócios novos (corretor A=10). Executa como superusuário local.
-- ---------------------------------------------------------------------------
RESET ROLE;
INSERT INTO public.ncrm_workflow_config (versao, status, timezone, janela_inicio, janela_fim, espera_apos_automacao_min, max_tentativas)
VALUES (2, 'rascunho', 'America/Sao_Paulo', time '00:00', time '23:59', 30, 4);
SELECT id AS cfg2 FROM public.ncrm_workflow_config WHERE versao=2 \gset
INSERT INTO public.ncrm_workflow_passo (config_id, ordem, canal_sugerido, intervalo_min, rotulo) VALUES
  (:cfg2,1,'ligacao',30,'v2-passo-1'),
  (:cfg2,2,'whatsapp',60,'v2-passo-2'),
  (:cfg2,3,'ligacao',90,'v2-passo-3'),
  (:cfg2,4,'whatsapp',120,'v2-passo-4');
UPDATE public.ncrm_workflow_config SET status='publicada', vigencia_inicio=now() WHERE id=:cfg2;

INSERT INTO public.leads (id, nome) SELECT g, 'Lead '||g FROM generate_series(31,40) g;
INSERT INTO public.negocios (id, lead_id, corretor_id, status) VALUES
  (900,31,10,'aberto'),(901,32,10,'aberto'),(902,33,10,'aberto'),
  (903,34,10,'aberto'),(904,35,10,'aberto'),(905,36,10,'aberto'),(906,37,10,'aberto');

-- Cria estados (automação/service_role)
SET ROLE service_role; SELECT set_config('request.jwt.claims','{}',false);
SELECT public.ncrm_registrar_msg_automatica(900,'d900',now());
SELECT public.ncrm_registrar_msg_automatica(901,'d901',now());
SELECT public.ncrm_registrar_msg_automatica(902,'d902',now());
SELECT public.ncrm_registrar_msg_automatica(903,'d903',now());
SELECT public.ncrm_registrar_msg_automatica(904,'d904',now());
SELECT public.ncrm_registrar_msg_automatica(905,'d905',now());
SELECT public.ncrm_registrar_msg_automatica(906,'d906',now());
RESET ROLE;

-- ===== D1: cliente envia prazo adulterado; o BANCO ignora e calcula pelo passo (900) =====
SELECT set_config('request.jwt.claims', json_build_object('sub',:A,'role','authenticated')::text, false); SET ROLE authenticated;
SELECT versao AS v FROM public.ncrm_estado WHERE negocio_id=900 \gset
-- passa tipo/título/prazo adulterados; resultado SEM resposta -> tudo recalculado
SELECT public.ncrm_registrar_tentativa(900,:v,'ligacao','nao_respondeu','1ª','preparar_proposta','TITULO FALSO', now()+interval '999 days','ui:d900');
SELECT public.test_assert((SELECT proxima_acao_tipo='tentativa_cadencia' AND proxima_acao_titulo='v2-passo-2'
                           FROM public.ncrm_estado WHERE negocio_id=900),
  'D1: próxima ação derivada do passo 2 (título/tipo do banco, não do cliente)');
SELECT public.test_assert((SELECT proxima_acao_em < now()+interval '2 days' AND proxima_acao_em > now()
                           FROM public.ncrm_estado WHERE negocio_id=900),
  'D1: prazo adulterado (999 dias) IGNORADO; banco usa intervalo do passo');
SELECT public.test_assert((SELECT payload->>'passo_executado'='1' AND payload->>'proximo_passo'='2'
                           AND payload->>'canal_executado'='ligacao' AND payload->>'canal_sugerido_seguinte'='whatsapp'
                           AND (payload->>'config_versao')::int=2
                           FROM public.ncrm_evento WHERE idempotency_key='ui:d900'),
  'D1: payload registra passo executado/próximo/canais/config');
RESET ROLE;

-- ===== D2: 1ª..4ª tentativas avançam pelo workflow_passo; após a 4ª -> avaliar_descarte (901) =====
SELECT set_config('request.jwt.claims', json_build_object('sub',:A,'role','authenticated')::text, false); SET ROLE authenticated;
SELECT versao AS v FROM public.ncrm_estado WHERE negocio_id=901 \gset
SELECT public.ncrm_registrar_tentativa(901,:v,'ligacao','nao_respondeu','1','x','x', now(),'ui:901a');
SELECT public.test_assert((SELECT tentativas_feitas=1 AND proxima_acao_tipo='tentativa_cadencia' AND proxima_acao_titulo='v2-passo-2' FROM public.ncrm_estado WHERE negocio_id=901),'D2: após 1ª -> passo 2');
SELECT versao AS v FROM public.ncrm_estado WHERE negocio_id=901 \gset
SELECT public.ncrm_registrar_tentativa(901,:v,'whatsapp','nao_respondeu','2','x','x', now(),'ui:901b');
SELECT public.test_assert((SELECT tentativas_feitas=2 AND proxima_acao_titulo='v2-passo-3' FROM public.ncrm_estado WHERE negocio_id=901),'D2: após 2ª -> passo 3');
SELECT versao AS v FROM public.ncrm_estado WHERE negocio_id=901 \gset
SELECT public.ncrm_registrar_tentativa(901,:v,'ligacao','nao_respondeu','3','x','x', now(),'ui:901c');
SELECT public.test_assert((SELECT tentativas_feitas=3 AND proxima_acao_titulo='v2-passo-4' FROM public.ncrm_estado WHERE negocio_id=901),'D2: após 3ª -> passo 4');
SELECT versao AS v FROM public.ncrm_estado WHERE negocio_id=901 \gset
SELECT public.ncrm_registrar_tentativa(901,:v,'whatsapp','nao_respondeu','4','x','x', now(),'ui:901d');
SELECT public.test_assert((SELECT tentativas_feitas=4 AND proxima_acao_tipo='avaliar_descarte' AND proxima_acao_titulo='Avaliar descarte ou nutrição' AND saida IS NULL
                           FROM public.ncrm_estado WHERE negocio_id=901),'D2/D3: após 4ª -> avaliar_descarte (lead ativo, sem saída)');
-- não existe 5ª tarefa de tentativa agendada (próxima ação não é tentativa_cadencia)
SELECT public.test_assert((SELECT proxima_acao_tipo <> 'tentativa_cadencia' FROM public.ncrm_estado WHERE negocio_id=901),'D3: nenhuma 5ª tarefa de tentativa agendada');
-- 5ª tentativa é rejeitada
SELECT versao AS v FROM public.ncrm_estado WHERE negocio_id=901 \gset
SELECT public.test_assert((public.ncrm_registrar_tentativa(901,:v,'whatsapp','nao_respondeu','5','x','x', now(),'ui:901e') ->> 'erro')='cadencia_esgotada','D3: 5ª tentativa rejeitada (cadencia_esgotada)');
-- numero_tentativa dos eventos coincide com o estado (1,2,3,4) e o máximo == tentativas_feitas
SELECT public.test_assert((SELECT array_agg(numero_tentativa ORDER BY numero_tentativa) FROM public.ncrm_evento WHERE negocio_id=901 AND tipo='tentativa') = ARRAY[1,2,3,4],'D6: numero_tentativa sequencial 1..4');
SELECT public.test_assert((SELECT max(numero_tentativa) FROM public.ncrm_evento WHERE negocio_id=901 AND tipo='tentativa') = (SELECT tentativas_feitas FROM public.ncrm_estado WHERE negocio_id=901),'D6: max(numero_tentativa) == tentativas_feitas');
-- após a última, o corretor ainda pode descartar (lead permaneceu operável)
SELECT versao AS v FROM public.ncrm_estado WHERE negocio_id=901 \gset
SELECT public.test_assert((public.ncrm_saida_descarte(901,:v,'sem_interesse',NULL,'ui:901desc') ->> 'ok')::boolean,'D3: após esgotar, corretor descarta normalmente');
RESET ROLE;

-- ===== D4: tentativa que ENCONTROU resposta incrementa o contador e encerra a cadência (902) =====
SELECT set_config('request.jwt.claims', json_build_object('sub',:A,'role','authenticated')::text, false); SET ROLE authenticated;
SELECT versao AS v FROM public.ncrm_estado WHERE negocio_id=902 \gset
SELECT public.ncrm_registrar_tentativa(902,:v,'ligacao','nao_respondeu','1','x','x', now(),'ui:902a');   -- tentativas -> 1
SELECT versao AS v FROM public.ncrm_estado WHERE negocio_id=902 \gset
SELECT public.test_assert((public.ncrm_registrar_tentativa(902,:v,'whatsapp','respondeu','falou','entender_necessidade','Entender', now()+interval '1 day','ui:902b') ->> 'ok')::boolean,'D4: tentativa com resposta ok');
SELECT public.test_assert((SELECT tentativas_feitas=2 AND respondeu AND resposta_pendente AND proxima_acao_tipo='entender_necessidade' FROM public.ncrm_estado WHERE negocio_id=902),'D4: resposta incrementou contador (2) e exigiu ação comercial');
SELECT public.test_assert((SELECT numero_tentativa FROM public.ncrm_evento WHERE idempotency_key='ui:902b')=2,'D4: numero_tentativa do evento respondido == 2');
-- prospecção posterior negada
SELECT versao AS v FROM public.ncrm_estado WHERE negocio_id=902 \gset
SELECT public.test_assert((public.ncrm_registrar_tentativa(902,:v,'whatsapp','nao_respondeu','x','x','x', now(),'ui:902c') ->> 'erro')='cadencia_encerrada','D4: prospecção após resposta negada');
-- responder via tentativa exige ação COMERCIAL (não cadência) e prazo válido
SELECT versao AS v FROM public.ncrm_estado WHERE negocio_id=906 \gset
SELECT public.test_assert((public.ncrm_registrar_tentativa(906,:v,'ligacao','respondeu','ok','tentativa_cadencia','x', now()+interval '1 day','ui:906a') ->> 'erro')='proxima_acao_fora_do_fluxo','D4: resposta com próxima=cadência é rejeitada');
SELECT versao AS v FROM public.ncrm_estado WHERE negocio_id=906 \gset
SELECT public.test_assert((public.ncrm_registrar_tentativa(906,:v,'ligacao','respondeu','ok',NULL,NULL,NULL,'ui:906b') ->> 'erro')='proxima_acao_obrigatoria','D4: resposta sem próxima ação é rejeitada');
SELECT public.test_assert((public.ncrm_registrar_tentativa(906,:v,'ligacao','respondeu','ok','entender_necessidade','E', now()-interval '1 day','ui:906c') ->> 'erro')='proxima_acao_em_no_passado','D4: resposta com prazo no passado é rejeitada');
RESET ROLE;

-- ===== D5: resposta inbound (WhatsApp) NÃO incrementa tentativas; automação inicial também não =====
SELECT set_config('request.jwt.claims', json_build_object('sub',:A,'role','authenticated')::text, false); SET ROLE authenticated;
SELECT versao AS v FROM public.ncrm_estado WHERE negocio_id=903 \gset
SELECT public.ncrm_registrar_tentativa(903,:v,'ligacao','nao_respondeu','1','x','x', now(),'ui:903a');   -- tentativas -> 1
RESET ROLE;
SET ROLE service_role; SELECT set_config('request.jwt.claims','{}',false);
SELECT public.ncrm_registrar_resposta_cliente(903,'wa903',now());                                       -- inbound NÃO conta
RESET ROLE;
SELECT public.test_assert((SELECT tentativas_feitas=1 AND respondeu FROM public.ncrm_estado WHERE negocio_id=903),'D5: inbound não incrementa tentativas (permanece 1)');
SELECT public.test_assert((SELECT tentativas_feitas=0 FROM public.ncrm_estado WHERE negocio_id=904),'D5: automação inicial não conta como tentativa (904=0)');

-- ===== D7: imutabilidade — mover passo de config PUBLICADA para RASCUNHO negado =====
RESET ROLE;
-- Versão fictícia isolada: a versão 3 passou a ser o workflow operacional real.
INSERT INTO public.ncrm_workflow_config (versao, status, max_tentativas) VALUES (3003,'rascunho',4);
SELECT id AS cfg3 FROM public.ncrm_workflow_config WHERE versao=3003 \gset
SELECT public.test_expect_error('UPDATE public.ncrm_workflow_passo SET config_id='||:cfg3||' WHERE config_id='||:cfg2||' AND ordem=1','passos_imutaveis','D7: mover passo de config publicada->rascunho negado');
SELECT public.test_assert((SELECT count(*) FROM public.ncrm_workflow_passo WHERE config_id=:cfg2)=4,'D7: passos da config publicada intactos');

-- ===== D8: config PUBLICADA não pode receber vigencia_fim sem virar encerrada =====
SELECT public.test_expect_error('UPDATE public.ncrm_workflow_config SET vigencia_fim=now() WHERE id='||:cfg2,'config_publicada_nao_recebe_vigencia_fim','D8: publicada com vigencia_fim (sem encerrar) negada');
SELECT public.test_assert((SELECT status='publicada' AND vigencia_fim IS NULL FROM public.ncrm_workflow_config WHERE id=:cfg2),'D8: config v2 permanece publicada e sem vigencia_fim');

-- ===== D9: timestamps NULL rejeitados com erros controlados =====
SET ROLE service_role; SELECT set_config('request.jwt.claims','{}',false);
SELECT public.test_assert((public.ncrm_registrar_msg_automatica(904,'nullts',NULL) ->> 'erro')='enviado_em_obrigatorio','D9: msg_automatica enviado_em NULL rejeitado');
SELECT public.test_assert((public.ncrm_registrar_resposta_cliente(905,'nullwa',NULL) ->> 'erro')='em_obrigatorio','D9: resposta_cliente p_em NULL rejeitado');
RESET ROLE;
-- concluir_acao com prazo no passado (902 já respondeu; resposta_pendente=true)
SELECT set_config('request.jwt.claims', json_build_object('sub',:A,'role','authenticated')::text, false); SET ROLE authenticated;
SELECT versao AS v FROM public.ncrm_estado WHERE negocio_id=902 \gset
SELECT public.test_assert((public.ncrm_concluir_acao(902,:v,'ok','obs','ligar_retorno','Ligar', now()-interval '1 day','ui:ca_past') ->> 'erro')='proxima_acao_em_no_passado','D9: concluir_acao prazo no passado rejeitado');
RESET ROLE;

SELECT '==== TODOS OS TESTES DE DELTA PASSARAM ====' AS resultado;
