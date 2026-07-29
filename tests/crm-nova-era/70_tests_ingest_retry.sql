-- ===== G. FASE 4 — RETRY de mensagem do MOTOR sem negócio (corrida motor → negócio) =====
\set ON_ERROR_STOP on
\set QUIET on
\set ADMIN '''aaaaaaaa-0000-0000-0000-000000000001'''

-- Reativa o ingest (ficou desligado ao fim do bloco E5).
SELECT set_config('request.jwt.claims', json_build_object('sub',:ADMIN,'role','authenticated')::text, false); SET ROLE authenticated;
SELECT public.test_assert((public.ncrm_ativar_ingest(true) ->> 'ok')::boolean,'G0 admin reativa o ingest para o teste de retry');
RESET ROLE;

-- G1: requalificação da migration — os noop/sem_negocio do MOTOR viraram pendente.
SELECT public.test_assert(
  (SELECT count(*) FROM public.ncrm_ingest_checkpoint WHERE tipo='msg_automatica' AND status='noop' AND ultimo_erro='sem_negocio')=0,
  'G1 nenhum noop definitivo de motor sem_negocio restou após a migration');
SELECT public.test_assert(
  (SELECT count(*) FROM public.ncrm_ingest_checkpoint WHERE wa_message_id='wam-motor-3' AND status='pendente')=1,
  'G1 checkpoint do motor sem negócio (lead 57) requalificado para pendente');

-- G2: CORRIDA REAL — motor dispara ANTES do negócio existir.
INSERT INTO public.leads (id, nome) VALUES (6000,'Lead 6000 corrida motor') ON CONFLICT DO NOTHING;
INSERT INTO public.wa_contatos (id, lead_id) VALUES ('c0000000-0000-4000-8000-0000000000a6',6000);
INSERT INTO public.wa_conversas (id, contato_id) VALUES ('c0000000-0000-4000-8000-0000000000b6','c0000000-0000-4000-8000-0000000000a6');
INSERT INTO public.wa_mensagens (id, wa_message_id, conversa_id, direcao, raw, criado_em) VALUES
  ('c0000000-0000-4000-8000-0000000000e1','wam-motor-corrida','c0000000-0000-4000-8000-0000000000b6','enviada','{"origem":"motor"}'::jsonb, now());

SELECT ncrm_private.reconciliar_mensagens(500);
SELECT public.test_assert(
  (SELECT status FROM public.ncrm_ingest_checkpoint WHERE wa_message_id='wam-motor-corrida')='pendente',
  'G2 motor sem negócio DENTRO da janela fica PENDENTE (não noop definitivo)');

-- G3: negócio criado DEPOIS (a corrida se resolve) => retry cria o estado pelo caminho canônico.
INSERT INTO public.negocios (id, lead_id, corretor_id, status, criado_em) VALUES (61060,6000,10,'aberto', now());
SELECT ncrm_private.reconciliar_mensagens(500);
SELECT public.test_assert(
  (SELECT status FROM public.ncrm_ingest_checkpoint WHERE wa_message_id='wam-motor-corrida')='processado',
  'G3 retry após criação do negócio: checkpoint processado');
SELECT public.test_assert((SELECT count(*) FROM public.ncrm_estado WHERE negocio_id=61060)=1,
  'G3 ncrm_estado criado pelo caminho canônico (sem inserção manual)');
SELECT public.test_assert(
  (SELECT count(*) FROM public.ncrm_evento WHERE negocio_id=61060 AND tipo='mensagem_automatica')=1,
  'G3 evento de automação registrado exatamente 1x');

-- G4: idempotência — nova rodada não duplica nada.
SELECT ncrm_private.reconciliar_mensagens(500);
SELECT public.test_assert((SELECT count(*) FROM public.ncrm_estado WHERE negocio_id=61060)=1,'G4 estado não duplica');
SELECT public.test_assert(
  (SELECT count(*) FROM public.ncrm_evento WHERE negocio_id=61060 AND tipo='mensagem_automatica')=1,'G4 evento não duplica');

-- G5: fora da janela => noop definitivo preservado.
INSERT INTO public.wa_contatos (id, lead_id) VALUES ('c0000000-0000-4000-8000-0000000000a7',57);
INSERT INTO public.wa_conversas (id, contato_id) VALUES ('c0000000-0000-4000-8000-0000000000b7','c0000000-0000-4000-8000-0000000000a7');
INSERT INTO public.wa_mensagens (id, wa_message_id, conversa_id, direcao, raw, criado_em) VALUES
  ('c0000000-0000-4000-8000-0000000000e2','wam-motor-velho','c0000000-0000-4000-8000-0000000000b7','enviada','{"origem":"motor"}'::jsonb, now());
-- janela zerada força o ramo "fora da janela"
SELECT ncrm_private.reconciliar_mensagens(500, 5, interval '0');
SELECT public.test_assert(
  (SELECT status FROM public.ncrm_ingest_checkpoint WHERE wa_message_id='wam-motor-velho')='noop',
  'G5 fora da janela: noop definitivo (sem_negocio) preservado');

-- Desliga o ingest novamente (deixa o harness no estado em que o bloco E o deixou).
SELECT set_config('request.jwt.claims', json_build_object('sub',:ADMIN,'role','authenticated')::text, false); SET ROLE authenticated;
SELECT public.test_assert((public.ncrm_desativar_ingest(true) ->> 'ok')::boolean,'G6 ingest desligado ao final do teste');
RESET ROLE;
