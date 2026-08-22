-- Índice solicitado pelo advisor para o vínculo de auditoria do alerta.
create index if not exists central_alerta_acoes_atualizado_por_idx
  on public.central_alerta_acoes (atualizado_por);
