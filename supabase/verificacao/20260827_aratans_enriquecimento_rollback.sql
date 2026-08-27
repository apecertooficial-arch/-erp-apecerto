begin;
set local lock_timeout = '5s';
set local statement_timeout = '30s';
select pg_advisory_xact_lock(hashtextextended('ciclo3_aratans_20260827', 0));

do $preconditions$
begin
  if (
    select count(*) from private.lead_attribution_patch_audit
    where batch_id = 'ciclo3_aratans_20260827'
      and rolled_back_at is null
  ) <> 6 then
    raise exception 'ABORTADO: rollback exige exatamente 6 snapshots ativos';
  end if;
end
$preconditions$;

update private.lead_attribution a
set
  campaign = h.before_snapshot->>'campaign',
  campaign_id = h.before_snapshot->>'campaign_id',
  adset_id = h.before_snapshot->>'adset_id',
  first_touch = h.before_snapshot->'first_touch',
  last_touch = h.before_snapshot->'last_touch',
  updated_at = (h.before_snapshot->>'updated_at')::timestamptz
from private.lead_attribution_patch_audit h
where h.batch_id = 'ciclo3_aratans_20260827'
  and h.rolled_back_at is null
  and a.lead_id = h.lead_id;

update private.lead_attribution_patch_audit
set rolled_back_at = now()
where batch_id = 'ciclo3_aratans_20260827'
  and rolled_back_at is null;

commit;

select
  count(*)::int as restaurados,
  count(*) filter (where campaign_id is null)::int as novamente_sem_campaign,
  count(*) filter (where adset_id is null)::int as novamente_sem_adset
from private.lead_attribution
where lead_id in (
  select lead_id from private.lead_attribution_patch_audit
  where batch_id = 'ciclo3_aratans_20260827'
);
