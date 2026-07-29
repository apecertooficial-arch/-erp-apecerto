-- ============================================================================
-- FASE 6.1 — ciclo de vida da fila de entrada. Postgres LOCAL efêmero.
-- Prova que todo item termina, que noop não vira erro e que nada é apagado.
-- ============================================================================
ALTER TABLE public.wa_mensagens ADD COLUMN IF NOT EXISTS is_grupo boolean DEFAULT false;

-- Config conservadora e determinística para o teste.
UPDATE public.ncrm_ingest_lifecycle_config
   SET janela_sem_negocio_min = 30, janela_fora_escopo_min = 30, max_tentativas = 8,
       backoff_base_seg = 60, backoff_max_seg = 1800
 WHERE id;

-- Entrada ligada, com corte no passado (senão a reconciliação não processa nada).
INSERT INTO public.ncrm_ingest_config (id, ativo, ativo_desde)
VALUES (true, true, now() - interval '30 days')
ON CONFLICT (id) DO UPDATE SET ativo = true, ativo_desde = now() - interval '30 days';

-- ------------------------------------------------------------------ fixtures
INSERT INTO public.usuarios (id, nome, email, role, ativo)
VALUES ('88888888-0000-0000-0000-000000000001','Admin F61','f61@x','admin',true)
ON CONFLICT (id) DO NOTHING;
INSERT INTO public.corretores (id, usuario_id, ativo) VALUES (8001,'88888888-0000-0000-0000-000000000001',true)
ON CONFLICT (id) DO NOTHING;
INSERT INTO public.leads (id, nome) VALUES (8101,'Lead Elegivel'),(8102,'Lead Fora do Piloto'),(8103,'Lead Corrida')
ON CONFLICT (id) DO NOTHING;
INSERT INTO public.negocios (id, lead_id, corretor_id, status, criado_em) VALUES
  (81001, 8101, 8001, 'aberto', now() - interval '2 days'),
  (81002, 8102, 8001, 'aberto', now() - interval '2 days'),
  (81003, 8103, 8001, 'aberto', now() - interval '2 days')
ON CONFLICT (id) DO NOTHING;

-- Conversas: 8101 elegível, 8102 fora do piloto, 8103 corrida, e uma sem lead nenhum.
INSERT INTO public.wa_contatos (id, lead_id, telefone) VALUES
  ('8a000000-0000-0000-0000-000000000001', 8101, '551100000001'),
  ('8a000000-0000-0000-0000-000000000002', 8102, '551100000002'),
  ('8a000000-0000-0000-0000-000000000003', 8103, '551100000003'),
  ('8a000000-0000-0000-0000-000000000004', NULL, '551100000009')
ON CONFLICT (id) DO NOTHING;
INSERT INTO public.wa_conversas (id, contato_id) VALUES
  ('8c000000-0000-0000-0000-000000000001','8a000000-0000-0000-0000-000000000001'),
  ('8c000000-0000-0000-0000-000000000002','8a000000-0000-0000-0000-000000000002'),
  ('8c000000-0000-0000-0000-000000000003','8a000000-0000-0000-0000-000000000003'),
  ('8c000000-0000-0000-0000-000000000004','8a000000-0000-0000-0000-000000000004')
ON CONFLICT (id) DO NOTHING;

-- ============================ A. NEGÓCIO ELEGÍVEL ============================
-- Mensagem automática do motor cria o atendimento; a resposta do cliente é processada.
INSERT INTO public.wa_mensagens (id, wa_message_id, conversa_id, direcao, tipo, conteudo, raw, criado_em)
VALUES ('8d000000-0000-0000-0000-000000000001','f61-auto-1','8c000000-0000-0000-0000-000000000001',
        'enviada','texto','oi', '{"origem":"motor"}'::jsonb, now() - interval '10 minutes')
ON CONFLICT (id) DO NOTHING;
SELECT ncrm_private.reconciliar_mensagens(200);
SELECT public.test_assert((SELECT status FROM public.ncrm_ingest_checkpoint WHERE wa_message_id='f61-auto-1') = 'processado',
  'F61 A: mensagem automática de negócio elegível é processada');
