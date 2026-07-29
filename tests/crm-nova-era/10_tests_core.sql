-- Testes automatizados do modelo persistente CRM Nova Era (local).
-- Requer: harness (00) + migration aplicados. Concorrência (#15) e rollback (#29/#30) no run_local.sh.
\set ON_ERROR_STOP on
\set QUIET on
SET client_min_messages TO notice;

-- Identidades
\set A '''cccccccc-0000-0000-0000-000000000001'''
\set B '''dddddddd-0000-0000-0000-000000000001'''
\set GER '''bbbbbbbb-0000-0000-0000-000000000001'''
\set ADM '''aaaaaaaa-0000-0000-0000-000000000001'''

-- Cria estados iniciais (automação/service_role) para 100,200,300,400,500,600
RESET ROLE; SELECT set_config('request.jwt.claims','{}',false); SET ROLE service_role;
SELECT public.ncrm_registrar_msg_automatica(100,'m100', now());
SELECT public.ncrm_registrar_msg_automatica(200,'m200', now());
SELECT public.ncrm_registrar_msg_automatica(300,'m300', now());
SELECT public.ncrm_registrar_msg_automatica(400,'m400', now());
SELECT public.ncrm_registrar_msg_automatica(500,'m500', now());
SELECT public.ncrm_registrar_msg_automatica(600,'m600', now());
RESET ROLE;

-- ===== #2 RLS habilitada =====
SELECT public.test_assert((SELECT bool_and(relrowsecurity) FROM pg_class WHERE relnamespace='public'::regnamespace AND relkind='r' AND relname LIKE 'ncrm\_%'), '#2 RLS habilitada em todas ncrm_*');

-- ===== #3 anon não acessa nada =====
SELECT set_config('request.jwt.claims','{}',false); SET ROLE anon;
SELECT public.test_expect_error('SELECT 1 FROM public.ncrm_estado LIMIT 1','42501','#3 anon SELECT ncrm_estado negado');
SELECT public.test_expect_error('SELECT 1 FROM public.ncrm_evento LIMIT 1','42501','#3 anon SELECT ncrm_evento negado');
RESET ROLE;

-- ===== #4 corretor A vê só seus negócios / #5 B não vê os de A =====
SELECT set_config('request.jwt.claims', json_build_object('sub',:A,'role','authenticated')::text, false); SET ROLE authenticated;
SELECT public.test_assert((SELECT count(*) FROM public.ncrm_estado)=5, '#4 A vê 5 estados (100,300,400,500,600)');
SELECT public.test_assert((SELECT count(*) FROM public.ncrm_estado WHERE negocio_id=200)=0, '#4 A NÃO vê 200 (de B)');
RESET ROLE;
SELECT set_config('request.jwt.claims', json_build_object('sub',:B,'role','authenticated')::text, false); SET ROLE authenticated;
SELECT public.test_assert((SELECT count(*) FROM public.ncrm_estado)=1, '#5 B vê só 1 estado (200)');
SELECT public.test_assert((SELECT count(*) FROM public.ncrm_estado WHERE negocio_id=100)=0, '#5 B NÃO vê 100 (de A)');
RESET ROLE;

-- ===== #6 gestor vê só sua equipe =====
SELECT set_config('request.jwt.claims', json_build_object('sub',:GER,'role','authenticated')::text, false); SET ROLE authenticated;
SELECT public.test_assert((SELECT count(*) FROM public.ncrm_estado)=5, '#6 gestor vê os 5 de A (sua equipe)');
SELECT public.test_assert((SELECT count(*) FROM public.ncrm_estado WHERE negocio_id=200)=0, '#6 gestor NÃO vê 200 (fora da equipe)');
RESET ROLE;

-- ===== #7 admin vê conforme permissões (todos) =====
SELECT set_config('request.jwt.claims', json_build_object('sub',:ADM,'role','authenticated')::text, false); SET ROLE authenticated;
SELECT public.test_assert((SELECT count(*) FROM public.ncrm_estado)=6, '#7 admin vê os 6 estados');
RESET ROLE;

-- ===== #8/#9 transferência A->B muda visibilidade; nenhuma linha ncrm_* atualizada =====
SELECT versao AS v100, atualizado_em AS at100 FROM public.ncrm_estado WHERE negocio_id=100 \gset
-- (ator legado = superusuário) transfere 100 de A(10) para B(20)
UPDATE public.negocios SET corretor_id=20 WHERE id=100;
SELECT set_config('request.jwt.claims', json_build_object('sub',:A,'role','authenticated')::text, false); SET ROLE authenticated;
SELECT public.test_assert((SELECT count(*) FROM public.ncrm_estado WHERE negocio_id=100)=0, '#8 A não vê mais 100 após transferência');
RESET ROLE;
SELECT set_config('request.jwt.claims', json_build_object('sub',:B,'role','authenticated')::text, false); SET ROLE authenticated;
SELECT public.test_assert((SELECT count(*) FROM public.ncrm_estado WHERE negocio_id=100)=1, '#8 B passa a ver 100 imediatamente');
RESET ROLE;
SELECT public.test_assert((SELECT versao FROM public.ncrm_estado WHERE negocio_id=100)=:v100
                          AND (SELECT atualizado_em FROM public.ncrm_estado WHERE negocio_id=100)=:'at100'
                          AND NOT EXISTS (SELECT 1 FROM public.ncrm_evento WHERE negocio_id=100 AND tipo='transferencia'),
  '#9 nenhuma linha ncrm_* alterada na transferência (sem trigger)');

-- ===== #10 escrita direta em estado/proposta/evento negada =====
SELECT set_config('request.jwt.claims', json_build_object('sub',:A,'role','authenticated')::text, false); SET ROLE authenticated;
SELECT public.test_expect_error('UPDATE public.ncrm_estado SET etapa=''novo'' WHERE negocio_id=300','42501','#10 UPDATE direto estado negado');
SELECT public.test_expect_error('DELETE FROM public.ncrm_estado WHERE negocio_id=300','42501','#10 DELETE direto estado negado');
SELECT public.test_expect_error('INSERT INTO public.ncrm_proposta(negocio_id,lead_id,valor,data_proposta,idempotency_key,criada_por) VALUES (300,3,1,now(),''x'',''cccccccc-0000-0000-0000-000000000001'')','42501','#10 INSERT direto proposta negado');
RESET ROLE;

-- ===== #11 RPC autorizada funciona (A opera 400) / #16 versão desatualizada / #17 atomicidade =====
SELECT set_config('request.jwt.claims', json_build_object('sub',:A,'role','authenticated')::text, false); SET ROLE authenticated;
SELECT versao AS v400 FROM public.ncrm_estado WHERE negocio_id=400 \gset
SELECT public.test_assert((public.ncrm_registrar_tentativa(400,:v400,'whatsapp','nao_respondeu','sem resposta','tentativa_cadencia','2ª tentativa', now()+interval '1 day','ui:t11') ->> 'ok')::boolean, '#11 RPC autorizada retorna ok');
SELECT public.test_assert((public.ncrm_registrar_tentativa(400,:v400,'whatsapp','nao_respondeu','x','tentativa_cadencia','2ª', now(),'ui:t16') ->> 'erro') = 'versao_conflito', '#16 versão desatualizada rejeitada');
SELECT public.test_assert((SELECT versao FROM public.ncrm_estado WHERE negocio_id=400) = :v400 + 1, '#17 estado avançou +1');
SELECT public.test_assert((SELECT count(*) FROM public.ncrm_evento WHERE idempotency_key='ui:t11')=1
                          AND (SELECT estado_versao_apos FROM public.ncrm_evento WHERE idempotency_key='ui:t11') = :v400 + 1,
  '#17 estado e evento atômicos (1 evento, versão coerente)');
RESET ROLE;

-- ===== #12 RPC não autorizada falha (B tenta operar 300 de A) =====
SELECT set_config('request.jwt.claims', json_build_object('sub',:B,'role','authenticated')::text, false); SET ROLE authenticated;
SELECT public.test_assert((public.ncrm_registrar_tentativa(300,1,'whatsapp','nao_respondeu','x','tentativa_cadencia','2ª', now(),'ui:t12') ->> 'erro') = 'sem_permissao', '#12 B não pode operar negócio de A');
RESET ROLE;

-- ===== #13 idempotency_key ausente/vazia rejeitada =====
SELECT set_config('request.jwt.claims', json_build_object('sub',:A,'role','authenticated')::text, false); SET ROLE authenticated;
SELECT public.test_expect_error('SELECT public.ncrm_registrar_tentativa(600,1,''whatsapp'',''nao_respondeu'',''x'',''tentativa_cadencia'',''2ª'', now(),''   '')','idempotency_key_obrigatoria','#13 idem em branco rejeitada');
SELECT public.test_expect_error('SELECT public.ncrm_registrar_tentativa(600,1,''whatsapp'',''nao_respondeu'',''x'',''tentativa_cadencia'',''2ª'', now(), NULL)','idempotency_key_obrigatoria','#13 idem NULL rejeitada');

-- ===== #14 retry com a mesma chave não duplica (negócio 600) =====
SELECT versao AS v600 FROM public.ncrm_estado WHERE negocio_id=600 \gset
SELECT public.ncrm_registrar_tentativa(600,:v600,'whatsapp','nao_respondeu','1','tentativa_cadencia','2ª', now()+interval '1 day','ui:t14');
SELECT public.ncrm_registrar_tentativa(600,:v600,'whatsapp','nao_respondeu','1','tentativa_cadencia','2ª', now()+interval '1 day','ui:t14');
SELECT public.test_assert((SELECT count(*) FROM public.ncrm_evento WHERE idempotency_key='ui:t14')=1, '#14 retry mesma chave: 1 evento');
SELECT public.test_assert((SELECT versao FROM public.ncrm_estado WHERE negocio_id=600) = :v600 + 1, '#14 retry: versão avançou só 1');
RESET ROLE;

-- ===== #18 evento não pode ser atualizado nem apagado =====
SELECT public.test_expect_error('UPDATE public.ncrm_evento SET resultado=''x'' WHERE id=(SELECT min(id) FROM public.ncrm_evento)','append-only','#18 UPDATE evento bloqueado');
SELECT public.test_expect_error('DELETE FROM public.ncrm_evento WHERE id=(SELECT min(id) FROM public.ncrm_evento)','append-only','#18 DELETE evento bloqueado');

-- ===== #19/#20 proposta registrada não cria venda nem marca ganho (negócio 300) =====
SELECT count(*) AS vendas_antes FROM public.vendas \gset
SELECT set_config('request.jwt.claims', json_build_object('sub',:A,'role','authenticated')::text, false); SET ROLE authenticated;
SELECT versao AS v300 FROM public.ncrm_estado WHERE negocio_id=300 \gset
SELECT public.test_assert((public.ncrm_saida_proposta(300,:v300,'11111111-1111-1111-1111-111111111111','22222222-2222-2222-2222-222222222222',450000,now(),'proposta demo','ui:p19') ->> 'ok')::boolean, '#19 proposta registrada ok');
RESET ROLE;
SELECT public.test_assert((SELECT count(*) FROM public.vendas) = :vendas_antes, '#19 contagem de vendas inalterada');
SELECT public.test_assert((SELECT status FROM public.negocios WHERE id=300) <> 'ganho', '#20 negócio 300 NÃO marcado ganho');
SELECT public.test_assert((SELECT count(*) FROM public.ncrm_proposta WHERE negocio_id=300 AND status='registrada')=1, '#20 1 proposta registrada criada');

-- ===== #26 saída esteira exige proposta_id (invariante) =====
SELECT public.test_assert((SELECT saida='esteira_vendas' AND proposta_id IS NOT NULL FROM public.ncrm_estado WHERE negocio_id=300), '#26 estado 300: saida esteira com proposta_id');
SELECT public.test_expect_error('UPDATE public.ncrm_estado SET proposta_id=NULL WHERE negocio_id=300','23514','#26 esteira sem proposta_id viola CHECK');

-- ===== #27 estado ativo exige próxima ação (invariante) — negócio 600 está ativo =====
SELECT public.test_expect_error('UPDATE public.ncrm_estado SET proxima_acao_tipo=NULL, proxima_acao_titulo=NULL, proxima_acao_em=NULL WHERE negocio_id=600','23514','#27 ativo sem próxima ação viola CHECK');

-- ===== #25 visita exige visita_id (negócio 500) =====
SELECT set_config('request.jwt.claims', json_build_object('sub',:A,'role','authenticated')::text, false); SET ROLE authenticated;
SELECT versao AS v500 FROM public.ncrm_estado WHERE negocio_id=500 \gset
SELECT public.test_assert((public.ncrm_saida_visita(500,:v500,NULL,'ui:v25a') ->> 'erro') = 'visita_invalida', '#25 saída visita sem visita_id rejeitada');
SELECT public.test_assert((public.ncrm_saida_visita(500,:v500,'33333333-3333-3333-3333-333333333333','ui:v25b') ->> 'ok')::boolean, '#25 saída visita com visita_id válido ok');
SELECT public.test_assert((SELECT saida='pipeline_visitas' AND visita_id IS NOT NULL FROM public.ncrm_estado WHERE negocio_id=500), '#25 estado 500: saida visita com visita_id');
RESET ROLE;

-- ===== #21 proposta recusada permanece histórica / #22 encerramento não reativa =====
SELECT set_config('request.jwt.claims', json_build_object('sub',:A,'role','authenticated')::text, false); SET ROLE authenticated;
SELECT id AS prop300, versao AS pv300 FROM public.ncrm_proposta WHERE negocio_id=300 AND status='registrada' \gset
SELECT public.test_assert((public.ncrm_proposta_transicao(:'prop300',:pv300,'recusada','cliente desistiu','ui:p21') ->> 'ok')::boolean, '#21 transição para recusada ok');
RESET ROLE;
SELECT public.test_assert((SELECT status FROM public.ncrm_proposta WHERE id=:'prop300')='recusada', '#21 proposta permanece histórica (recusada)');
SELECT public.test_assert((SELECT saida='esteira_vendas' AND proposta_id IS NOT NULL FROM public.ncrm_estado WHERE negocio_id=300), '#22 encerramento NÃO reativou o lead automaticamente');

-- ===== #23 reativação explícita exige próxima ação / #24 nova proposta após terminal =====
SELECT set_config('request.jwt.claims', json_build_object('sub',:A,'role','authenticated')::text, false); SET ROLE authenticated;
SELECT versao AS v300r FROM public.ncrm_estado WHERE negocio_id=300 \gset
SELECT public.test_assert((public.ncrm_reativar_apos_proposta(300,:v300r,'retomar','em_atendimento',NULL,NULL,NULL,'ui:p23a') ->> 'erro') = 'proxima_acao_obrigatoria', '#23 reativação sem próxima ação rejeitada');
SELECT public.test_assert((public.ncrm_reativar_apos_proposta(300,:v300r,'retomar','em_atendimento','entender_necessidade','Entender necessidade', now()+interval '1 day','ui:p23b') ->> 'ok')::boolean, '#23 reativação com próxima ação ok');
SELECT public.test_assert((SELECT saida IS NULL AND proposta_id IS NULL AND proxima_acao_tipo IS NOT NULL FROM public.ncrm_estado WHERE negocio_id=300), '#23 estado 300 reativado (saida limpa, próxima ação definida)');
SELECT versao AS v300n FROM public.ncrm_estado WHERE negocio_id=300 \gset
SELECT public.test_assert((public.ncrm_saida_proposta(300,:v300n,'11111111-1111-1111-1111-111111111111',NULL,500000,now(),'nova proposta','ui:p24') ->> 'ok')::boolean, '#24 nova proposta após ciclo terminal permitida');
SELECT public.test_assert((SELECT count(*) FROM public.ncrm_proposta WHERE negocio_id=300)=2, '#24 duas propostas no histórico do negócio 300');
RESET ROLE;

-- ===== #28 Sara não sobrescreve decisão humana posterior (negócio 200) =====
SELECT set_config('request.jwt.claims', json_build_object('sub',:B,'role','authenticated')::text, false); SET ROLE authenticated;
SELECT versao AS v200 FROM public.ncrm_estado WHERE negocio_id=200 \gset
SELECT public.ncrm_registrar_tentativa(200,:v200,'whatsapp','nao_respondeu','humano agiu','tentativa_cadencia','2ª', now()+interval '1 day','ui:s28h');
RESET ROLE;
-- Sara com base_versao ANTIGA (:v200) enquanto o estado já avançou -> precedência humana
SELECT set_config('request.jwt.claims', json_build_object('sub',:B,'role','authenticated','app_metadata', json_build_object('app_role','sara'))::text, false); SET ROLE authenticated;
SELECT public.test_assert((public.ncrm_sara_classificar(200,:v200,'{"temperatura":"quente"}'::jsonb,'ui:s28') ->> 'motivo') = 'precedencia_humana', '#28 Sara com base velha NÃO sobrescreve (precedência humana)');
SELECT public.test_assert((SELECT versao FROM public.ncrm_estado WHERE negocio_id=200) = (:v200 + 1), '#28 Sara não incrementou a versão do estado (foi a tentativa humana)');
SELECT public.test_assert((SELECT (payload->>'aplicado')::boolean = false FROM public.ncrm_evento WHERE idempotency_key='ui:s28'), '#28 sugestão da Sara registrada como não aplicada');
RESET ROLE;

SELECT '==== TODOS OS TESTES SQL PASSARAM ====' AS resultado;
