-- Limpeza controlada de objetos explicitamente desativados em 2026-08-14.
-- Mantém um arquivo técnico restaurável no schema privado antes de excluir.

create table if not exists ncrm_private.erp_cleanup_archive (
  id bigint generated always as identity primary key,
  batch text not null,
  entity_type text not null,
  entity_id text not null,
  source_table text not null,
  data jsonb not null,
  archived_at timestamptz not null default now(),
  unique (batch, source_table, entity_id)
);

revoke all on table ncrm_private.erp_cleanup_archive from public, anon, authenticated;
grant select, insert on table ncrm_private.erp_cleanup_archive to service_role;

do $cleanup$
declare
  v_batch constant text := 'desativados_20260814';
begin
  -- Automações: todas estavam inativas; filas existentes eram apenas ok/erro históricos.
  insert into ncrm_private.erp_cleanup_archive(batch,entity_type,entity_id,source_table,data)
  select v_batch,'automacao',id::text,'automacoes',to_jsonb(a)
  from public.automacoes a where id in (41,45,50,63)
  on conflict do nothing;

  insert into ncrm_private.erp_cleanup_archive(batch,entity_type,entity_id,source_table,data)
  select v_batch,'automacao',id::text,'automacao_versoes',to_jsonb(v)
  from public.automacao_versoes v where automacao_id in (41,45,50,63)
  on conflict do nothing;

  insert into ncrm_private.erp_cleanup_archive(batch,entity_type,entity_id,source_table,data)
  select v_batch,'automacao',id::text,'motor_fila',to_jsonb(f)
  from public.motor_fila f where automacao_id in (41,45,50,63)
  on conflict do nothing;

  delete from public.motor_fila where automacao_id in (41,45,50,63);
  delete from public.automacao_versoes where automacao_id in (41,45,50,63);
  delete from public.automacoes where id in (41,45,50,63) and ativa=false;

  -- Agentes arquivados: o arquivo inclui filhos que seriam removidos por CASCADE.
  insert into ncrm_private.erp_cleanup_archive(batch,entity_type,entity_id,source_table,data)
  select v_batch,'agente',id::text,'agentes_ia',to_jsonb(a)
  from public.agentes_ia a where id in (6,8,9,10,11,12,13,14) and ativo=false
  on conflict do nothing;

  insert into ncrm_private.erp_cleanup_archive(batch,entity_type,entity_id,source_table,data)
  select v_batch,'agente',id::text,'agente_versoes',to_jsonb(x) from public.agente_versoes x where agente_id in (6,8,9,10,11,12,13,14)
  on conflict do nothing;
  insert into ncrm_private.erp_cleanup_archive(batch,entity_type,entity_id,source_table,data)
  select v_batch,'agente',id::text,'agente_cenarios',to_jsonb(x) from public.agente_cenarios x where agente_id in (6,8,9,10,11,12,13,14)
  on conflict do nothing;
  insert into ncrm_private.erp_cleanup_archive(batch,entity_type,entity_id,source_table,data)
  select v_batch,'agente',id::text,'agente_avaliacoes',to_jsonb(x) from public.agente_avaliacoes x where agente_id in (6,8,9,10,11,12,13,14)
  on conflict do nothing;
  insert into ncrm_private.erp_cleanup_archive(batch,entity_type,entity_id,source_table,data)
  select v_batch,'agente',concat(agente_id,':',fonte_id),'agente_fonte_links',to_jsonb(x) from public.agente_fonte_links x where agente_id in (6,8,9,10,11,12,13,14)
  on conflict do nothing;
  insert into ncrm_private.erp_cleanup_archive(batch,entity_type,entity_id,source_table,data)
  select v_batch,'agente',concat(agente_id,':',ferramenta_id),'agente_ferramenta_permissoes',to_jsonb(x) from public.agente_ferramenta_permissoes x where agente_id in (6,8,9,10,11,12,13,14)
  on conflict do nothing;
  insert into ncrm_private.erp_cleanup_archive(batch,entity_type,entity_id,source_table,data)
  select v_batch,'agente',id::text,'agente_auditoria',to_jsonb(x) from public.agente_auditoria x where agente_id in (6,8,9,10,11,12,13,14)
  on conflict do nothing;
  insert into ncrm_private.erp_cleanup_archive(batch,entity_type,entity_id,source_table,data)
  select v_batch,'agente',id::text,'agente_execucoes',to_jsonb(x) from public.agente_execucoes x where agente_id in (6,8,9,10,11,12,13,14)
  on conflict do nothing;

  delete from public.agentes_ia
  where id in (6,8,9,10,11,12,13,14) and ativo=false and status='arquivado';
end
$cleanup$;
