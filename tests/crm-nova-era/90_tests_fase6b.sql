-- ============================================================================
-- FASE 6 (PR B) — testes de treinamento, carteira antiga assistida e saúde.
-- Roda no Postgres LOCAL efêmero. Nunca toca produção.
-- Convenção: chamadas de RPC rodam com SET ROLE authenticated (como o app);
-- asserções que leem tabela direto rodam com RESET ROLE (as tabelas novas
-- não dão SELECT a ninguém — é isso que queremos provar).
-- ============================================================================

-- Complementos do harness usados só por este bloco (aditivos, idempotentes).
ALTER TABLE public.corretores      ADD COLUMN IF NOT EXISTS nome text;
ALTER TABLE public.corretores      ADD COLUMN IF NOT EXISTS apelido text;
ALTER TABLE public.leads           ADD COLUMN IF NOT EXISTS origem text;
ALTER TABLE public.leads           ADD COLUMN IF NOT EXISTS criado_em timestamptz NOT NULL DEFAULT now();
ALTER TABLE public.pipeline_stages ADD COLUMN IF NOT EXISTS rotulo text;
ALTER TABLE public.wa_mensagens    ADD COLUMN IF NOT EXISTS is_grupo boolean DEFAULT false;
-- ncrm_sara_runner_config nasce na migration do cron (pg_cron/vault), fora do harness local:
-- aqui basta o formato real da tabela para exercitar o kill-switch da leitura.
CREATE TABLE IF NOT EXISTS public.ncrm_sara_runner_config (
  id boolean PRIMARY KEY DEFAULT true CHECK (id), enabled boolean NOT NULL DEFAULT false,
  edge_url text, atualizado_em timestamptz NOT NULL DEFAULT now(), atualizado_por uuid
);
INSERT INTO public.ncrm_sara_runner_config (id, enabled) VALUES (true, true) ON CONFLICT (id) DO NOTHING;
CREATE TABLE IF NOT EXISTS public.wa_instancias (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), session_id text, corretor_id bigint,
  rotulo text, telefone text, status text, ultimo_heartbeat timestamptz
);

-- Fixtures isoladas (faixa 9xxxx, não colide com nenhum outro bloco).
INSERT INTO public.usuarios (id, nome, email, role, ativo) VALUES
  ('99999999-0000-0000-0000-000000000001','Admin Fase6B','a6b@x','admin',true),
  ('99999999-0000-0000-0000-000000000002','Corretor Fase6B','c6b@x','corretor',true)
ON CONFLICT (id) DO NOTHING;
INSERT INTO public.corretores (id, usuario_id, ativo, nome) VALUES (9001,'99999999-0000-0000-0000-000000000002',true,'Corretor Fase6B')
ON CONFLICT (id) DO NOTHING;
INSERT INTO public.leads (id, nome, origem) VALUES (9101,'Cliente Antigo A','anuncio'), (9102,'Cliente Antigo B','indicacao')
ON CONFLICT (id) DO NOTHING;
INSERT INTO public.negocios (id, lead_id, corretor_id, status, stage_id, criado_em, ultima_movimentacao) VALUES
  (91001, 9101, 9001, 'aberto', 20, now() - interval '30 days', now() - interval '20 days'),
  (91002, 9102, 9001, 'aberto', 20, now() - interval '40 days', now() - interval '35 days')
ON CONFLICT (id) DO NOTHING;

-- ---------------------------------------------------------------- TREINAMENTO
SELECT set_config('request.jwt.claims', json_build_object('sub','99999999-0000-0000-0000-000000000002','role','authenticated')::text, false);
SET ROLE authenticated;
SELECT public.test_assert((public.ncrm_treinamento_meu()->>'ok')::boolean
  AND jsonb_array_length(public.ncrm_treinamento_meu()->'concluidos') = 0,
  'F6B treinamento: começa vazio para o corretor');
SELECT public.ncrm_treinamento_marcar('meu-dia', true);
SELECT public.test_assert(public.ncrm_treinamento_meu()->'concluidos' @> '["meu-dia"]'::jsonb,
  'F6B treinamento: marcar registra o item');
SELECT public.ncrm_treinamento_marcar('meu-dia', true);
SELECT public.test_assert(jsonb_array_length(public.ncrm_treinamento_meu()->'concluidos') = 1,
  'F6B treinamento: marcar duas vezes é idempotente');
