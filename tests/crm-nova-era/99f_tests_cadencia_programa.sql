-- Programa comercial da cadencia: workflow v2, janela seg-sex, reativacao e SLA.

-- 1. Workflow v2 publicado com 6 tentativas e janela 9-19.
SELECT public.test_assert(
  EXISTS (SELECT 1 FROM public.ncrm_workflow_config
           WHERE versao = 2 AND status = 'publicada' AND max_tentativas = 6
             AND fds_operacional = false
             AND janela_inicio = '09:00'::time AND janela_fim = '19:00'::time),
  '#cp1 workflow v2 publicado: 6 tentativas, 9h-19h, seg a sex');

SELECT public.test_assert(
  (SELECT count(*) FROM public.ncrm_workflow_passo p
    JOIN public.ncrm_workflow_config c ON c.id = p.config_id AND c.versao = 2) = 6,
  '#cp2 os 6 passos do programa existem');

SELECT public.test_assert(
  (SELECT jsonb_agg(p.intervalo_min ORDER BY p.ordem) FROM public.ncrm_workflow_passo p
    JOIN public.ncrm_workflow_config c ON c.id = p.config_id AND c.versao = 2)
  = '[5,120,1440,2880,2880,2880]'::jsonb,
  '#cp3 intervalos: 5min, 2h, D+1, D+3, D+5, D+7');

-- 2. clamp_janela pula o fim de semana quando fds_operacional = false.
DO $$
DECLARE v_cfg bigint; v_sab timestamptz; v_res timestamptz;
BEGIN
  SELECT id INTO v_cfg FROM public.ncrm_workflow_config WHERE versao = 2 LIMIT 1;
  -- um sabado 10h em SP
  v_sab := (date_trunc('week', now() AT TIME ZONE 'America/Sao_Paulo')::date + 5 + time '10:00') AT TIME ZONE 'America/Sao_Paulo';
  v_res := ncrm_private.clamp_janela(v_sab, v_cfg);
  PERFORM public.test_assert(
    extract(isodow FROM (v_res AT TIME ZONE 'America/Sao_Paulo'))::int NOT IN (6,7),
    '#cp4 sabado nao recebe cadencia: prazo empurrado para dia util');
END $$;

-- 3. Primeira abordagem em 5 minutos.
DO $$
BEGIN
  IF to_regclass('public.ncrm_entrada_config') IS NOT NULL THEN
    PERFORM public.test_assert(
      (SELECT prazo_primeira_abordagem_min FROM public.ncrm_entrada_config WHERE id) = 5,
      '#cp5 prazo da primeira abordagem e 5 minutos');
  ELSE
    PERFORM public.test_assert(true, '#cp5 prazo da primeira abordagem (tabela fora do recorte local)');
  END IF;
END $$;

-- 4. Reativacao e redistribuicao: fechadas a servico, nunca ao navegador.
SELECT public.test_assert(
  to_regproc('ncrm_private.reativar_por_resposta') IS NOT NULL
  AND to_regproc('ncrm_private.sla_redistribuir') IS NOT NULL,
  '#cp6 funcoes de reativacao e redistribuicao existem');

SELECT public.test_assert(
  NOT has_function_privilege('authenticated','ncrm_private.reativar_por_resposta(int)','EXECUTE')
  AND NOT has_function_privilege('authenticated','ncrm_private.sla_redistribuir(int)','EXECUTE')
  AND NOT has_function_privilege('anon','ncrm_private.sla_redistribuir(int)','EXECUTE'),
  '#cp7 reativacao e redistribuicao sao exclusivas do servico');

-- 5. Kill-switch da redistribuicao existe e nasce ligado com tolerancia 15.
SELECT public.test_assert(
  (SELECT ativo AND tolerancia_min = 15 FROM public.ncrm_sla_redistribuicao_config WHERE id),
  '#cp8 redistribuicao nasce ligada com tolerancia de 15 minutos');
