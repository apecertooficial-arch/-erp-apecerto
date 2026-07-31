-- Validacao do token de servico SEM expor o valor.
--
-- A tentacao seria criar uma view que devolve o token para a Edge Function
-- comparar. Isso poria o segredo em transito e numa view de public. Em vez
-- disso, a Edge manda o que recebeu e o banco responde apenas sim ou nao.
-- O token nunca sai do Vault.
--
-- A comparacao usa hash de tamanho fixo antes do teste de igualdade, para o
-- tempo de resposta nao depender de quantos caracteres iniciais coincidem.

CREATE OR REPLACE FUNCTION public.ncrm_envio_token_valido(p_token text)
RETURNS boolean
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $fn$
DECLARE v_esperado text;
BEGIN
  IF p_token IS NULL OR length(p_token) < 16 THEN RETURN false; END IF;

  SELECT decrypted_secret INTO v_esperado
    FROM vault.decrypted_secrets WHERE name = 'ncrm_envio_interno_token';

  IF v_esperado IS NULL THEN RETURN false; END IF;

  -- Compara digests: mesmo comprimento sempre, independente da entrada.
  RETURN extensions.digest(p_token, 'sha256') = extensions.digest(v_esperado, 'sha256');
EXCEPTION WHEN OTHERS THEN
  RETURN false;  -- fail-closed: duvida nao autoriza envio
END $fn$;

REVOKE ALL ON FUNCTION public.ncrm_envio_token_valido(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ncrm_envio_token_valido(text) TO service_role;

COMMENT ON FUNCTION public.ncrm_envio_token_valido(text) IS
  'Responde se o token de servico apresentado confere. Nunca devolve o valor esperado.';