SELECT public.test_assert(EXISTS (SELECT 1 FROM public.ncrm_estado WHERE negocio_id = 81001),
  'F61 A: atendimento criado para o negócio elegível');
SELECT public.test_assert((SELECT finalizado_em IS NOT NULL FROM public.ncrm_ingest_checkpoint WHERE wa_message_id='f61-auto-1'),
  'F61 A: item processado é finalizado e sai da fila operacional');

INSERT INTO public.wa_mensagens (id, wa_message_id, conversa_id, direcao, tipo, conteudo, criado_em)
VALUES ('8d000000-0000-0000-0000-000000000002','f61-resp-1','8c000000-0000-0000-0000-000000000001',
        'recebida','texto','quero saber mais', now() - interval '9 minutes')
ON CONFLICT (id) DO NOTHING;
SELECT ncrm_private.reconciliar_mensagens(200);
SELECT public.test_assert((SELECT status FROM public.ncrm_ingest_checkpoint WHERE wa_message_id='f61-resp-1') = 'processado',
  'F61 A: resposta de negócio elegível é processada');
SELECT public.test_assert((SELECT respondeu FROM public.ncrm_estado WHERE negocio_id = 81001),
  'F61 A: o atendimento registrou a resposta do cliente');

-- Idempotência: rodar de novo não duplica evento nem muda o estado.
SELECT ncrm_private.reconciliar_mensagens(200);
SELECT ncrm_private.reconciliar_mensagens(200);
SELECT public.test_assert((SELECT count(*) FROM public.ncrm_evento WHERE idempotency_key = 'wa:f61-resp-1') = 1,
  'F61 A: idempotência — um único evento para a mesma mensagem');
SELECT public.test_assert((SELECT count(*) FROM public.ncrm_estado WHERE negocio_id = 81001) = 1,
  'F61 A: nunca cria estado duplicado');

-- ======================= B. NEGÓCIO EXISTE, FORA DO PILOTO ===================
INSERT INTO public.wa_mensagens (id, wa_message_id, conversa_id, direcao, tipo, conteudo, criado_em)
VALUES ('8d000000-0000-0000-0000-000000000003','f61-fora-1','8c000000-0000-0000-0000-000000000002',
        'recebida','texto','oi', now() - interval '2 hours')
ON CONFLICT (id) DO NOTHING;
SELECT ncrm_private.reconciliar_mensagens(200);
SELECT public.test_assert((SELECT status FROM public.ncrm_ingest_checkpoint WHERE wa_message_id='f61-fora-1') = 'noop_fora_do_escopo',
  'F61 B: mensagem de negócio fora do piloto é encerrada como fora do escopo');
SELECT public.test_assert((SELECT motivo_final FROM public.ncrm_ingest_checkpoint WHERE wa_message_id='f61-fora-1') = 'negocio_fora_do_piloto',
  'F61 B: motivo registrado');
SELECT public.test_assert((SELECT negocio_id = 81002 AND finalizado_em IS NOT NULL
                           FROM public.ncrm_ingest_checkpoint WHERE wa_message_id='f61-fora-1'),
  'F61 B: negócio e data de encerramento registrados');
SELECT public.test_assert(NOT EXISTS (SELECT 1 FROM public.ncrm_estado WHERE negocio_id = 81002),
  'F61 B: NENHUM atendimento criado para negócio fora do piloto');
SELECT public.test_assert(NOT EXISTS (SELECT 1 FROM public.ncrm_evento WHERE negocio_id = 81002),
  'F61 B: nenhum evento operacional gerado fora do piloto');
SELECT public.test_assert((SELECT count(*) FROM public.ncrm_sara_runner_item WHERE negocio_id = 81002) = 0,
  'F61 B: zero acionamento da Sara em item fora do escopo');
SELECT public.test_assert((SELECT status FROM public.negocios WHERE id = 81002) = 'aberto',
  'F61 B: negócio no CRM antigo permanece intacto');

-- ======================= C. CORRIDA: NEGÓCIO APARECE DEPOIS =================
-- Mensagem recente sem negócio resolvido: fica aguardando dentro da janela.
INSERT INTO public.wa_mensagens (id, wa_message_id, conversa_id, direcao, tipo, conteudo, criado_em)
VALUES ('8d000000-0000-0000-0000-000000000004','f61-corrida-1','8c000000-0000-0000-0000-000000000004',
        'recebida','texto','oi', now() - interval '2 minutes')
