-- =====================================================================
-- CRM Nova Era — runner prioriza quem tem NOVIDADE + Manual Operacional
-- ---------------------------------------------------------------------
-- 1. ncrm_sara_elegiveis v2: a fila do runner passa a atender PRIMEIRO os
--    negócios com interação mais nova que a última análise da Sara (ou nunca
--    analisados). O lead que respondeu agora não espera a rotação inteira.
--    Usa ncrm_estado.ultima_interacao_em (já mantido pelo reconciliador):
--    nenhuma consulta a wa_* — custo baixo, sem tocar no caminho do ERP.
--    Também deixa de listar quem já saiu do quadro (saida IS NOT NULL).
--
-- 2. Manual Operacional: um texto único, lido por todos os autenticados,
--    editado SOMENTE por admin (decisão de 31/07). Escrita exclusivamente
--    via RPC fail-closed; a tabela não aceita INSERT/UPDATE direto.
-- =====================================================================
BEGIN;
SET LOCAL check_function_bodies = off;

CREATE OR REPLACE FUNCTION public.ncrm_sara_elegiveis(p_lote integer DEFAULT 100)
  RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $function$
DECLARE v_lim int := LEAST(GREATEST(COALESCE(p_lote,100),1),500);
BEGIN
  IF COALESCE(auth.role(),'') <> 'service_role' THEN RETURN jsonb_build_object('ok',false,'erro','somente_servico'); END IF;
  RETURN jsonb_build_object('ok',true,'negocios', COALESCE((
    SELECT jsonb_agg(x.negocio_id ORDER BY x.tem_novidade DESC, x.nunca DESC, x.prox ASC NULLS FIRST, x.ult ASC NULLS FIRST, x.negocio_id)
    FROM (
      SELECT e.negocio_id,
             (i.negocio_id IS NULL) AS nunca,
             (a.max_analisado_em IS NULL
              OR (e.ultima_interacao_em IS NOT NULL AND e.ultima_interacao_em > a.max_analisado_em)) AS tem_novidade,
             i.proxima_tentativa_em AS prox,
             i.ultima_tentativa_em AS ult
      FROM public.ncrm_estado e
      LEFT JOIN public.ncrm_sara_runner_item i ON i.negocio_id = e.negocio_id
      LEFT JOIN LATERAL (
        SELECT max(s.analisado_em) AS max_analisado_em
          FROM public.ncrm_sara_analise s WHERE s.negocio_id = e.negocio_id
      ) a ON true
      WHERE e.saida IS NULL
        AND (i.negocio_id IS NULL OR i.proxima_tentativa_em IS NULL OR i.proxima_tentativa_em <= now())
      ORDER BY tem_novidade DESC, (i.negocio_id IS NULL) DESC,
               i.proxima_tentativa_em ASC NULLS FIRST, i.ultima_tentativa_em ASC NULLS FIRST, e.negocio_id
      LIMIT v_lim
    ) x), '[]'::jsonb));
END $function$;

-- ---------------------------------------------------------------------
-- Manual Operacional (linha única)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.ncrm_manual_operacional (
  id boolean PRIMARY KEY DEFAULT true CHECK (id),
  conteudo text NOT NULL DEFAULT '',
  atualizado_em timestamptz NOT NULL DEFAULT now(),
  atualizado_por uuid
);
INSERT INTO public.ncrm_manual_operacional (id, conteudo) VALUES (true, '') ON CONFLICT (id) DO NOTHING;

ALTER TABLE public.ncrm_manual_operacional ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS ncrm_manual_ler ON public.ncrm_manual_operacional;
CREATE POLICY ncrm_manual_ler ON public.ncrm_manual_operacional FOR SELECT TO authenticated USING (true);
REVOKE ALL ON public.ncrm_manual_operacional FROM PUBLIC, anon;
GRANT SELECT ON public.ncrm_manual_operacional TO authenticated;

CREATE OR REPLACE FUNCTION public.ncrm_manual_salvar(p_conteudo text)
  RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $fn$
DECLARE v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL THEN RETURN jsonb_build_object('ok',false,'erro','nao_autenticado'); END IF;
  IF public.is_admin() IS NOT TRUE THEN RETURN jsonb_build_object('ok',false,'erro','somente_admin'); END IF;
  IF p_conteudo IS NULL OR length(p_conteudo) > 20000 THEN
    RETURN jsonb_build_object('ok',false,'erro','conteudo_invalido'); END IF;
  UPDATE public.ncrm_manual_operacional
     SET conteudo = p_conteudo, atualizado_em = now(), atualizado_por = v_uid
   WHERE id = true;
  RETURN jsonb_build_object('ok', true);
END $fn$;
REVOKE ALL ON FUNCTION public.ncrm_manual_salvar(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ncrm_manual_salvar(text) TO authenticated;

COMMIT;
