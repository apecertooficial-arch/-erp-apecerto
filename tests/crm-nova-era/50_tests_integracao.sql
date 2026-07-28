-- Testes de INTEGRAÇÃO das RPCs atômicas + reconciliação. Local, após aplicar as 3 migrations novas.
\set ON_ERROR_STOP on
\set QUIET on
SET client_min_messages TO notice;
\set A '''cccccccc-0000-0000-0000-000000000001'''
\set B '''dddddddd-0000-0000-0000-000000000001'''
\set PROD '''e0000000-0000-4000-8000-000000000099'''

-- Negócios/leads frescos (evita interferência). Corretor A = id 10.
RESET ROLE;
INSERT INTO public.leads (id, nome) SELECT g, 'Lead '||g FROM generate_series(50,60) g;
INSERT INTO public.negocios (id, lead_id, corretor_id, status) VALUES
  (1000,50,10,'aberto'),(1001,51,10,'aberto'),(1002,52,10,'aberto'),(1003,53,10,'aberto'),
  (1004,54,10,'aberto'),(1005,55,10,'aberto'),(1006,56,10,'aberto');
SET ROLE service_role; SELECT set_config('request.jwt.claims','{}',false);
SELECT public.ncrm_registrar_msg_automatica(1000,'a1000',now());
SELECT public.ncrm_registrar_msg_automatica(1001,'a1001',now());
SELECT public.ncrm_registrar_msg_automatica(1002,'a1002',now());
SELECT public.ncrm_registrar_msg_automatica(1003,'a1003',now());
RESET ROLE;

-- ===== A. VISITA ATÔMICA (1000) =====
SELECT set_config('request.jwt.claims', json_build_object('sub',:A,'role','authenticated')::text, false); SET ROLE authenticated;
SELECT versao AS v FROM public.ncrm_estado WHERE negocio_id=1000 \gset
SELECT public.test_assert((public.ncrm_agendar_visita_e_encaminhar(1000,:v,50,current_date+1,'10:00',NULL,'Empreendimento X',false,NULL,'ui:vis1') ->> 'ok')::boolean,'A visita atômica ok');
SELECT public.test_assert((SELECT count(*) FROM public.visitas WHERE negocio_id=1000)=1,'A visita real criada (1 linha)');
SELECT public.test_assert((SELECT saida='pipeline_visitas' AND visita_id IS NOT NULL FROM public.ncrm_estado WHERE negocio_id=1000),'A estado encaminhado ao Pipe de Visitas');
-- idempotência: mesma idem não duplica visita
SELECT versao AS v FROM public.ncrm_estado WHERE negocio_id=1000 \gset
SELECT public.test_assert((public.ncrm_agendar_visita_e_encaminhar(1000,:v,50,current_date+1,'10:00',NULL,'X',false,NULL,'ui:vis1') ->> 'ja_processado')::boolean,'A idempotente (ja_processado)');
SELECT public.test_assert((SELECT count(*) FROM public.visitas WHERE negocio_id=1000)=1,'A idempotente: continua 1 visita');
RESET ROLE;

-- ===== B. ROLLBACK DA VISITA (1001): força falha no evento => visita revertida =====
RESET ROLE;
CREATE FUNCTION public._falha_evt() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN IF NEW.negocio_id IN (1001,1003) AND NEW.tipo IN ('visita_agendada','proposta_registrada') THEN RAISE EXCEPTION 'falha_forcada_teste'; END IF; RETURN NEW; END $$;
CREATE TRIGGER _t_falha BEFORE INSERT ON public.ncrm_evento FOR EACH ROW EXECUTE FUNCTION public._falha_evt();
SELECT set_config('request.jwt.claims', json_build_object('sub',:A,'role','authenticated')::text, false); SET ROLE authenticated;
SELECT versao AS v FROM public.ncrm_estado WHERE negocio_id=1001 \gset
SELECT public.test_expect_error('SELECT public.ncrm_agendar_visita_e_encaminhar(1001,'||:v||',51,current_date+1,''11:00'',NULL,''X'',false,NULL,''ui:vis-rb'')','falha_forcada_teste','B rollback da visita: erro no encaminhamento');
SELECT public.test_assert((SELECT count(*) FROM public.visitas WHERE negocio_id=1001)=0,'B visita REVERTIDA (0 linhas) — não ficou órfã');
SELECT public.test_assert((SELECT saida IS NULL AND versao=:v FROM public.ncrm_estado WHERE negocio_id=1001),'B estado inalterado após rollback');
RESET ROLE;

