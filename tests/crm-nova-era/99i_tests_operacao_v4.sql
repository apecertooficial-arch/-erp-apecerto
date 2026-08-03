-- Quatro etapas, dez momentos, roleta e visita como visão paralela.
SELECT public.test_assert((SELECT count(*) FROM public.ncrm_momento_padrao WHERE ativo)=10,
  '#v4-01 catálogo possui dez momentos ativos');
SELECT public.test_assert((SELECT count(DISTINCT etapa) FROM public.ncrm_momento_padrao WHERE ativo)=4,
  '#v4-02 dez momentos vivem dentro de quatro etapas');
SELECT public.test_assert((SELECT count(*) FROM public.ncrm_acao_padrao WHERE ativa)=10,
  '#v4-03 catálogo possui dez ações oficiais');
SELECT public.test_assert((public.ncrm_conduta_oficial_v4('tentando_contato','CADENCIA_SEM_RESPOSTA',false,false,2,now())->>'acao')='Enviar cadência 3 de 5',
  '#v4-04 cadência informa o passo exato');
SELECT public.test_assert((public.ncrm_conduta_oficial_v4('em_atendimento','BUSCANDO_PRODUTO',true,false,1,now())->>'acao_codigo')='BUSCAR_E_ENVIAR_IMOVEIS',
  '#v4-05 momento determina uma única ação');

INSERT INTO public.usuarios(id,nome,email,role,ativo) VALUES
 ('aaaaaaaa-0000-0000-0000-000000000091','Corretor V4','v4@test.local','corretor',true)
ON CONFLICT(id) DO NOTHING;
INSERT INTO public.corretores(id,usuario_id,ativo,nome,online,no_escritorio,ultima_presenca)
VALUES(71991,'aaaaaaaa-0000-0000-0000-000000000091',true,'Corretor V4',true,true,'2026-08-03 13:00-03')
ON CONFLICT(id) DO UPDATE SET nome=excluded.nome,online=true,no_escritorio=true,ultima_presenca=excluded.ultima_presenca;
INSERT INTO public.instancias(id,nome,corretor_id,ativa,conectada,status_dapi)
VALUES(71991,'V4',71991,true,true,'connected') ON CONFLICT(id) DO UPDATE SET conectada=true,status_dapi='connected';
INSERT INTO public.corretor_presencas(corretor_id,dia) VALUES(71991,'2026-08-03') ON CONFLICT DO NOTHING;

SELECT public.test_assert((public.ncrm_corretor_elegibilidade(71991,'2026-08-03 13:05-03')->>'elegivel')::boolean,
  '#v4-06 horário oficial exige e aceita presença recente e D-API');
UPDATE public.instancias SET conectada=false,status_dapi='disconnected' WHERE id=71991;
SELECT public.test_assert(NOT (public.ncrm_corretor_elegibilidade(71991,'2026-08-03 13:05-03')->>'elegivel')::boolean
  AND public.ncrm_corretor_elegibilidade(71991,'2026-08-03 13:05-03')->>'motivo'='dapi_desconectada',
  '#v4-07 D-API desconectada bloqueia novo lead');
UPDATE public.instancias SET conectada=true,status_dapi='connected' WHERE id=71991;
UPDATE public.corretores SET online=false,no_escritorio=false,ultima_presenca='2026-08-03 18:00-03' WHERE id=71991;
SELECT public.test_assert((public.ncrm_corretor_elegibilidade(71991,'2026-08-03 21:00-03')->>'elegivel')::boolean
  AND public.ncrm_corretor_elegibilidade(71991,'2026-08-03 21:00-03')->>'cobranca_5min'='false',
  '#v4-08 depois do expediente quem compareceu recebe sem cobrança de cinco minutos');
SELECT public.test_assert(
  public.ncrm_primeira_abordagem_prazo('2026-08-03 21:00-03')='2026-08-04 09:30-03'::timestamptz
  AND public.ncrm_primeira_abordagem_prazo('2026-08-03 10:00-03')='2026-08-03 10:05-03'::timestamptz,
  '#v4-08b lead remoto fica disponível, mas o prazo oficial começa às 09h30');

SELECT public.test_assert(position('NCRM31_ELEGIBILIDADE_E_DAPI' in pg_get_functiondef('public.motor_roleta(bigint,text,text,jsonb,bigint,bigint,jsonb,boolean,boolean,jsonb)'::regprocedure))>0
  AND position('_fallback := true; _cands := _cands_all;' in pg_get_functiondef('public.motor_roleta(bigint,text,text,jsonb,bigint,bigint,jsonb,boolean,boolean,jsonb)'::regprocedure))=0,
  '#v4-09 roleta não possui fallback para corretor inelegível/desconectado');
SELECT public.test_assert(position('NCRM31_AQUARIO_ELEGIVEL' in pg_get_functiondef('public.aquario_pescar()'::regprocedure))>0
  AND position('NCRM31_AQUARIO_ELEGIVEL' in pg_get_functiondef('public.pescar_lead_aquario(bigint)'::regprocedure))>0,
  '#v4-10 Aquário usa a mesma elegibilidade da roleta');
SELECT public.test_assert(position('NCRM31_SLA_SOMENTE_OFICIAL' in pg_get_functiondef('ncrm_private.sla_redistribuir(integer)'::regprocedure))>0,
  '#v4-11 redistribuição de cinco minutos só existe no horário oficial');

