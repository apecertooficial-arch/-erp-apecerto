-- ============================================================================
-- ENTRADA PELA DISTRIBUIÇÃO + PRIMEIRA ABORDAGEM HUMANA + SARA ASSIST + NOTIFICAÇÕES
-- ============================================================================
ALTER TABLE public.wa_mensagens ADD COLUMN IF NOT EXISTS is_grupo boolean DEFAULT false;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS telefone text;
ALTER TABLE public.corretores ADD COLUMN IF NOT EXISTS nome text;
ALTER TABLE public.corretores ADD COLUMN IF NOT EXISTS apelido text;
CREATE TABLE IF NOT EXISTS public.motor_execucoes (
  id bigserial PRIMARY KEY, automacao_id bigint, automacao_nome text, bloco_id text,
  evento text, status text, lead_nome text, lead_telefone text, detalhe text,
  criado_em timestamptz DEFAULT now()
);

INSERT INTO public.ncrm_ingest_config (id, ativo, ativo_desde)
VALUES (true, true, now() - interval '30 days')
ON CONFLICT (id) DO UPDATE SET ativo = true, ativo_desde = now() - interval '30 days';

-- Fixtures 7xxxx
INSERT INTO public.usuarios (id, nome, email, role, ativo) VALUES
  ('77777777-0000-0000-0000-000000000001','Admin EH','eh@x','admin',true),
  ('77777777-0000-0000-0000-000000000002','Corretor Piloto','ehc@x','corretor',true),
  ('77777777-0000-0000-0000-000000000003','Corretor Fora','ehf@x','corretor',true)
ON CONFLICT (id) DO NOTHING;
INSERT INTO public.corretores (id, usuario_id, ativo) VALUES
  (7001,'77777777-0000-0000-0000-000000000002',true), (7002,'77777777-0000-0000-0000-000000000003',true)
ON CONFLICT (id) DO NOTHING;
INSERT INTO public.ncrm_piloto (usuario_id, ativo, liberado_por) VALUES ('77777777-0000-0000-0000-000000000002', true, '77777777-0000-0000-0000-000000000001')
ON CONFLICT (usuario_id) DO UPDATE SET ativo = true;
INSERT INTO public.leads (id, nome, telefone) VALUES
  (7101,'Cliente Piloto','5511900000001'), (7102,'Cliente Legado','5511900000002')
ON CONFLICT (id) DO NOTHING;
INSERT INTO public.negocios (id, lead_id, corretor_id, status, stage_id, criado_em) VALUES
  (71001, 7101, 7001, 'aberto', 20, now() - interval '5 minutes'),
  (71002, 7102, 7002, 'aberto', 20, now() - interval '5 minutes')
ON CONFLICT (id) DO NOTHING;
INSERT INTO public.wa_contatos (id, lead_id, telefone) VALUES
  ('7a000000-0000-0000-0000-000000000001', 7101, '5511900000001'),
  ('7a000000-0000-0000-0000-000000000002', 7102, '5511900000002')
ON CONFLICT (id) DO NOTHING;
INSERT INTO public.wa_conversas (id, contato_id) VALUES
  ('7c000000-0000-0000-0000-000000000001','7a000000-0000-0000-0000-000000000001'),
  ('7c000000-0000-0000-0000-000000000002','7a000000-0000-0000-0000-000000000002')
ON CONFLICT (id) DO NOTHING;


-- ============ A. FAIL-CLOSED: ESCOPO 'nenhum' NÃO MUDA NADA ============
SELECT public.test_assert((SELECT escopo FROM public.ncrm_entrada_config WHERE id) = 'nenhum',
  'EH A: escopo nasce fail-closed em nenhum');
SELECT public.test_assert((SELECT modo_primeira_abordagem FROM public.ncrm_entrada_config WHERE id) = 'automatica',
  'EH A: modo nasce como automatica (comportamento de hoje)');
SELECT public.test_assert(NOT ncrm_private.negocio_elegivel_nova_era(71001),
  'EH A: com escopo nenhum, ninguem e elegivel');
SELECT public.test_assert(NOT public.ncrm_bloqueia_abordagem_automatica(7101),
  'EH A: com escopo nenhum, o motor NUNCA e bloqueado');
SELECT ncrm_private.reconciliar_mensagens(50);
SELECT public.test_assert((SELECT count(*) FROM public.ncrm_estado WHERE negocio_id IN (71001,71002)) = 0,
  'EH A: nenhum card nasce enquanto o escopo for nenhum');

-- ============ B. ESCOPO 'pilotos': SO O PILOTO ENTRA ============
SELECT set_config('request.jwt.claims', json_build_object('sub','77777777-0000-0000-0000-000000000001','role','authenticated')::text, false);
SET ROLE authenticated;
SELECT public.test_assert((public.ncrm_entrada_config_set('{"escopo":"liberados","modo_primeira_abordagem":"humana"}'::jsonb,'nao')->>'erro') = 'confirmacao_obrigatoria',
  'EH B: virada exige confirmacao digitada');
SELECT public.ncrm_entrada_config_set('{"escopo":"liberados","modo_primeira_abordagem":"humana","motivo":"teste"}'::jsonb,'CONFIRMAR');
-- Liberação por NOME, uma dimensão separada do acesso à tela.
SELECT public.test_assert((public.ncrm_abordagem_humana_definir(7001, true, 'CONFIRMAR')->>'erro') = 'confirmacao_obrigatoria',
  'EH B: ligar abordagem humana exige a palavra forte');
SELECT public.ncrm_abordagem_humana_definir(7001, true, 'ATIVAR ABORDAGEM HUMANA');
RESET ROLE;
SELECT public.test_assert((SELECT vigente_desde IS NOT NULL FROM public.ncrm_entrada_config WHERE id),
  'EH B: o corte e registrado na virada para humana');
SELECT public.test_assert((SELECT count(*) FROM public.ncrm_entrada_config_audit) = 1,
  'EH B: a virada fica auditada');
SELECT public.test_assert(ncrm_private.negocio_elegivel_nova_era(71001),
  'EH B: negocio do corretor LIBERADO e elegivel');
SELECT public.test_assert(NOT ncrm_private.negocio_elegivel_nova_era(71002),
  'EH B: negocio de corretor nao liberado NAO e elegivel');

-- ============ C. BLOQUEIO SELETIVO DA ABORDAGEM AUTOMATICA ============
SELECT public.test_assert(public.ncrm_bloqueia_abordagem_automatica(7101),
  'EH C: motor bloqueado para o lead Nova Era');
SELECT public.test_assert(NOT public.ncrm_bloqueia_abordagem_automatica(7102),
  'EH C: motor PRESERVADO para o lead legado');

-- ============ D. O CARD NASCE PELA DISTRIBUICAO, SEM MENSAGEM ============
SELECT ncrm_private.reconciliar_mensagens(50);
SELECT public.test_assert(EXISTS (SELECT 1 FROM public.ncrm_estado WHERE negocio_id = 71001),
  'EH D: card do piloto nasce sem nenhuma mensagem ter sido enviada');
