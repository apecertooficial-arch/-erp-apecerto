-- Cutover de seguranca da presenca.
-- Aplicar somente depois que a Edge Function `presenca` e a aplicacao que a
-- consome estiverem publicadas. Separar o cutover evita qualquer janela em que
-- o aplicativo atual fique sem conseguir confirmar corretores no escritorio.

BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';

-- Fecha os RPCs antigos: o booleano de escritorio era fornecido pelo cliente.
REVOKE ALL ON FUNCTION public.presenca_confirmar() FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.presenca_confirmar(boolean) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.presenca_confirmar(boolean,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.presenca_confirmar() TO service_role;
GRANT EXECUTE ON FUNCTION public.presenca_confirmar(boolean) TO service_role;
GRANT EXECUTE ON FUNCTION public.presenca_confirmar(boolean,text) TO service_role;

REVOKE ALL ON FUNCTION public.registrar_presenca(uuid,boolean)
  FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.registrar_presenca(uuid,boolean) TO service_role;

-- A lista de IPs deixa de ser editavel por qualquer usuario autenticado.
DROP POLICY IF EXISTS escritorio_all ON public.escritorio_config;
DROP POLICY IF EXISTS escritorio_select_gestao ON public.escritorio_config;
DROP POLICY IF EXISTS escritorio_insert_gestao ON public.escritorio_config;
DROP POLICY IF EXISTS escritorio_update_gestao ON public.escritorio_config;
DROP POLICY IF EXISTS escritorio_delete_gestao ON public.escritorio_config;
CREATE POLICY escritorio_select_gestao ON public.escritorio_config
  FOR SELECT TO authenticated USING ((SELECT public.can_manage_all()));
CREATE POLICY escritorio_insert_gestao ON public.escritorio_config
  FOR INSERT TO authenticated WITH CHECK ((SELECT public.can_manage_all()));
CREATE POLICY escritorio_update_gestao ON public.escritorio_config
  FOR UPDATE TO authenticated USING ((SELECT public.can_manage_all()))
  WITH CHECK ((SELECT public.can_manage_all()));
CREATE POLICY escritorio_delete_gestao ON public.escritorio_config
  FOR DELETE TO authenticated USING ((SELECT public.can_manage_all()));

DO $check$
BEGIN
  IF has_function_privilege('authenticated','public.presenca_confirmar()','EXECUTE')
     OR has_function_privilege('authenticated','public.presenca_confirmar(boolean)','EXECUTE')
     OR has_function_privilege('authenticated','public.presenca_confirmar(boolean,text)','EXECUTE')
     OR has_function_privilege('anon','public.presenca_confirmar(boolean,text)','EXECUTE')
     OR has_function_privilege('authenticated','public.registrar_presenca(uuid,boolean)','EXECUTE') THEN
    RAISE EXCEPTION 'confirmacao_de_presenca_insegura_ainda_exposta';
  END IF;

  IF NOT has_function_privilege(
    'service_role','public.presenca_registrar_segura(uuid,boolean,text)','EXECUTE'
  ) THEN RAISE EXCEPTION 'edge_sem_permissao_para_confirmar_presenca'; END IF;
END
$check$;

COMMIT;