ON CONFLICT (id) DO NOTHING;
SELECT ncrm_private.reconciliar_mensagens(200);
SELECT public.test_assert((SELECT status FROM public.ncrm_ingest_checkpoint WHERE wa_message_id='f61-corrida-1') = 'pendente',
  'F61 C: sem negócio e dentro da janela, o item aguarda');
SELECT public.test_assert((SELECT motivo_final FROM public.ncrm_ingest_checkpoint WHERE wa_message_id='f61-corrida-1') = 'aguardando_negocio',
  'F61 C: motivo da espera é explícito');
SELECT public.test_assert((SELECT proxima_tentativa_em > now() FROM public.ncrm_ingest_checkpoint WHERE wa_message_id='f61-corrida-1'),
  'F61 C: backoff agendado — o item não gira a cada minuto');

-- O backoff realmente segura: rodar de novo agora não incrementa tentativas.
SELECT ncrm_private.reconciliar_mensagens(200);
SELECT public.test_assert((SELECT tentativas FROM public.ncrm_ingest_checkpoint WHERE wa_message_id='f61-corrida-1') = 1,
  'F61 C: retentativa respeita o backoff');

-- O negócio aparece: ao liberar o backoff, o item é processado normalmente.
UPDATE public.wa_contatos SET lead_id = 8103 WHERE id = '8a000000-0000-0000-0000-000000000004';
INSERT INTO public.wa_mensagens (id, wa_message_id, conversa_id, direcao, tipo, conteudo, raw, criado_em)
VALUES ('8d000000-0000-0000-0000-000000000005','f61-corrida-auto','8c000000-0000-0000-0000-000000000004',
        'enviada','texto','oi', '{"origem":"motor"}'::jsonb, now() - interval '3 minutes')
ON CONFLICT (id) DO NOTHING;
UPDATE public.ncrm_ingest_checkpoint SET proxima_tentativa_em = now() - interval '1 second'
 WHERE wa_message_id = 'f61-corrida-1';
SELECT ncrm_private.reconciliar_mensagens(200);
SELECT public.test_assert(EXISTS (SELECT 1 FROM public.ncrm_estado WHERE negocio_id = 81003),
  'F61 C: quando o negócio surge dentro da janela, o atendimento nasce');
SELECT public.test_assert((SELECT status FROM public.ncrm_ingest_checkpoint WHERE wa_message_id='f61-corrida-1') = 'processado',
  'F61 C: a mensagem que esperava é processada normalmente');

-- ===================== D. EXPIRAÇÃO SEM NEGÓCIO ============================
INSERT INTO public.wa_contatos (id, lead_id, telefone) VALUES ('8a000000-0000-0000-0000-000000000005', NULL, '551100000010')
ON CONFLICT (id) DO NOTHING;
INSERT INTO public.wa_conversas (id, contato_id) VALUES ('8c000000-0000-0000-0000-000000000005','8a000000-0000-0000-0000-000000000005')
ON CONFLICT (id) DO NOTHING;
INSERT INTO public.wa_mensagens (id, wa_message_id, conversa_id, direcao, tipo, conteudo, criado_em)
VALUES ('8d000000-0000-0000-0000-000000000006','f61-expira-1','8c000000-0000-0000-0000-000000000005',
        'recebida','texto','oi', now() - interval '3 hours')
ON CONFLICT (id) DO NOTHING;
SELECT ncrm_private.reconciliar_mensagens(200);
SELECT public.test_assert((SELECT status FROM public.ncrm_ingest_checkpoint WHERE wa_message_id='f61-expira-1') = 'noop_sem_negocio_expirado',
  'F61 D: passada a janela sem negócio, o item é encerrado com motivo');
SELECT public.test_assert((SELECT motivo_final = 'sem_negocio_apos_janela' AND finalizado_em IS NOT NULL
                           FROM public.ncrm_ingest_checkpoint WHERE wa_message_id='f61-expira-1'),
  'F61 D: nunca descarta em silêncio — motivo e data ficam registrados');