SELECT public.test_assert(NOT EXISTS (SELECT 1 FROM public.ncrm_estado WHERE negocio_id = 71002),
  'EH D: negocio legado NAO ganha card');
SELECT public.test_assert((SELECT etapa FROM public.ncrm_estado WHERE negocio_id = 71001) = 'novo',
  'EH D: nasce no momento Novo');
SELECT public.test_assert((SELECT proxima_acao_em IS NOT NULL AND proxima_acao_titulo IS NOT NULL
                           FROM public.ncrm_estado WHERE negocio_id = 71001),
  'EH D: nasce com prazo de primeira abordagem');
SELECT public.test_assert((SELECT origem_ultima FROM public.ncrm_estado WHERE negocio_id = 71001) = 'sistema',
  'EH D: origem auditavel');
SELECT public.test_assert((SELECT count(*) FROM public.wa_mensagens WHERE conversa_id='7c000000-0000-0000-0000-000000000001') = 0,
  'EH D: NENHUMA mensagem foi enviada durante a criacao');
SELECT public.test_assert((SELECT count(*) FROM public.ncrm_evento WHERE negocio_id=71001 AND idempotency_key='entrada_distribuicao:71001') = 1,
  'EH D: evento de entrada registrado uma unica vez');
-- Idempotência
SELECT ncrm_private.reconciliar_mensagens(50);
SELECT ncrm_private.reconciliar_mensagens(50);
SELECT public.test_assert((SELECT count(*) FROM public.ncrm_estado WHERE negocio_id = 71001) = 1,
  'EH D: zero card duplicado apos varias passagens');

-- ============ E. PRIMEIRA ATUACAO HUMANA ============
-- Mensagem do MOTOR nao conta como atuacao humana.
INSERT INTO public.wa_mensagens (id, wa_message_id, conversa_id, direcao, tipo, conteudo, raw, criado_em)
VALUES ('7d000000-0000-0000-0000-000000000001','eh-motor-1','7c000000-0000-0000-0000-000000000001',
        'enviada','texto','oi','{"origem":"motor"}'::jsonb, now() - interval '3 minutes')
ON CONFLICT (id) DO NOTHING;
SELECT ncrm_private.reconciliar_mensagens(50);
SELECT public.test_assert((SELECT etapa FROM public.ncrm_estado WHERE negocio_id = 71001) = 'novo',
  'EH E: mensagem do motor NAO conta como primeira atuacao humana');

-- Mensagem do corretor no chat interno conta.
INSERT INTO public.wa_mensagens (id, wa_message_id, conversa_id, direcao, tipo, conteudo, criado_em)
VALUES ('7d000000-0000-0000-0000-000000000002','eh-humana-1','7c000000-0000-0000-0000-000000000001',
        'enviada','texto','Ola, tudo bem?', now() - interval '2 minutes')
ON CONFLICT (id) DO NOTHING;
SELECT ncrm_private.reconciliar_mensagens(50);
SELECT public.test_assert((SELECT etapa FROM public.ncrm_estado WHERE negocio_id = 71001) = 'tentando_contato',
  'EH E: primeira mensagem humana move Novo -> Tentando contato');
SELECT public.test_assert((SELECT ultima_decisao_humana_em IS NOT NULL FROM public.ncrm_estado WHERE negocio_id = 71001),
  'EH E: marca a decisao humana');
SELECT public.test_assert((SELECT count(*) FROM public.ncrm_evento WHERE idempotency_key = 'humana:eh-humana-1') = 1,
  'EH E: evento auditavel de primeira abordagem');
SELECT public.test_assert(
  (SELECT (payload->>'sla_min')::int >= 0 FROM public.ncrm_evento WHERE idempotency_key = 'humana:eh-humana-1'),
  'EH E: SLA real calculado e nunca negativo');
-- Reprocessamento nao duplica
SELECT ncrm_private.reconciliar_mensagens(50);
SELECT public.test_assert((SELECT count(*) FROM public.ncrm_evento WHERE idempotency_key = 'humana:eh-humana-1') = 1,
  'EH E: reprocessar nao duplica o evento');
-- Segunda mensagem humana nao volta a promover
INSERT INTO public.wa_mensagens (id, wa_message_id, conversa_id, direcao, tipo, conteudo, criado_em)
VALUES ('7d000000-0000-0000-0000-000000000003','eh-humana-2','7c000000-0000-0000-0000-000000000001',
        'enviada','texto','Consegue falar?', now() - interval '1 minute')
ON CONFLICT (id) DO NOTHING;
SELECT ncrm_private.reconciliar_mensagens(50);
SELECT public.test_assert((SELECT status FROM public.ncrm_ingest_checkpoint WHERE wa_message_id='eh-humana-2') = 'noop',
  'EH E: segunda mensagem humana e encerrada como noop, nao como erro');

-- ============ F. RESPOSTA DO CLIENTE ============
INSERT INTO public.wa_mensagens (id, wa_message_id, conversa_id, direcao, tipo, conteudo, criado_em)
VALUES ('7d000000-0000-0000-0000-000000000004','eh-inbound-1','7c000000-0000-0000-0000-000000000001',
        'recebida','texto','Oi, quero saber o valor', now())
ON CONFLICT (id) DO NOTHING;
SELECT ncrm_private.reconciliar_mensagens(50);
SELECT public.test_assert((SELECT etapa FROM public.ncrm_estado WHERE negocio_id = 71001) = 'em_atendimento',
  'EH F: resposta do cliente move para Em atendimento');
SELECT public.test_assert((SELECT resposta_pendente FROM public.ncrm_estado WHERE negocio_id = 71001),
  'EH F: fica marcado como aguardando o corretor');

-- ============ G. NADA DE MENSAGEM, VISITA, PROPOSTA OU VENDA ============
SELECT public.test_assert((SELECT count(*) FROM public.visitas WHERE negocio_id IN (71001,71002)) = 0,
  'EH G: nenhuma visita criada');
SELECT public.test_assert((SELECT count(*) FROM public.ncrm_proposta WHERE negocio_id IN (71001,71002)) = 0,
  'EH G: nenhuma proposta criada');
SELECT public.test_assert((SELECT status FROM public.negocios WHERE id = 71002) = 'aberto',
  'EH G: negocio legado intacto');

-- ============ H. SARA ASSIST ============
SELECT set_config('request.jwt.claims', json_build_object('sub','77777777-0000-0000-0000-000000000001','role','authenticated')::text, false);
SET ROLE authenticated;
SELECT public.test_assert((public.ncrm_sara_definir_modo('execute', true)->>'erro') = 'execute_bloqueado_nesta_fase',
  'EH H: execute generico continua BLOQUEADO');
