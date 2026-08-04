-- Funil 2.0: laboratório fisicamente isolado e limitado a duas cópias.
-- O primeiro fixture simula um estado antigo sem momento explícito. Ele é
-- autocontido para não depender de negócios removidos por rollbacks anteriores.
INSERT INTO public.leads(id,nome,telefone)
VALUES(71992,'Lead legado sem momento','11999997192') ON CONFLICT(id) DO NOTHING;
INSERT INTO public.negocios(id,lead_id,corretor_id,status,pipeline_id,stage_id)
VALUES(71992,71992,71991,'aberto',2,20) ON CONFLICT(id) DO NOTHING;
INSERT INTO public.ncrm_estado(
  negocio_id,workflow_config_id,etapa,momento_codigo,respondeu,resposta_pendente,
  proxima_acao_tipo,proxima_acao_titulo,proxima_acao_em,origem_ultima
)
SELECT 71992,id,'tentando_contato',NULL,false,false,
  'tentativa_cadencia','Enviar cadência',now()+interval '1 day','usuario'
FROM public.ncrm_workflow_config WHERE status='publicada' ORDER BY versao DESC LIMIT 1
ON CONFLICT(negocio_id) DO UPDATE SET momento_codigo=NULL,etapa='tentando_contato';
UPDATE public.ncrm_estado SET momento_codigo='DECISAO_POS_VISITA' WHERE negocio_id=71991;

SELECT set_config('request.jwt.claims','{"role":"service_role"}',false);
SET ROLE service_role;
SELECT public.f2_importar_negocio(71992);
SELECT public.f2_importar_negocio(71991);
RESET ROLE;

SELECT public.test_assert((SELECT count(*) FROM public.f2_lead)=2,
  '#f2-01 importa exatamente duas cópias');
SELECT public.test_assert(
  (SELECT momento_codigo FROM public.f2_lead WHERE origem_negocio_id=71992)='CADENCIA_SEM_RESPOSTA',
  '#f2-01b estado antigo sem momento usa o momento oficial da etapa como fallback');
SELECT public.test_assert((SELECT count(*) FROM public.negocios WHERE id IN(71992,71991))=2,
  '#f2-02 negócios originais continuam existentes');
SELECT public.test_assert((SELECT count(*) FROM public.f2_momento_config WHERE ativo)=10
  AND (SELECT count(DISTINCT etapa) FROM public.f2_momento_config WHERE ativo)=4,
  '#f2-03 catálogo possui quatro etapas e dez momentos oficiais');
SELECT id AS _f2_id,versao AS _f2_versao FROM public.f2_lead WHERE origem_negocio_id=71992 \gset

DO $t$
BEGIN
  BEGIN
    INSERT INTO public.f2_lead(origem_negocio_id,nome,etapa,momento_codigo,acao_codigo,acao_rotulo,proxima_acao_em)
    VALUES(710,'Terceiro proibido','novo','PRIMEIRA_ABORDAGEM','PRIMEIRA_ABORDAGEM','Fazer a primeira abordagem',now()+interval '5 minutes');
    PERFORM public.test_assert(false,'#f2-04 limite físico deveria recusar terceiro lead');
  EXCEPTION WHEN OTHERS THEN
    PERFORM public.test_assert(SQLERRM LIKE '%funil_2_limite_dois_leads%',
      '#f2-04 limite físico recusa o terceiro lead');
  END;
END $t$;

SELECT set_config('request.jwt.claims','{"sub":"cccccccc-0000-0000-0000-000000000001","role":"authenticated"}',false);
SET ROLE authenticated;
SELECT public.test_assert((SELECT count(*) FROM public.f2_lead)=0,
  '#f2-05 corretor não enxerga o laboratório administrativo');
SELECT public.test_assert((public.f2_atualizar_momento(
  :'_f2_id',:_f2_versao,'PRODUTO_ENVIADO',NULL,NULL)->>'erro')='sem_permissao',
  '#f2-06 corretor não consegue atualizar uma cópia por UUID conhecido');
RESET ROLE;

SELECT set_config('request.jwt.claims','{"sub":"aaaaaaaa-0000-0000-0000-000000000001","role":"authenticated"}',false);
SET ROLE authenticated;
SELECT public.test_assert((SELECT count(*) FROM public.f2_lead)=2,
  '#f2-07 administrador enxerga somente as duas cópias');
SELECT public.test_assert((public.f2_atualizar_momento(
  :'_f2_id',:_f2_versao,'PRODUTO_ENVIADO',NULL,'Cliente recebeu opções')->>'ok')::boolean,
  '#f2-08 menu oficial altera momento, ação e prazo de forma atômica');
SELECT versao AS _f2_versao2 FROM public.f2_lead WHERE id=:'_f2_id' \gset
SELECT public.test_assert((public.f2_confirmar_acao(
  :'_f2_id',:_f2_versao2,'registro_operacional',NULL)->>'erro')='confirmacao_dapi_obrigatoria',
  '#f2-09 ação de mensagem exige evidência D-API');
SELECT public.test_assert((public.f2_confirmar_acao(
  :'_f2_id',:_f2_versao2,'dapi','Webhook confirmado')->>'ok')::boolean,
  '#f2-10 confirmação D-API registra a ação e recalcula o prazo');
SELECT versao AS _f2_versao3 FROM public.f2_lead WHERE id=:'_f2_id' \gset
SELECT public.test_assert((public.f2_atualizar_momento(
  :'_f2_id',:_f2_versao3,'CADENCIA_SEM_RESPOSTA',NULL,'Voltou para a cadência')->>'ok')::boolean,
  '#f2-10b entrada na cadência começa no dia 1');
SELECT versao AS _f2_versao4 FROM public.f2_lead WHERE id=:'_f2_id' \gset
SELECT public.test_assert((public.f2_atualizar_momento(
  :'_f2_id',:_f2_versao4,'CADENCIA_SEM_RESPOSTA',NULL,'Continua sem resposta')->>'mesmo_momento')::boolean
  AND (SELECT cadencia_passo FROM public.f2_lead WHERE id=:'_f2_id')=0,
  '#f2-10c revalidar o mesmo momento não reinicia nem avança a cadência');
SELECT versao AS _f2_versao5 FROM public.f2_lead WHERE id=:'_f2_id' \gset
SELECT public.f2_confirmar_acao(
  :'_f2_id',:_f2_versao5,'dapi','Dia 1 confirmado') AS _f2_confirmacao_dia1 \gset
SELECT public.test_assert((:'_f2_confirmacao_dia1'::jsonb->>'ok')::boolean
  AND (SELECT cadencia_passo FROM public.f2_lead WHERE id=:'_f2_id')=1,
  '#f2-10d depois do dia 1 a próxima obrigação é o dia 2');
RESET ROLE;

SELECT public.test_assert(
  NOT has_function_privilege('anon','public.f2_importar_negocio(bigint)','EXECUTE')
  AND NOT has_function_privilege('authenticated','public.f2_importar_negocio(bigint)','EXECUTE')
  AND has_function_privilege('service_role','public.f2_importar_negocio(bigint)','EXECUTE'),
  '#f2-11 importação é exclusiva do serviço');
SELECT public.test_assert(
  (SELECT count(*) FROM public.f2_evento WHERE funil_lead_id=:'_f2_id')>=4,
  '#f2-12 importação, mudança, confirmação e releitura ficam auditadas');
