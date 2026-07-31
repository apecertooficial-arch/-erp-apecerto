-- Analise da Sara pedida pelo CORRETOR (origem 'usuario').
-- Testes de ESTRUTURA e de CONTRATO: prendem o que quebraria silenciosamente.

-- 1. A RPC existe e o acesso e fechado por papel.
SELECT public.test_assert(
  to_regproc('public.ncrm_sara_analise_usuario') IS NOT NULL,
  '#su1 RPC ncrm_sara_analise_usuario existe');

SELECT public.test_assert(
  NOT has_function_privilege('anon',
    'public.ncrm_sara_analise_usuario(bigint,text,text,text,timestamptz,text,jsonb,numeric,text)', 'EXECUTE'),
  '#su2 anon NAO executa a RPC');

SELECT public.test_assert(
  has_function_privilege('authenticated',
    'public.ncrm_sara_analise_usuario(bigint,text,text,text,timestamptz,text,jsonb,numeric,text)', 'EXECUTE'),
  '#su3 authenticated executa a RPC');

-- 2. A whitelist de origem aceita as duas fontes e continua FECHADA.
SELECT public.test_assert(
  (SELECT pg_get_constraintdef(oid) FROM pg_constraint WHERE conname='ncrm_sara_analise_origem_check')
    LIKE '%usuario%'
  AND (SELECT pg_get_constraintdef(oid) FROM pg_constraint WHERE conname='ncrm_sara_analise_origem_check')
    LIKE '%sara_runner%',
  '#su4 origem aceita sara_runner e usuario');

DO $$
DECLARE v_ok boolean := false;
BEGIN
  BEGIN
    INSERT INTO public.ncrm_sara_analise (negocio_id, origem, ator, run_id, context_hash,
      etapa_atual, proxima_acao_sugerida, confianca, versao_prompt, versao_modelo, modo)
    VALUES (1, 'robo', 'x', gen_random_uuid(), 'h', 'novo', 'ligar', 0.5, 'v', 'm', 'observer');
  EXCEPTION WHEN check_violation THEN v_ok := true;
  WHEN others THEN v_ok := true; -- FK/coluna faltando tambem recusa: fail-closed
  END;
  PERFORM public.test_assert(v_ok, '#su5 origem inventada e recusada pelo banco');
END $$;

-- 3. Sem sessao, a RPC recusa educadamente (fail-closed, sem excecao vazando).
DO $$
DECLARE v jsonb;
BEGIN
  PERFORM set_config('request.jwt.claims', '{}', true);
  v := public.ncrm_sara_analise_usuario(1,'novo','abordado','ligar', now()+interval '2 hours',
        'teste','[]'::jsonb, 0.9, 'ui:teste');
  PERFORM public.test_assert(v->>'ok' = 'false' AND v->>'erro' = 'nao_autenticado',
    '#su6 sem JWT a RPC devolve nao_autenticado');
END $$;

-- 4. O card le prazo, confianca e etapa sugerida: o GRANT de coluna precisa existir.
SELECT public.test_assert(
  (SELECT count(*) FROM information_schema.column_privileges
    WHERE table_schema='public' AND table_name='ncrm_sara_analise'
      AND grantee='authenticated' AND privilege_type='SELECT'
      AND column_name IN ('prazo_sugerido','confianca','etapa_sugerida')) = 3,
  '#su7 authenticated le prazo, confianca e etapa sugerida');
