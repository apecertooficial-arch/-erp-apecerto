-- =====================================================================
-- CRM Nova Era — a análise da Sara pedida pelo CORRETOR também é persistida
-- ---------------------------------------------------------------------
-- Hoje só o motor (service_role) grava em ncrm_sara_analise, e a classificação
-- via evento exige papel 'sara'. Resultado: a análise que o corretor pede na
-- ficha morria no navegador — cada aparelho via uma Sara diferente, e o card
-- não tinha de onde ler o diagnóstico.
--
-- Esta RPC grava a análise EM NOME do usuário autenticado (origem 'usuario'),
-- fail-closed (pode_operar_negocio), sem tocar em ncrm_estado: análise é
-- leitura do mundo, nunca mudança de estado. Dedupe por context_hash.
-- =====================================================================
BEGIN;
SET LOCAL check_function_bodies = off;

-- A tabela nasceu exclusiva do motor (origem = 'sara_runner'). A análise pedida
-- pelo corretor é o mesmo dado com outra origem — o CHECK passa a aceitar as duas.
ALTER TABLE public.ncrm_sara_analise DROP CONSTRAINT IF EXISTS ncrm_sara_analise_origem_check;
ALTER TABLE public.ncrm_sara_analise ADD CONSTRAINT ncrm_sara_analise_origem_check
  CHECK (origem IN ('sara_runner','usuario'));

CREATE OR REPLACE FUNCTION public.ncrm_sara_analise_usuario(
  p_negocio_id bigint, p_etapa_atual text, p_etapa_sugerida text,
  p_proxima_acao text, p_prazo timestamptz, p_justificativa text,
  p_evidencias jsonb, p_confianca numeric, p_hash text)
  RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $fn$
DECLARE v_uid uuid := auth.uid(); v_modo text; v_id bigint;
BEGIN
  IF v_uid IS NULL THEN RETURN jsonb_build_object('ok',false,'erro','nao_autenticado'); END IF;
  IF ncrm_private.pode_operar_negocio(p_negocio_id) IS NOT TRUE THEN
    RETURN jsonb_build_object('ok',false,'erro','sem_permissao'); END IF;
  IF p_proxima_acao IS NULL OR btrim(p_proxima_acao) = '' THEN
    RETURN jsonb_build_object('ok',false,'erro','proxima_acao_obrigatoria'); END IF;
  IF p_confianca IS NULL OR p_confianca < 0 OR p_confianca > 1 THEN
    RETURN jsonb_build_object('ok',false,'erro','confianca_invalida'); END IF;
  IF p_hash IS NULL OR btrim(p_hash) = '' THEN
    RETURN jsonb_build_object('ok',false,'erro','hash_obrigatorio'); END IF;

  -- Mesma análise (mesmo conteúdo) não duplica.
  SELECT id INTO v_id FROM public.ncrm_sara_analise
   WHERE negocio_id = p_negocio_id AND context_hash = p_hash LIMIT 1;
  IF FOUND THEN RETURN jsonb_build_object('ok',true,'ja_processado',true,'analise_id',v_id); END IF;

  SELECT modo INTO v_modo FROM public.ncrm_sara_config LIMIT 1;

  INSERT INTO public.ncrm_sara_analise
    (negocio_id, origem, ator, run_id, context_hash, etapa_atual, etapa_sugerida,
     proxima_acao_sugerida, prazo_sugerido, justificativa, evidencias, confianca,
     versao_prompt, versao_modelo, modo, analisado_em)
  VALUES
    (p_negocio_id, 'usuario', v_uid::text, gen_random_uuid(), p_hash, p_etapa_atual, p_etapa_sugerida,
     left(p_proxima_acao, 400), p_prazo, left(coalesce(p_justificativa,''), 800),
     coalesce(p_evidencias, '[]'::jsonb), p_confianca,
     'ui-ficha-v1', 'ia-router', coalesce(v_modo, 'observer'), now())
  RETURNING id INTO v_id;

  RETURN jsonb_build_object('ok',true,'analise_id',v_id);
END $fn$;

REVOKE ALL ON FUNCTION public.ncrm_sara_analise_usuario(bigint,text,text,text,timestamptz,text,jsonb,numeric,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ncrm_sara_analise_usuario(bigint,text,text,text,timestamptz,text,jsonb,numeric,text) TO authenticated;

-- O card precisa ler tambem prazo, confianca e etapa sugerida (o placar ja
-- liberou negocio_id, proxima_acao_sugerida, justificativa e analisado_em).
GRANT SELECT (prazo_sugerido, confianca, etapa_sugerida)
  ON public.ncrm_sara_analise TO authenticated;

COMMIT;
