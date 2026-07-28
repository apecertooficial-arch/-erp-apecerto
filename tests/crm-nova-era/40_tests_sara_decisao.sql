-- Testes da correção auditável da Sara (ncrm_registrar_decisao_sara). Local, após migration + correção.
\set ON_ERROR_STOP on
\set QUIET on
SET client_min_messages TO notice;
\set A '''cccccccc-0000-0000-0000-000000000001'''
\set B '''dddddddd-0000-0000-0000-000000000001'''

-- Reaproveita um negócio já com estado (904 do delta; corretor A/10). Garante estado.
RESET ROLE; SET ROLE service_role; SELECT set_config('request.jwt.claims','{}',false);
SELECT public.ncrm_registrar_msg_automatica(905,'auto-dec-905', now());  -- idempotente; garante estado
RESET ROLE;

SELECT set_config('request.jwt.claims', json_build_object('sub',:A,'role','authenticated')::text, false); SET ROLE authenticated;
-- Nota: no harness local os corretores usam os UUIDs c/ prefixo 'cccc0000...'; 905 pertence ao corretor A(10).
SELECT versao AS v905 FROM public.ncrm_estado WHERE negocio_id=905 \gset

-- Decisão inválida / confiança inválida / sugestão inválida
SELECT public.test_assert((public.ncrm_registrar_decisao_sara(905,:v905,'talvez','{"proxima_acao":"x"}'::jsonb,0.5,'j','sara:d0') ->> 'erro')='decisao_invalida','Sara-dec: decisão inválida rejeitada');
SELECT public.test_assert((public.ncrm_registrar_decisao_sara(905,:v905,'aceita','{"proxima_acao":"x"}'::jsonb,2,'j','sara:d0b') ->> 'erro')='confianca_invalida','Sara-dec: confiança fora de 0..1 rejeitada');

-- Aceite persiste evento auditável classificacao_sara (decisao=aceita), sem alterar estado
SELECT public.test_assert((public.ncrm_registrar_decisao_sara(905,:v905,'aceita','{"proxima_acao":"Ligar 15h","confianca":0.8}'::jsonb,0.8,'boa sugestão','sara:d1') ->> 'ok')::boolean,'Sara-dec: aceite ok');
SELECT public.test_assert((SELECT versao FROM public.ncrm_estado WHERE negocio_id=905)=:v905,'Sara-dec: estado NÃO muda (sugestão, não aplicação)');
SELECT public.test_assert((SELECT (payload->>'decisao')='aceita' AND (payload->>'aplicado')::boolean=false AND payload ? 'decidido_por' AND payload ? 'decidido_em' AND payload ? 'confianca'
                           FROM public.ncrm_evento WHERE idempotency_key='sara:d1'),'Sara-dec: evento auditável com decisão/usuário/horário/confiança');

-- Idempotência
SELECT public.ncrm_registrar_decisao_sara(905,:v905,'aceita','{"proxima_acao":"x"}'::jsonb,0.8,'j','sara:d1');
SELECT public.test_assert((SELECT count(*) FROM public.ncrm_evento WHERE idempotency_key='sara:d1')=1,'Sara-dec: idempotente (1 evento)');
RESET ROLE;

-- Corretor B (não dono) => sem_permissao (fail-closed; não deixa service_role/genérico se passar por Sara)
SELECT set_config('request.jwt.claims', json_build_object('sub',:B,'role','authenticated')::text, false); SET ROLE authenticated;
SELECT public.test_assert((public.ncrm_registrar_decisao_sara(905,1,'rejeitada','{"proxima_acao":"x"}'::jsonb,0.4,'não','sara:d2') ->> 'erro')='sem_permissao','Sara-dec: corretor sem permissão negado');
RESET ROLE;

SELECT '==== TESTES SARA-DECISÃO OK ====' AS resultado;