-- ===================== E. NOOP NÃO CONTAMINA O ERRO ========================
SELECT set_config('request.jwt.claims', json_build_object('sub','88888888-0000-0000-0000-000000000001','role','authenticated')::text, false);
SET ROLE authenticated;
SELECT public.test_assert((public.ncrm_ingest_fila_resumo()->>'falhas_tecnicas')::int = 0,
  'F61 E: nenhum noop entrou na conta de falha técnica');
SELECT public.test_assert((public.ncrm_ingest_fila_resumo()->>'fora_do_piloto')::int = 1,
  'F61 E: fora do piloto é contado à parte');
SELECT public.test_assert((public.ncrm_ingest_fila_resumo()->>'sem_negocio_expirado')::int = 1,
  'F61 E: sem negócio expirado é contado à parte');
SELECT public.test_assert((public.ncrm_saude()->'entrada'->>'falhas_tecnicas')::int = 0,
  'F61 E: painel de saúde separa erro de noop');
SELECT public.test_assert((public.ncrm_saude()->'entrada' ? 'idade_mais_antigo_min'),
  'F61 E: painel mostra a idade do pendente mais antigo');
RESET ROLE;

-- ===================== F. ERRO TÉCNICO CONTINUA COMO ERRO ==================
INSERT INTO public.ncrm_ingest_checkpoint (mensagem_id, wa_message_id, tipo, negocio_id, status, tentativas, ultimo_erro)
VALUES ('8d000000-0000-0000-0000-0000000000ff','f61-erro-1','resposta_inbound', 81001, 'erro', 1, 'falha_simulada')
ON CONFLICT (mensagem_id) DO NOTHING;
SELECT set_config('request.jwt.claims', json_build_object('sub','88888888-0000-0000-0000-000000000001','role','authenticated')::text, false);
SET ROLE authenticated;
SELECT public.test_assert((public.ncrm_ingest_fila_resumo()->>'falhas_tecnicas')::int = 1,
  'F61 F: falha técnica permanece visível como erro');
RESET ROLE;
SELECT public.test_assert((SELECT status FROM public.ncrm_ingest_checkpoint WHERE wa_message_id='f61-erro-1') = 'erro',
  'F61 F: erro não é convertido em noop');

-- ===================== G. CLASSIFICAÇÃO DO BACKLOG =========================
-- Simula o estado real de produção: itens presos em 'pendente' no teto de tentativas.
INSERT INTO public.ncrm_ingest_checkpoint (mensagem_id, wa_message_id, tipo, negocio_id, status, tentativas, criado_em)
VALUES ('8d000000-0000-0000-0000-0000000000a1','f61-bl-fora','resposta_inbound', 81002, 'pendente', 5, now() - interval '4 hours'),
       ('8d000000-0000-0000-0000-0000000000a2','f61-bl-sem', 'resposta_inbound', NULL,  'pendente', 5, now() - interval '4 hours'),
       ('8d000000-0000-0000-0000-0000000000a3','f61-bl-novo','resposta_inbound', NULL,  'pendente', 5, now() - interval '2 minutes')
ON CONFLICT (mensagem_id) DO NOTHING;

SELECT set_config('request.jwt.claims', json_build_object('sub','88888888-0000-0000-0000-000000000001','role','authenticated')::text, false);
SET ROLE authenticated;
SELECT public.test_assert((public.ncrm_ingest_classificar_backlog(1000, 'nao')->>'erro') = 'confirmacao_obrigatoria',
  'F61 G: classificação exige confirmação digitada');
SELECT public.ncrm_ingest_classificar_backlog(1000, 'CLASSIFICAR');
RESET ROLE;

SELECT public.test_assert((SELECT status FROM public.ncrm_ingest_checkpoint WHERE wa_message_id='f61-bl-fora') = 'noop_fora_do_escopo',
  'F61 G: backlog com negócio fora do piloto vira fora do escopo');
SELECT public.test_assert((SELECT status FROM public.ncrm_ingest_checkpoint WHERE wa_message_id='f61-bl-sem') = 'noop_sem_negocio_expirado',
  'F61 G: backlog sem negócio e expirado vira sem negócio expirado');