SELECT public.ncrm_treinamento_marcar('meu-dia', false);
SELECT public.test_assert(jsonb_array_length(public.ncrm_treinamento_meu()->'concluidos') = 0,
  'F6B treinamento: desmarcar remove o item');
SELECT public.test_assert((public.ncrm_treinamento_marcar('x', true)->>'erro') = 'item_invalido',
  'F6B treinamento: item curto demais é recusado');
SELECT public.test_assert((public.ncrm_treinamento_equipe()->>'erro') = 'sem_permissao',
  'F6B treinamento: corretor não vê a equipe');
RESET ROLE;

SELECT set_config('request.jwt.claims', json_build_object('sub','99999999-0000-0000-0000-000000000001','role','authenticated')::text, false);
SET ROLE authenticated;
SELECT public.test_assert((public.ncrm_treinamento_equipe()->>'ok')::boolean,
  'F6B treinamento: admin acompanha a conclusão da equipe');

-- ------------------------------------------------- CARTEIRA ANTIGA — PRÉVIA
SELECT public.test_assert((public.ncrm_migracao_preview('{}'::jsonb)->>'somente_leitura')::boolean,
  'F6B prévia: declara-se somente leitura');
SELECT public.test_assert((public.ncrm_migracao_preview('{"quantidade":"99"}'::jsonb)->>'limite')::int = 10,
  'F6B prévia: teto rígido de 10 mesmo pedindo mais');
SELECT public.test_assert((public.ncrm_migracao_preview('{"quantidade":"3"}'::jsonb)->>'limite')::int = 3,
  'F6B prévia: respeita quantidade menor');
SELECT public.test_assert(
  jsonb_array_length(public.ncrm_migracao_preview('{"busca":"Cliente Antigo"}'::jsonb)->'itens') = 2,
  'F6B prévia: encontra os dois negócios da carteira antiga');
SELECT public.test_assert(
  jsonb_array_length(public.ncrm_migracao_preview('{"busca":"Cliente Antigo","conversa":"sim"}'::jsonb)->'itens') = 0,
  'F6B prévia: filtro de conversa exclui quem não tem histórico');
SELECT public.test_assert((public.ncrm_migracao_contexto(ARRAY[91001,91002]::bigint[])->>'ok')::boolean,
  'F6B contexto: admin obtém o contexto de leitura');
SELECT public.test_assert(
  (public.ncrm_migracao_contexto(ARRAY[1,2,3,4,5,6,7,8,9,10,11]::bigint[])->>'erro') = 'limite_10',
  'F6B contexto: recusa lote acima de 10');
RESET ROLE;

-- A prévia e o contexto NÃO podem escrever nada (leitura direta, fora do RLS).
SELECT public.test_assert((SELECT count(*) FROM public.ncrm_estado WHERE negocio_id IN (91001,91002)) = 0,
  'F6B prévia: nenhum atendimento criado');
SELECT public.test_assert((SELECT count(*) FROM public.ncrm_migracao_item) = 0,
  'F6B prévia: nenhum item de migração registrado');
SELECT public.test_assert((SELECT count(*) FROM public.ncrm_evento WHERE negocio_id IN (91001,91002)) = 0,
  'F6B prévia: nenhum evento gerado');

-- --------------------------------------------- CARTEIRA ANTIGA — LEITURA SARA
SET ROLE authenticated;
SELECT public.ncrm_migracao_registrar_analise(jsonb_build_object(
  'negocio_id', 91001, 'context_hash', 'ca1234', 'resumo', 'cliente pediu retorno',
  'etapa_sugerida','em_acompanhamento','temperatura','morno','risco','medio',
  'proxima_acao','retomar contato','justificativa','o cliente pediu para chamarem depois',
  'evidencias', '["me chama semana que vem"]'::jsonb, 'confianca', 0.7,
  'contexto_qualidade','boa','versao_modelo','sara/ia-router'));
SELECT public.ncrm_migracao_registrar_analise(jsonb_build_object(
  'negocio_id', 91002, 'context_hash','ca9999','contexto_qualidade','insuficiente','evidencias','[]'::jsonb));
RESET ROLE;
SELECT public.test_assert((SELECT etapa_sugerida FROM public.ncrm_migracao_analise WHERE negocio_id = 91001) = 'em_acompanhamento',
  'F6B leitura: análise registrada');