SELECT public.ncrm_sara_definir_modo('assist', true);
RESET ROLE;
SELECT public.test_assert((SELECT modo FROM public.ncrm_sara_config WHERE id) = 'assist',
  'EH H: assist pode ser ligado');
SELECT public.test_assert((SELECT operacao FROM public.ncrm_sara_assist_config WHERE id) = 'shadow',
  'EH H: assist comeca em shadow (nao altera nada)');

-- Análise com evidência e confiança alta, sugerindo transição válida.
INSERT INTO public.ncrm_sara_analise (negocio_id, origem, ator, run_id, context_hash, etapa_atual,
    etapa_sugerida, proxima_acao_sugerida, prazo_sugerido, justificativa, evidencias, confianca,
    versao_modelo, modo, analisado_em)
VALUES (71001,'sara_runner','sara', gen_random_uuid(), 'eh-ctx-1', 'em_atendimento',
    'em_acompanhamento', 'Enviar opcoes de 2 quartos', now() + interval '1 day',
    'O cliente pediu opcoes e combinou retorno', '["quero ver opcoes de 2 quartos"]'::jsonb, 0.9,
    'sara/ia-router','observer', now())
RETURNING id AS _a1 \gset
SELECT public.test_assert((public.ncrm_sara_organizar(71001, :_a1)->>'aplicado')::boolean = false,
  'EH H: em shadow a Sara registra mas NAO altera');
SELECT public.test_assert((SELECT etapa FROM public.ncrm_estado WHERE negocio_id = 71001) = 'em_atendimento',
  'EH H: shadow nao mexeu no momento');
SELECT public.test_assert((SELECT count(*) FROM public.ncrm_sara_acao WHERE negocio_id=71001 AND NOT aplicado) = 1,
  'EH H: a divergencia do shadow fica registrada');

-- Ativa e aplica.
SELECT set_config('request.jwt.claims', json_build_object('sub','77777777-0000-0000-0000-000000000001','role','authenticated')::text, false);
SET ROLE authenticated;
SELECT public.ncrm_sara_assist_config_set('ativo', 0.75, 'CONFIRMAR');
RESET ROLE;
SELECT public.test_assert((public.ncrm_sara_organizar(71001, :_a1)->>'aplicado')::boolean,
  'EH H: com assist ativo a Sara organiza o momento');
SELECT public.test_assert((SELECT etapa FROM public.ncrm_estado WHERE negocio_id = 71001) = 'em_acompanhamento',
  'EH H: transicao da whitelist aplicada');
SELECT public.test_assert((SELECT origem_ultima FROM public.ncrm_estado WHERE negocio_id = 71001) = 'sara',
  'EH H: origem registrada como sara');

-- Confiança insuficiente não altera.
INSERT INTO public.ncrm_sara_analise (negocio_id, origem, ator, run_id, context_hash, etapa_atual,
    etapa_sugerida, justificativa, evidencias, confianca, modo, analisado_em)
VALUES (71001,'sara_runner','sara', gen_random_uuid(), 'eh-ctx-2', 'em_acompanhamento',
    'em_atendimento', 'talvez', '["oi"]'::jsonb, 0.4, 'observer', now())
RETURNING id AS _a2 \gset
SELECT public.test_assert((public.ncrm_sara_organizar(71001, :_a2)->>'erro') = 'confianca_insuficiente',
  'EH H: confianca baixa NAO altera nada');
SELECT public.test_assert((public.ncrm_sara_organizar(71001, :_a2)->>'mensagem') = 'A Sara precisa de mais informações',
  'EH H: mensagem humana quando falta informacao');

-- Sem evidência não altera.
INSERT INTO public.ncrm_sara_analise (negocio_id, origem, ator, run_id, context_hash, etapa_atual,
    etapa_sugerida, evidencias, confianca, modo, analisado_em)
VALUES (71001,'sara_runner','sara', gen_random_uuid(), 'eh-ctx-3', 'em_acompanhamento',
    'em_atendimento', '[]'::jsonb, 0.95, 'observer', now())
RETURNING id AS _a3 \gset
SELECT public.test_assert((public.ncrm_sara_organizar(71001, :_a3)->>'erro') = 'sem_evidencia',
  'EH H: sem evidencia NAO altera nada');

-- Transição fora da whitelist é recusada.
INSERT INTO public.ncrm_sara_analise (negocio_id, origem, ator, run_id, context_hash, etapa_atual,
    etapa_sugerida, evidencias, confianca, modo, analisado_em)
VALUES (71001,'sara_runner','sara', gen_random_uuid(), 'eh-ctx-4', 'em_acompanhamento',
    'novo', '["texto"]'::jsonb, 0.95, 'observer', now())
RETURNING id AS _a4 \gset
SELECT public.test_assert((public.ncrm_sara_organizar(71001, :_a4)->>'erro') = 'transicao_fora_da_whitelist',
  'EH H: transicao fora da whitelist e recusada');

-- Ação humana mais recente prevalece.
UPDATE public.ncrm_estado SET ultima_decisao_humana_em = now() + interval '1 minute' WHERE negocio_id = 71001;
INSERT INTO public.ncrm_sara_analise (negocio_id, origem, ator, run_id, context_hash, etapa_atual,
    etapa_sugerida, evidencias, confianca, modo, analisado_em)
VALUES (71001,'sara_runner','sara', gen_random_uuid(), 'eh-ctx-5', 'em_acompanhamento',
    'em_atendimento', '["texto"]'::jsonb, 0.95, 'observer', now())
RETURNING id AS _a5 \gset
SELECT public.test_assert((public.ncrm_sara_organizar(71001, :_a5)->>'erro') = 'acao_humana_mais_recente',
  'EH H: acao humana prevalece sobre a Sara');
UPDATE public.ncrm_estado SET ultima_decisao_humana_em = NULL WHERE negocio_id = 71001;

-- Estado mudou desde a análise (conflito de versão lógico).
INSERT INTO public.ncrm_sara_analise (negocio_id, origem, ator, run_id, context_hash, etapa_atual,
    etapa_sugerida, evidencias, confianca, modo, analisado_em)
VALUES (71001,'sara_runner','sara', gen_random_uuid(), 'eh-ctx-6', 'novo',
    'tentando_contato', '["texto"]'::jsonb, 0.95, 'observer', now())
RETURNING id AS _a6 \gset
SELECT public.test_assert((public.ncrm_sara_organizar(71001, :_a6)->>'erro') = 'estado_mudou_desde_a_analise',
  'EH H: analise sobre estado antigo e recusada');

-- Reversão.
SELECT public.test_assert(
  (SELECT (public.ncrm_sara_reverter(id)->>'ok')::boolean FROM public.ncrm_sara_acao
    WHERE negocio_id=71001 AND aplicado AND revertido_em IS NULL ORDER BY id LIMIT 1),
  'EH H: organizacao da Sara pode ser revertida');
