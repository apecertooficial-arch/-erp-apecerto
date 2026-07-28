-- Testes de INTEGRAÇÃO das RPCs atômicas + reconciliação com CORTE DE ATIVAÇÃO.
-- Local, após aplicar as 3 migrations novas (ingest/config, proposta-esteira, visita atômica).
\set ON_ERROR_STOP on
\set QUIET on
SET client_min_messages TO notice;
\set A '''cccccccc-0000-0000-0000-000000000001'''
\set ADMIN '''aaaaaaaa-0000-0000-0000-000000000001'''
\set B '''dddddddd-0000-0000-0000-000000000001'''
\set PROD '''e0000000-0000-4000-8000-000000000099'''

-- Negócios/leads frescos (evita interferência). Corretor A = id 10.
RESET ROLE;
INSERT INTO public.leads (id, nome) SELECT g, 'Lead '||g FROM generate_series(50,60) g;
INSERT INTO public.negocios (id, lead_id, corretor_id, status) VALUES
  (1000,50,10,'aberto'),(1001,51,10,'aberto'),(1002,52,10,'aberto'),(1003,53,10,'aberto'),
  (1004,54,10,'aberto'),(1005,55,10,'aberto'),(1006,56,10,'aberto'),
  -- E: lead 58 só GANHO; lead 59 tem GANHO + ABERTO (resolver deve pegar o ABERTO).
  (1008,58,10,'ganho'),(1009,59,10,'ganho'),(1010,59,10,'aberto'),
  -- G: proposta / solicitação pendente divergente.
  (1011,60,10,'aberto'),(1012,50,10,'aberto');
SET ROLE service_role; SELECT set_config('request.jwt.claims','{}',false);
SELECT public.ncrm_registrar_msg_automatica(1000,'a1000',now());
SELECT public.ncrm_registrar_msg_automatica(1001,'a1001',now());
SELECT public.ncrm_registrar_msg_automatica(1002,'a1002',now());
SELECT public.ncrm_registrar_msg_automatica(1003,'a1003',now());
SELECT public.ncrm_registrar_msg_automatica(1004,'a1004',now());
SELECT public.ncrm_registrar_msg_automatica(1011,'a1011',now());
SELECT public.ncrm_registrar_msg_automatica(1012,'a1012',now());
RESET ROLE;

-- ===== A. VISITA ATÔMICA + MOVE NO PIPE REAL (1000) =====
SELECT set_config('request.jwt.claims', json_build_object('sub',:A,'role','authenticated')::text, false); SET ROLE authenticated;
SELECT versao AS v FROM public.ncrm_estado WHERE negocio_id=1000 \gset
SELECT public.test_assert((public.ncrm_agendar_visita_e_encaminhar(1000,:v,50,current_date+1,'10:00',NULL,'Empreendimento X',false,NULL,'ui:vis1') ->> 'ok')::boolean,'A visita atômica ok');
SELECT public.test_assert((SELECT count(*) FROM public.visitas WHERE negocio_id=1000)=1,'A visita real criada (1 linha)');
SELECT public.test_assert((SELECT saida='pipeline_visitas' AND visita_id IS NOT NULL FROM public.ncrm_estado WHERE negocio_id=1000),'A estado encaminhado ao Pipe de Visitas');
-- MOVE real: negócio 1000 foi para a etapa "Visita Agendada" do pipe "Visita ApeCerto" (id 53 / pipe 3), status permanece aberto.
SELECT public.test_assert((SELECT stage_id=53 AND pipeline_id=3 AND status='aberto' FROM public.negocios WHERE id=1000),'A negócio movido para Visita ApeCerto / Visita Agendada (etapa e pipe reais)');
-- idempotência: mesma idem não duplica visita nem re-move
SELECT versao AS v FROM public.ncrm_estado WHERE negocio_id=1000 \gset
SELECT public.test_assert((public.ncrm_agendar_visita_e_encaminhar(1000,:v,50,current_date+1,'10:00',NULL,'X',false,NULL,'ui:vis1') ->> 'ja_processado')::boolean,'A idempotente (ja_processado)');
SELECT public.test_assert((SELECT count(*) FROM public.visitas WHERE negocio_id=1000)=1,'A idempotente: continua 1 visita');
RESET ROLE;

