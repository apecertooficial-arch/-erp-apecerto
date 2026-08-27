-- CICLO 3 — DRY-RUN REVERSÍVEL: enriquecimento dos seis Aratans.
-- NÃO aplicar como migração. Este arquivo sempre termina em ROLLBACK.
-- Não expõe lead, telefone, e-mail ou meta_lead_id nos relatórios.

begin;
set local lock_timeout = '5s';
set local statement_timeout = '30s';

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

do $preconditions$
declare
  v_missing integer;
  v_campaign_count integer;
  v_adset_count integer;
begin
  select count(*) into v_missing
  from private.lead_attribution
  where ad_id = '120253551407240616'
    and meta_lead_id is not null
    and (campaign_id is null or adset_id is null);

  select campaign_count, adset_count
    into v_campaign_count, v_adset_count
  from aratans_mapping
  where ad_id = '120253551407240616';

  if v_missing <> 6 then
    raise exception 'ABORTADO: esperados 6 registros incompletos; encontrados %', v_missing;
  end if;
  if coalesce(v_campaign_count, 0) <> 1 or coalesce(v_adset_count, 0) <> 1 then
    raise exception 'ABORTADO: ad_id sem hierarquia 1:1 comprovada (campanhas %, conjuntos %)',
      coalesce(v_campaign_count, 0), coalesce(v_adset_count, 0);
  end if;
end
$preconditions$;

create temp table aratans_before on commit drop as
select lead_id, campaign, campaign_id, adset_id, first_touch, last_touch, updated_at
from private.lead_attribution
where ad_id = '120253551407240616'
  and meta_lead_id is not null
  and (campaign_id is null or adset_id is null)
for update;

-- Relatório anterior sanitizado.
select
  count(*)::bigint as candidatos,
  count(*) filter (where campaign_id is null)::bigint as sem_campaign_id,
  count(*) filter (where adset_id is null)::bigint as sem_adset_id
from aratans_before;

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

-- Relatório posterior sanitizado; deve retornar 6 alterados e zero incompletos.
select
  count(*)::bigint as alterados,
  count(*) filter (where a.campaign_id is null)::bigint as ainda_sem_campaign_id,
  count(*) filter (where a.adset_id is null)::bigint as ainda_sem_adset_id,
  count(*) filter (
    where a.campaign_id is distinct from m.campaign_id
       or a.adset_id is distinct from m.adset_id
  )::bigint as divergencias_da_hierarquia_unica
from private.lead_attribution a
join aratans_before b on b.lead_id = a.lead_id
join aratans_mapping m on m.ad_id = a.ad_id;

-- Obrigatório: nenhuma mudança persiste durante o dry-run.
rollback;