-- Visita: o negócio não troca de pipeline e o atendimento continua no funil.
INSERT INTO public.leads(id,nome) VALUES(71991,'Lead Visita V4') ON CONFLICT(id) DO NOTHING;
INSERT INTO public.negocios(id,lead_id,corretor_id,status,pipeline_id,stage_id)
VALUES(71991,71991,71991,'aberto',2,20) ON CONFLICT(id) DO NOTHING;
INSERT INTO public.ncrm_estado(negocio_id,workflow_config_id,etapa,momento_codigo,respondeu,resposta_pendente,
  primeira_resposta_em,proxima_acao_tipo,proxima_acao_titulo,proxima_acao_em,origem_ultima)
SELECT 71991,id,'em_atendimento','TENTANDO_AGENDAMENTO',true,false,now(),'agendar_visita','Agendar uma visita',now(),'usuario'
FROM public.ncrm_workflow_config WHERE status='publicada' ORDER BY versao DESC LIMIT 1
ON CONFLICT(negocio_id) DO NOTHING;
SELECT set_config('request.jwt.claims',json_build_object('sub','aaaaaaaa-0000-0000-0000-000000000091','role','authenticated')::text,false);
SET ROLE authenticated;
SELECT public.ncrm_agendar_visita_e_encaminhar(71991,1,71991,'2030-08-03','14:00',NULL,'Produto V4',false,NULL,'v4:visita:1');
RESET ROLE;
SELECT public.test_assert((SELECT pipeline_id=2 AND stage_id=20 FROM public.negocios WHERE id=71991)
  AND (SELECT saida IS NULL AND etapa='em_atendimento' AND momento_codigo='VISITA_AGENDADA' AND visita_id IS NOT NULL FROM public.ncrm_estado WHERE negocio_id=71991),
  '#v4-12 visita aparece em Visitas sem retirar o atendimento do funil');

SELECT set_config('request.jwt.claims',json_build_object('sub','aaaaaaaa-0000-0000-0000-000000000091','role','authenticated')::text,false);
SET ROLE authenticated;
SELECT public.ncrm_registrar_resultado_visita(
  (SELECT visita_id FROM public.ncrm_estado WHERE negocio_id=71991),71991,2,'interessado','gostou','v4:visita:resultado');
RESET ROLE;
SELECT public.test_assert((SELECT etapa='em_acompanhamento' AND momento_codigo='DECISAO_POS_VISITA' AND saida IS NULL FROM public.ncrm_estado WHERE negocio_id=71991),
  '#v4-13 visita realizada leva ao Pós-visita com próxima decisão');

SELECT public.test_assert(NOT has_function_privilege('anon','public.ncrm_atualizar_momento(bigint,integer,text,text)','EXECUTE')
  AND has_function_privilege('authenticated','public.ncrm_atualizar_momento(bigint,integer,text,text)','EXECUTE'),
  '#v4-14 atualização de momento exige sessão autenticada');

-- Sara organiza Momento + Ação + Prazo pelo runner, sem executar a obrigação.
INSERT INTO public.ncrm_sara_analise(negocio_id,origem,ator,run_id,context_hash,
  etapa_atual,etapa_sugerida,proxima_acao_sugerida,prazo_sugerido,justificativa,
  evidencias,confianca,versao_prompt,versao_modelo,modo,analisado_em)
VALUES(71991,'sara_runner','sara_runner',gen_random_uuid(),'v4-sara-auto-71991',
  'em_acompanhamento','em_acompanhamento','Definir o avanço pós-visita',now()+interval '24 hours',
  'O cliente concluiu a visita e precisa definir o próximo passo.',
  '["visita concluída; cliente avaliando a próxima opção"]'::jsonb,.94,'sara-conduta-v4','ia-router','observer',now())
RETURNING id AS _v4_analise \gset
SELECT set_config('request.jwt.claims','{"role":"service_role"}',false);
SET ROLE service_role;
SELECT public.ncrm_sara_aplicar_conduta_automatica(
  71991,:_v4_analise,'DECISAO_POS_VISITA','AVANCAR_POS_VISITA');
RESET ROLE;
SELECT public.test_assert((SELECT momento_codigo='DECISAO_POS_VISITA'
    AND proxima_acao_titulo='Definir o avanço pós-visita'
    AND proxima_acao_origem='sara' FROM public.ncrm_estado WHERE negocio_id=71991)
  AND EXISTS(SELECT 1 FROM public.ncrm_evento WHERE negocio_id=71991
    AND idempotency_key='sara:auto:'||:_v4_analise AND origem='sara'
    AND coalesce((payload->>'executou_acao_comercial')::boolean,false)=false),
  '#v4-15 Sara determina e grava a conduta sem executar ação comercial');
SELECT public.test_assert(
  NOT has_function_privilege('anon','public.ncrm_sara_aplicar_conduta_automatica(bigint,bigint,text,text)','EXECUTE')
  AND NOT has_function_privilege('authenticated','public.ncrm_sara_aplicar_conduta_automatica(bigint,bigint,text,text)','EXECUTE')
  AND has_function_privilege('service_role','public.ncrm_sara_aplicar_conduta_automatica(bigint,bigint,text,text)','EXECUTE'),
  '#v4-16 organizador automático da Sara é exclusivo do serviço');
