-- ===== I. FASE 5 (PR A) - cadencia configuravel, janela, fila, gestao, justificativa =====
-- Fixtures PROPRIAS e isoladas (71xxx): os negocios do harness ja foram mutados por blocos anteriores.
\set ON_ERROR_STOP on
\set QUIET on
\set A '''cccccccc-0000-0000-0000-000000000001'''
\set B '''dddddddd-0000-0000-0000-000000000001'''
\set ADMIN '''aaaaaaaa-0000-0000-0000-000000000001'''

RESET ROLE;
INSERT INTO public.leads (id, nome) VALUES (71,'Lead F5 respondeu'),(72,'Lead F5 cadencia'),(73,'Lead F5 do corretor B') ON CONFLICT DO NOTHING;
INSERT INTO public.negocios (id, lead_id, corretor_id, status) VALUES (71000,71,10,'aberto'),(71001,72,10,'aberto'),(71002,73,20,'aberto') ON CONFLICT DO NOTHING;
SELECT set_config('request.jwt.claims', json_build_object('role','service_role')::text, false); SET ROLE service_role;
SELECT public.ncrm_registrar_msg_automatica(71000,'f5-a-71000', now() - interval '3 hours');
SELECT public.ncrm_registrar_msg_automatica(71001,'f5-a-71001', now() - interval '5 hours');
SELECT public.ncrm_registrar_msg_automatica(71002,'f5-a-71002', now() - interval '3 hours');
SELECT public.ncrm_registrar_resposta_cliente(71000,'f5-in-71000', now() - interval '30 min');
RESET ROLE;
-- 71001 ja teve atuacao humana (tentativa registrada pelo dono) => sai da classe 'lead novo' (prio 2)
SELECT set_config('request.jwt.claims', json_build_object('sub','cccccccc-0000-0000-0000-000000000001','role','authenticated')::text, false); SET ROLE authenticated;
SELECT public.ncrm_registrar_tentativa(71001,1,'whatsapp','nao_respondeu','fixture f5','tentativa_cadencia','2a tentativa', now() + interval '1 day','f5-tent-71001');
RESET ROLE;
UPDATE public.ncrm_estado SET proxima_acao_tipo='tentativa_cadencia', proxima_acao_em = now() - interval '2 hours' WHERE negocio_id = 71001;

-- I1: config - leitura autenticada; escrita SO admin; auditada.
SELECT set_config('request.jwt.claims', json_build_object('sub',:A,'role','authenticated')::text, false); SET ROLE authenticated;
SELECT public.test_assert((public.ncrm_cadencia_config_get() ->> 'ok')::boolean,'I1 corretor le a config de cadencia');
SELECT public.test_assert((public.ncrm_cadencia_config_set('{"max_tentativas":4}'::jsonb) ->> 'erro')='sem_permissao','I1 corretor NAO altera a config');
RESET ROLE;
SELECT set_config('request.jwt.claims', json_build_object('sub',:ADMIN,'role','authenticated')::text, false); SET ROLE authenticated;
SELECT public.test_assert(((public.ncrm_cadencia_config_set('{"tolerancia_min":30}'::jsonb)) ->> 'tolerancia_min')::int = 30,'I1 admin altera tolerancia');
RESET ROLE;
SELECT public.test_assert((SELECT count(*) FROM public.ncrm_cadencia_config_audit) = 1,'I1 alteracao auditada');

-- I2: janela comercial America/Sao_Paulo (sabado, fora de hora, dentro da janela).
SELECT public.test_assert((ncrm_private.ajustar_para_janela('2026-08-01T15:00:00Z') AT TIME ZONE 'America/Sao_Paulo') = '2026-08-03 09:00:00'::timestamp,'I2 sabado vai para segunda 09:00 local');
SELECT public.test_assert((ncrm_private.ajustar_para_janela('2026-08-04T01:30:00Z') AT TIME ZONE 'America/Sao_Paulo') = '2026-08-04 09:00:00'::timestamp,'I2 22:30 local vai para 09:00 do dia seguinte');
SELECT public.test_assert(ncrm_private.ajustar_para_janela('2026-08-04T17:00:00Z') = '2026-08-04T17:00:00Z'::timestamptz,'I2 14:00 local em dia util permanece igual');

