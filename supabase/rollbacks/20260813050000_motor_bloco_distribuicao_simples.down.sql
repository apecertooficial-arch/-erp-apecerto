-- Rollback: remove o ramo `distribution-simple` do motor.
--
-- ATENCAO: rode isto SOMENTE depois de garantir que nenhuma automacao publicada
-- usa o bloco. Verifique antes:
--
--   SELECT a.id, a.nome
--     FROM public.automacoes a,
--          LATERAL jsonb_array_elements(a.mapa->'automation'->'blocks') b(bloco)
--    WHERE b.bloco->>'type' = 'distribution-simple';
--
-- Se alguma automacao usar o bloco e o ramo for removido, o motor cai no ramo
-- final (bloco desconhecido) e o fluxo para naquele ponto — o lead NAO e
-- distribuido. Troque o bloco na automacao antes.

BEGIN;

DO $rb$
DECLARE d text; ini int; fim int;
BEGIN
  SELECT pg_get_functiondef(oid) INTO d FROM pg_proc WHERE proname='motor_rodar_unchecked';
  IF position('tipo=''distribution-simple''' in d) = 0 THEN
    RAISE NOTICE 'ramo ja ausente';
    RETURN;
  END IF;

  ini := position(E'elsif tipo=''distribution-simple'' then' in d);
  fim := position(E'elsif tipo=''distribution'' then' in d);
  IF ini = 0 OR fim = 0 OR fim <= ini THEN
    RAISE EXCEPTION 'nao foi possivel delimitar o ramo com seguranca';
  END IF;

  d := left(d, ini - 1) || substr(d, fim);

  IF position('distribution-simple' in d) > 0 THEN
    RAISE EXCEPTION 'remocao incompleta';
  END IF;

  EXECUTE d;
END
$rb$;

COMMIT;
