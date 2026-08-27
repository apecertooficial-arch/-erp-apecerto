-- Rollback manual do apêcerto Studio. NÃO executar automaticamente.
-- Preserva objetos do bucket `social-studio` para permitir recuperação de mídia.
begin;

drop trigger if exists social_product_changed on public.empreendimentos;
drop trigger if exists social_unit_changed on public.unidades;
drop trigger if exists social_media_changed on public.midias;
drop trigger if exists social_membership_after_user on public.usuarios;

drop policy if exists social_storage_select on storage.objects;
drop policy if exists social_storage_insert on storage.objects;
drop policy if exists social_storage_update_derivatives on storage.objects;
drop policy if exists social_storage_delete_derivatives on storage.objects;

drop function if exists public.social_refresh_campaign_snapshot(uuid);
drop function if exists public.social_prepare_publication(uuid);
drop function if exists public.social_schedule_piece(uuid,timestamptz,text);
drop function if exists public.social_retry_job(uuid);
drop function if exists public.social_enqueue_job(uuid,uuid,uuid,text,jsonb,text);
drop function if exists public.social_approve_piece_version(uuid,text,text);
drop function if exists public.social_create_campaign_from_product(text,text,text,date,date,text);
drop function if exists public.social_current_piece_approved(uuid);
drop function if exists public.social_mark_product_changed();
drop function if exists public.social_service_claim_render_job(text,uuid);
drop function if exists public.social_service_complete_render_job(uuid,text,jsonb);
drop function if exists public.social_service_fail_render_job(uuid,text,text,text,boolean);
drop function if exists public.social_service_store_meta_token(uuid,text,jsonb,timestamptz);
drop function if exists public.social_service_read_meta_token(uuid);
drop function if exists public.social_service_disconnect_meta(uuid);

drop table if exists public.social_meta_oauth_states;
drop table if exists public.social_publications;
drop table if exists public.social_schedules;
drop table if exists public.social_approvals;
drop table if exists public.social_generation_jobs;
alter table if exists public.social_pieces drop constraint if exists social_pieces_current_version_id_fkey;
drop table if exists public.social_piece_versions;
drop table if exists public.social_pieces;
drop table if exists public.social_template_slots;
drop table if exists public.social_template_versions;
drop table if exists public.social_templates;
drop table if exists public.social_asset_derivatives;
drop table if exists public.social_assets;
drop table if exists public.social_briefs;
alter table if exists public.social_campaigns drop constraint if exists social_campaigns_snapshot_atual_id_fkey;
drop table if exists public.social_product_snapshots;
drop table if exists public.social_campaigns;
drop table if exists public.social_budgets;
drop table if exists public.social_integrations;
drop table if exists public.social_audit_events;
drop table if exists public.social_memberships;
drop table if exists public.social_organizations;

drop function if exists public.social_audit_row();
drop function if exists public.social_protect_template_version();
drop function if exists public.social_prevent_immutable_update();
drop function if exists public.social_set_updated_at();
drop function if exists public.social_has_permission(text,uuid);

commit;
