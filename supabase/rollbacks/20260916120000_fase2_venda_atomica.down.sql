-- Desfaz 20260916120000_fase2_venda_atomica.
-- ATENÇÃO: antes de rodar, volte a rota app/api/finance/route.ts para a versão
-- anterior (createSale/deleteSale tabela a tabela); senão lançar e apagar venda
-- passam a responder 503 ("financeiro está sendo atualizado").
-- A coluna vendas.request_id só guarda a chave de idempotência; apagá-la não
-- perde dado de negócio.

drop function if exists public.venda_criar(jsonb);
drop function if exists public.venda_excluir(uuid);
drop index if exists public.vendas_request_id_key;
alter table public.vendas drop column if exists request_id;

notify pgrst, 'reload schema';