-- ===== C. PROPOSTA ATÔMICA NA ESTEIRA (1002) =====
SELECT count(*) AS vendas_antes FROM public.vendas \gset
SELECT set_config('request.jwt.claims', json_build_object('sub',:A,'role','authenticated')::text, false); SET ROLE authenticated;
SELECT versao AS v FROM public.ncrm_estado WHERE negocio_id=1002 \gset
SELECT public.test_assert((public.ncrm_registrar_proposta_esteira(1002,:v,:PROD,450000,'avista','proposta',' ui:prop1') ->> 'ok')::boolean,'C proposta na Esteira ok');
SELECT public.test_assert((SELECT count(*) FROM public.venda_solicitacoes WHERE negocio_id=1002 AND status='pendente')=1,'C criou venda_solicitacao PENDENTE (registro real da Esteira)');
SELECT public.test_assert((SELECT venda_solicitacao_id IS NOT NULL FROM public.ncrm_proposta WHERE negocio_id=1002),'C ncrm_proposta vinculada à solicitação real');
SELECT public.test_assert((SELECT saida='esteira_vendas' AND proposta_id IS NOT NULL FROM public.ncrm_estado WHERE negocio_id=1002),'C estado encaminhado à Esteira');
RESET ROLE;
SELECT public.test_assert((SELECT count(*) FROM public.vendas)=:vendas_antes,'C proposta NÃO cria venda (contagem inalterada)');
SELECT public.test_assert((SELECT status FROM public.negocios WHERE id=1002)<>'ganho','C negócio NÃO marcado ganho');
-- idempotência
SELECT set_config('request.jwt.claims', json_build_object('sub',:A,'role','authenticated')::text, false); SET ROLE authenticated;
SELECT versao AS v FROM public.ncrm_estado WHERE negocio_id=1002 \gset
SELECT public.test_assert((public.ncrm_registrar_proposta_esteira(1002,:v,:PROD,450000,'avista','x',' ui:prop1') ->> 'ja_processado')::boolean,'C idempotente (ja_processado)');
SELECT public.test_assert((SELECT count(*) FROM public.venda_solicitacoes WHERE negocio_id=1002)=1,'C idempotente: 1 solicitação');
RESET ROLE;

