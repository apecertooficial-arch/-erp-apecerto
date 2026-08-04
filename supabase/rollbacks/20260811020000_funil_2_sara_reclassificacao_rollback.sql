DO $do$ BEGIN
  IF EXISTS(SELECT 1 FROM pg_extension WHERE extname='pg_cron') THEN
    BEGIN PERFORM cron.unschedule('f2_sara_reclassificar'); EXCEPTION WHEN others THEN NULL; END;
  END IF;
END $do$;
DROP FUNCTION IF EXISTS public.f2_sara_tick();
DROP FUNCTION IF EXISTS public.f2_sara_registrar_classificacao(uuid,integer,text,text,text,text,text,jsonb,numeric,integer,timestamptz);
DROP FUNCTION IF EXISTS public.f2_sara_elegiveis(integer);
DROP TABLE IF EXISTS public.f2_sara_analise;
DROP TABLE IF EXISTS public.f2_sara_config;