SELECT public.test_assert((SELECT NOT evidencia_insuficiente FROM public.ncrm_migracao_analise WHERE negocio_id = 91001),
  'F6B leitura: com evidência e etapa, não marca falta de base');
SELECT public.test_assert((SELECT evidencia_insuficiente FROM public.ncrm_migracao_analise WHERE negocio_id = 91002),
  'F6B leitura: sem evidência marca explicitamente falta de base');
SELECT public.test_assert((SELECT count(*) FROM public.ncrm_estado WHERE negocio_id IN (91001,91002)) = 0,
  'F6B leitura: registrar análise não cria atendimento');

-- ------------------------------------------ CARTEIRA ANTIGA — APROVAÇÃO
SET ROLE authenticated;
SELECT public.test_assert((public.ncrm_migracao_aprovar(91001,'em_acompanhamento','retornar_contato','ligar de retorno', now()+interval '1 day','')->>'erro') = 'confirmacao_obrigatoria',
  'F6B aprovação: sem digitar MIGRAR não migra');
SELECT public.test_assert((public.ncrm_migracao_aprovar(91001,'etapa_que_nao_existe','retornar_contato','x', now()+interval '1 day','MIGRAR')->>'erro') = 'etapa_invalida',
  'F6B aprovação: etapa inválida é recusada');
SELECT public.test_assert((public.ncrm_migracao_aprovar(91001,'em_acompanhamento','retornar_contato','ligar de retorno', NULL,'MIGRAR')->>'erro') = 'prazo_obrigatorio',
  'F6B aprovação: exige prazo (nenhum atendimento nasce sem próxima ação com data)');
SELECT public.test_assert((public.ncrm_migracao_aprovar(91001,'em_acompanhamento','retornar_contato','', now()+interval '1 day','MIGRAR')->>'erro') = 'proxima_acao_sem_titulo',
  'F6B aprovação: exige próxima ação escrita');
SELECT public.test_assert((public.ncrm_migracao_aprovar(91001,'em_acompanhamento','tipo_inexistente','x', now()+interval '1 day','MIGRAR')->>'erro') = 'proxima_acao_invalida',
  'F6B aprovação: tipo de próxima ação inválido é recusado');
SELECT public.test_assert((public.ncrm_migracao_aprovar(91001,'tentando_contato','retornar_contato','ligar de retorno', now()+interval '1 day','MIGRAR')->>'ok')::boolean,
  'F6B aprovação: migra o cliente selecionado');
SELECT public.test_assert((public.ncrm_migracao_aprovar(91001,'tentando_contato','retornar_contato','de novo', now()+interval '1 day','MIGRAR')->>'erro') = 'ja_existe_atendimento',
  'F6B aprovação: não duplica atendimento');
SELECT public.test_assert(
  jsonb_array_length(public.ncrm_migracao_preview('{"busca":"Cliente Antigo"}'::jsonb)->'itens') = 1,
  'F6B prévia: quem já migrou sai da lista da carteira antiga');
RESET ROLE;

SELECT public.test_assert((SELECT etapa FROM public.ncrm_estado WHERE negocio_id = 91001) = 'tentando_contato',
  'F6B aprovação: vale a etapa aprovada pelo humano, não a sugerida');
SELECT public.test_assert((SELECT origem_ultima FROM public.ncrm_estado WHERE negocio_id = 91001) = 'migracao',
  'F6B aprovação: origem registrada como migração');
SELECT public.test_assert((SELECT proxima_acao_titulo IS NOT NULL AND proxima_acao_em IS NOT NULL
                           FROM public.ncrm_estado WHERE negocio_id = 91001),
  'F6B aprovação: atendimento nasce com próxima ação e prazo');
SELECT public.test_assert(
  (SELECT etapa_sugerida = 'em_acompanhamento' AND etapa_aprovada = 'tentando_contato'
          AND aprovado_por = '99999999-0000-0000-0000-000000000001'::uuid AND ativo
          AND origem = 'migracao_assistida'
   FROM public.ncrm_migracao_item WHERE negocio_id = 91001),
  'F6B aprovação: auditoria guarda sugerido, aprovado, aprovador e origem');
SELECT public.test_assert((SELECT count(*) FROM public.ncrm_evento WHERE negocio_id = 91001 AND origem = 'migracao') = 1,
  'F6B aprovação: um evento auditável de migração');

