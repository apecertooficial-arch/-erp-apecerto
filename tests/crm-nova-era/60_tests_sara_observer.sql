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

-- registrar análise: sem JWT => nao_autenticado
SELECT set_config('request.jwt.claims','{}',false);
SELECT public.test_assert((public.ncrm_sara_registrar_analise(1000,'em_atendimento','em_acompanhamento','enviar_opcoes',now(),'just','[]'::jsonb,0.7,true,false,false,false,'v1') ->> 'erro')='nao_autenticado','SARA análise sem JWT negada');

-- corretor B (não dono do negócio 1000, de A) => sem_permissao (fail-closed)
SELECT set_config('request.jwt.claims', json_build_object('sub',:B,'role','authenticated')::text, false); SET ROLE authenticated;
SELECT public.test_assert((public.ncrm_sara_registrar_analise(1000,'x','em_atendimento','enviar_opcoes',now(),'just','[]'::jsonb,0.7,true,false,false,false,'v1') ->> 'erro')='sem_permissao','SARA análise sem pode_operar negada');
RESET ROLE;

-- observer NÃO muta operacional: captura versao/eventos do negócio 1000 antes
SELECT versao AS v_antes FROM public.ncrm_estado WHERE negocio_id=1000 \gset
SELECT count(*) AS ev_antes FROM public.ncrm_evento WHERE negocio_id=1000 \gset
-- corretor A (dono) registra análise em observer => ok, INSERT-only
SELECT set_config('request.jwt.claims', json_build_object('sub',:A,'role','authenticated')::text, false); SET ROLE authenticated;
SELECT public.test_assert((public.ncrm_sara_registrar_analise(1000,'em_atendimento','em_acompanhamento','enviar_opcoes',now(),'Cliente pediu 2 dorms',jsonb_build_array('msg 14:02'),0.72,true,false,false,false,'sara-obs-v1') ->> 'ok')::boolean,'SARA observer registra análise');
SELECT public.test_assert((public.ncrm_sara_registrar_analise(1000,'x','em_atendimento','enviar_opcoes',now(),'just',NULL,1.5,true,false,false,false,'v1') ->> 'erro')='confianca_invalida','SARA confiança fora de 0..1 negada');
RESET ROLE;
SELECT public.test_assert((SELECT count(*) FROM public.ncrm_sara_analise WHERE negocio_id=1000)=1,'SARA 1 análise registrada (a inválida não gravou)');
SELECT public.test_assert((SELECT versao FROM public.ncrm_estado WHERE negocio_id=1000)=:v_antes,'SARA observer NÃO alterou versao do estado (não muta)');
SELECT public.test_assert((SELECT count(*) FROM public.ncrm_evento WHERE negocio_id=1000)=:ev_antes,'SARA observer NÃO criou evento operacional (não muta)');

-- modo off => análise recusada (sara_desligada)
SELECT set_config('request.jwt.claims', json_build_object('sub',:ADMIN,'role','authenticated')::text, false); SET ROLE authenticated;
SELECT public.ncrm_sara_definir_modo('off', true);
RESET ROLE;
SELECT set_config('request.jwt.claims', json_build_object('sub',:A,'role','authenticated')::text, false); SET ROLE authenticated;
SELECT public.test_assert((public.ncrm_sara_registrar_analise(1000,'x','em_atendimento','enviar_opcoes',now(),'just','[]'::jsonb,0.7,true,false,false,false,'v1') ->> 'erro')='sara_desligada','SARA off recusa análise');
RESET ROLE;
-- restaura observer
SELECT set_config('request.jwt.claims', json_build_object('sub',:ADMIN,'role','authenticated')::text, false); SET ROLE authenticated;
SELECT public.ncrm_sara_definir_modo('observer', true);
SELECT public.test_assert((public.ncrm_sara_modo_status() ->> 'modo')='observer','SARA restaurada para observer');
RESET ROLE;

SELECT '==== TESTES SARA-OBSERVER OK ====' AS resultado;
