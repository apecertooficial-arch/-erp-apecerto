-- Regressão do defeito visto em produção: depois da primeira abordagem, uma
-- nova mensagem real do corretor precisa atualizar o estado e acordar a Sara.

UPDATE public.ncrm_estado SET
  etapa='em_atendimento',momento_codigo='CONVERSANDO_QUALIFICANDO',
  respondeu=true,resposta_pendente=true,
  proxima_acao_tipo='entender_necessidade',proxima_acao_titulo='Ação antiga',
  proxima_acao_em=now()-interval '2 hours',ultima_interacao_em=now()-interval '3 hours'
WHERE negocio_id=73002;

INSERT INTO public.wa_mensagens(id,wa_message_id,conversa_id,instancia_id,direcao,tipo,
  conteudo,raw,criado_em,enviado_em)
VALUES('dddddddd-0000-0000-0000-000000000011','MSG-CONT-1',
  'cccccccc-0000-0000-0000-000000000001','aaaaaaaa-0000-0000-0000-000000000001',
  'enviada','texto','Nova resposta do corretor','{"fromMe":true,"id":"MSG-CONT-1"}',
  now()-interval '1 minute',now()-interval '1 minute');

SELECT ncrm_private.reconciliar_mensagens(200);

SELECT public.test_assert((SELECT status='processado' AND motivo_final='saida_humana_continuidade'
  FROM public.ncrm_ingest_checkpoint WHERE wa_message_id='MSG-CONT-1'),
  '#cont1 nova saida humana e processada como continuidade');
SELECT public.test_assert((SELECT etapa='em_atendimento' AND momento_codigo='CONVERSANDO_QUALIFICANDO'
  FROM public.ncrm_estado WHERE negocio_id=73002),
  '#cont2 etapa e momento permanecem coerentes');
SELECT public.test_assert((SELECT NOT resposta_pendente AND ultima_interacao_em>=now()-interval '2 minutes'
  FROM public.ncrm_estado WHERE negocio_id=73002),
  '#cont3 resposta pendente e limpa e interacao e renovada');
SELECT public.test_assert((SELECT proxima_acao_titulo='Responder e qualificar'
  AND proxima_acao_em>now() FROM public.ncrm_estado WHERE negocio_id=73002),
  '#cont4 conduta oficial ganha novo prazo');
SELECT public.test_assert((SELECT primeira_saida_message_id='MSG-AUTO-1'
  FROM public.ncrm_estado WHERE negocio_id=73002),
  '#cont5 SLA da primeira abordagem nao e reescrito');
SELECT public.test_assert((SELECT count(*)=1 FROM public.ncrm_evento
  WHERE idempotency_key='humana:MSG-CONT-1' AND tipo='acao_comercial'
    AND resultado='saida_humana_confirmada'),
  '#cont6 continuidade gera um evento auditavel');

CREATE TEMP TABLE tst_cont_versao AS SELECT versao FROM public.ncrm_estado WHERE negocio_id=73002;
SELECT ncrm_private.reconciliar_mensagens(200);
SELECT public.test_assert((SELECT e.versao=t.versao FROM public.ncrm_estado e,tst_cont_versao t
  WHERE e.negocio_id=73002), '#cont7 reprocessamento e idempotente');

-- Prazos com data exata não podem ser deslocados por uma mensagem de contexto.
UPDATE public.ncrm_estado SET momento_codigo='RETORNO_PROGRAMADO',
  proxima_acao_tipo='retornar_contato',proxima_acao_titulo='Retomar no combinado',
  proxima_acao_em=now()+interval '3 days',resposta_pendente=true
WHERE negocio_id=73002;
CREATE TEMP TABLE tst_cont_prazo AS SELECT proxima_acao_em FROM public.ncrm_estado WHERE negocio_id=73002;
INSERT INTO public.wa_mensagens(id,wa_message_id,conversa_id,instancia_id,direcao,tipo,
  conteudo,raw,criado_em,enviado_em)
VALUES('dddddddd-0000-0000-0000-000000000012','MSG-CONT-2',
  'cccccccc-0000-0000-0000-000000000001','aaaaaaaa-0000-0000-0000-000000000001',
  'enviada','texto','Combinado, retorno na data','{"fromMe":true,"id":"MSG-CONT-2"}',
  now(),now());
SELECT ncrm_private.reconciliar_mensagens(200);
SELECT public.test_assert((SELECT e.proxima_acao_em=t.proxima_acao_em
  FROM public.ncrm_estado e,tst_cont_prazo t WHERE e.negocio_id=73002),
  '#cont8 retorno programado preserva data e hora exatas');
SELECT public.test_assert(NOT has_function_privilege('authenticated',
  'ncrm_private.registrar_saida_humana_continuidade(bigint,bigint,bigint,bigint,integer,text,text,timestamptz)','EXECUTE'),
  '#cont9 helper nao e executavel por authenticated');