-- O CRM antigo continua intacto.
SELECT public.test_assert((SELECT status FROM public.negocios WHERE id = 91001) = 'aberto'
  AND (SELECT stage_id FROM public.negocios WHERE id = 91001) = 20,
  'F6B aprovação: negócio no CRM antigo permanece igual');
SELECT public.test_assert((SELECT count(*) FROM public.visitas WHERE negocio_id = 91001) = 0
  AND (SELECT count(*) FROM public.ncrm_proposta WHERE negocio_id = 91001) = 0,
  'F6B aprovação: nenhuma visita ou proposta criada');

-- --------------------------------------------- CARTEIRA ANTIGA — ROLLBACK
SET ROLE authenticated;
SELECT public.test_assert((public.ncrm_migracao_rollback(91002)->>'erro') = 'nao_migrado',
  'F6B rollback: só desfaz o que foi migrado');
SELECT public.test_assert((public.ncrm_migracao_rollback(91001)->>'ok')::boolean,
  'F6B rollback: desfaz individualmente');
RESET ROLE;
SELECT public.test_assert((SELECT count(*) FROM public.ncrm_estado WHERE negocio_id = 91001) = 0,
  'F6B rollback: atendimento removido do CRM Nova Era');
SELECT public.test_assert((SELECT NOT ativo AND desativado_por IS NOT NULL FROM public.ncrm_migracao_item WHERE negocio_id = 91001),
  'F6B rollback: auditoria preservada e desativada');
SELECT public.test_assert((SELECT status FROM public.negocios WHERE id = 91001) = 'aberto',
  'F6B rollback: CRM antigo segue intacto');

-- --------------------------------------------------------------------- SAÚDE
SET ROLE authenticated;
SELECT public.test_assert((public.ncrm_saude()->>'ok')::boolean, 'F6B saúde: admin lê o diagnóstico');
SELECT public.test_assert(public.ncrm_saude()->'sara'->>'custo_disponivel' = 'false',
  'F6B saúde: custo nunca é inventado');
SELECT public.test_assert((public.ncrm_saude_acao('desligar_runner', NULL, 'nao')->>'erro') = 'confirmacao_obrigatoria',
  'F6B saúde: ação exige confirmação digitada');
SELECT public.test_assert((public.ncrm_saude_acao('ligar_sara_execute', NULL, 'CONFIRMAR')->>'erro') = 'acao_invalida',
  'F6B saúde: não existe ação para ligar a Sara em execução');
SELECT public.test_assert((public.ncrm_saude_acao('desligar_runner', NULL, 'CONFIRMAR')->>'ok')::boolean,
  'F6B saúde: desligar a leitura da Sara funciona');
RESET ROLE;
SELECT public.test_assert((SELECT NOT enabled FROM public.ncrm_sara_runner_config WHERE id),
  'F6B saúde: kill-switch da leitura aplicado');
SELECT public.test_assert((SELECT count(*) FROM public.ncrm_saude_acao_audit WHERE acao = 'desligar_runner') = 1,
  'F6B saúde: ação auditada');

UPDATE public.ncrm_sara_config SET modo = 'suggest' WHERE id;
SET ROLE authenticated;
SELECT public.test_assert((public.ncrm_saude_acao('religar_runner_observador', NULL, 'CONFIRMAR')->>'erro') = 'sara_fora_de_observacao',
  'F6B saúde: só religa a leitura com a Sara em observação');
RESET ROLE;
SELECT public.test_assert((SELECT NOT enabled FROM public.ncrm_sara_runner_config WHERE id),
  'F6B saúde: tentativa recusada não religou nada');
UPDATE public.ncrm_sara_config SET modo = 'observer' WHERE id;
SET ROLE authenticated;
SELECT public.test_assert((public.ncrm_saude_acao('religar_runner_observador', NULL, 'CONFIRMAR')->>'ok')::boolean,
  'F6B saúde: religa a leitura em modo de observação');
SELECT public.test_assert((public.ncrm_saude_acao('reprocessar_item','nao-existe','CONFIRMAR')->>'resultado') = 'ignorado',
  'F6B saúde: reprocessar item inexistente não quebra e é registrado');
SELECT public.test_assert((public.ncrm_saude_acao('retentar_analise','91001','CONFIRMAR')->>'resultado') = 'ignorado',
  'F6B saúde: pedir nova leitura sem item pendente não quebra');
