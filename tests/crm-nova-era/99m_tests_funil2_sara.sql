-- Sara do Funil 2.0: catálogo fechado, confiança, idempotência e isolamento.
SELECT id AS _sara_f2_id,versao AS _sara_f2_v0,momento_codigo AS _sara_f2_m0
FROM public.f2_lead ORDER BY criado_em,id LIMIT 1 \gset

SELECT set_config('request.jwt.claims','{"role":"service_role"}',false);
SET ROLE service_role;

SELECT public.test_assert((SELECT count(*) FROM public.f2_sara_elegiveis(50))<=10,
  '#f2s-01 lote é limitado no banco');
SELECT public.test_assert(
  (SELECT modo_execucao='canary' AND canary_limite=5 AND NOT enabled FROM public.f2_sara_config WHERE id)
  AND (SELECT count(*) FROM public.f2_sara_elegiveis(10))<=5,
  '#f2s-01b implantação nasce desligada e limitada a cinco leads de canário');

SELECT public.f2_sara_registrar_classificacao(
  :'_sara_f2_id',:_sara_f2_v0,repeat('a',64),'deterministica','sem_historico',NULL,
  'Sem histórico D-API; classificação anterior preservada.','[]'::jsonb,NULL,0,NULL
) AS _f2s_sem \gset
SELECT public.test_assert((:'_f2s_sem'::jsonb->>'status')='sem_historico'
  AND (SELECT momento_codigo=:'_sara_f2_m0' FROM public.f2_lead WHERE id=:'_sara_f2_id'),
  '#f2s-02 ausência de histórico nunca inventa nem muda momento');

SELECT versao AS _sara_f2_v1 FROM public.f2_lead WHERE id=:'_sara_f2_id' \gset
SELECT public.f2_sara_registrar_classificacao(
  :'_sara_f2_id',:_sara_f2_v1,repeat('b',64),'ia','sugestao','PRODUTO_ENVIADO',
  'Cliente recebeu opções e precisa avaliar.','["quero avaliar"]'::jsonb,0.40,3,NULL
) AS _f2s_baixa \gset
SELECT public.test_assert((:'_f2s_baixa'::jsonb->>'status')='revisao_humana'
  AND (SELECT momento_codigo=:'_sara_f2_m0' FROM public.f2_lead WHERE id=:'_sara_f2_id'),
  '#f2s-03 baixa confiança não altera o lead');

SELECT versao AS _sara_f2_v2 FROM public.f2_lead WHERE id=:'_sara_f2_id' \gset
SELECT public.f2_sara_registrar_classificacao(
  :'_sara_f2_id',:_sara_f2_v2,repeat('c',64),'deterministica','sugestao','CADENCIA_SEM_RESPOSTA',
  'O corretor chamou, mas o cliente ainda não respondeu.','[]'::jsonb,1,2,NULL
) AS _f2s_aplica \gset
SELECT public.test_assert((:'_f2s_aplica'::jsonb->>'status') IN ('aplicada','mantida')
  AND (SELECT etapa='tentando_contato' AND momento_codigo='CADENCIA_SEM_RESPOSTA'
       AND acao_codigo='ENVIAR_CADENCIA' FROM public.f2_lead WHERE id=:'_sara_f2_id'),
  '#f2s-04 classificação usa etapa e ação do catálogo, nunca texto livre');

SELECT public.test_assert((public.f2_sara_registrar_classificacao(
  :'_sara_f2_id',:_sara_f2_v2,repeat('c',64),'deterministica','sugestao','CADENCIA_SEM_RESPOSTA',
  'O corretor chamou, mas o cliente ainda não respondeu.','[]'::jsonb,1,2,NULL
)->>'ja_processado')::boolean
  AND (SELECT count(*) FROM public.f2_sara_analise WHERE funil_lead_id=:'_sara_f2_id' AND context_hash=repeat('c',64))=1,
  '#f2s-05 mesmo contexto é idempotente');

SELECT public.test_assert((public.f2_sara_registrar_classificacao(
  :'_sara_f2_id',(SELECT versao FROM public.f2_lead WHERE id=:'_sara_f2_id'),repeat('d',64),'ia','sugestao','MOMENTO_INVENTADO',
  'Classificação inválida não deve passar.','["teste"]'::jsonb,0.99,1,NULL
)->>'erro')='momento_invalido',
  '#f2s-06 momento fora do catálogo é recusado');
RESET ROLE;

SELECT set_config('request.jwt.claims','{"sub":"cccccccc-0000-0000-0000-000000000001","role":"authenticated"}',false);
SET ROLE authenticated;
SELECT public.test_assert(
  NOT has_function_privilege('authenticated','public.f2_sara_elegiveis(integer)','EXECUTE')
  AND NOT has_function_privilege('authenticated','public.f2_sara_registrar_classificacao(uuid,integer,text,text,text,text,text,jsonb,numeric,integer,timestamptz)','EXECUTE')
  AND NOT has_table_privilege('authenticated','public.f2_sara_analise','INSERT')
  AND NOT has_table_privilege('authenticated','public.f2_sara_analise','UPDATE'),
  '#f2s-07 corretor não executa nem falsifica classificação');
RESET ROLE;

SELECT public.test_assert(
  (SELECT count(*) FROM public.f2_evento WHERE funil_lead_id=:'_sara_f2_id' AND tipo='sara_reavaliou')>=1,
  '#f2s-08 aplicação da Sara deixa evento auditável');
SELECT public.test_assert(
  EXISTS(SELECT 1 FROM public.negocios WHERE id=(SELECT origem_negocio_id FROM public.f2_lead WHERE id=:'_sara_f2_id')),
  '#f2s-09 negócio original permanece intacto');
