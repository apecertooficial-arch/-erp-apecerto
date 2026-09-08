-- Mantem o vinculo canonico site_leads -> leads -> negocios quando a
-- automacao cria ou reutiliza um negocio para um lead originado no site.

begin;

create or replace function private.sync_site_lead_negocio()
returns trigger
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_site_lead_raw text;
  v_site_lead_id uuid;
begin
  select nullif(l.extras->>'site_lead_id', '')
    into v_site_lead_raw
    from public.leads l
   where l.id = new.lead_id;

  if v_site_lead_raw is null then
    return new;
  end if;

  begin
    v_site_lead_id := v_site_lead_raw::uuid;
  exception when invalid_text_representation then
    return new;
  end;

  update public.site_leads s
     set crm_lead_id = coalesce(s.crm_lead_id, new.lead_id),
         crm_negocio_id = new.id,
         crm_synced_at = coalesce(s.crm_synced_at, now()),
         crm_sync_error = null
   where s.id = v_site_lead_id
     and s.crm_negocio_id is null
     and (s.crm_lead_id is null or s.crm_lead_id = new.lead_id);

  return new;
end
$function$;

revoke all on function private.sync_site_lead_negocio()
  from public, anon, authenticated;

drop trigger if exists trg_negocio_site_lead_linkage on public.negocios;
create trigger trg_negocio_site_lead_linkage
after insert or update of ultima_movimentacao on public.negocios
for each row execute function private.sync_site_lead_negocio();

-- Os 15 registros existentes sao todos inequivocos: possuem um unico
-- negocio ou exatamente um negocio aberto. Casos ambiguos ficam intocados.
with candidatos as (
  select
    s.id as site_lead_id,
    count(n.id) as total_negocios,
    count(n.id) filter (where n.status = 'aberto') as negocios_abertos,
    max(n.id) filter (where n.status = 'aberto') as negocio_aberto_id,
    max(n.id) as negocio_unico_id
  from public.site_leads s
  join public.negocios n on n.lead_id = s.crm_lead_id
  where s.crm_lead_id is not null
    and s.crm_negocio_id is null
  group by s.id
), inequivocos as (
  select
    site_lead_id,
    case
      when negocios_abertos = 1 then negocio_aberto_id
      when total_negocios = 1 then negocio_unico_id
    end as negocio_id
  from candidatos
  where negocios_abertos = 1 or total_negocios = 1
)
update public.site_leads s
   set crm_negocio_id = i.negocio_id,
       crm_synced_at = coalesce(s.crm_synced_at, now()),
       crm_sync_error = null
  from inequivocos i
 where s.id = i.site_lead_id
   and i.negocio_id is not null;

do $verify$
begin
  if not exists (
    select 1
      from pg_trigger t
      join pg_class c on c.oid = t.tgrelid
      join pg_namespace n on n.oid = c.relnamespace
     where n.nspname = 'public'
       and c.relname = 'negocios'
       and t.tgname = 'trg_negocio_site_lead_linkage'
       and not t.tgisinternal
  ) then
    raise exception 'SITE_NEGOCIO_LINKAGE_TRIGGER_MISSING';
  end if;

  if exists (
    select 1
      from public.site_leads s
     where s.crm_lead_id is not null
       and s.crm_negocio_id is null
       and exists (
         select 1 from public.negocios n where n.lead_id = s.crm_lead_id
       )
  ) then
    raise exception 'SITE_NEGOCIO_LINKAGE_BACKFILL_INCOMPLETE';
  end if;
end
$verify$;

commit;
