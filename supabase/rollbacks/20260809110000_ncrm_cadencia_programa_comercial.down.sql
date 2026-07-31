-- Rollback: despublica o workflow v2 (v1 volta a valer para os novos),
-- devolve prazos anteriores e remove reativação/redistribuição.
BEGIN;
-- Config encerrada é imutável: para voltar, criamos uma v3 CÓPIA da v1 e publicamos.
DO $$
DECLARE v_v1 public.ncrm_workflow_config%ROWTYPE; v_id bigint;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.ncrm_workflow_config WHERE versao = 2 AND status = 'publicada') THEN RETURN; END IF;
  SELECT * INTO v_v1 FROM public.ncrm_workflow_config WHERE versao = 1;
  UPDATE public.ncrm_workflow_config SET status = 'encerrada', vigencia_fim = now() WHERE versao = 2;
  INSERT INTO public.ncrm_workflow_config
    (status, versao, timezone, janela_inicio, janela_fim, max_tentativas, fds_operacional,
     espera_apos_automacao_min, vigencia_inicio)
  VALUES ('rascunho', 3, v_v1.timezone, v_v1.janela_inicio, v_v1.janela_fim, v_v1.max_tentativas,
          v_v1.fds_operacional, v_v1.espera_apos_automacao_min, now())
  RETURNING id INTO v_id;
  INSERT INTO public.ncrm_workflow_passo (config_id, ordem, rotulo, canal_sugerido, intervalo_min)
  SELECT v_id, ordem, rotulo, canal_sugerido, intervalo_min
    FROM public.ncrm_workflow_passo WHERE config_id = v_v1.id;
  UPDATE public.ncrm_workflow_config SET status = 'publicada' WHERE id = v_id;
END $$;
DO $$
BEGIN
  IF to_regclass('public.ncrm_entrada_config') IS NOT NULL THEN
    UPDATE public.ncrm_entrada_config SET prazo_primeira_abordagem_min = 15, atualizado_em = now() WHERE id;
  END IF;
END $$;
UPDATE public.ncrm_cadencia_config
   SET max_tentativas = 5, intervalos_min = '[15,120,1440,2880,5760]'::jsonb, atualizado_em = now()
 WHERE id = true;
DROP FUNCTION IF EXISTS ncrm_private.reativar_por_resposta(int);
DROP FUNCTION IF EXISTS ncrm_private.sla_redistribuir(int);
DROP TABLE IF EXISTS public.ncrm_sla_redistribuicao_config;
-- clamp_janela v2 é compatível com a v1 (fds_operacional=true passa direto): fica.
COMMIT;