-- ===== D. ROLLBACK DA PROPOSTA (1003): falha no evento => solicitação revertida =====
SELECT set_config('request.jwt.claims', json_build_object('sub',:A,'role','authenticated')::text, false); SET ROLE authenticated;
SELECT versao AS v FROM public.ncrm_estado WHERE negocio_id=1003 \gset
SELECT public.test_expect_error('SELECT public.ncrm_registrar_proposta_esteira(1003,'||:v||','''||:PROD||''',100,''x'',''y'',''ui:prop-rb'')','falha_forcada_teste','D rollback da proposta: erro no evento');
SELECT public.test_assert((SELECT count(*) FROM public.venda_solicitacoes WHERE negocio_id=1003)=0,'D venda_solicitacao REVERTIDA (rollback integral)');
SELECT public.test_assert((SELECT saida IS NULL AND versao=:v FROM public.ncrm_estado WHERE negocio_id=1003),'D estado inalterado após rollback');
RESET ROLE;
DROP TRIGGER _t_falha ON public.ncrm_evento; DROP FUNCTION public._falha_evt();

-- ===== E. RECONCILIAÇÃO (1005 sem estado prévio; 1006 lead sem negócio) =====
RESET ROLE;
-- wa chain: contato(lead 55)->conversa; mensagens motor(x2) + inbound. E um lead(56->negócio 1006) e um lead sem negócio.
INSERT INTO public.wa_contatos (id, lead_id) VALUES ('c0000000-0000-4000-8000-0000000000a1',55);
INSERT INTO public.wa_conversas (id, contato_id) VALUES ('c0000000-0000-4000-8000-0000000000b1','c0000000-0000-4000-8000-0000000000a1');
INSERT INTO public.wa_mensagens (id, wa_message_id, conversa_id, direcao, raw, criado_em) VALUES
  ('c0000000-0000-4000-8000-0000000000d1','wam-motor-1','c0000000-0000-4000-8000-0000000000b1','enviada','{"origem":"motor"}'::jsonb, now()-interval '3 min'),
  ('c0000000-0000-4000-8000-0000000000d2','wam-motor-2','c0000000-0000-4000-8000-0000000000b1','enviada','{"origem":"motor"}'::jsonb, now()-interval '2 min'),
  ('c0000000-0000-4000-8000-0000000000d3','wam-in-1','c0000000-0000-4000-8000-0000000000b1','recebida','{}'::jsonb, now()-interval '1 min');
-- lead 57 sem negócio -> mensagem motor deve virar noop (sem_negocio)
INSERT INTO public.leads (id, nome) VALUES (57,'Lead 57 sem negocio') ON CONFLICT DO NOTHING;
INSERT INTO public.wa_contatos (id, lead_id) VALUES ('c0000000-0000-4000-8000-0000000000a2',57);
INSERT INTO public.wa_conversas (id, contato_id) VALUES ('c0000000-0000-4000-8000-0000000000b2','c0000000-0000-4000-8000-0000000000a2');
INSERT INTO public.wa_mensagens (id, wa_message_id, conversa_id, direcao, raw, criado_em) VALUES
  ('c0000000-0000-4000-8000-0000000000d4','wam-motor-3','c0000000-0000-4000-8000-0000000000b2','enviada','{"origem":"motor"}'::jsonb, now());

SELECT ncrm_private.reconciliar_mensagens(500) AS r1 \gset
SELECT public.test_assert((SELECT count(*) FROM public.ncrm_estado WHERE negocio_id=1005)=1,'E reconciliação criou estado do negócio 1005 (msg motor)');
SELECT public.test_assert((SELECT respondeu FROM public.ncrm_estado WHERE negocio_id=1005),'E inbound encerrou prospecção (respondeu=true)');
SELECT public.test_assert((SELECT status FROM public.ncrm_ingest_checkpoint WHERE wa_message_id='wam-motor-1')='processado','E checkpoint: 1ª motor processada');
SELECT public.test_assert((SELECT status FROM public.ncrm_ingest_checkpoint WHERE wa_message_id='wam-motor-2')='noop','E checkpoint: 2ª motor do mesmo disparo = NOOP (estado_ja_existe, não erro)');
SELECT public.test_assert((SELECT status FROM public.ncrm_ingest_checkpoint WHERE wa_message_id='wam-in-1')='processado','E checkpoint: inbound processada');
SELECT public.test_assert((SELECT status FROM public.ncrm_ingest_checkpoint WHERE wa_message_id='wam-motor-3')='noop','E checkpoint: lead sem negócio = noop (sem_negocio)');
-- Idempotência da reconciliação: rodar de novo não duplica checkpoint nem muda estado
SELECT ncrm_private.reconciliar_mensagens(500) AS r2 \gset
SELECT public.test_assert((SELECT count(*) FROM public.ncrm_ingest_checkpoint)=4,'E idempotente: 4 checkpoints (sem duplicar)');
SELECT public.test_assert((SELECT count(*) FROM public.ncrm_evento WHERE negocio_id=1005 AND tipo='mensagem_automatica')=1,'E idempotente: 1 evento de automação (retry não duplica)');

SELECT '==== TESTES DE INTEGRAÇÃO OK ====' AS resultado;