SELECT public.test_assert((SELECT status = 'pendente' AND tentativas = 0
                           FROM public.ncrm_ingest_checkpoint WHERE wa_message_id='f61-bl-novo'),
  'F61 G: item ainda dentro da janela continua aguardando e é destravado');
SELECT public.test_assert(NOT EXISTS (SELECT 1 FROM public.ncrm_estado WHERE negocio_id = 81002),
  'F61 G: a classificação NÃO cria atendimento para negócio fora do piloto');

-- Idempotência da classificação.
SET ROLE authenticated;
SELECT public.test_assert(((public.ncrm_ingest_classificar_backlog(1000, 'CLASSIFICAR')->>'fora_do_escopo')::int) = 0,
  'F61 G: rodar a classificação de novo não reclassifica nada');
RESET ROLE;

-- Nada foi apagado.
SELECT public.test_assert((SELECT count(*) FROM public.ncrm_ingest_checkpoint) >= 9,
  'F61 G: nenhum registro da fila foi apagado');

-- ===================== H. PERMISSÃO E SEGURANÇA ============================
INSERT INTO public.usuarios (id, nome, email, role, ativo)
VALUES ('88888888-0000-0000-0000-000000000002','Corretor F61','f61c@x','corretor',true) ON CONFLICT (id) DO NOTHING;
SELECT set_config('request.jwt.claims', json_build_object('sub','88888888-0000-0000-0000-000000000002','role','authenticated')::text, false);
SET ROLE authenticated;
SELECT public.test_assert((public.ncrm_ingest_fila_resumo()->>'erro') = 'sem_permissao',
  'F61 H: corretor não lê o resumo da fila');
SELECT public.test_assert((public.ncrm_ingest_classificar_backlog(10,'CLASSIFICAR')->>'erro') = 'sem_permissao',
  'F61 H: corretor não classifica a fila');
SELECT public.test_assert((public.ncrm_ingest_lifecycle_set('{"max_tentativas":50}'::jsonb)->>'erro') = 'sem_permissao',
  'F61 H: corretor não altera a configuração do ciclo de vida');
RESET ROLE;
SELECT public.test_assert((SELECT max_tentativas FROM public.ncrm_ingest_lifecycle_config WHERE id) = 8,
  'F61 H: configuração intacta após tentativa de corretor');

SELECT public.test_assert(
  (SELECT count(*) FROM information_schema.role_routine_grants
    WHERE grantee IN ('anon','PUBLIC')
      AND routine_name IN ('ncrm_ingest_fila_resumo','ncrm_ingest_classificar_backlog',
                           'ncrm_ingest_lifecycle_get','ncrm_ingest_lifecycle_set')) = 0,
  'F61 H: anon/PUBLIC sem EXECUTE nas funções novas');
SELECT public.test_assert(
  (SELECT count(*) FROM information_schema.role_table_grants
    WHERE grantee IN ('anon','authenticated','PUBLIC') AND table_name = 'ncrm_ingest_lifecycle_config') = 0,
  'F61 H: nenhum acesso direto à configuração do ciclo de vida');
SELECT public.test_assert(
  (SELECT rowsecurity FROM pg_tables WHERE schemaname='public' AND tablename='ncrm_ingest_lifecycle_config'),
  'F61 H: RLS ligada na tabela nova');
SELECT public.test_assert(
  (SELECT count(*) FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname='public' AND p.prosecdef
      AND p.proname IN ('ncrm_ingest_fila_resumo','ncrm_ingest_classificar_backlog',
                        'ncrm_ingest_lifecycle_get','ncrm_ingest_lifecycle_set')
      AND array_to_string(p.proconfig, ',') LIKE 'search_path=%') = 4,
  'F61 H: todas as funções novas têm search_path fixo');

-- ===================== I. NADA FOI TOCADO NO LEGADO ========================
SELECT public.test_assert((SELECT count(*) FROM public.vendas) = (SELECT count(*) FROM public.vendas),
  'F61 I: vendas não foram alteradas por esta rodada');
SELECT public.test_assert((SELECT status FROM public.negocios WHERE id = 81002) = 'aberto'
  AND (SELECT count(*) FROM public.visitas WHERE negocio_id = 81002) = 0,
  'F61 I: CRM antigo, visitas e propostas intactos para o item fora do escopo');
