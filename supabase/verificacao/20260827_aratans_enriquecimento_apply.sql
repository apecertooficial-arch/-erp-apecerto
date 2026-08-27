begin;
set local lock_timeout = '5s';
set local statement_timeout = '30s';
select pg_advisory_xact_lock(hashtextextended('ciclo3_aratans_20260827', 0));

create temp table aratans_mapping on commit drop as
select
  a.ad_id,
  min(a.campaign_id) as campaign_id,
  min(a.adset_id) as adset_id,
  min(a.campaign) filter (where a.campaign is not null) as campaign,
  count(distinct a.campaign_id) as campaign_count,
  count(distinct a.adset_id) as adset_count
from private.lead_attribution a
where a.ad_id = '120253551407240616'
  and a.campaign_id is not null
  and a.adset_id is not null
group by a.ad_id;

create temp table aratans_before on commit drop as
select lead_id, campaign, campaign_id, adset_id, first_touch, last_touch, updated_at
from private.lead_attribution
where ad_id = '120253551407240616'
  and meta_lead_id is not null
  and (campaign_id is null or adset_id is null)
for update;

do $preconditions$
declare
  v_missing integer;
  v_campaign_count integer;
  v_adset_count integer;
begin
  select count(*) into v_missing from aratans_before;
  select campaign_count, adset_count
    into v_campaign_count, v_adset_count
  from aratans_mapping
  where ad_id = '120253551407240616';

  if exists (
    select 1 from private.lead_attribution_patch_audit
    where batch_id = 'ciclo3_aratans_20260827'
  ) then
    raise exception 'ABORTADO: batch de auditoria já existe';
  end if;
  if v_missing <> 6 then
    raise exception 'ABORTADO: esperados 6 registros incompletos; encontrados %', v_missing;
  end if;
  if coalesce(v_campaign_count, 0) <> 1 or coalesce(v_adset_count, 0) <> 1 then
    raise exception 'ABORTADO: ad_id sem hierarquia 1:1 comprovada';
  end if;
end
$preconditions$;

insert into private.lead_attribution_patch_audit (
  batch_id, lead_id, reason, before_snapshot
)
select
  'ciclo3_aratans_20260827',
  b.lead_id,
  'Enriquecimento determinístico campaign/adset por ad_id 1:1',
  jsonb_build_object(
    'campaign', b.campaign,
    'campaign_id', b.campaign_id,
    'adset_id', b.adset_id,
    'first_touch', b.first_touch,
    'last_touch', b.last_touch,
    'updated_at', b.updated_at
  )
from aratans_before b;

do $snapshot$
begin
  if (select count(*) from private.lead_attribution_patch_audit
      where batch_id = 'ciclo3_aratans_20260827') <> 6 then
    raise exception 'ABORTADO: snapshot não contém exatamente 6 linhas';
  end if;
end
$snapshot$;

update private.lead_attribution a
set
  campaign = coalesce(a.campaign, m.campaign),
  campaign_id = m.campaign_id,
  adset_id = m.adset_id,
  last_touch = coalesce(a.last_touch, '{}'::jsonb) || jsonb_build_object(
    'campaign', coalesce(a.campaign, m.campaign),
    'campaign_id', m.campaign_id,
    'adset_id', m.adset_id,
    'ad_id', a.ad_id
  ),
  first_touch = case
    when a.first_touch->>'ad_id' = a.ad_id then
      coalesce(a.first_touch, '{}'::jsonb) || jsonb_build_object(
        'campaign', coalesce(a.campaign, m.campaign),
        'campaign_id', m.campaign_id,
        'adset_id', m.adset_id,
        'ad_id', a.ad_id
      )
    else a.first_touch
  end,
  updated_at = now()
from aratans_mapping m
join aratans_before b on true
where a.lead_id = b.lead_id
  and a.ad_id = m.ad_id
  and (a.campaign_id is null or a.adset_id is null);

do $verification$
begin
  if (
    select count(*)
    from private.lead_attribution a
    join private.lead_attribution_patch_audit h on h.lead_id = a.lead_id
    where h.batch_id = 'ciclo3_aratans_20260827'
      and a.campaign_id = '120253551407260616'
      and a.adset_id = '120253551407250616'
  ) <> 6 then
    raise exception 'ABORTADO: verificação posterior diferente de 6';
  end if;
end
$verification$;

commit;

select
  count(*)::int as auditados,
  count(*) filter (
    where a.campaign_id = '120253551407260616'
      and a.adset_id = '120253551407250616'
  )::int as enriquecidos,
  count(*) filter (
    where a.campaign_id is distinct from '120253551407260616'
       or a.adset_id is distinct from '120253551407250616'
  )::int as divergencias
from private.lead_attribution_patch_audit h
join private.lead_attribution a on a.lead_id = h.lead_id
where h.batch_id = 'ciclo3_aratans_20260827';
