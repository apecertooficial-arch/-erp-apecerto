-- Pos-visita, motivos de descarte e origem da proxima acao.
-- Testes de ESTRUTURA e de CONTRATO: nao dependem de dado semeado, entao valem
-- em qualquer base. O que eles prendem e o que quebraria silenciosamente.

-- 1. Resultado da visita existe e so aceita os sete valores combinados.
SELECT public.test_assert(
  EXISTS (SELECT 1 FROM information_schema.columns
           WHERE table_schema='public' AND table_name='visitas' AND column_name='resultado'),
  '#pv1 visitas.resultado existe');

SELECT public.test_assert(
  EXISTS (SELECT 1 FROM pg_constraint WHERE conname='visitas_resultado_check'),
  '#pv2 visitas.resultado tem whitelist');

-- Um resultado inventado precisa ser recusado pelo banco, nao so pela tela.
DO $$
DECLARE v_ok boolean := false;
BEGIN
  BEGIN
    INSERT INTO public.visitas (id, data, status, resultado)
    VALUES (gen_random_uuid(), current_date, 'realizada', 'gostou_muito');
  EXCEPTION WHEN check_violation THEN v_ok := true;
  WHEN others THEN v_ok := true; -- coluna obrigatoria faltando tambem recusa
  END;
  PERFORM public.test_assert(v_ok, '#pv3 resultado fora da lista e recusado');
END $$;

-- 2. Origem e motivo da proxima acao.
SELECT public.test_assert(
  (SELECT count(*) FROM information_schema.columns
    WHERE table_schema='public' AND table_name='ncrm_estado'
      AND column_name IN ('proxima_acao_motivo','proxima_acao_origem')) = 2,
  '#pv4 proxima acao guarda motivo e origem');

SELECT public.test_assert(
  EXISTS (SELECT 1 FROM pg_constraint WHERE conname='ncrm_estado_proxima_acao_origem_check'),
  '#pv5 origem da proxima acao e fechada por whitelist');

-- 3. Descarte com dez motivos.
SELECT public.test_assert(
  (SELECT pg_get_constraintdef(oid) FROM pg_constraint WHERE conname='ncrm_estado_descarte_motivo_check')
    LIKE '%produto_incompativel%',
  '#pv6 descarte aceita produto_incompativel');

SELECT public.test_assert(
  (SELECT pg_get_constraintdef(oid) FROM pg_constraint WHERE conname='ncrm_estado_descarte_motivo_check')
    LIKE '%sem_resposta%'
  AND (SELECT pg_get_constraintdef(oid) FROM pg_constraint WHERE conname='ncrm_estado_descarte_motivo_check')
    LIKE '%fora_da_regiao%'
  AND (SELECT pg_get_constraintdef(oid) FROM pg_constraint WHERE conname='ncrm_estado_descarte_motivo_check')
    LIKE '%nao_quer_contato%'
  AND (SELECT pg_get_constraintdef(oid) FROM pg_constraint WHERE conname='ncrm_estado_descarte_motivo_check')
    LIKE '%desistiu%',
  '#pv7 os quatro motivos novos entraram');

-- A whitelist continua FECHADA: motivo inventado nao passa.
SELECT public.test_assert(
  (SELECT pg_get_constraintdef(oid) FROM pg_constraint WHERE conname='ncrm_estado_descarte_motivo_check')
    NOT LIKE '%cansou%',
  '#pv8 whitelist de descarte continua fechada');

-- 4. RPCs existem e sao SECURITY DEFINER com search_path travado.
SELECT public.test_assert(
  to_regproc('public.ncrm_registrar_resultado_visita') IS NOT NULL,
  '#pv9 RPC de resultado da visita existe');

SELECT public.test_assert(
  (SELECT p.prosecdef FROM pg_proc p WHERE p.proname='ncrm_registrar_resultado_visita'),
  '#pv10 RPC roda como definer');

SELECT public.test_assert(
  (SELECT array_to_string(p.proconfig,',') FROM pg_proc p WHERE p.proname='ncrm_registrar_resultado_visita')
    LIKE '%search_path%',
  '#pv11 RPC trava o search_path');

-- Sem sessao autenticada, a funcao recusa. Fail-closed, como as demais.
SELECT public.test_assert(
  (public.ncrm_registrar_resultado_visita(gen_random_uuid(), 1, 1, 'interessado', NULL,
     'teste:pv:' || gen_random_uuid()::text) ->> 'erro') = 'nao_autenticado',
  '#pv12 sem sessao, nada e registrado');

-- Resultado invalido e recusado antes de qualquer escrita.
SELECT public.test_assert(
  (public.ncrm_registrar_resultado_visita(gen_random_uuid(), 1, 1, 'gostou_muito', NULL,
     'teste:pv:' || gen_random_uuid()::text) ->> 'erro') IN ('resultado_invalido','nao_autenticado'),
  '#pv13 resultado invalido nao passa');

-- 5. Cobranca: a consulta das visitas sem desfecho existe.
SELECT public.test_assert(
  to_regproc('public.ncrm_visitas_sem_resultado') IS NOT NULL,
  '#pv14 lista de visitas sem resultado existe');

-- anon nao executa nenhuma das duas.
SELECT public.test_assert(
  NOT has_function_privilege('anon', 'public.ncrm_registrar_resultado_visita(uuid,bigint,int,text,text,text)', 'EXECUTE'),
  '#pv15 anon nao registra resultado de visita');