SELECT public.test_assert((SELECT etapa FROM public.ncrm_estado WHERE negocio_id = 71001) = 'em_atendimento',
  'EH H: reversao devolve o momento anterior');

-- A Sara nunca envia mensagem, cria visita, proposta ou venda.
SELECT public.test_assert((SELECT count(*) FROM public.ncrm_evento WHERE origem='sara' AND tipo IN
  ('mensagem_automatica','visita_agendada','proposta_registrada','proposta_convertida')) = 0,
  'EH H: zero mensagem, visita, proposta ou venda pela Sara');

-- ============ I. NOTIFICACOES POR PAPEL ============
SELECT ncrm_private.notificacoes_sincronizar();
SELECT public.test_assert((SELECT count(*) FROM public.ncrm_notificacao WHERE resolvida_em IS NULL) >= 1,
  'EH I: notificacoes reais foram criadas');
SELECT ncrm_private.notificacoes_sincronizar();
SELECT public.test_assert((SELECT count(*) FROM public.ncrm_notificacao n1
   WHERE n1.resolvida_em IS NULL AND EXISTS (
     SELECT 1 FROM public.ncrm_notificacao n2 WHERE n2.id <> n1.id AND n2.chave = n1.chave AND n2.resolvida_em IS NULL)) = 0,
  'EH I: deduplicacao — nunca duas notificacoes abertas para a mesma chave');

SELECT set_config('request.jwt.claims', json_build_object('sub','77777777-0000-0000-0000-000000000002','role','authenticated')::text, false);
SET ROLE authenticated;
SELECT public.test_assert((public.ncrm_notificacoes()->>'ok')::boolean,
  'EH I: corretor le suas notificacoes');
SELECT public.test_assert((public.ncrm_notificacoes()->>'gestor')::boolean = false,
  'EH I: corretor nao e tratado como gestor');
CREATE TEMP TABLE _eh_notif_corretor AS SELECT (public.ncrm_notificacoes()->'itens') AS itens;
RESET ROLE;
SELECT public.test_assert(
  NOT EXISTS (SELECT 1 FROM _eh_notif_corretor, lateral jsonb_array_elements(itens) x
               WHERE (x->>'negocio_id')::bigint = 71002),
  'EH I: corretor NAO ve cliente de outro corretor');

SELECT set_config('request.jwt.claims', json_build_object('sub','77777777-0000-0000-0000-000000000001','role','authenticated')::text, false);
SET ROLE authenticated;
SELECT public.test_assert((public.ncrm_notificacoes()->>'gestor')::boolean,
  'EH I: admin recebe a visao de gestao');
RESET ROLE;

-- Resolução automática: a pendência sumiu, a notificação sai do contador.
UPDATE public.ncrm_estado SET resposta_pendente = false WHERE negocio_id = 71001;
SELECT ncrm_private.notificacoes_sincronizar();
SELECT public.test_assert((SELECT resolvida_por FROM public.ncrm_notificacao WHERE chave='resp:71001') = 'automatica',
  'EH I: notificacao se resolve sozinha quando a pendencia acaba');
SELECT public.test_assert((SELECT count(*) FROM public.ncrm_notificacao) >= 1,
  'EH I: historico preservado — nada e apagado');

-- ============ J. SEGURANCA ============
SELECT public.test_assert(
  (SELECT count(*) FROM information_schema.role_routine_grants
    WHERE grantee IN ('anon','PUBLIC')
      AND routine_name IN ('ncrm_entrada_config_get','ncrm_entrada_config_set','ncrm_bloqueia_abordagem_automatica',
                           'ncrm_registrar_primeira_humana','ncrm_sara_organizar','ncrm_sara_reverter',
                           'ncrm_sara_assist_relatorio','ncrm_sara_assist_config_set','ncrm_notificacoes',
                           'ncrm_notificacao_vista')) = 0,
  'EH J: anon/PUBLIC sem EXECUTE nas funcoes novas');
SELECT public.test_assert(
  (SELECT count(*) FROM information_schema.role_table_grants
    WHERE grantee IN ('anon','authenticated','PUBLIC')
      AND table_name IN ('ncrm_entrada_config','ncrm_entrada_config_audit','ncrm_sara_assist_config',
                         'ncrm_sara_acao','ncrm_notificacao')) = 0,
  'EH J: nenhum acesso direto as tabelas novas');
SELECT public.test_assert(
  (SELECT count(*) FROM pg_tables WHERE schemaname='public' AND rowsecurity
     AND tablename IN ('ncrm_entrada_config','ncrm_entrada_config_audit','ncrm_sara_assist_config',
                       'ncrm_sara_acao','ncrm_notificacao')) = 5,
  'EH J: RLS ligada nas 5 tabelas novas');
SELECT public.test_assert(
  (SELECT count(*) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
    WHERE n.nspname IN ('public','ncrm_private') AND p.prosecdef
      AND p.proname IN ('ncrm_entrada_config_get','ncrm_entrada_config_set','ncrm_bloqueia_abordagem_automatica',
                        'ncrm_registrar_primeira_humana','ncrm_sara_organizar','ncrm_sara_reverter',
                        'ncrm_sara_assist_relatorio','ncrm_sara_assist_config_set','ncrm_notificacoes',
                        'ncrm_notificacao_vista','negocio_elegivel_nova_era','entrada_por_distribuicao',
                        'notificacoes_sincronizar')
      AND array_to_string(p.proconfig, ',') LIKE 'search_path=%') = 13,
  'EH J: todas as funcoes novas com search_path fixo');

-- Corretor não administra.
SELECT set_config('request.jwt.claims', json_build_object('sub','77777777-0000-0000-0000-000000000002','role','authenticated')::text, false);
SET ROLE authenticated;
SELECT public.test_assert((public.ncrm_entrada_config_set('{"escopo":"liberados"}'::jsonb,'CONFIRMAR')->>'erro') = 'sem_permissao',
  'EH J: corretor nao muda o modo de entrada');
SELECT public.test_assert((public.ncrm_sara_assist_config_set('ativo',0.5,'CONFIRMAR')->>'erro') = 'sem_permissao',
  'EH J: corretor nao configura a Sara');
RESET ROLE;
SELECT public.test_assert((SELECT escopo FROM public.ncrm_entrada_config WHERE id) = 'liberados',
  'EH J: configuracao intacta apos tentativa do corretor');

-- ============ K. FONTE DE ELEGIBILIDADE — TODOS OS CASOS ============
-- Fixtures extras: corretor com ACESSO ao CRM mas FORA do modo humano; admin; sem corretor.
INSERT INTO public.usuarios (id, nome, email, role, ativo) VALUES
  ('77777777-0000-0000-0000-000000000004','Corretor So Acesso','ehsa@x','corretor',true)
