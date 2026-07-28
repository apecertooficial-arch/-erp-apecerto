-- =====================================================================================
-- CRM NOVA ERA — SMOKE TESTS EM STAGING (após aplicar a migration 20260728151548).
-- Exercita RLS/RPC no nível do banco emulando o JWT do Supabase via request.jwt.claims + SET ROLE
-- (mesma superfície que o PostgREST usa: authenticated/anon/service_role). Seguro para rodar no
-- SQL Editor do STAGING. NUNCA rodar em produção. Dados: seed fictício (02).
-- Complemento HTTP/Data API (curl com JWT real) está em 06_validacao_dataapi.md.
-- =====================================================================================
\set ON_ERROR_STOP on
SET client_min_messages TO notice;

-- Helpers de asserção (idempotentes; presentes também no bootstrap local)
CREATE OR REPLACE FUNCTION public.test_assert(cond boolean, msg text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN IF cond IS NOT TRUE THEN RAISE EXCEPTION 'ASSERT FAIL: %', msg; ELSE RAISE NOTICE 'PASS: %', msg; END IF; END $$;
CREATE OR REPLACE FUNCTION public.test_expect_error(p_sql text, p_want text, msg text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  BEGIN EXECUTE p_sql; RAISE EXCEPTION 'ASSERT FAIL (esperava erro, não houve): %', msg;
  EXCEPTION WHEN others THEN
    IF p_want IS NOT NULL AND SQLSTATE <> p_want AND position(p_want in SQLERRM) = 0 THEN
      RAISE EXCEPTION 'ASSERT FAIL (erro % / % ): %', SQLSTATE, SQLERRM, msg; END IF;
    RAISE NOTICE 'PASS (erro esperado): %', msg;
  END;
END $$;

\set ADM '''aaaa0000-0000-4000-8000-000000000001'''
\set GER '''bbbb0000-0000-4000-8000-000000000001'''
\set A   '''cccc0000-0000-4000-8000-000000000001'''
\set B   '''cccc0000-0000-4000-8000-000000000002'''
\set C   '''cccc0000-0000-4000-8000-000000000003'''

-- ============ S6: automação cria estado para os 12 negócios (service_role) ============
RESET ROLE; SELECT set_config('request.jwt.claims','{}',false); SET ROLE service_role;
SELECT public.ncrm_registrar_msg_automatica(g, 'auto-stg-'||g, now())
FROM generate_series(1,12) g;
RESET ROLE;
SELECT set_config('request.jwt.claims', json_build_object('sub',:ADM,'role','authenticated')::text, false); SET ROLE authenticated;
SELECT public.test_assert((SELECT count(*) FROM public.ncrm_estado)=12,'S6 automação criou os 12 estados');
RESET ROLE;

-- ============ S1: RLS por papel (ANTES da transferência) ============
SELECT set_config('request.jwt.claims', json_build_object('sub',:A,'role','authenticated')::text, false); SET ROLE authenticated;
SELECT public.test_assert((SELECT count(*) FROM public.ncrm_estado)=10,'S1 corretor A vê só sua carteira (10)');
SELECT public.test_assert((SELECT count(*) FROM public.ncrm_estado WHERE negocio_id=9)=0,'S1 A NÃO vê negócio 9 (de B)');
RESET ROLE;
SELECT set_config('request.jwt.claims', json_build_object('sub',:B,'role','authenticated')::text, false); SET ROLE authenticated;
SELECT public.test_assert((SELECT count(*) FROM public.ncrm_estado)=1,'S1 corretor B vê só o seu (1)');
RESET ROLE;
SELECT set_config('request.jwt.claims', json_build_object('sub',:GER,'role','authenticated')::text, false); SET ROLE authenticated;
SELECT public.test_assert((SELECT count(*) FROM public.ncrm_estado)=11,'S1 gestor vê a equipe A+B (11), não C');
SELECT public.test_assert((SELECT count(*) FROM public.ncrm_estado WHERE negocio_id=11)=0,'S1 gestor NÃO vê 11 (corretor C fora da equipe)');
RESET ROLE;
SELECT set_config('request.jwt.claims', json_build_object('sub',:ADM,'role','authenticated')::text, false); SET ROLE authenticated;
SELECT public.test_assert((SELECT count(*) FROM public.ncrm_estado)=12,'S1 admin vê todos (12)');
RESET ROLE;

-- ============ S3: anon não acessa nada ============
SELECT set_config('request.jwt.claims','{}',false); SET ROLE anon;
SELECT public.test_expect_error('SELECT 1 FROM public.ncrm_estado LIMIT 1','42501','S3 anon SELECT ncrm_estado negado');
SELECT public.test_expect_error('SELECT 1 FROM public.ncrm_evento LIMIT 1','42501','S3 anon SELECT ncrm_evento negado');
RESET ROLE;

-- ============ S2: escrita direta negada (só RPC escreve) ============
SELECT set_config('request.jwt.claims', json_build_object('sub',:A,'role','authenticated')::text, false); SET ROLE authenticated;
SELECT public.test_expect_error('UPDATE public.ncrm_estado SET etapa=''novo'' WHERE negocio_id=1','42501','S2 UPDATE direto ncrm_estado negado');
SELECT public.test_expect_error('DELETE FROM public.ncrm_estado WHERE negocio_id=1','42501','S2 DELETE direto ncrm_estado negado');
SELECT public.test_expect_error('INSERT INTO public.ncrm_proposta(negocio_id,lead_id,valor,data_proposta,idempotency_key,criada_por) VALUES (1,1,1,now(),''x'',''cccc0000-0000-4000-8000-000000000001'')','42501','S2 INSERT direto ncrm_proposta negado');
RESET ROLE;

-- ============ S4 + S8: RPC autorizada; cadência calculada pelo banco; prazo adulterado ignorado (neg 1) ============
SELECT set_config('request.jwt.claims', json_build_object('sub',:A,'role','authenticated')::text, false); SET ROLE authenticated;
SELECT versao AS v FROM public.ncrm_estado WHERE negocio_id=1 \gset
-- cliente manda tipo/título/prazo adulterados; resultado SEM resposta -> banco recalcula pelo passo 2
SELECT public.test_assert((public.ncrm_registrar_tentativa(1,:v,'ligacao','nao_respondeu','1ª','preparar_proposta','FALSO', now()+interval '999 days','stg:t1') ->> 'ok')::boolean,'S4 RPC autorizada (A opera 1) ok');
SELECT public.test_assert((SELECT proxima_acao_tipo='tentativa_cadencia' AND proxima_acao_titulo='Segunda tentativa' FROM public.ncrm_estado WHERE negocio_id=1),'S8 próxima ação derivada do passo 2 (banco, não cliente)');
SELECT public.test_assert((SELECT proxima_acao_em < now()+interval '5 days' AND proxima_acao_em > now() FROM public.ncrm_estado WHERE negocio_id=1),'S8 prazo adulterado (999d) ignorado; banco usa intervalo do passo');
-- S5 RPC não autorizada: B tenta operar 1 (de A)
RESET ROLE;
SELECT set_config('request.jwt.claims', json_build_object('sub',:B,'role','authenticated')::text, false); SET ROLE authenticated;
SELECT public.test_assert((public.ncrm_registrar_tentativa(1,1,'whatsapp','nao_respondeu','x','x','x', now(),'stg:t1b') ->> 'erro')='sem_permissao','S5 B não pode operar negócio de A');
RESET ROLE;

-- ============ S8b: cadência esgotada -> avaliar_descarte; 5ª negada (neg 8) ============
SELECT set_config('request.jwt.claims', json_build_object('sub',:A,'role','authenticated')::text, false); SET ROLE authenticated;
SELECT versao AS v FROM public.ncrm_estado WHERE negocio_id=8 \gset
SELECT public.ncrm_registrar_tentativa(8,:v,'ligacao','nao_respondeu','1','x','x',now(),'stg:8a');
SELECT versao AS v FROM public.ncrm_estado WHERE negocio_id=8 \gset
SELECT public.ncrm_registrar_tentativa(8,:v,'whatsapp','nao_respondeu','2','x','x',now(),'stg:8b');
SELECT versao AS v FROM public.ncrm_estado WHERE negocio_id=8 \gset
SELECT public.ncrm_registrar_tentativa(8,:v,'ligacao','nao_respondeu','3','x','x',now(),'stg:8c');
SELECT versao AS v FROM public.ncrm_estado WHERE negocio_id=8 \gset
SELECT public.ncrm_registrar_tentativa(8,:v,'whatsapp','nao_respondeu','4','x','x',now(),'stg:8d');
SELECT public.test_assert((SELECT tentativas_feitas=4 AND proxima_acao_tipo='avaliar_descarte' AND saida IS NULL FROM public.ncrm_estado WHERE negocio_id=8),'S8b após 4ª -> avaliar_descarte (lead ativo)');
SELECT versao AS v FROM public.ncrm_estado WHERE negocio_id=8 \gset
SELECT public.test_assert((public.ncrm_registrar_tentativa(8,:v,'whatsapp','nao_respondeu','5','x','x',now(),'stg:8e') ->> 'erro')='cadencia_esgotada','S8b 5ª tentativa negada (cadencia_esgotada)');
SELECT public.test_assert((SELECT array_agg(numero_tentativa ORDER BY numero_tentativa) FROM public.ncrm_evento WHERE negocio_id=8 AND tipo='tentativa')=ARRAY[1,2,3,4],'S8b numero_tentativa sequencial 1..4');
RESET ROLE;

-- ============ S7: resposta inbound encerra a cadência (neg 2) ============
SELECT set_config('request.jwt.claims', json_build_object('sub',:A,'role','authenticated')::text, false); SET ROLE authenticated;
SELECT versao AS v FROM public.ncrm_estado WHERE negocio_id=2 \gset
SELECT public.ncrm_registrar_tentativa(2,:v,'ligacao','nao_respondeu','1','x','x',now(),'stg:2a');  -- tentativas->1
RESET ROLE;
SET ROLE service_role; SELECT set_config('request.jwt.claims','{}',false);
SELECT public.test_assert((public.ncrm_registrar_resposta_cliente(2,'wa-stg-2',now()) ->> 'ok')::boolean,'S7 inbound registrado');
RESET ROLE;
SELECT set_config('request.jwt.claims', json_build_object('sub',:A,'role','authenticated')::text, false); SET ROLE authenticated;
SELECT public.test_assert((SELECT respondeu AND resposta_pendente AND tentativas_feitas=1 FROM public.ncrm_estado WHERE negocio_id=2),'S7 inbound encerra cadência sem contar como tentativa');
SELECT versao AS v FROM public.ncrm_estado WHERE negocio_id=2 \gset
SELECT public.test_assert((public.ncrm_registrar_tentativa(2,:v,'whatsapp','nao_respondeu','x','x','x',now(),'stg:2b') ->> 'erro')='cadencia_encerrada','S7 prospecção após resposta negada');
RESET ROLE;

-- ============ S11: visita sai do quadro (neg 3) ============
SELECT set_config('request.jwt.claims', json_build_object('sub',:A,'role','authenticated')::text, false); SET ROLE authenticated;
SELECT versao AS v FROM public.ncrm_estado WHERE negocio_id=3 \gset
SELECT public.test_assert((public.ncrm_saida_visita(3,:v,'40000000-0000-4000-8000-000000000001','stg:v3') ->> 'ok')::boolean,'S11 saída visita ok');
SELECT public.test_assert((SELECT saida='pipeline_visitas' AND visita_id IS NOT NULL FROM public.ncrm_estado WHERE negocio_id=3),'S11 negócio 3 saiu para pipeline_visitas');
RESET ROLE;

-- ============ S10: proposta NÃO cria venda (neg 4) ============
SELECT count(*) AS vendas_antes FROM public.vendas \gset
SELECT set_config('request.jwt.claims', json_build_object('sub',:A,'role','authenticated')::text, false); SET ROLE authenticated;
SELECT versao AS v FROM public.ncrm_estado WHERE negocio_id=4 \gset
SELECT public.test_assert((public.ncrm_saida_proposta(4,:v,'e0000000-0000-4000-8000-000000000001','d0000000-0000-4000-8000-000000000001',450000,now(),'proposta fictícia','stg:p4') ->> 'ok')::boolean,'S10 proposta registrada ok');
RESET ROLE;
SELECT public.test_assert((SELECT count(*) FROM public.vendas)=:vendas_antes,'S10 contagem de vendas inalterada');
SELECT public.test_assert((SELECT status FROM public.negocios WHERE id=4)<>'ganho','S10 negócio 4 NÃO marcado ganho');
SELECT public.test_assert((SELECT saida='esteira_vendas' AND proposta_id IS NOT NULL FROM public.ncrm_estado WHERE negocio_id=4),'S10 negócio 4 na esteira com proposta');

-- ============ S12/S13/S14: descarte, nutrição, reativação (negs 5,6,7) ============
SELECT set_config('request.jwt.claims', json_build_object('sub',:A,'role','authenticated')::text, false); SET ROLE authenticated;
SELECT versao AS v FROM public.ncrm_estado WHERE negocio_id=5 \gset
SELECT public.test_assert((public.ncrm_saida_descarte(5,:v,'sem_interesse',NULL,'stg:d5') ->> 'ok')::boolean,'S12 descarte ok');
SELECT public.test_assert((SELECT saida='descartado' FROM public.ncrm_estado WHERE negocio_id=5),'S12 negócio 5 descartado');
SELECT versao AS v FROM public.ncrm_estado WHERE negocio_id=6 \gset
SELECT public.test_assert((public.ncrm_saida_nutricao(6,:v,'compra futura','stg:n6') ->> 'ok')::boolean,'S13 nutrição ok');
SELECT public.test_assert((SELECT saida='nutricao' FROM public.ncrm_estado WHERE negocio_id=6),'S13 negócio 6 em nutrição');
-- reativação: descarta e reativa (neg 7)
SELECT versao AS v FROM public.ncrm_estado WHERE negocio_id=7 \gset
SELECT public.ncrm_saida_descarte(7,:v,'duplicado',NULL,'stg:d7');
SELECT versao AS v FROM public.ncrm_estado WHERE negocio_id=7 \gset
SELECT public.test_assert((public.ncrm_reativar(7,:v,'retomou contato','tentando_contato','tentativa_cadencia','Retomar', now()+interval '1 day','stg:r7') ->> 'ok')::boolean,'S14 reativação ok');
SELECT public.test_assert((SELECT saida IS NULL AND proxima_acao_tipo IS NOT NULL FROM public.ncrm_estado WHERE negocio_id=7),'S14 negócio 7 reativado');
RESET ROLE;

-- ============ S15: Sara somente sugere (neg 12) ============
SELECT set_config('request.jwt.claims', json_build_object('sub',:A,'role','authenticated','app_metadata', json_build_object('app_role','sara'))::text, false); SET ROLE authenticated;
SELECT versao AS v12 FROM public.ncrm_estado WHERE negocio_id=12 \gset
SELECT public.test_assert((public.ncrm_sara_classificar(12,:v12,'{"temperatura":"quente"}'::jsonb,'stg:sara12') ->> 'aplicado')::boolean=false,'S15 Sara nunca aplica (aplicado=false)');
SELECT public.test_assert((SELECT versao FROM public.ncrm_estado WHERE negocio_id=12)=:v12,'S15 Sara não altera o estado (versão intacta)');
RESET ROLE;

-- ============ S16: idempotência + conflito de versão (neg 12) ============
SELECT set_config('request.jwt.claims', json_build_object('sub',:A,'role','authenticated')::text, false); SET ROLE authenticated;
SELECT versao AS v FROM public.ncrm_estado WHERE negocio_id=12 \gset
SELECT public.ncrm_registrar_tentativa(12,:v,'whatsapp','nao_respondeu','1','x','x',now(),'stg:idem12');
SELECT public.ncrm_registrar_tentativa(12,:v,'whatsapp','nao_respondeu','1','x','x',now(),'stg:idem12');  -- repetido
SELECT public.test_assert((SELECT count(*) FROM public.ncrm_evento WHERE idempotency_key='stg:idem12')=1,'S16 idempotência: 1 único evento');
-- conflito de versão: :v agora está velho
SELECT public.test_assert((public.ncrm_registrar_tentativa(12,:v,'whatsapp','nao_respondeu','x','x','x',now(),'stg:vc12') ->> 'erro')='versao_conflito','S16 conflito de versão rejeitado');
RESET ROLE;

-- ============ S17: evento imutável ============
SELECT public.test_expect_error('UPDATE public.ncrm_evento SET resultado=''x'' WHERE id=(SELECT min(id) FROM public.ncrm_evento)','append-only','S17 UPDATE evento bloqueado');
SELECT public.test_expect_error('DELETE FROM public.ncrm_evento WHERE id=(SELECT min(id) FROM public.ncrm_evento)','append-only','S17 DELETE evento bloqueado');

-- ============ S18: rollback atômico em erro (unique_violation não-idem re-lançada; neg 12) ============
INSERT INTO public.ncrm_proposta (negocio_id, lead_id, valor, data_proposta, status, motivo_encerramento, encerrada_em, idempotency_key, criada_por)
VALUES (12,12,1,now(),'recusada','x',now(),'STGDUP:prop','cccc0000-0000-4000-8000-000000000001');
SELECT set_config('request.jwt.claims', json_build_object('sub',:A,'role','authenticated')::text, false); SET ROLE authenticated;
SELECT versao AS v FROM public.ncrm_estado WHERE negocio_id=12 \gset
SELECT public.test_expect_error('SELECT public.ncrm_saida_proposta(12,'||:v||',NULL,NULL,100,now(),''x'',''STGDUP'')','23505','S18 colisão não-idem é RELANÇADA');
SELECT public.test_assert(NOT EXISTS (SELECT 1 FROM public.ncrm_evento WHERE idempotency_key='STGDUP'),'S18 nenhum evento STGDUP (rollback atômico)');
SELECT public.test_assert((SELECT saida IS NULL FROM public.ncrm_estado WHERE negocio_id=12),'S18 estado 12 permanece ativo (UPDATE revertido)');
RESET ROLE;

-- ============ S1b: transferência muda acesso (neg 10: A -> B) ============
SELECT set_config('request.jwt.claims', json_build_object('sub',:A,'role','authenticated')::text, false); SET ROLE authenticated;
SELECT public.test_assert((SELECT count(*) FROM public.ncrm_estado WHERE negocio_id=10)=1,'S1b A vê 10 antes da transferência');
RESET ROLE;
UPDATE public.negocios SET corretor_id=2 WHERE id=10;   -- ator legado
SELECT set_config('request.jwt.claims', json_build_object('sub',:A,'role','authenticated')::text, false); SET ROLE authenticated;
SELECT public.test_assert((SELECT count(*) FROM public.ncrm_estado WHERE negocio_id=10)=0,'S1b A deixa de ver 10 após transferência');
RESET ROLE;
SELECT set_config('request.jwt.claims', json_build_object('sub',:B,'role','authenticated')::text, false); SET ROLE authenticated;
SELECT public.test_assert((SELECT count(*) FROM public.ncrm_estado WHERE negocio_id=10)=1,'S1b B passa a ver 10 imediatamente');
RESET ROLE;

SELECT '==== SMOKE TESTS DE STAGING: TODOS PASSARAM ====' AS resultado;
