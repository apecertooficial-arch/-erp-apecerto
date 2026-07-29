-- ===== I. FASE 5 (PR A) — cadência configurável, janela, fila, gestão, justificativa =====
\set ON_ERROR_STOP on
\set QUIET on
\set A '''cccccccc-0000-0000-0000-000000000001'''
\set B '''dddddddd-0000-0000-0000-000000000001'''
\set ADMIN '''aaaaaaaa-0000-0000-0000-000000000001'''

-- I1: config — leitura autenticada; escrita SÓ admin; auditada.
SELECT set_config('request.jwt.claims', json_build_object('sub',:A,'role','authenticated')::text, false); SET ROLE authenticated;
SELECT public.test_assert((public.ncrm_cadencia_config_get() ->> 'ok')::boolean,'I1 corretor lê a config de cadência');
SELECT public.test_assert((public.ncrm_cadencia_config_set('{"max_tentativas":4}'::jsonb) ->> 'erro')='sem_permissao','I1 corretor NÃO altera a config');
RESET ROLE;
SELECT set_config('request.jwt.claims', json_build_object('sub',:ADMIN,'role','authenticated')::text, false); SET ROLE authenticated;
SELECT public.test_assert(((public.ncrm_cadencia_config_set('{"tolerancia_min":30}'::jsonb)) ->> 'tolerancia_min')::int = 30,'I1 admin altera tolerância');
RESET ROLE;
SELECT public.test_assert((SELECT count(*) FROM public.ncrm_cadencia_config_audit) = 1,'I1 alteração auditada');

-- I2: janela comercial (America/Sao_Paulo): sábado 12h -> segunda 09h local; dia útil 22h -> dia seguinte 09h; dentro da janela não muda.
SELECT public.test_assert(
  (ncrm_private.ajustar_para_janela('2026-08-01T15:00:00Z') AT TIME ZONE 'America/Sao_Paulo') = '2026-08-03 09:00:00'::timestamp,
  'I2 sábado é levado para segunda 09:00 local');
SELECT public.test_assert(
  (ncrm_private.ajustar_para_janela('2026-08-04T01:30:00Z') AT TIME ZONE 'America/Sao_Paulo') = '2026-08-04 09:00:00'::timestamp,
  'I2 22:30 local (dia útil) vai para 09:00 do dia seguinte');
SELECT public.test_assert(
  ncrm_private.ajustar_para_janela('2026-08-04T17:00:00Z') = '2026-08-04T17:00:00Z'::timestamptz,
  'I2 14:00 local em dia útil permanece igual');

-- I3: fila de trabalho — prioridades e escopo por carteira.
-- fixtures: usa negócios existentes do harness (100=A/corretor10, 200=B/corretor20).
RESET ROLE;
UPDATE public.ncrm_estado SET resposta_pendente = true, ultima_interacao_em = now() - interval '30 min' WHERE negocio_id = 100;
UPDATE public.ncrm_estado SET proxima_acao_tipo='tentativa_cadencia', proxima_acao_em = now() - interval '2 hours' WHERE negocio_id = 300;
UPDATE public.ncrm_estado SET proxima_acao_tipo=NULL, proxima_acao_em = NULL WHERE negocio_id = 400;

SELECT set_config('request.jwt.claims', json_build_object('sub',:A,'role','authenticated')::text, false); SET ROLE authenticated;
SELECT public.ncrm_fila_trabalho('agora') AS fila \gset
SELECT public.test_assert((:'fila'::jsonb ->> 'ok')::boolean,'I3 fila responde ok para corretor');
SELECT public.test_assert(((:'fila'::jsonb -> 'itens') -> 0 ->> 'negocio_id')::bigint = 100,'I3 prioridade 1: cliente respondeu vem primeiro');
SELECT public.test_assert(((:'fila'::jsonb -> 'itens') -> 0 ->> 'prioridade')::int = 1,'I3 item 1 tem prioridade 1');
-- corretor A não vê negócio do corretor B (200)
SELECT public.test_assert(
  NOT EXISTS (SELECT 1 FROM jsonb_array_elements(:'fila'::jsonb -> 'itens') i WHERE (i->>'negocio_id')::bigint = 200),
  'I3 RLS de carteira: corretor A não vê lead do corretor B');
-- filtro vencidos contém 300 (cadência vencida => prioridade 5, motivo Cadência vencida)
SELECT public.ncrm_fila_trabalho('vencidos') AS filav \gset
SELECT public.test_assert(
  EXISTS (SELECT 1 FROM jsonb_array_elements(:'filav'::jsonb -> 'itens') i WHERE (i->>'negocio_id')::bigint = 300 AND (i->>'prioridade')::int = 5 AND i->>'motivo' = 'Cadência vencida'),
  'I3 cadência vencida classificada como prioridade 5');
RESET ROLE;

-- I4: gestão — admin vê agregado por corretor com aderência; drill dos números bate.
SELECT set_config('request.jwt.claims', json_build_object('sub',:ADMIN,'role','authenticated')::text, false); SET ROLE authenticated;
SELECT public.ncrm_gestao_painel() AS g \gset
SELECT public.test_assert((:'g'::jsonb ->> 'ok')::boolean,'I4 painel de gestão responde ok');
SELECT public.test_assert(jsonb_array_length(:'g'::jsonb -> 'corretores') >= 2,'I4 agrega mais de um corretor');
SELECT public.test_assert(
  EXISTS (SELECT 1 FROM jsonb_array_elements(:'g'::jsonb -> 'corretores') c WHERE c->>'aderencia' IN ('em_dia','atencao','critico')),
  'I4 aderência classificada');
RESET ROLE;

-- I5: justificativa — dono registra; texto curto é recusado; corretor B não justifica lead de A.
SELECT set_config('request.jwt.claims', json_build_object('sub',:A,'role','authenticated')::text, false); SET ROLE authenticated;
SELECT public.test_assert((public.ncrm_justificar_atraso(300,'cadencia_vencida','Cliente pediu para retornar somente na sexta.') ->> 'ok')::boolean,'I5 corretor justifica atraso do próprio lead');
SELECT public.test_assert((public.ncrm_justificar_atraso(300,'cadencia_vencida','curto') ->> 'erro')='justificativa_invalida','I5 justificativa curta é recusada');
RESET ROLE;
SELECT set_config('request.jwt.claims', json_build_object('sub',:B,'role','authenticated')::text, false); SET ROLE authenticated;
SELECT public.test_assert((public.ncrm_justificar_atraso(300,'cadencia_vencida','Tentando justificar lead alheio aqui.') ->> 'erro')='sem_permissao','I5 corretor B não justifica lead do A');
RESET ROLE;
SELECT public.test_assert((SELECT count(*) FROM public.ncrm_justificativa WHERE negocio_id=300)=1,'I5 exatamente 1 justificativa registrada');

-- I6: zero execução automática — nada nesta fase muta estado sozinho.
SELECT versao AS v300 FROM public.ncrm_estado WHERE negocio_id=300 \gset
SELECT set_config('request.jwt.claims', json_build_object('sub',:ADMIN,'role','authenticated')::text, false); SET ROLE authenticated;
SELECT public.ncrm_fila_trabalho('agora'); SELECT public.ncrm_gestao_painel();
RESET ROLE;
SELECT public.test_assert((SELECT versao FROM public.ncrm_estado WHERE negocio_id=300) = :v300,'I6 fila/painel não mutam estado (versão intacta)');

-- limpeza dos ajustes de fixture para não interferir nos blocos seguintes
RESET ROLE;
UPDATE public.ncrm_estado SET resposta_pendente = false WHERE negocio_id = 100;
