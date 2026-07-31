-- =============================================================================
-- Infraestrutura do Supabase que o Postgres puro do harness nao tem.
--
-- O QUE ISTO COBRE: que as migrations de envio compilam e se aplicam — tipos,
-- assinaturas, REVOKE/GRANT, dollar quoting, search_path. Ate agora elas nunca
-- passaram pelo harness, e a primeira execucao ja acusou 'schema extensions
-- does not exist'.
--
-- O QUE ISTO NAO COBRE: comportamento de rede e criptografia real do Vault.
-- Isso nao e testavel em Postgres efemero de jeito nenhum, e fingir que e seria
-- pior do que nao testar.
--
-- extensions.http() lanca excecao DE PROPOSITO: nenhum teste deve conseguir
-- fazer uma chamada externa. Se alguma migration tentar enviar mensagem durante
-- o harness, o teste quebra alto em vez de sair mandando WhatsApp.
-- =============================================================================

CREATE SCHEMA IF NOT EXISTS extensions;
CREATE SCHEMA IF NOT EXISTS vault;

DO $t$ BEGIN
  CREATE TYPE extensions.http_header AS (field text, value text);
EXCEPTION WHEN duplicate_object THEN NULL; END $t$;

DO $t$ BEGIN
  CREATE TYPE extensions.http_request AS (
    method text, uri text, headers extensions.http_header[],
    content_type text, content text);
EXCEPTION WHEN duplicate_object THEN NULL; END $t$;

DO $t$ BEGIN
  CREATE TYPE extensions.http_response AS (
    status integer, content_type text, headers extensions.http_header[], content text);
EXCEPTION WHEN duplicate_object THEN NULL; END $t$;

CREATE OR REPLACE FUNCTION extensions.http_header(field text, value text)
RETURNS extensions.http_header LANGUAGE sql IMMUTABLE AS
$f$ SELECT ROW(field, value)::extensions.http_header $f$;

CREATE OR REPLACE FUNCTION extensions.http(request extensions.http_request)
RETURNS extensions.http_response LANGUAGE plpgsql AS $f$
BEGIN
  RAISE EXCEPTION 'harness: rede bloqueada; nenhuma chamada HTTP sai do teste';
END $f$;

CREATE OR REPLACE FUNCTION extensions.digest(p_dado text, p_algo text)
RETURNS bytea LANGUAGE sql IMMUTABLE AS
$f$ SELECT sha256(convert_to(p_dado, 'UTF8')) $f$;

-- Em producao e uma view sobre o Vault. Aqui, tabela vazia: sem segredo
-- cadastrado, processar_agendadas se recusa a enviar, que e o comportamento
-- que queremos ver exercitado.
CREATE TABLE IF NOT EXISTS vault.decrypted_secrets (
  name text PRIMARY KEY,
  decrypted_secret text
);

-- ---------------------------------------------------------------------------
-- public.wa_instancias: espelho das sessoes da D-API. E esta que wa_mensagens
-- referencia (instancia_id uuid), nao public.instancias (id bigint, cadastro do
-- ERP). A confirmacao de primeira saida humana usa este vinculo para garantir
-- que a conversa saiu do telefone do corretor daquele negocio.
CREATE TABLE IF NOT EXISTS public.wa_instancias (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id   text NULL,
  corretor_id  bigint NULL,
  telefone     text NULL,
  status       text NULL
);
