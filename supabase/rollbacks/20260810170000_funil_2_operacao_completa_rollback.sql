BEGIN;
DROP FUNCTION IF EXISTS public.f2_pescar_negocio(bigint,uuid);
DROP FUNCTION IF EXISTS public.f2_listar_aquario();
DROP FUNCTION IF EXISTS public.f2_salvar_negociacao(uuid,uuid,text,text,numeric,text);
DROP FUNCTION IF EXISTS public.f2_salvar_visita(uuid,uuid,timestamptz,text,text,text);
DROP FUNCTION IF EXISTS public.f2_configurar_momento(text,text,text,text,text,integer,integer,boolean,boolean);
DROP FUNCTION IF EXISTS public.f2_configurar_etapa(text,text,text,integer,boolean);
DROP TABLE IF EXISTS public.f2_config_audit;
DROP TABLE IF EXISTS public.f2_negociacao;
DROP TABLE IF EXISTS public.f2_visita;

-- O schema anterior aceita somente os quatro estágios e dez momentos
-- canônicos. Antes de restaurar os CHECKs antigos, normalize exclusivamente
-- as cópias do laboratório que estejam usando uma configuração criada nesta
-- versão. Nenhum objeto ncrm_*, negócio ou lead operacional é tocado.
UPDATE public.f2_lead
SET etapa = 'em_atendimento',
    momento_codigo = 'CONVERSANDO_QUALIFICANDO',
    acao_codigo = 'RESPONDER_E_QUALIFICAR',
    acao_rotulo = 'Responder e qualificar',
    proxima_acao_em = now() + interval '24 hours',
    versao = versao + 1,
    atualizado_em = now()
WHERE etapa NOT IN ('novo','tentando_contato','em_atendimento','pos_visita')
   OR momento_codigo NOT IN (
     'PRIMEIRA_ABORDAGEM','CADENCIA_SEM_RESPOSTA','CONVERSANDO_QUALIFICANDO',
     'PROCURANDO_PRODUTO','PRODUTO_ENVIADO','TENTANDO_AGENDAMENTO',
     'RETORNO_PROGRAMADO','COLETAR_FEEDBACK','REMARCAR_VISITA',
     'ACOMPANHAMENTO_POS_VISITA'
   );

DELETE FROM public.f2_momento_config
WHERE codigo NOT IN (
  'PRIMEIRA_ABORDAGEM','CADENCIA_SEM_RESPOSTA','CONVERSANDO_QUALIFICANDO',
  'PROCURANDO_PRODUTO','PRODUTO_ENVIADO','TENTANDO_AGENDAMENTO',
  'RETORNO_PROGRAMADO','COLETAR_FEEDBACK','REMARCAR_VISITA',
  'ACOMPANHAMENTO_POS_VISITA'
);

UPDATE public.f2_momento_config AS m
SET etapa=v.etapa, ordem=v.ordem, rotulo=v.rotulo, descricao=v.descricao,
    acao_codigo=v.acao_codigo, acao_rotulo=v.acao_rotulo,
    prazo_minutos=v.prazo_minutos, prazo_rotulo=v.prazo_rotulo,
    exige_dapi=v.exige_dapi, ativo=true
FROM (VALUES
  ('PRIMEIRA_ABORDAGEM','novo',1,'Primeira abordagem','O lead acabou de chegar. A primeira mensagem precisa ser confirmada pelo D-API.','PRIMEIRA_ABORDAGEM','Fazer a primeira abordagem',5,'5 minutos',true),
  ('CADENCIA_SEM_RESPOSTA','tentando_contato',2,'Cadência sem resposta','O cliente nunca respondeu. Siga somente os dias 1, 2, 4, 6 e 7.','ENVIAR_CADENCIA','Enviar a mensagem da cadência',1440,'dias 1, 2, 4, 6 e 7',true),
  ('CONVERSANDO_QUALIFICANDO','em_atendimento',3,'Conversando e qualificando','Mantenha a conversa viva e complete o perfil do cliente.','RESPONDER_E_QUALIFICAR','Responder e qualificar',1440,'24 horas',true),
  ('PROCURANDO_PRODUTO','em_atendimento',4,'Procurando produto','Encontre opções compatíveis com o que o cliente pediu.','PROCURAR_PRODUTO','Procurar imóveis compatíveis',1440,'24 horas',false),
  ('PRODUTO_ENVIADO','em_atendimento',5,'Produto enviado','Confirme o interesse nas opções e descubra o que precisa ser ajustado.','PEDIR_RETORNO_PRODUTO','Pedir retorno sobre as opções',1440,'24 horas',true),
  ('TENTANDO_AGENDAMENTO','em_atendimento',6,'Tentando agendamento','Converta o interesse em visita com data e hora.','AGENDAR_VISITA','Combinar data e horário da visita',720,'12 horas',true),
  ('RETORNO_PROGRAMADO','em_atendimento',7,'Retorno programado','Retome exatamente na data combinada; sem data, use cinco dias.','RETOMAR_NO_COMBINADO','Retomar no horário combinado',7200,'data combinada ou 5 dias',true),
  ('COLETAR_FEEDBACK','pos_visita',8,'Coletar feedback','Registre o resultado da visita e a reação do cliente.','REGISTRAR_FEEDBACK','Registrar feedback da visita',120,'2 horas após a visita',false),
  ('REMARCAR_VISITA','pos_visita',9,'Remarcar visita','Visita cancelada ou cliente ausente: combine uma nova data.','REMARCAR_VISITA','Remarcar a visita',720,'12 horas',true),
  ('ACOMPANHAMENTO_POS_VISITA','pos_visita',10,'Acompanhamento pós-visita','Transforme o feedback em nova opção, retorno ou proposta.','AVANCAR_POS_VISITA','Definir o próximo avanço',1440,'24 horas',true)
) AS v(codigo,etapa,ordem,rotulo,descricao,acao_codigo,acao_rotulo,prazo_minutos,prazo_rotulo,exige_dapi)
WHERE m.codigo=v.codigo;

ALTER TABLE public.f2_lead DROP CONSTRAINT IF EXISTS f2_lead_etapa_fkey;
ALTER TABLE public.f2_momento_config DROP CONSTRAINT IF EXISTS f2_momento_config_etapa_fkey;
DROP INDEX IF EXISTS public.f2_momento_etapa_ordem_uk;
DROP TABLE IF EXISTS public.f2_etapa_config;
ALTER TABLE public.f2_momento_config DROP CONSTRAINT IF EXISTS f2_momento_config_ordem_check;
ALTER TABLE public.f2_momento_config ADD CONSTRAINT f2_momento_config_etapa_check CHECK (etapa IN ('novo','tentando_contato','em_atendimento','pos_visita'));
ALTER TABLE public.f2_momento_config ADD CONSTRAINT f2_momento_config_ordem_check CHECK (ordem BETWEEN 1 AND 10);
ALTER TABLE public.f2_momento_config ADD CONSTRAINT f2_momento_config_ordem_key UNIQUE (ordem);
ALTER TABLE public.f2_lead ADD CONSTRAINT f2_lead_etapa_check CHECK (etapa IN ('novo','tentando_contato','em_atendimento','pos_visita'));
ALTER TABLE public.f2_momento_config DROP COLUMN IF EXISTS criado_em;
ALTER TABLE public.f2_momento_config DROP COLUMN IF EXISTS atualizado_em;
COMMIT;
