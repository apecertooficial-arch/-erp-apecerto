-- Fase 0: f2_sara_alertar_checkpoint_nao_executado grava execution_id, coluna que nao existia.
-- Resultado: 223 itens do motor em erro em 7 dias. Coluna nullable, sem impacto em quem nao usa.
alter table public.ncrm_notificacao add column if not exists execution_id bigint;
create index if not exists ncrm_notificacao_execution_id_idx on public.ncrm_notificacao (execution_id) where execution_id is not null;
comment on column public.ncrm_notificacao.execution_id is 'Execucao do motor que originou o alerta (f2_sara_analise.evento_execution_id).';
