-- Fecha duas RPCs que ficaram executaveis por qualquer usuario autenticado sem
-- nenhuma checagem de autorizacao. Achado da auditoria de seguranca apos a
-- aplicacao de 20260804100000 e 20260804100100.
--
-- ncrm_registrar_primeira_humana: e um caminho de SISTEMA. Quem a chama e a
-- reconciliacao do D-API, por cron, sob service_role. Concedida a authenticated,
-- qualquer usuario logado poderia avancar um card de 'novo' para
-- 'tentando_contato' passando um negocio_id arbitrario, gravando um evento
-- atribuido ao corretor daquele negocio. Nunca houve motivo para a UI chama-la.
--
-- ncrm_sara_organizar: hoje barra em 'sara_fora_de_assist' porque a Sara esta em
-- observer, entao a exposicao ainda nao e alcancavel. Passaria a ser no momento
-- em que o assist fosse ativado. Fechamos agora, antes de virar problema.
--
-- Padrao do ERP: RPC sensivel e chamada por rota server-side com service_role,
-- nunca direto do browser. Aditiva e reversivel: nenhum objeto e alterado, so
-- privilegios de execucao.

REVOKE EXECUTE ON FUNCTION public.ncrm_registrar_primeira_humana(bigint, text, timestamptz)
  FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.ncrm_registrar_primeira_humana(bigint, text, timestamptz)
  TO service_role;

REVOKE EXECUTE ON FUNCTION public.ncrm_sara_organizar(bigint, bigint)
  FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.ncrm_sara_organizar(bigint, bigint)
  TO service_role;

DO $v$
BEGIN
  IF has_function_privilege('authenticated',
       'public.ncrm_registrar_primeira_humana(bigint,text,timestamptz)', 'EXECUTE')
     OR has_function_privilege('authenticated',
       'public.ncrm_sara_organizar(bigint,bigint)', 'EXECUTE') THEN
    RAISE EXCEPTION 'ABORTADO: authenticated ainda executa uma das RPCs de sistema';
  END IF;
  RAISE NOTICE 'RPCs de sistema fechadas para authenticated';
END $v$;