-- I3: fila - prioridades e escopo por carteira.
SELECT set_config('request.jwt.claims', json_build_object('sub',:A,'role','authenticated')::text, false); SET ROLE authenticated;
SELECT public.ncrm_fila_trabalho('agora') AS fila \gset
SELECT public.test_assert((:'fila'::jsonb ->> 'ok')::boolean,'I3 fila responde ok para corretor');
SELECT public.test_assert(((:'fila'::jsonb -> 'itens') -> 0 ->> 'negocio_id')::bigint = 71000,'I3 prioridade 1: cliente respondeu vem primeiro');
SELECT public.test_assert(((:'fila'::jsonb -> 'itens') -> 0 ->> 'prioridade')::int = 1,'I3 item 1 tem prioridade 1');
SELECT public.test_assert(NOT EXISTS (SELECT 1 FROM jsonb_array_elements(:'fila'::jsonb -> 'itens') i WHERE (i->>'negocio_id')::bigint = 71002),'I3 RLS de carteira: corretor A nao ve lead do corretor B');
SELECT public.ncrm_fila_trabalho('vencidos') AS filav \gset
SELECT public.test_assert(EXISTS (SELECT 1 FROM jsonb_array_elements(:'filav'::jsonb -> 'itens') i WHERE (i->>'negocio_id')::bigint = 71001 AND (i->>'prioridade')::int = 5 AND i->>'motivo' = 'Cadencia vencida'),'I3 cadencia vencida = prioridade 5');
RESET ROLE;

-- I4: gestao - agregado por corretor com aderencia.
SELECT set_config('request.jwt.claims', json_build_object('sub',:ADMIN,'role','authenticated')::text, false); SET ROLE authenticated;
SELECT public.ncrm_gestao_painel() AS g \gset
SELECT public.test_assert((:'g'::jsonb ->> 'ok')::boolean,'I4 painel de gestao responde ok');
SELECT public.test_assert(jsonb_array_length(:'g'::jsonb -> 'corretores') >= 2,'I4 agrega mais de um corretor');
SELECT public.test_assert(EXISTS (SELECT 1 FROM jsonb_array_elements(:'g'::jsonb -> 'corretores') c WHERE c->>'aderencia' IN ('em_dia','atencao','critico')),'I4 aderencia classificada');
RESET ROLE;

-- I5: justificativa - dono registra; texto curto recusado; corretor B nao justifica lead de A.
SELECT set_config('request.jwt.claims', json_build_object('sub',:A,'role','authenticated')::text, false); SET ROLE authenticated;
SELECT public.test_assert((public.ncrm_justificar_atraso(71001,'cadencia_vencida','Cliente pediu para retornar somente na sexta.') ->> 'ok')::boolean,'I5 corretor justifica atraso do proprio lead');
SELECT public.test_assert((public.ncrm_justificar_atraso(71001,'cadencia_vencida','abc') ->> 'erro')='justificativa_invalida','I5 justificativa curta e recusada');
RESET ROLE;
SELECT set_config('request.jwt.claims', json_build_object('sub',:B,'role','authenticated')::text, false); SET ROLE authenticated;
SELECT public.test_assert((public.ncrm_justificar_atraso(71001,'cadencia_vencida','Tentando justificar lead alheio aqui.') ->> 'erro')='sem_permissao','I5 corretor B nao justifica lead do A');
RESET ROLE;
SELECT public.test_assert((SELECT count(*) FROM public.ncrm_justificativa WHERE negocio_id=71001)=1,'I5 exatamente 1 justificativa registrada');

-- I6: zero execucao automatica - fila/painel nao mutam estado.
SELECT versao AS v71001 FROM public.ncrm_estado WHERE negocio_id=71001 \gset
SELECT set_config('request.jwt.claims', json_build_object('sub',:ADMIN,'role','authenticated')::text, false); SET ROLE authenticated;
SELECT public.ncrm_fila_trabalho('agora'); SELECT public.ncrm_gestao_painel();
RESET ROLE;
SELECT public.test_assert((SELECT versao FROM public.ncrm_estado WHERE negocio_id=71001) = :v71001,'I6 fila/painel nao mutam estado (versao intacta)');
