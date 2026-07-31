-- Remove o resolvedor de instancia. Sem ele, dapi-enviar e enviar-whatsapp
-- recebem erro na RPC e param de enviar para chamada de pessoa (fail-closed).
DROP FUNCTION IF EXISTS public.ncrm_resolver_envio_autorizado(uuid,text,bigint);

-- A tabela de auditoria NAO e removida de proposito: ela guarda o historico de
-- decisoes de autorizacao, que e justamente o que se quer consultar depois de
-- um incidente. A reaplicacao usa CREATE TABLE IF NOT EXISTS e reaproveita.
