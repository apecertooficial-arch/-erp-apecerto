-- Indices da fila temporaria apontados pelo advisor do Supabase.

create index if not exists f2_dist_programada_funil_lead_idx
  on ncrm_private.f2_distribuicao_programada (funil_lead_id);

create index if not exists f2_dist_programada_lead_idx
  on ncrm_private.f2_distribuicao_programada (lead_id);

create index if not exists f2_dist_programada_negocio_idx
  on ncrm_private.f2_distribuicao_programada (negocio_id);

create index if not exists f2_dist_programada_corretor_idx
  on ncrm_private.f2_distribuicao_programada (corretor_id);

create index if not exists f2_dist_programada_fila_idx
  on ncrm_private.f2_distribuicao_programada (programa, status, programado_para);

