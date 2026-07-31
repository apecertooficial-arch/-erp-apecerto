-- Rollback fail-closed.
--
-- A versao anterior de processar_agendadas chamava dapi-enviar SEM credencial
-- nenhuma. Restaura-la seria reabrir o caminho que esta migration fechou.
-- Em vez disso, o rollback deixa a fila inerte: ela nao envia e diz por que.
-- Nenhuma mensagem se perde — os registros continuam pendentes na tabela.
CREATE OR REPLACE FUNCTION public.processar_agendadas()
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
begin
  raise warning 'processar_agendadas: rollback aplicado; fila suspensa ate reaplicar a migration de autenticacao';
  return 0;
end $function$;

REVOKE ALL ON FUNCTION public.processar_agendadas() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.processar_agendadas() TO service_role;
