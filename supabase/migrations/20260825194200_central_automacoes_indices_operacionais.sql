-- Índices de cobertura para as relações usadas pelo motor de automações.
-- São aditivos e não alteram mapas, versões publicadas ou itens da fila.

create index if not exists automacoes_versao_publicada_automacao_idx
  on public.automacoes (versao_publicada_id, id)
  where versao_publicada_id is not null;

create index if not exists motor_fila_automacao_id_idx
  on public.motor_fila (automacao_id)
  where automacao_id is not null;

create index if not exists motor_fila_automacao_versao_id_idx
  on public.motor_fila (automacao_versao_id)
  where automacao_versao_id is not null;
