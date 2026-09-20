alter table public.f2_config_audit drop constraint f2_config_audit_tipo_check;
alter table public.f2_config_audit add constraint f2_config_audit_tipo_check
  check (tipo = any (array['etapa','momento','visita','negociacao','pesca','migracao','carteira_antiga']));
