SELECT public.test_assert((SELECT count(*) FROM public.ncrm_acao_padrao WHERE ativa)=15,
  '#op1 catálogo tem 15 ações padrão ativas');
SELECT public.test_assert((SELECT sla_min FROM public.ncrm_acao_padrao WHERE codigo='RESPONDER_CLIENTE')=15,
  '#op2 resposta ao cliente vence em 15 minutos');
SELECT public.test_assert(EXISTS(SELECT 1 FROM public.ncrm_workflow_config WHERE versao=3 AND status='publicada'),
  '#op3 workflow v3 está publicado');
SELECT public.test_assert((SELECT max_tentativas FROM public.ncrm_workflow_config WHERE versao=3)=6,
  '#op4 workflow tem primeira abordagem mais cinco cadências');
SELECT public.test_assert((SELECT array_agg(intervalo_min ORDER BY ordem) FROM public.ncrm_workflow_passo p JOIN public.ncrm_workflow_config c ON c.id=p.config_id WHERE c.versao=3)=ARRAY[5,360,1080,2880,2880,1440],
  '#op5 sequência operacional corresponde a 5min, mesmo dia, D2, D4, D6 e D7');
SELECT public.test_assert(NOT has_table_privilege('anon','public.ncrm_acao_padrao','SELECT'),
  '#op6 anon não lê catálogo interno');
