-- Rollback de 20260917160000_fase3_site_lead_protegido.
-- ANTES: reverter o analytics.js do site para o POST anon (ou garantir que a
-- Edge Function site-lead não está em uso). O caminho anon nunca foi removido.

drop policy if exists site_leads_insert_anon_tipos on public.site_leads;

drop function if exists public.site_lead_ingest(
  uuid, text, text, text, text, text, text, uuid, uuid, text, text, uuid, jsonb, jsonb
);
drop function if exists private.site_lead_rate_take(text, text, integer, integer);

delete from private.site_financing_lead_rate_usage where scope in ('lead_ip', 'lead_phone');
alter table private.site_financing_lead_rate_usage
  drop constraint if exists site_financing_lead_rate_usage_scope_check;
alter table private.site_financing_lead_rate_usage
  add constraint site_financing_lead_rate_usage_scope_check
  check (scope = any (array['ip', 'client']));

drop index if exists public.site_leads_request_id_key;
alter table public.site_leads drop column if exists request_id;
