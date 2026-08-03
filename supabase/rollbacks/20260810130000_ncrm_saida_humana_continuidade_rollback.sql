BEGIN;
DO $do$
DECLARE r record;
BEGIN
  FOR r IN SELECT definicao FROM public.ncrm_saida_humana_continuidade_backup ORDER BY assinatura LOOP
    EXECUTE r.definicao;
  END LOOP;
END $do$;
DROP FUNCTION IF EXISTS ncrm_private.registrar_saida_humana_continuidade(
  bigint,bigint,bigint,bigint,integer,text,text,timestamptz
);
DROP TABLE IF EXISTS public.ncrm_saida_humana_continuidade_backup;
COMMIT;