ON CONFLICT (id) DO NOTHING;
INSERT INTO public.corretores (id, usuario_id, ativo) VALUES (7003,'77777777-0000-0000-0000-000000000004',true)
ON CONFLICT (id) DO NOTHING;
-- Tem ACESSO a tela (ncrm_piloto), mas NAO foi liberado para abordagem humana.
INSERT INTO public.ncrm_piloto (usuario_id, ativo, liberado_por) VALUES ('77777777-0000-0000-0000-000000000004', true, '77777777-0000-0000-0000-000000000001')
ON CONFLICT (usuario_id) DO UPDATE SET ativo = true;
-- Corretor do ADMIN.
INSERT INTO public.corretores (id, usuario_id, ativo) VALUES (7004,'77777777-0000-0000-0000-000000000001',true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.leads (id, nome, telefone) VALUES
  (7103,'Cliente So Acesso','5511900000003'), (7104,'Cliente Admin','5511900000004'),
  (7105,'Cliente Antigo','5511900000005'), (7106,'Cliente Sem Corretor','5511900000006')
ON CONFLICT (id) DO NOTHING;
INSERT INTO public.negocios (id, lead_id, corretor_id, status, stage_id, criado_em) VALUES
  (71003, 7103, 7003, 'aberto', 20, now() - interval '4 minutes'),
  (71004, 7104, 7004, 'aberto', 20, now() - interval '4 minutes'),
  (71005, 7105, 7001, 'aberto', 20, now() - interval '60 days'),   -- ANTES do corte
  (71006, 7106, NULL, 'aberto', 20, now() - interval '4 minutes')  -- SEM corretor
ON CONFLICT (id) DO NOTHING;

SELECT public.test_assert(ncrm_private.negocio_elegivel_nova_era(71001),
  'EH K1: corretor com acesso E liberado para abordagem humana => elegivel');
SELECT public.test_assert(NOT ncrm_private.negocio_elegivel_nova_era(71003),
  'EH K2: corretor COM acesso a tela mas FORA do modo humano => NAO elegivel');
SELECT public.test_assert(NOT ncrm_private.negocio_elegivel_nova_era(71002),
  'EH K3: corretor sem acesso e sem liberacao => NAO elegivel');
SELECT public.test_assert(NOT ncrm_private.negocio_elegivel_nova_era(71004),
  'EH K4: ADMIN enxerga tudo, mas os negocios dele NAO sao elegiveis');
SELECT public.test_assert(NOT ncrm_private.negocio_elegivel_nova_era(71005),
  'EH K5: negocio ANTERIOR ao corte => NAO elegivel');
SELECT public.test_assert(NOT ncrm_private.negocio_elegivel_nova_era(71006),
  'EH K6: negocio SEM corretor => NAO elegivel');
SELECT public.test_assert(NOT public.ncrm_bloqueia_abordagem_automatica(7103),
  'EH K7: motor segue enviando para quem so tem acesso a tela');
SELECT public.test_assert(NOT public.ncrm_bloqueia_abordagem_automatica(7104),
  'EH K8: motor segue enviando para o admin');

-- Troca de corretor ANTES da primeira atuacao muda a elegibilidade.
UPDATE public.negocios SET corretor_id = 7002 WHERE id = 71003;
SELECT public.test_assert(NOT ncrm_private.negocio_elegivel_nova_era(71003),
  'EH K9: troca para corretor nao liberado mantem NAO elegivel');
UPDATE public.negocios SET corretor_id = 7001 WHERE id = 71003;
SELECT public.test_assert(ncrm_private.negocio_elegivel_nova_era(71003),
  'EH K9: troca para corretor liberado torna elegivel');
UPDATE public.negocios SET corretor_id = 7003 WHERE id = 71003;

-- Configuracao incompleta / inconsistente => fail-closed, legado preservado.
UPDATE public.ncrm_entrada_config SET escopo = 'nenhum' WHERE id;
SELECT public.test_assert(NOT ncrm_private.negocio_elegivel_nova_era(71001),
  'EH K10: escopo nenhum => ninguem elegivel');
SELECT public.test_assert(NOT public.ncrm_bloqueia_abordagem_automatica(7101),
  'EH K10: escopo nenhum => motor NUNCA bloqueado');
UPDATE public.ncrm_entrada_config SET escopo = 'liberados', modo_primeira_abordagem = 'automatica' WHERE id;
SELECT public.test_assert(NOT public.ncrm_bloqueia_abordagem_automatica(7101),
  'EH K11: modo automatico => motor nao bloqueado mesmo com corretor liberado');
UPDATE public.ncrm_ingest_config SET ativo = false WHERE id;
SELECT public.test_assert(NOT ncrm_private.negocio_elegivel_nova_era(71001),
  'EH K12: entrada desligada => fail-closed');
UPDATE public.ncrm_ingest_config SET ativo = true WHERE id;
UPDATE public.ncrm_entrada_config SET modo_primeira_abordagem = 'humana' WHERE id;

-- ============ L. CAMINHO AUTOMATICO DO LEGADO REALMENTE ENVIA ============
SELECT public.motor_envia_abordagem(0,'Boas-vindas','START',
  jsonb_build_object('nome','Cliente Legado','telefone','5511900000002'), 7102, 7002, NULL, '[1]'::jsonb);
SELECT public.test_assert(
  (SELECT count(*) FROM public.wa_mensagens m JOIN public.wa_conversas cv ON cv.id = m.conversa_id
     JOIN public.wa_contatos ct ON ct.id = cv.contato_id
    WHERE ct.lead_id = 7102 AND m.raw->>'origem' = 'motor') = 1,
  'EH L: LEGADO continua enviando a primeira abordagem automatica');

-- ============ M. CAMINHO HUMANO NAO ENVIA ============
SELECT public.motor_envia_abordagem(0,'Boas-vindas','START',
  jsonb_build_object('nome','Cliente Piloto','telefone','5511900000001'), 7101, 7001, NULL, '[1]'::jsonb);
SELECT public.test_assert(
  (SELECT count(*) FROM public.wa_mensagens m JOIN public.wa_conversas cv ON cv.id = m.conversa_id
     JOIN public.wa_contatos ct ON ct.id = cv.contato_id
    WHERE ct.lead_id = 7101 AND m.raw->>'origem' = 'motor'
      AND m.criado_em > now() - interval '10 seconds') = 0,
  'EH M: NOVA ERA nao recebe primeira mensagem automatica');
SELECT public.test_assert(
  (SELECT count(*) FROM public.motor_execucoes
    WHERE detalhe LIKE 'CRM NOVA ERA: primeira abordagem e humana%') >= 1,
  'EH M: o bloqueio fica registrado no log do motor, nao em silencio');

-- ============ N. REMOCAO DO PILOTO ============
SELECT set_config('request.jwt.claims', json_build_object('sub','77777777-0000-0000-0000-000000000001','role','authenticated')::text, false);
SET ROLE authenticated;
SELECT public.ncrm_abordagem_humana_definir(7001, false, 'CONFIRMAR');
RESET ROLE;
SELECT public.test_assert(NOT ncrm_private.negocio_elegivel_nova_era(71001),
  'EH N: removido do piloto => novos negocios voltam ao legado');
SELECT public.test_assert(EXISTS (SELECT 1 FROM public.ncrm_estado WHERE negocio_id = 71001),
  'EH N: atendimento ja criado NAO e apagado');
SELECT public.test_assert((SELECT count(*) FROM public.ncrm_evento WHERE negocio_id = 71001) >= 1,
  'EH N: historico do negocio Nova Era continua auditavel');
SELECT public.test_assert((SELECT count(*) FROM public.ncrm_abordagem_humana_audit WHERE corretor_id = 7001) = 2,
  'EH N: entrada e saida do modo humano ficam auditadas');
SELECT public.test_assert(NOT public.ncrm_bloqueia_abordagem_automatica(7101),
  'EH N: motor volta a poder enviar para esse corretor');
-- Sem envio duplicado para quem ja tinha card.
SELECT ncrm_private.reconciliar_mensagens(50);
SELECT public.test_assert((SELECT count(*) FROM public.ncrm_estado WHERE negocio_id = 71001) = 1,
  'EH N: nenhum card duplicado apos a remocao');
-- Reativa para o restante da suite.
SELECT set_config('request.jwt.claims', json_build_object('sub','77777777-0000-0000-0000-000000000001','role','authenticated')::text, false);
SET ROLE authenticated;
SELECT public.ncrm_abordagem_humana_definir(7001, true, 'ATIVAR ABORDAGEM HUMANA');
SELECT public.test_assert((public.ncrm_abordagem_humana_listar()->>'ok')::boolean,
  'EH N: administrador lista corretores por NOME, com as duas dimensoes');
SELECT public.test_assert(
  EXISTS (SELECT 1 FROM jsonb_array_elements(public.ncrm_abordagem_humana_listar()->'corretores') x
           WHERE (x->>'corretor_id')::bigint = 7003 AND (x->>'acessa_crm')::boolean
             AND NOT (x->>'abordagem_humana')::boolean),
  'EH N: a lista separa acesso ao CRM de participacao na abordagem humana');
RESET ROLE;

-- ============ O. PROTECAO DA FUNCAO LEGADA ============
SELECT public.test_assert((SELECT count(*) FROM public.ncrm_funcao_legada_backup
                            WHERE funcao='motor_envia_abordagem') = 1,
  'EH O: definicao anterior de motor_envia_abordagem foi salva antes da troca');
SELECT public.test_assert(
  (SELECT position('ncrm_bloqueia_abordagem_automatica' in definicao) = 0
     FROM public.ncrm_funcao_legada_backup WHERE funcao='motor_envia_abordagem'),
  'EH O: o backup guarda a versao SEM o guarda');
SELECT public.test_assert(
  (SELECT prosecdef FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
    WHERE n.nspname='public' AND p.proname='motor_envia_abordagem'),
  'EH O: SECURITY DEFINER preservado apos a troca');
SELECT public.test_assert(
  (SELECT array_to_string(proconfig,',') FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
    WHERE n.nspname='public' AND p.proname='motor_envia_abordagem') LIKE 'search_path=%',
  'EH O: search_path preservado apos a troca');
SELECT public.test_assert(
  (SELECT count(*) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
    WHERE n.nspname='public' AND p.proname='motor_envia_abordagem') = 1,
  'EH O: continua sem overloads');

-- ==========================================================================
-- CENARIOS A-G — criacao x continuidade do atendimento
-- ==========================================================================
-- Fixtures proprias (faixa 72xxx) para nao depender do estado das secoes anteriores.
INSERT INTO public.usuarios (id, nome, email, role, ativo) VALUES
  ('72000000-0000-0000-0000-000000000001','Corretor AG','ag@x','corretor',true)
ON CONFLICT (id) DO NOTHING;
INSERT INTO public.corretores (id, usuario_id, ativo, nome) VALUES (7201,'72000000-0000-0000-0000-000000000001',true,'Corretor AG')
ON CONFLICT (id) DO NOTHING;
INSERT INTO public.leads (id, nome, telefone) VALUES
  (7201,'AG Sem Estado','5511920000001'), (7202,'AG Com Estado','5511920000002'),
  (7203,'AG Liberado','5511920000003'),   (7204,'AG Pos Remocao','5511920000004'),
  (7205,'AG Antes Dist','5511920000005')
ON CONFLICT (id) DO NOTHING;
INSERT INTO public.wa_contatos (id, lead_id, telefone) VALUES
  ('72a00000-0000-0000-0000-000000000001', 7201, '5511920000001'),
  ('72a00000-0000-0000-0000-000000000002', 7202, '5511920000002'),
  ('72a00000-0000-0000-0000-000000000003', 7203, '5511920000003'),
  ('72a00000-0000-0000-0000-000000000004', 7204, '5511920000004'),
  ('72a00000-0000-0000-0000-000000000005', 7205, '5511920000005')
ON CONFLICT (id) DO NOTHING;
INSERT INTO public.wa_conversas (id, contato_id) VALUES
  ('72c00000-0000-0000-0000-000000000001','72a00000-0000-0000-0000-000000000001'),
  ('72c00000-0000-0000-0000-000000000002','72a00000-0000-0000-0000-000000000002'),
  ('72c00000-0000-0000-0000-000000000003','72a00000-0000-0000-0000-000000000003'),
  ('72c00000-0000-0000-0000-000000000004','72a00000-0000-0000-0000-000000000004'),
  ('72c00000-0000-0000-0000-000000000005','72a00000-0000-0000-0000-000000000005')
ON CONFLICT (id) DO NOTHING;

-- ---------- A. escopo nenhum + negocio SEM estado + mensagem do motor ----------
UPDATE public.ncrm_entrada_config SET escopo = 'nenhum', modo_primeira_abordagem = 'automatica' WHERE id;
INSERT INTO public.negocios (id, lead_id, corretor_id, status, stage_id, criado_em)
VALUES (72001, 7201, 7201, 'aberto', 20, now() - interval '3 minutes') ON CONFLICT (id) DO NOTHING;

SELECT public.test_assert(NOT public.ncrm_bloqueia_abordagem_automatica(7201),
  'AG A: motor automatico PERMITIDO com escopo nenhum');
SELECT public.motor_envia_abordagem(0,'Boas-vindas','START',
  jsonb_build_object('nome','AG Sem Estado','telefone','5511920000001'), 7201, 7201, NULL, '[1]'::jsonb);
SELECT public.test_assert(
  (SELECT count(*) FROM public.wa_mensagens WHERE conversa_id='72c00000-0000-0000-0000-000000000001'
     AND raw->>'origem'='motor') = 1,
  'AG A: mensagem automatica foi REGISTRADA (legado funcionando)');
SELECT ncrm_private.reconciliar_mensagens(100);
SELECT public.test_assert(NOT EXISTS (SELECT 1 FROM public.ncrm_estado WHERE negocio_id = 72001),
  'AG A: ZERO ncrm_estado — mensagem do motor nao cria card fora do escopo');
SELECT public.test_assert(
  (SELECT status FROM public.ncrm_ingest_checkpoint c
     JOIN public.wa_mensagens m ON m.id = c.mensagem_id
    WHERE m.conversa_id='72c00000-0000-0000-0000-000000000001') = 'noop_fora_do_escopo',
  'AG A: item encerrado como noop_fora_do_escopo');
SELECT public.test_assert(
  (SELECT motivo_final = 'negocio_fora_do_piloto' AND finalizado_em IS NOT NULL
     FROM public.ncrm_ingest_checkpoint c JOIN public.wa_mensagens m ON m.id = c.mensagem_id
    WHERE m.conversa_id='72c00000-0000-0000-0000-000000000001'),
  'AG A: motivo_final e finalizado_em registrados');
SELECT public.test_assert((SELECT count(*) FROM public.ncrm_sara_analise WHERE negocio_id = 72001) = 0,
  'AG A: ZERO Sara para negocio fora do escopo');
SELECT public.test_assert((SELECT count(*) FROM public.ncrm_ingest_checkpoint WHERE status='erro') = 0,
  'AG A: ZERO erro tecnico');
SELECT ncrm_private.reconciliar_mensagens(100);
SELECT public.test_assert(NOT EXISTS (SELECT 1 FROM public.ncrm_estado WHERE negocio_id = 72001),
  'AG A: reprocessar nao cria card');

-- ---------- B. escopo nenhum + atendimento JA existente + inbound ----------
INSERT INTO public.negocios (id, lead_id, corretor_id, status, stage_id, criado_em)
VALUES (72002, 7202, 7201, 'aberto', 20, now() - interval '3 minutes') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.ncrm_estado (negocio_id, workflow_config_id, etapa, proxima_acao_tipo,
    proxima_acao_titulo, proxima_acao_em, origem_ultima)
SELECT 72002, id, 'tentando_contato', 'tentativa_cadencia', 'Aguardar retorno', now() + interval '1 day', 'sistema'
  FROM public.ncrm_workflow_config WHERE status='publicada' ORDER BY versao DESC LIMIT 1
ON CONFLICT (negocio_id) DO NOTHING;

INSERT INTO public.wa_mensagens (id, wa_message_id, conversa_id, direcao, tipo, conteudo, criado_em)
VALUES ('72d00000-0000-0000-0000-000000000002','ag-in-2','72c00000-0000-0000-0000-000000000002',
        'recebida','texto','Quero saber o valor', now())
ON CONFLICT (id) DO NOTHING;
SELECT ncrm_private.reconciliar_mensagens(100);
SELECT public.test_assert((SELECT etapa FROM public.ncrm_estado WHERE negocio_id = 72002) = 'em_atendimento',
  'AG B: atendimento existente CONTINUA sendo processado mesmo fora do escopo');
SELECT public.test_assert((SELECT respondeu AND resposta_pendente FROM public.ncrm_estado WHERE negocio_id = 72002),
  'AG B: resposta do cliente reconhecida');
SELECT public.test_assert((SELECT count(*) FROM public.ncrm_estado WHERE negocio_id = 72002) = 1,
  'AG B: ZERO duplicidade de atendimento');
SELECT public.test_assert((SELECT count(*) FROM public.ncrm_evento WHERE idempotency_key = 'wa:ag-in-2') = 1,
  'AG B: evento unico');

-- ---------- C. corretor liberado + novo negocio ----------
SELECT set_config('request.jwt.claims', json_build_object('sub','77777777-0000-0000-0000-000000000001','role','authenticated')::text, false);
SET ROLE authenticated;
SELECT public.ncrm_entrada_config_set('{"escopo":"liberados","modo_primeira_abordagem":"humana"}'::jsonb,'CONFIRMAR');
SELECT public.ncrm_abordagem_humana_definir(7201, true, 'ATIVAR ABORDAGEM HUMANA');
RESET ROLE;
INSERT INTO public.negocios (id, lead_id, corretor_id, status, stage_id, criado_em)
VALUES (72003, 7203, 7201, 'aberto', 20, now() - interval '2 minutes') ON CONFLICT (id) DO NOTHING;
SELECT ncrm_private.reconciliar_mensagens(100);
SELECT public.test_assert(EXISTS (SELECT 1 FROM public.ncrm_estado WHERE negocio_id = 72003),
  'AG C: card nasce pela DISTRIBUICAO');
SELECT public.test_assert((SELECT etapa FROM public.ncrm_estado WHERE negocio_id = 72003) = 'novo',
  'AG C: nasce no momento Novo');
SELECT public.test_assert(
  (SELECT proxima_acao_titulo LIKE '%Primeira abordagem%' FROM public.ncrm_estado WHERE negocio_id = 72003),
  'AG C: tarefa de chamar o cliente criada');
SELECT public.test_assert(public.ncrm_bloqueia_abordagem_automatica(7203),
  'AG C: motor BLOQUEADO antes de instancia/HTTP');
SELECT public.motor_envia_abordagem(0,'Boas-vindas','START',
  jsonb_build_object('nome','AG Liberado','telefone','5511920000003'), 7203, 7201, NULL, '[1]'::jsonb);
SELECT public.test_assert(
  (SELECT count(*) FROM public.wa_mensagens WHERE conversa_id='72c00000-0000-0000-0000-000000000003') = 0,
  'AG C: ZERO mensagem automatica enviada');

-- ---------- D. corretor removido DEPOIS da criacao ----------
SELECT set_config('request.jwt.claims', json_build_object('sub','77777777-0000-0000-0000-000000000001','role','authenticated')::text, false);
SET ROLE authenticated;
SELECT public.ncrm_abordagem_humana_definir(7201, false, 'CONFIRMAR');
RESET ROLE;
SELECT public.test_assert(EXISTS (SELECT 1 FROM public.ncrm_estado WHERE negocio_id = 72003),
  'AG D: atendimento existente PRESERVADO apos remocao');
INSERT INTO public.wa_mensagens (id, wa_message_id, conversa_id, direcao, tipo, conteudo, criado_em)
VALUES ('72d00000-0000-0000-0000-000000000003','ag-in-3','72c00000-0000-0000-0000-000000000003',
        'recebida','texto','Oi', now())
ON CONFLICT (id) DO NOTHING;
SELECT ncrm_private.reconciliar_mensagens(100);
SELECT public.test_assert((SELECT etapa FROM public.ncrm_estado WHERE negocio_id = 72003) = 'em_atendimento',
  'AG D: inbound continua sendo processado no atendimento existente');
INSERT INTO public.negocios (id, lead_id, corretor_id, status, stage_id, criado_em)
VALUES (72004, 7204, 7201, 'aberto', 20, now() - interval '1 minute') ON CONFLICT (id) DO NOTHING;
SELECT ncrm_private.reconciliar_mensagens(100);
SELECT public.test_assert(NOT EXISTS (SELECT 1 FROM public.ncrm_estado WHERE negocio_id = 72004),
  'AG D: novo negocio do corretor removido NAO cria card');
SELECT public.test_assert(NOT public.ncrm_bloqueia_abordagem_automatica(7204),
  'AG D: motor volta a enviar nesses novos negocios');
SELECT public.motor_envia_abordagem(0,'Boas-vindas','START',
  jsonb_build_object('nome','AG Pos Remocao','telefone','5511920000004'), 7204, 7201, NULL, '[1]'::jsonb);
SELECT public.test_assert(
  (SELECT count(*) FROM public.wa_mensagens WHERE conversa_id='72c00000-0000-0000-0000-000000000004'
     AND raw->>'origem'='motor') = 1,
  'AG D: legado automatico voltou a funcionar');
SELECT ncrm_private.reconciliar_mensagens(100);
SELECT public.test_assert(NOT EXISTS (SELECT 1 FROM public.ncrm_estado WHERE negocio_id = 72004),
  'AG D: nem mesmo a mensagem do motor cria card apos a remocao');

-- ---------- E. corrida distribuicao x motor ----------
SELECT set_config('request.jwt.claims', json_build_object('sub','77777777-0000-0000-0000-000000000001','role','authenticated')::text, false);
SET ROLE authenticated;
SELECT public.ncrm_abordagem_humana_definir(7201, true, 'ATIVAR ABORDAGEM HUMANA');
RESET ROLE;
SELECT ncrm_private.reconciliar_mensagens(100);
SELECT ncrm_private.reconciliar_mensagens(100);
SELECT ncrm_private.reconciliar_mensagens(100);
SELECT public.test_assert((SELECT count(*) FROM public.ncrm_estado WHERE negocio_id = 72004) <= 1,
  'AG E: retry idempotente — nunca mais de um card');
SELECT public.test_assert(
  (SELECT count(*) FROM public.ncrm_evento WHERE idempotency_key = 'entrada_distribuicao:72004') <= 1,
  'AG E: evento de entrada nao duplica na corrida');
SELECT public.test_assert(
  NOT (public.ncrm_bloqueia_abordagem_automatica(7204)
       AND (SELECT count(*) FROM public.wa_mensagens WHERE conversa_id='72c00000-0000-0000-0000-000000000004'
              AND raw->>'origem'='motor' AND criado_em > now() - interval '5 seconds') > 0),
  'AG E: decisao consistente — nao ha envio e bloqueio simultaneos');

-- ---------- F. mensagem ANTERIOR a distribuicao ----------
INSERT INTO public.wa_mensagens (id, wa_message_id, conversa_id, direcao, tipo, conteudo, criado_em)
VALUES ('72d00000-0000-0000-0000-000000000005','ag-pre-5','72c00000-0000-0000-0000-000000000005',
        'enviada','texto','mensagem antiga', now() - interval '10 days')
ON CONFLICT (id) DO NOTHING;
INSERT INTO public.negocios (id, lead_id, corretor_id, status, stage_id, criado_em)
VALUES (72005, 7205, 7201, 'aberto', 20, now() - interval '1 minute') ON CONFLICT (id) DO NOTHING;
SELECT ncrm_private.reconciliar_mensagens(100);
SELECT public.test_assert((SELECT etapa FROM public.ncrm_estado WHERE negocio_id = 72005) = 'novo',
  'AG F: mensagem anterior a distribuicao NAO move a etapa');
SELECT public.test_assert((SELECT count(*) FROM public.ncrm_evento WHERE idempotency_key = 'humana:ag-pre-5') = 0,
  'AG F: nao conta como primeira atuacao humana');
SELECT public.test_assert((SELECT ultima_decisao_humana_em IS NULL FROM public.ncrm_estado WHERE negocio_id = 72005),
  'AG F: nenhum SLA humano registrado');

-- ---------- G. primeira outbound humana valida ----------
INSERT INTO public.wa_mensagens (id, wa_message_id, conversa_id, direcao, tipo, conteudo, criado_em)
VALUES ('72d00000-0000-0000-0000-000000000006','ag-hum-6','72c00000-0000-0000-0000-000000000005',
        'enviada','texto','Ola! Sou seu corretor.', now())
ON CONFLICT (id) DO NOTHING;
SELECT ncrm_private.reconciliar_mensagens(100);
SELECT public.test_assert((SELECT etapa FROM public.ncrm_estado WHERE negocio_id = 72005) = 'tentando_contato',
  'AG G: primeira outbound humana move Novo -> Tentando contato');
SELECT public.test_assert((SELECT count(*) FROM public.ncrm_evento WHERE idempotency_key = 'humana:ag-hum-6') = 1,
  'AG G: evento unico');
SELECT public.test_assert(
  (SELECT (payload->>'sla_min')::int >= 0 FROM public.ncrm_evento WHERE idempotency_key = 'humana:ag-hum-6'),
  'AG G: SLA calculado e nunca negativo');
SELECT public.test_assert(
  (SELECT proxima_acao_em IS NOT NULL AND proxima_acao_titulo IS NOT NULL
     FROM public.ncrm_estado WHERE negocio_id = 72005),
  'AG G: proxima acao criada');
SELECT ncrm_private.notificacoes_sincronizar();
SELECT public.test_assert(
  (SELECT resolvida_por FROM public.ncrm_notificacao WHERE chave = 'novo:72005') = 'automatica',
  'AG G: notificacao de primeira abordagem resolvida automaticamente');
SELECT ncrm_private.reconciliar_mensagens(100);
SELECT public.test_assert((SELECT count(*) FROM public.ncrm_evento WHERE idempotency_key = 'humana:ag-hum-6') = 1,
  'AG G: reprocessamento sem duplicidade');

-- ---------- complementares ----------
SELECT public.test_assert((public.ncrm_registrar_primeira_humana(999999,'x',now())->>'erro') = 'negocio_inexistente',
  'AG H: negocio inexistente e recusado');
SELECT public.test_assert((public.ncrm_registrar_primeira_humana(72005,'',now())->>'erro') = 'message_id_obrigatorio',
  'AG H: message_id obrigatorio');
SELECT public.test_assert((public.ncrm_registrar_primeira_humana(72005,'ag-hum-6',now())->>'ja_processado')::boolean,
  'AG H: mensagem duplicada e idempotente');
SELECT public.test_assert(NOT ncrm_private.negocio_elegivel_nova_era(72001),
  'AG H: negocio sem liberacao segue nao elegivel');
UPDATE public.ncrm_entrada_config SET escopo = 'nenhum', modo_primeira_abordagem = 'automatica' WHERE id;
