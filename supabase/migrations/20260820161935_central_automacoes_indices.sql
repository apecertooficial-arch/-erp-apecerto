create index if not exists automacao_eventos_entrada_fila_id_idx
  on public.automacao_eventos_entrada(fila_id)
  where fila_id is not null;
