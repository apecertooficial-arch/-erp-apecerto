-- Rollback: devolve os elegíveis à rotação simples e remove o manual.
BEGIN;
CREATE OR REPLACE FUNCTION public.ncrm_sara_elegiveis(p_lote integer DEFAULT 100)
  RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $function$
DECLARE v_lim int := LEAST(GREATEST(COALESCE(p_lote,100),1),500);
BEGIN
  IF COALESCE(auth.role(),'') <> 'service_role' THEN RETURN jsonb_build_object('ok',false,'erro','somente_servico'); END IF;
  RETURN jsonb_build_object('ok',true,'negocios', COALESCE((
    SELECT jsonb_agg(x.negocio_id ORDER BY x.nunca DESC, x.prox ASC NULLS FIRST, x.ult ASC NULLS FIRST, x.negocio_id)
    FROM (
      SELECT e.negocio_id,
             (i.negocio_id IS NULL) AS nunca,
             i.proxima_tentativa_em AS prox,
             i.ultima_tentativa_em AS ult
      FROM public.ncrm_estado e
      LEFT JOIN public.ncrm_sara_runner_item i ON i.negocio_id = e.negocio_id
      WHERE i.negocio_id IS NULL OR i.proxima_tentativa_em IS NULL OR i.proxima_tentativa_em <= now()
      ORDER BY (i.negocio_id IS NULL) DESC, i.proxima_tentativa_em ASC NULLS FIRST, i.ultima_tentativa_em ASC NULLS FIRST, e.negocio_id
      LIMIT v_lim
    ) x), '[]'::jsonb));
END $function$;
DROP FUNCTION IF EXISTS public.ncrm_manual_salvar(text);
DROP TABLE IF EXISTS public.ncrm_manual_operacional;
COMMIT;
