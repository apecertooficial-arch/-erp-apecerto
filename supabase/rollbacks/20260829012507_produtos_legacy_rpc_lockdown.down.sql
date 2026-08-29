-- Rollback temporário e específico; preservar a RPC canônica.
grant execute on function public.produto_unidade_definir_disponibilidade(uuid,uuid,boolean) to authenticated;
grant execute on function public.produto_unidade_excluir(uuid,uuid) to authenticated;
