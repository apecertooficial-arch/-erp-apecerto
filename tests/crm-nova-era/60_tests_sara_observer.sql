-- Testes da migration Sara modo observador (local; após aplicar 20260728210000).
\set ON_ERROR_STOP on
\set QUIET on
SET client_min_messages TO notice;
\set A '''cccccccc-0000-0000-0000-000000000001'''
\set ADMIN '''aaaaaaaa-0000-0000-0000-000000000001'''
\set B '''dddddddd-0000-0000-0000-000000000001'''

-- modo inicial obrigatório = observer (consulta admin)
SELECT set_config('request.jwt.claims', json_build_object('sub',:ADMIN,'role','authenticated')::text, false); SET ROLE authenticated;
SELECT public.test_assert((public.ncrm_sara_modo_status() ->> 'modo')='observer','SARA modo inicial = observer');
RESET ROLE;

-- corretor NÃO consulta nem define modo
SELECT set_config('request.jwt.claims', json_build_object('sub',:A,'role','authenticated')::text, false); SET ROLE authenticated;
SELECT public.test_assert((public.ncrm_sara_modo_status() ->> 'erro')='sem_permissao','SARA corretor não consulta status');
SELECT public.test_assert((public.ncrm_sara_definir_modo('suggest', true) ->> 'erro')='sem_permissao','SARA corretor não define modo');
RESET ROLE;

-- admin define modo; execute é BLOQUEADO; confirmação obrigatória
SELECT set_config('request.jwt.claims', json_build_object('sub',:ADMIN,'role','authenticated')::text, false); SET ROLE authenticated;
SELECT public.test_assert((public.ncrm_sara_definir_modo('observer', false) ->> 'erro')='confirmacao_obrigatoria','SARA sem confirmação bloqueia');
SELECT public.test_assert((public.ncrm_sara_definir_modo('execute', true) ->> 'erro')='execute_bloqueado_nesta_fase','SARA execute bloqueado nesta fase');
SELECT public.test_assert((public.ncrm_sara_definir_modo('suggest', true) ->> 'ok')::boolean,'SARA admin muda para suggest');
SELECT public.test_assert((public.ncrm_sara_definir_modo('observer', true) ->> 'ok')::boolean,'SARA admin volta a observer');
RESET ROLE;

-- ===== PROVENIÊNCIA (P0-C): análise automática é SERVICE-ONLY =====
-- corretor A (dono do negócio 1000) NÃO consegue fabricar análise automática via RPC direta.
SELECT set_config('request.jwt.claims', json_build_object('sub',:A,'role','authenticated')::text, false); SET ROLE authenticated;
SELECT public.test_expect_error(
  'SELECT public.ncrm_sara_registrar_analise(gen_random_uuid(),''ctx-forjado-1'',1000,''x'',''em_atendimento'',''enviar_opcoes'',now(),''forjada'',''[]''::jsonb,0.7,true,false,false,false,''v1'',''m1'')',
  'permission denied', 'P0-C corretor NÃO forja análise (sem EXECUTE)');
RESET ROLE;

-- observer NÃO muta operacional: captura versao/eventos do negócio 1000 antes
SELECT versao AS v_antes FROM public.ncrm_estado WHERE negocio_id=1000 \gset
SELECT count(*) AS ev_antes FROM public.ncrm_evento WHERE negocio_id=1000 \gset

-- runner (service_role) registra análise em observer => ok, INSERT-only, provenance completa
SELECT set_config('request.jwt.claims', json_build_object('role','service_role')::text, false); SET ROLE service_role;
SELECT public.test_assert((public.ncrm_sara_registrar_analise(
   '11111111-1111-4111-8111-111111111111'::uuid,'ctx-1000-a1',1000,'em_atendimento','em_acompanhamento','enviar_opcoes',now(),
   'Cliente pediu 2 dorms', jsonb_build_array('msg 14:02','audio 14:05'), 0.72, true, false, false, false, 'sara-obs-v1','gpt-x') ->> 'ok')::boolean,
   'SARA runner registra análise (service_role)');
-- idempotência por context_hash: mesmo contexto NÃO gera análise duplicada
SELECT public.test_assert((public.ncrm_sara_registrar_analise(
   '22222222-2222-4222-8222-222222222222'::uuid,'ctx-1000-a1',1000,'em_atendimento','em_acompanhamento','enviar_opcoes',now(),
   'reanalise', '[]'::jsonb, 0.9, true, false, false, false, 'sara-obs-v1','gpt-x') ->> 'ja_analisado')::boolean,
   'SARA idempotente: mesmo context_hash não duplica');
-- validação dura: confiança fora de 0..1
SELECT public.test_assert((public.ncrm_sara_registrar_analise(
   gen_random_uuid(),'ctx-1000-bad',1000,'x','em_atendimento','enviar_opcoes',now(),'j','[]'::jsonb,1.5,true,false,false,false,'v1','m1') ->> 'erro')='confianca_invalida',
   'SARA validação dura: confiança inválida rejeitada');