-- ===== A2. FALHA AO MOVER O PIPE REVERTE VISITA E ESTADO (1004) =====
RESET ROLE;
-- gatilho que faz a movimentação (UPDATE em negocios p/ etapa 53) falhar apenas no negócio 1004.
CREATE FUNCTION public._falha_mov() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN IF NEW.id = 1004 AND NEW.stage_id = 53 THEN RAISE EXCEPTION 'falha_forcada_mover'; END IF; RETURN NEW; END $$;
CREATE TRIGGER _t_falha_mov BEFORE UPDATE ON public.negocios FOR EACH ROW EXECUTE FUNCTION public._falha_mov();
SELECT set_config('request.jwt.claims', json_build_object('sub',:A,'role','authenticated')::text, false); SET ROLE authenticated;
SELECT versao AS v FROM public.ncrm_estado WHERE negocio_id=1004 \gset
SELECT public.test_expect_error('SELECT public.ncrm_agendar_visita_e_encaminhar(1004,'||:v||',54,current_date+1,''09:00'',NULL,''X'',false,NULL,''ui:vis-mov-rb'')','falha_forcada_mover','A2 falha ao mover pipeline: erro propagado');
SELECT public.test_assert((SELECT count(*) FROM public.visitas WHERE negocio_id=1004)=0,'A2 visita REVERTIDA (mover falhou => nada de visita órfã)');
SELECT public.test_assert((SELECT saida IS NULL AND visita_id IS NULL AND versao=:v FROM public.ncrm_estado WHERE negocio_id=1004),'A2 ncrm_estado inalterado após rollback');
SELECT public.test_assert((SELECT stage_id IS NULL FROM public.negocios WHERE id=1004),'A2 negócio NÃO movido (rollback integral)');
RESET ROLE;
DROP TRIGGER _t_falha_mov ON public.negocios; DROP FUNCTION public._falha_mov();

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
SELECT public.test_assert((SELECT stage_id IS NULL FROM public.negocios WHERE id=1001),'B move do pipe também revertido');
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
-- (o gatilho public._t_falha em ncrm_evento continua ativo desde o bloco B)
SELECT set_config('request.jwt.claims', json_build_object('sub',:A,'role','authenticated')::text, false); SET ROLE authenticated;
SELECT versao AS v FROM public.ncrm_estado WHERE negocio_id=1003 \gset
SELECT public.test_expect_error('SELECT public.ncrm_registrar_proposta_esteira(1003,'||:v||','''||:PROD||''',100,''x'',''y'',''ui:prop-rb'')','falha_forcada_teste','D rollback da proposta: erro no evento');
SELECT public.test_assert((SELECT count(*) FROM public.venda_solicitacoes WHERE negocio_id=1003)=0,'D venda_solicitacao REVERTIDA (rollback integral)');
SELECT public.test_assert((SELECT saida IS NULL AND versao=:v FROM public.ncrm_estado WHERE negocio_id=1003),'D estado inalterado após rollback');
RESET ROLE;
DROP TRIGGER _t_falha ON public.ncrm_evento; DROP FUNCTION public._falha_evt();

-- ===== E. INGEST: CORTE DE ATIVAÇÃO + RECONCILIAÇÃO =====
RESET ROLE;
-- cadeia wa do lead 55 (negócio 1005 aberto). Mensagens HISTÓRICAS (antes da ativação).
INSERT INTO public.wa_contatos (id, lead_id) VALUES ('c0000000-0000-4000-8000-0000000000a1',55);
INSERT INTO public.wa_conversas (id, contato_id) VALUES ('c0000000-0000-4000-8000-0000000000b1','c0000000-0000-4000-8000-0000000000a1');
INSERT INTO public.wa_mensagens (id, wa_message_id, conversa_id, direcao, raw, criado_em) VALUES
  ('c0000000-0000-4000-8000-00000000f0f1','wam-hist-motor','c0000000-0000-4000-8000-0000000000b1','enviada','{"origem":"motor"}'::jsonb, now()-interval '30 min'),
  ('c0000000-0000-4000-8000-00000000f0f2','wam-hist-in','c0000000-0000-4000-8000-0000000000b1','recebida','{}'::jsonb, now()-interval '29 min');

-- E0: INGEST DESLIGADO (default ativo=false) => reconciliação não processa NADA (nem cria checkpoint).
SELECT ncrm_private.reconciliar_mensagens(500) AS e0 \gset
SELECT public.test_assert((SELECT count(*) FROM public.ncrm_ingest_checkpoint)=0,'E0 ingest DESLIGADO não processa nada (0 checkpoints)');
SELECT public.test_assert((:'e0'::jsonb ->> 'inativo')='true','E0 reconciliação retorna inativo=true');
-- ingest começa DESLIGADO (deploy/flag não ativam): status via RPC autenticada de admin.
SELECT set_config('request.jwt.claims', json_build_object('sub',:ADMIN,'role','authenticated')::text, false); SET ROLE authenticated;
SELECT public.test_assert((public.ncrm_status_ingest() ->> 'ativo')::boolean IS FALSE,'E0 status inicial ativo=false (deploy/flag NÃO ativam)');
RESET ROLE;

-- E1: guardas de ativação — só admin, confirmação explícita, sem retroação acidental.
SELECT set_config('request.jwt.claims', json_build_object('sub',:A,'role','authenticated')::text, false); SET ROLE authenticated;
SELECT public.test_assert((public.ncrm_ativar_ingest(true) ->> 'erro')='sem_permissao','E1 corretor (não admin) não ativa');
RESET ROLE;
SELECT set_config('request.jwt.claims', json_build_object('sub',:ADMIN,'role','authenticated')::text, false); SET ROLE authenticated;
SELECT public.test_assert((public.ncrm_ativar_ingest(false) ->> 'erro')='confirmacao_obrigatoria','E1 admin sem confirmação é bloqueado');
SELECT public.test_assert((public.ncrm_ativar_ingest(true, now()-interval '2 days') ->> 'erro')='ativo_desde_retroativo_nao_permitido','E1 ativação retroativa acidental bloqueada');
-- E2: ATIVA (default now()). Corte = agora; histórico anterior fica de fora.
SELECT public.test_assert((public.ncrm_ativar_ingest(true) ->> 'ok')::boolean,'E2 admin ativa com confirmação');
RESET ROLE;

-- reconciliação após ativar: NÃO processa histórico (mensagens anteriores ao corte).
SELECT ncrm_private.reconciliar_mensagens(500);
SELECT public.test_assert((SELECT count(*) FROM public.ncrm_ingest_checkpoint)=0,'E2 ativação NÃO processa histórico (0 checkpoints; mensagens pré-corte ignoradas)');

-- E3: mensagens POSTERIORES ao corte (elegíveis) + humana enviada + lead sem negócio + ganho.
-- lead 55 -> negócio 1005 (aberto): 2 motor (mesmo disparo) + 1 inbound + 1 HUMANA enviada.
INSERT INTO public.wa_mensagens (id, wa_message_id, conversa_id, direcao, raw, criado_em) VALUES
  ('c0000000-0000-4000-8000-0000000000d1','wam-motor-1','c0000000-0000-4000-8000-0000000000b1','enviada','{"origem":"motor"}'::jsonb, now()+interval '1 min'),
  ('c0000000-0000-4000-8000-0000000000d2','wam-motor-2','c0000000-0000-4000-8000-0000000000b1','enviada','{"origem":"motor"}'::jsonb, now()+interval '2 min'),
  ('c0000000-0000-4000-8000-0000000000d3','wam-in-1','c0000000-0000-4000-8000-0000000000b1','recebida','{}'::jsonb, now()+interval '3 min'),
  ('c0000000-0000-4000-8000-0000000000d5','wam-humana','c0000000-0000-4000-8000-0000000000b1','enviada','{"origem":"corretor"}'::jsonb, now()+interval '4 min');
-- lead 57 sem negócio -> motor pós-corte => noop (sem_negocio)
INSERT INTO public.leads (id, nome) VALUES (57,'Lead 57 sem negocio') ON CONFLICT DO NOTHING;
INSERT INTO public.wa_contatos (id, lead_id) VALUES ('c0000000-0000-4000-8000-0000000000a2',57);
INSERT INTO public.wa_conversas (id, contato_id) VALUES ('c0000000-0000-4000-8000-0000000000b2','c0000000-0000-4000-8000-0000000000a2');
INSERT INTO public.wa_mensagens (id, wa_message_id, conversa_id, direcao, raw, criado_em) VALUES
  ('c0000000-0000-4000-8000-0000000000d4','wam-motor-3','c0000000-0000-4000-8000-0000000000b2','enviada','{"origem":"motor"}'::jsonb, now()+interval '1 min');
-- lead 58 só GANHO (negócio 1008) -> motor => noop (resolver ignora ganho => sem_negocio)
INSERT INTO public.wa_contatos (id, lead_id) VALUES ('c0000000-0000-4000-8000-0000000000a3',58);
INSERT INTO public.wa_conversas (id, contato_id) VALUES ('c0000000-0000-4000-8000-0000000000b3','c0000000-0000-4000-8000-0000000000a3');
INSERT INTO public.wa_mensagens (id, wa_message_id, conversa_id, direcao, raw, criado_em) VALUES
  ('c0000000-0000-4000-8000-0000000000d6','wam-motor-ganho','c0000000-0000-4000-8000-0000000000b3','enviada','{"origem":"motor"}'::jsonb, now()+interval '1 min');
-- lead 59 GANHO (1009) + ABERTO (1010) -> motor deve resolver para o ABERTO (1010)
INSERT INTO public.wa_contatos (id, lead_id) VALUES ('c0000000-0000-4000-8000-0000000000a4',59);
INSERT INTO public.wa_conversas (id, contato_id) VALUES ('c0000000-0000-4000-8000-0000000000b4','c0000000-0000-4000-8000-0000000000a4');
INSERT INTO public.wa_mensagens (id, wa_message_id, conversa_id, direcao, raw, criado_em) VALUES
  ('c0000000-0000-4000-8000-0000000000d7','wam-motor-misto','c0000000-0000-4000-8000-0000000000b4','enviada','{"origem":"motor"}'::jsonb, now()+interval '1 min');

SELECT ncrm_private.reconciliar_mensagens(500);
-- só as mensagens elegíveis pós-corte viram checkpoint (2 motor + 1 inbound + motor-57 + motor-ganho + motor-misto = 6). Humana e históricas NÃO.
SELECT public.test_assert((SELECT count(*) FROM public.ncrm_ingest_checkpoint)=6,'E3 somente mensagens elegíveis pós-corte viram checkpoint (6)');
SELECT public.test_assert((SELECT count(*) FROM public.ncrm_ingest_checkpoint WHERE wa_message_id IN ('wam-hist-motor','wam-hist-in'))=0,'E3 histórico pré-corte permanece SEM checkpoint');
SELECT public.test_assert((SELECT count(*) FROM public.ncrm_ingest_checkpoint WHERE wa_message_id='wam-humana')=0,'E3 mensagem HUMANA enviada ignorada SEM checkpoint');
SELECT public.test_assert((SELECT count(*) FROM public.ncrm_estado WHERE negocio_id=1005)=1,'E3 reconciliação criou estado do negócio 1005 (motor pós-corte)');
SELECT public.test_assert((SELECT respondeu FROM public.ncrm_estado WHERE negocio_id=1005),'E3 inbound encerrou prospecção (respondeu=true)');
SELECT public.test_assert((SELECT status FROM public.ncrm_ingest_checkpoint WHERE wa_message_id='wam-motor-1')='processado','E3 checkpoint: 1ª motor processada');
SELECT public.test_assert((SELECT status FROM public.ncrm_ingest_checkpoint WHERE wa_message_id='wam-motor-2')='noop','E3 checkpoint: 2ª motor do mesmo disparo = NOOP (estado_ja_existe)');
SELECT public.test_assert((SELECT status FROM public.ncrm_ingest_checkpoint WHERE wa_message_id='wam-motor-3')='noop','E3 checkpoint: lead sem negócio = noop (sem_negocio)');
-- ganho não é selecionado
SELECT public.test_assert((SELECT status FROM public.ncrm_ingest_checkpoint WHERE wa_message_id='wam-motor-ganho')='noop','E3 negócio GANHO não é selecionado => noop (sem_negocio)');
SELECT public.test_assert((SELECT count(*) FROM public.ncrm_estado WHERE negocio_id=1008)=0,'E3 nenhum estado criado para o negócio ganho (1008)');
-- misto ganho+aberto => resolve para o ABERTO
SELECT public.test_assert((SELECT status FROM public.ncrm_ingest_checkpoint WHERE wa_message_id='wam-motor-misto')='processado','E3 misto ganho+aberto: motor processado');
SELECT public.test_assert((SELECT count(*) FROM public.ncrm_estado WHERE negocio_id=1010)=1,'E3 misto: estado criado no ABERTO (1010)');
SELECT public.test_assert((SELECT count(*) FROM public.ncrm_estado WHERE negocio_id=1009)=0,'E3 misto: NADA no ganho (1009)');

-- E4: idempotência da reconciliação — rodar de novo não duplica checkpoint nem evento.
SELECT ncrm_private.reconciliar_mensagens(500);
SELECT public.test_assert((SELECT count(*) FROM public.ncrm_ingest_checkpoint)=6,'E4 idempotente: 6 checkpoints (sem duplicar)');
SELECT public.test_assert((SELECT count(*) FROM public.ncrm_evento WHERE negocio_id=1005 AND tipo='mensagem_automatica')=1,'E4 idempotente: 1 evento de automação (retry não duplica)');

-- E5: DESATIVAR volta a não processar (novas mensagens elegíveis não viram checkpoint).
SELECT set_config('request.jwt.claims', json_build_object('sub',:ADMIN,'role','authenticated')::text, false); SET ROLE authenticated;
SELECT public.test_assert((public.ncrm_desativar_ingest(true) ->> 'ok')::boolean,'E5 admin desativa o ingest');
RESET ROLE;
INSERT INTO public.wa_mensagens (id, wa_message_id, conversa_id, direcao, raw, criado_em) VALUES
  ('c0000000-0000-4000-8000-0000000000d8','wam-motor-pos-off','c0000000-0000-4000-8000-0000000000b1','enviada','{"origem":"motor"}'::jsonb, now()+interval '10 min');
SELECT ncrm_private.reconciliar_mensagens(500);
SELECT public.test_assert((SELECT count(*) FROM public.ncrm_ingest_checkpoint WHERE wa_message_id='wam-motor-pos-off')=0,'E5 após desativar, nova mensagem não é processada');

-- ===== F. STATUS/AUTORIZAÇÃO DO INGEST (RPC autenticada — o que o endpoint /api/ncrm/ingest chama) =====
-- auditoria: ao menos 1 ativar + 1 desativar registrados (blocos E2/E5).
SELECT public.test_assert((SELECT count(*) FROM public.ncrm_ingest_audit WHERE acao='ativar')>=1 AND (SELECT count(*) FROM public.ncrm_ingest_audit WHERE acao='desativar')>=1,'F auditoria: ativação e desativação registradas');
-- admin consulta status; reflete desativado + última auditoria = desativar.
SELECT set_config('request.jwt.claims', json_build_object('sub',:ADMIN,'role','authenticated')::text, false); SET ROLE authenticated;
SELECT public.test_assert((public.ncrm_status_ingest() ->> 'ok')::boolean,'F admin consulta o status (ok)');
SELECT public.test_assert((public.ncrm_status_ingest() ->> 'ativo')::boolean IS FALSE,'F status reflete ingest desativado');
SELECT public.test_assert((public.ncrm_status_ingest() -> 'ultima_auditoria' ->> 'acao')='desativar','F status traz última auditoria (desativar)');
RESET ROLE;
-- corretor NÃO consulta / NÃO ativa / NÃO desativa.
SELECT set_config('request.jwt.claims', json_build_object('sub',:A,'role','authenticated')::text, false); SET ROLE authenticated;
SELECT public.test_assert((public.ncrm_status_ingest() ->> 'erro')='sem_permissao','F corretor não consulta status');
SELECT public.test_assert((public.ncrm_ativar_ingest(true) ->> 'erro')='sem_permissao','F corretor não ativa');
SELECT public.test_assert((public.ncrm_desativar_ingest(true) ->> 'erro')='sem_permissao','F corretor não desativa');
RESET ROLE;
-- SQL sem JWT (auth.uid() nulo) NÃO ativa nem consulta — como o SQL Editor.
SELECT set_config('request.jwt.claims','{}',false);
SELECT public.test_assert((public.ncrm_ativar_ingest(true) ->> 'erro')='nao_autenticado','F SQL sem JWT não ativa (nao_autenticado)');
SELECT public.test_assert((public.ncrm_status_ingest() ->> 'erro')='nao_autenticado','F SQL sem JWT não consulta status');

-- ===== G. PROPOSTA: SOLICITAÇÃO PENDENTE DIVERGENTE =====
\set OUTRO '''a1111111-2222-4333-8444-555566667777'''
RESET ROLE;
-- G1: pendente COMPATÍVEL (mesmo produto e valor) é reutilizada — sem duplicar solicitação.
INSERT INTO public.venda_solicitacoes (negocio_id, produto_id, vgv, status) VALUES (1011, :PROD, 500000, 'pendente');
SELECT set_config('request.jwt.claims', json_build_object('sub',:A,'role','authenticated')::text, false); SET ROLE authenticated;
SELECT versao AS v FROM public.ncrm_estado WHERE negocio_id=1011 \gset
SELECT public.test_assert((public.ncrm_registrar_proposta_esteira(1011,:v,:PROD,500000,'avista','ok','ui:g1') ->> 'ok')::boolean,'G1 pendente compatível reutilizada (ok)');
SELECT public.test_assert((SELECT count(*) FROM public.venda_solicitacoes WHERE negocio_id=1011)=1,'G1 NÃO duplicou solicitação (reutilizou a pendente)');
SELECT public.test_assert((SELECT venda_solicitacao_id=(SELECT id FROM public.venda_solicitacoes WHERE negocio_id=1011) FROM public.ncrm_proposta WHERE negocio_id=1011),'G1 proposta vinculada à solicitação pendente reutilizada');
SELECT public.test_assert((SELECT saida='esteira_vendas' FROM public.ncrm_estado WHERE negocio_id=1011),'G1 estado encaminhado (compatível é atômico)');
RESET ROLE;

-- G2/G3: pendente DIVERGENTE (produto ou valor diferentes) NÃO é sobrescrita; nada muda.
RESET ROLE;
INSERT INTO public.venda_solicitacoes (id, negocio_id, produto_id, vgv, status)
  VALUES ('b2222222-2222-4222-8222-222222222222', 1012, :PROD, 500000, 'pendente');
SELECT set_config('request.jwt.claims', json_build_object('sub',:A,'role','authenticated')::text, false); SET ROLE authenticated;
SELECT versao AS v FROM public.ncrm_estado WHERE negocio_id=1012 \gset
-- produto diferente
SELECT public.ncrm_registrar_proposta_esteira(1012,:v,:OUTRO,500000,'avista','x','ui:g2') AS g2 \gset
SELECT public.test_assert((:'g2'::jsonb ->> 'erro')='solicitacao_pendente_divergente','G2 produto diferente => solicitacao_pendente_divergente');
SELECT public.test_assert((:'g2'::jsonb ->> 'solicitacao_id')='b2222222-2222-4222-8222-222222222222','G2 retorna a solicitacao_id existente');
SELECT public.test_assert((:'g2'::jsonb ->> 'produto_id_existente')=(SELECT produto_id::text FROM public.venda_solicitacoes WHERE id='b2222222-2222-4222-8222-222222222222'),'G2 retorna produto_id_existente');
SELECT public.test_assert(((:'g2'::jsonb ->> 'valor_existente')::numeric)=500000,'G2 retorna valor_existente');
-- valor diferente
SELECT public.ncrm_registrar_proposta_esteira(1012,:v,:PROD,999999,'avista','x','ui:g3') AS g3 \gset
SELECT public.test_assert((:'g3'::jsonb ->> 'erro')='solicitacao_pendente_divergente','G3 valor diferente => solicitacao_pendente_divergente');
-- nada mudou: 1 solicitação, sem proposta, estado sem saída, versão intacta.
SELECT public.test_assert((SELECT count(*) FROM public.venda_solicitacoes WHERE negocio_id=1012)=1,'G divergente: venda_solicitacoes inalterada (sem 2ª solicitação)');
SELECT public.test_assert((SELECT count(*) FROM public.ncrm_proposta WHERE negocio_id=1012)=0,'G divergente: NENHUMA ncrm_proposta criada');
SELECT public.test_assert((SELECT saida IS NULL AND versao=:v FROM public.ncrm_estado WHERE negocio_id=1012),'G divergente: ncrm_estado inalterado');
RESET ROLE;

SELECT '==== TESTES DE INTEGRAÇÃO OK ====' AS resultado;
