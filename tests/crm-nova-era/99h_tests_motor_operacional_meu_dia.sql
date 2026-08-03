SELECT public.test_assert((SELECT count(*) FROM public.ncrm_momento_padrao WHERE ativo)=4,
  '#mo1 existem somente quatro momentos comerciais');
SELECT public.test_assert((SELECT count(*) FROM public.ncrm_acao_padrao WHERE ativa)=10,
  '#mo2 existem somente dez ações oficiais ativas');
SELECT public.test_assert((public.ncrm_conduta_oficial('novo',false,false,0,'tentativa_cadencia','Primeira abordagem',now())->>'acao_codigo')='PRIMEIRA_ABORDAGEM',
  '#mo3 novo exige primeira abordagem');
SELECT public.test_assert((public.ncrm_conduta_oficial('tentando_contato',false,false,2,'tentativa_cadencia','Cadência',now())->>'acao')='Enviar cadência 3 de 6',
  '#mo4 tentando contato indica a cadência exata');
SELECT public.test_assert((public.ncrm_conduta_oficial('em_atendimento',true,true,1,'outro','texto livre',now())->>'acao_codigo')='RESPONDER_CLIENTE',
  '#mo5 cliente aguardando sempre exige resposta antes de qualquer interpretação');
SELECT public.test_assert((public.ncrm_conduta_oficial('em_atendimento',true,false,1,'enviar_opcoes','Buscar outro imóvel',now())->>'acao_codigo')='BUSCAR_E_ENVIAR_IMOVEIS',
  '#mo6 pedido de imóvel entra na ação oficial de busca e envio');
SELECT public.test_assert(NOT has_function_privilege('anon','public.ncrm_sara_aplicar_proxima_acao(bigint,bigint,text)','EXECUTE')
  AND has_function_privilege('authenticated','public.ncrm_sara_aplicar_proxima_acao(bigint,bigint,text)','EXECUTE'),
  '#mo7 aplicação da Sara é autenticada e não é pública');
SELECT public.test_assert(NOT has_function_privilege('authenticated','public.ncrm_conduta_oficial(text,boolean,boolean,integer,text,text,timestamptz)','EXECUTE'),
  '#mo8 helper interno não pode ser explorado diretamente pelo cliente');

