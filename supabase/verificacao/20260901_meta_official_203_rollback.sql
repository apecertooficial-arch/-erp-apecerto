-- ROLLBACK MANUAL — NAO EXECUTAR JUNTO COM O ROLLOUT.
-- Lote: meta_official_203_20260901_v1
-- Aborta se qualquer um dos 15 leads mudou depois do snapshot final.

begin;
set local lock_timeout='5s';
set local statement_timeout='120s';
select pg_advisory_xact_lock(hashtextextended('meta_official_203_20260901_v1',0));

select 1
from private.lead_attribution_patch_audit
where batch_id='meta_official_203_20260901_v1'
for update;

do $rollback_checks$
declare
  v_new_id bigint;
begin
  if (select count(*) from private.lead_attribution_patch_audit
      where batch_id='meta_official_203_20260901_v1')<>15
     or (select count(*) from private.meta_lead_submissions
         where recovery_batch='meta_official_203_20260901_v1')<>203 then
    raise exception 'ROLLBACK_SNAPSHOT_COUNT_CHANGED';
  end if;

  if exists(
    select 1
    from private.lead_attribution_patch_audit a
    join public.leads l on l.id=a.lead_id
    left join private.lead_attribution t on t.lead_id=l.id
    where a.batch_id='meta_official_203_20260901_v1'
      and a.before_snapshot->>'after_checksum' is distinct from
        encode(extensions.digest(
          coalesce(l.extras,'{}'::jsonb)::text||'|'||
          coalesce(to_jsonb(t),'{}'::jsonb)::text,
          'sha256'
        ),'hex')
  ) then raise exception 'ROLLBACK_CONCURRENT_CHANGE_DETECTED'; end if;

  select lead_id into v_new_id
  from private.lead_attribution_patch_audit
  where batch_id='meta_official_203_20260901_v1'
    and coalesce((before_snapshot->>'created_by_recovery')::boolean,false);

  if v_new_id is null
     or exists(select 1 from public.leads where id=v_new_id and (corretor_id is not null or pipeline_id is not null))
     or exists(select 1 from public.negocios where lead_id=v_new_id)
     or exists(select 1 from public.lead_produtos where lead_id=v_new_id)
     or exists(select 1 from public.crm_atividades where lead_id=v_new_id)
     or exists(select 1 from public.crm_tarefas where lead_id=v_new_id)
     or exists(select 1 from public.mensagens_agendadas where lead_id=v_new_id)
     or exists(select 1 from public.f2_carga_lead where lead_id=v_new_id)
     or exists(select 1 from public.motor_fila where lead @> jsonb_build_object('id',v_new_id))
     or (select count(*) from public.perf_eventos where lead_id=v_new_id)<>1
     or not exists(select 1 from public.perf_eventos where lead_id=v_new_id and tipo='lead_criado' and origem='trigger') then
    raise exception 'ROLLBACK_NEW_LEAD_HAS_OPERATIONAL_ACTIVITY';
  end if;
end
$rollback_checks$;

delete from private.meta_lead_submissions
where recovery_batch='meta_official_203_20260901_v1';

delete from private.lead_attribution t
using private.lead_attribution_patch_audit a
where a.batch_id='meta_official_203_20260901_v1'
  and t.lead_id=a.lead_id;

insert into private.lead_attribution
select (jsonb_populate_record(
  null::private.lead_attribution,
  a.before_snapshot->'previous_attribution'
)).*
from private.lead_attribution_patch_audit a
where a.batch_id='meta_official_203_20260901_v1'
  and a.before_snapshot->'previous_attribution' is not null;

update public.leads l
set extras=a.before_snapshot->'previous_extras'
from private.lead_attribution_patch_audit a
where a.batch_id='meta_official_203_20260901_v1'
  and not coalesce((a.before_snapshot->>'created_by_recovery')::boolean,false)
  and l.id=a.lead_id;

delete from public.perf_eventos p
using private.lead_attribution_patch_audit a
where a.batch_id='meta_official_203_20260901_v1'
  and coalesce((a.before_snapshot->>'created_by_recovery')::boolean,false)
  and p.lead_id=a.lead_id
  and p.tipo='lead_criado'
  and p.origem='trigger';

delete from public.leads l
using private.lead_attribution_patch_audit a
where a.batch_id='meta_official_203_20260901_v1'
  and coalesce((a.before_snapshot->>'created_by_recovery')::boolean,false)
  and l.id=a.lead_id;

update private.lead_attribution_patch_audit
set rolled_back_at=now()
where batch_id='meta_official_203_20260901_v1';

commit;