RESET ROLE;
SELECT public.test_assert((SELECT enabled FROM public.ncrm_sara_runner_config WHERE id),
  'F6B saúde: leitura religada apenas em observação');
SELECT public.test_assert((SELECT modo FROM public.ncrm_sara_config WHERE id) = 'observer',
  'F6B saúde: nenhuma ação mudou o modo da Sara');

-- ------------------------------------------------------------------ PERMISSÃO
SELECT set_config('request.jwt.claims', json_build_object('sub','99999999-0000-0000-0000-000000000002','role','authenticated')::text, false);
SET ROLE authenticated;
SELECT public.test_assert((public.ncrm_migracao_preview('{}'::jsonb)->>'erro') = 'sem_permissao',
  'F6B permissão: corretor não gera prévia da carteira antiga');
SELECT public.test_assert((public.ncrm_migracao_contexto(ARRAY[91002]::bigint[])->>'erro') = 'sem_permissao',
  'F6B permissão: corretor não obtém contexto');
SELECT public.test_assert((public.ncrm_migracao_aprovar(91002,'novo','retornar_contato','x', now()+interval '1 day','MIGRAR')->>'erro') = 'sem_permissao',
  'F6B permissão: corretor não migra ninguém');
SELECT public.test_assert((public.ncrm_migracao_rollback(91001)->>'erro') = 'sem_permissao',
  'F6B permissão: corretor não desfaz migração');
SELECT public.test_assert((public.ncrm_saude()->>'erro') = 'sem_permissao',
  'F6B permissão: corretor não vê a saúde');
SELECT public.test_assert((public.ncrm_saude_acao('desligar_entrada', NULL, 'CONFIRMAR')->>'erro') = 'sem_permissao',
  'F6B permissão: corretor não executa ação administrativa');
RESET ROLE;
SELECT public.test_assert((SELECT ativo FROM public.ncrm_ingest_config WHERE id) IS NOT NULL,
  'F6B permissão: entrada de conversas intacta após tentativa de corretor');

-- ------------------------------------------------------------------ SEGURANÇA
SELECT public.test_assert(
  (SELECT count(*) FROM information_schema.role_routine_grants
    WHERE grantee IN ('anon','PUBLIC')
      AND routine_name IN ('ncrm_migracao_preview','ncrm_migracao_aprovar','ncrm_migracao_rollback',
                           'ncrm_migracao_contexto','ncrm_migracao_registrar_analise','ncrm_saude','ncrm_saude_acao',
                           'ncrm_treinamento_meu','ncrm_treinamento_marcar','ncrm_treinamento_equipe')) = 0,
  'F6B segurança: anon/PUBLIC sem EXECUTE em nenhuma função nova');
SELECT public.test_assert(
  (SELECT count(*) FROM information_schema.role_table_grants
    WHERE grantee IN ('anon','authenticated','PUBLIC')
      AND table_name IN ('ncrm_treinamento','ncrm_migracao_analise','ncrm_migracao_item','ncrm_saude_acao_audit')) = 0,
  'F6B segurança: nenhum acesso direto às tabelas novas (só pelas RPCs)');
SELECT public.test_assert(
  (SELECT count(*) FROM pg_tables WHERE schemaname='public'
     AND tablename IN ('ncrm_treinamento','ncrm_migracao_analise','ncrm_migracao_item','ncrm_saude_acao_audit')
     AND rowsecurity) = 4,
  'F6B segurança: RLS ligada em todas as tabelas novas');
SELECT public.test_assert(
  (SELECT count(*) FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname='public' AND p.prosecdef
      AND p.proname IN ('ncrm_migracao_preview','ncrm_migracao_aprovar','ncrm_migracao_rollback',
                        'ncrm_migracao_contexto','ncrm_migracao_registrar_analise','ncrm_saude','ncrm_saude_acao',
                        'ncrm_treinamento_meu','ncrm_treinamento_marcar','ncrm_treinamento_equipe')
      AND array_to_string(p.proconfig, ',') LIKE 'search_path=%') = 10,
  'F6B segurança: todas as funções novas têm search_path fixo');
SELECT public.test_assert(
  (SELECT provolatile FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname='public' AND p.proname = 'ncrm_migracao_preview') = 's',
  'F6B segurança: a prévia é STABLE — o banco impede que ela escreva');
