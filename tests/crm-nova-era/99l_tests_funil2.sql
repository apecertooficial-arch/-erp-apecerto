-- Funil 2.0: laboratório fisicamente isolado e limitado a duas cópias.
-- O primeiro fixture simula um estado antigo sem momento explícito. Ele é
-- autocontido para não depender de negócios removidos por rollbacks anteriores.
INSERT INTO public.leads(id,nome,telefone)
VALUES(71992,'Lead legado sem momento','11999997192') ON CONFLICT(id) DO NOTHING;
INSERT INTO public.negocios(id,lead_id,corretor_id,status,pipeline_id,stage_id)
VALUES(71992,71992,71991,'aberto',2,20) ON CONFLICT(id) DO NOTHING;
INSERT INTO public.leads(id,nome,telefone)
VALUES(71993,'Lead pescado simples','11999997193') ON CONFLICT(id) DO NOTHING;
INSERT INTO public.negocios(id,lead_id,corretor_id,status,pipeline_id,stage_id)
VALUES(71993,71993,71991,'aberto',2,20) ON CONFLICT(id) DO NOTHING;
INSERT INTO public.ncrm_estado(
  negocio_id,workflow_config_id,etapa,momento_codigo,respondeu,resposta_pendente,
  proxima_acao_tipo,proxima_acao_titulo,proxima_acao_em,origem_ultima
)
SELECT 71992,id,'tentando_contato',NULL,false,false,
  'tentativa_cadencia','Enviar cadência',now()+interval '1 day','usuario'
FROM public.ncrm_workflow_config WHERE status='publicada' ORDER BY versao DESC LIMIT 1
ON CONFLICT(negocio_id) DO UPDATE SET momento_codigo=NULL,etapa='tentando_contato';
INSERT INTO public.ncrm_estado(
  negocio_id,workflow_config_id,etapa,momento_codigo,respondeu,resposta_pendente,
  primeira_resposta_em,proxima_acao_tipo,proxima_acao_titulo,proxima_acao_em,origem_ultima
)
SELECT 71993,id,'em_atendimento','CONVERSANDO_QUALIFICANDO',true,true,
  now(),'entender_necessidade','Entender necessidade',now()+interval '1 day','usuario'
FROM public.ncrm_workflow_config WHERE status='publicada' ORDER BY versao DESC LIMIT 1
ON CONFLICT(negocio_id) DO UPDATE SET
  momento_codigo='CONVERSANDO_QUALIFICANDO',
  etapa='em_atendimento',
  respondeu=true,
  resposta_pendente=true,
  primeira_resposta_em=coalesce(public.ncrm_estado.primeira_resposta_em,now());
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

SELECT set_config('request.jwt.claims','{"sub":"aaaaaaaa-0000-0000-0000-000000000001","role":"authenticated"}',false);
SET ROLE authenticated;
SELECT public.test_assert((public.f2_configurar_etapa('relacionamento','Relacionamento','Etapa criada pelo administrador',5,true)->>'ok')::boolean,
  '#f2-16 administrador cria etapa configurável');
SELECT public.test_assert((public.f2_configurar_momento('NUTRICAO','relacionamento','Nutrição','Manter contato útil','Enviar conteúdo relevante',2880,1,true,true)->>'ok')::boolean,
  '#f2-17 administrador cria momento com ação e prazo próprios');
SELECT public.test_assert((SELECT prazo_minutos FROM public.f2_momento_config WHERE codigo='NUTRICAO')=2880,
  '#f2-18 horas configuradas persistem como prazo oficial');
SELECT public.test_assert((public.f2_salvar_visita(NULL,:'_f2_id',now()+interval '1 day','Apartamento laboratório','agendada',NULL)->>'ok')::boolean,
  '#f2-19 Pipe de Visitas recebe compromisso ligado à cópia');
SELECT public.test_assert((public.f2_salvar_negociacao(NULL,:'_f2_id','Oportunidade laboratório','qualificacao',500000,NULL)->>'ok')::boolean,
  '#f2-20 Esteira recebe negociação ligada à cópia');
SELECT public.test_assert((SELECT count(*) FROM public.f2_lead)=2,
  '#f2-21 configurações, visita e negociação preservam limite de duas cópias');
SELECT public.f2_pescar_negocio(71993,NULL) AS _f2_pesca_simples \gset
SELECT public.test_assert((:'_f2_pesca_simples'::jsonb->>'ok')::boolean,
  '#f2-23 pesca simples não exige escolher cópia para substituir');
SELECT public.test_assert((SELECT count(*) FROM public.f2_lead)=2
  AND (SELECT count(*) FROM public.f2_lead WHERE origem_negocio_id=71993)=1
  AND (SELECT count(*) FROM public.f2_lead WHERE origem_negocio_id IN(71991,71992))=1,
  '#f2-24 pesca mantém duas cópias e substitui silenciosamente somente a mais antiga');
SELECT public.test_assert((SELECT etapa='novo'
    AND momento_codigo='PRIMEIRA_ABORDAGEM'
    AND acao_codigo='PRIMEIRA_ABORDAGEM'
    AND cadencia_passo=0
    AND ultima_acao_confirmada_em IS NULL
  FROM public.f2_lead WHERE origem_negocio_id=71993),
  '#f2-25 lead pescado entra em Novo e Primeira abordagem com estado limpo');
SELECT public.test_assert((SELECT proxima_acao_em BETWEEN now()+interval '4 minutes' AND now()+interval '6 minutes'
  FROM public.f2_lead WHERE origem_negocio_id=71993),
  '#f2-26 primeira abordagem vence em cinco minutos');
SELECT public.test_assert(EXISTS(SELECT 1 FROM public.negocios WHERE id=71993)
  AND EXISTS(SELECT 1 FROM public.leads WHERE id=71993),
  '#f2-27 pesca preserva lead e negócio originais');
SELECT public.test_assert(EXISTS(SELECT 1 FROM public.f2_config_audit
    WHERE tipo='pesca' AND chave='71993' AND acao='pescar_lead'),
  '#f2-28 substituição automática fica auditada');
RESET ROLE;

SELECT public.test_assert(
  NOT has_table_privilege('anon','public.f2_etapa_config','SELECT')
  AND NOT has_table_privilege('anon','public.f2_visita','SELECT')
  AND NOT has_table_privilege('anon','public.f2_negociacao','SELECT')
  AND NOT has_function_privilege('anon','public.f2_configurar_etapa(text,text,text,integer,boolean)','EXECUTE')
  AND NOT has_function_privilege('anon','public.f2_salvar_visita(uuid,uuid,timestamptz,text,text,text)','EXECUTE'),
  '#f2-22 anon não tem privilégios na configuração, Pipe nem Esteira');
