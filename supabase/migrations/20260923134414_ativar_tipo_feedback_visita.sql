-- O gatilho ncrm_notificacao_filtrar descarta em silencio tipos fora desta lista.
-- Ativar a cobranca in-app criada na migration 20260923133937.
insert into public.ncrm_notificacao_tipos_ativos (tipo, motivo)
values ('visita_feedback_pendente', 'Cobrar resultado de visita sem feedback completo')
on conflict (tipo) do nothing;