-- validação dura: etapa_sugerida inesperada
SELECT public.test_assert((public.ncrm_sara_registrar_analise(
   gen_random_uuid(),'ctx-1000-bad2',1000,'x','ETAPA_FALSA','enviar_opcoes',now(),'j','[]'::jsonb,0.5,true,false,false,false,'v1','m1') ->> 'erro')='etapa_sugerida_invalida',
   'SARA validação dura: etapa_sugerida inválida rejeitada');
-- validação dura: evidencias não-array
SELECT public.test_assert((public.ncrm_sara_registrar_analise(
   gen_random_uuid(),'ctx-1000-bad3',1000,'x','em_atendimento','enviar_opcoes',now(),'j','{"a":1}'::jsonb,0.5,true,false,false,false,'v1','m1') ->> 'erro')='evidencias_invalidas',
   'SARA validação dura: evidencias não-array rejeitadas');
RESET ROLE;
SELECT public.test_assert((SELECT count(*) FROM public.ncrm_sara_analise WHERE negocio_id=1000)=1,'SARA 1 análise (idempotência+inválidas não gravaram)');
SELECT public.test_assert((SELECT versao FROM public.ncrm_estado WHERE negocio_id=1000)=:v_antes,'SARA observer NÃO alterou versao do estado (não muta)');
SELECT public.test_assert((SELECT count(*) FROM public.ncrm_evento WHERE negocio_id=1000)=:ev_antes,'SARA observer NÃO criou evento operacional (não muta)');

-- ===== DECISÃO HUMANA vinculada à análise =====
SELECT id AS aid FROM public.ncrm_sara_analise WHERE negocio_id=1000 ORDER BY id DESC LIMIT 1 \gset
-- corretor B (não dono) não decide
SELECT set_config('request.jwt.claims', json_build_object('sub',:B,'role','authenticated')::text, false); SET ROLE authenticated;
SELECT public.test_assert((public.ncrm_sara_decidir_analise(:aid,'aprovada',NULL) ->> 'erro')='sem_permissao','SARA decisão: corretor sem pode_operar negado');
RESET ROLE;
-- dono A decide (aprovada) => marca análise + evento classificacao_sara (não muta operacional)
SELECT count(*) AS ev_antes2 FROM public.ncrm_evento WHERE negocio_id=1000 \gset
SELECT set_config('request.jwt.claims', json_build_object('sub',:A,'role','authenticated')::text, false); SET ROLE authenticated;
SELECT public.test_assert((public.ncrm_sara_decidir_analise(:aid,'aprovada','ok') ->> 'ok')::boolean,'SARA decisão humana registrada');
SELECT public.test_assert((public.ncrm_sara_decidir_analise(:aid,'aprovada','ok') ->> 'ja_decidido')::boolean,'SARA decisão idempotente');
RESET ROLE;
SELECT public.test_assert((SELECT decisao FROM public.ncrm_sara_analise WHERE id=:aid)='aprovada','SARA análise marcada como aprovada');
SELECT public.test_assert((SELECT count(*) FROM public.ncrm_evento WHERE negocio_id=1000 AND tipo='classificacao_sara' AND (payload->>'analise_id')::bigint=:aid)=1,'SARA decisão gera 1 evento classificacao_sara vinculado');
SELECT public.test_assert((SELECT versao FROM public.ncrm_estado WHERE negocio_id=1000)=:v_antes,'SARA decisão NÃO muta estado');

-- ===== KILL-SWITCH: modo off recusa análise do runner =====
SELECT set_config('request.jwt.claims', json_build_object('sub',:ADMIN,'role','authenticated')::text, false); SET ROLE authenticated;
SELECT public.ncrm_sara_definir_modo('off', true);
RESET ROLE;
SELECT set_config('request.jwt.claims', json_build_object('role','service_role')::text, false); SET ROLE service_role;
SELECT public.test_assert((public.ncrm_sara_registrar_analise(gen_random_uuid(),'ctx-off',1000,'x','em_atendimento','enviar_opcoes',now(),'j','[]'::jsonb,0.7,true,false,false,false,'v1','m1') ->> 'erro')='sara_desligada','SARA off recusa análise (kill-switch)');
RESET ROLE;
SELECT set_config('request.jwt.claims', json_build_object('sub',:ADMIN,'role','authenticated')::text, false); SET ROLE authenticated;
SELECT public.ncrm_sara_definir_modo('observer', true);
SELECT public.test_assert((public.ncrm_sara_modo_status() ->> 'modo')='observer','SARA restaurada para observer');
RESET ROLE;

SELECT '==== TESTES SARA-OBSERVER OK ====' AS resultado;
