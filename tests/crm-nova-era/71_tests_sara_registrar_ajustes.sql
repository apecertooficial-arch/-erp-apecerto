-- ===== H. FASE 4 - ajuste do registro da Sara (hash curto real; validacao segue dura) =====
\set ON_ERROR_STOP on
SELECT set_config('request.jwt.claims', json_build_object('role','service_role')::text, false); SET ROLE service_role;
SELECT public.test_assert((public.ncrm_sara_registrar_analise(
   '44444444-4444-4444-8444-444444444444'::uuid,'ab12cd',61060,'novo','tentando_contato','ligar',now(),
   'hash real de 6 chars aceito', '[]'::jsonb, 0.5, false, false, false, false, 'sara-obs-v1','m1') ->> 'ok')::boolean,
   'H1 hash de 6 caracteres (contextHashEstavel real) e ACEITO');
SELECT public.test_assert((public.ncrm_sara_registrar_analise(
   '55555555-5555-4555-8555-555555555555'::uuid,'abc',61060,'novo',NULL,'ligar',now(),
   'hash de 3 e recusado', '[]'::jsonb, 0.5, false, false, false, false, 'sara-obs-v1','m1') ->> 'erro') = 'context_hash_invalido',
   'H2 hash de 3 caracteres segue RECUSADO (validacao dura preservada)');
RESET ROLE;
