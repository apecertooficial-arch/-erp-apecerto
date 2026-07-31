-- Remove apenas o validador. O segredo no Vault nao e tocado: rollback de
-- codigo nao apaga credencial em uso.
DROP FUNCTION IF EXISTS public.ncrm_envio_token_valido(text);
