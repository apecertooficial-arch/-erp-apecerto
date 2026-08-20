create or replace function public.tracking_delivery_health(p_days integer default 30)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare v_since timestamptz := now() - make_interval(days => greatest(1, least(coalesce(p_days,30),365)));
declare v_result jsonb;
begin
  if not (
    auth.role() = 'service_role'
    or exists (
      select 1 from public.usuarios u
      where u.id = auth.uid() and u.ativo
        and u.role::text in ('admin','gerente','diretor','executivo')
    )
  ) then
    raise exception 'acesso_negado' using errcode='42501';
  end if;

  select jsonb_build_object(
    'total', count(*),
    'delivered', count(*) filter (where status='delivered'),
    'pending', count(*) filter (where status in ('pending','dispatched','sending')),
    'failed', count(*) filter (where status='failed'),
    'blocked', count(*) filter (where status='blocked'),
    'skipped', count(*) filter (where status='skipped'),
    'last_delivery_at', max(delivered_at),
    'last_error_at', max(updated_at) filter (where status in ('failed','blocked')),
    'last_error', (array_agg(last_error order by updated_at desc) filter (where status in ('failed','blocked')))[1],
    'by_channel', coalesce((
      select jsonb_object_agg(channel, payload)
      from (
        select channel, jsonb_build_object(
          'total',count(*),
          'delivered',count(*) filter (where status='delivered'),
          'pending',count(*) filter (where status in ('pending','dispatched','sending')),
          'failed',count(*) filter (where status='failed'),
          'blocked',count(*) filter (where status='blocked')
        ) payload
        from private.tracking_delivery_logs
        where created_at >= v_since
        group by channel
      ) channels
    ), '{}'::jsonb),
    'updated_at', now()
  ) into v_result
  from private.tracking_delivery_logs
  where created_at >= v_since;

  return v_result;
end;
$$;

revoke all on function public.tracking_delivery_health(integer) from public, anon, authenticated;
grant execute on function public.tracking_delivery_health(integer) to authenticated, service_role;

comment on function public.tracking_delivery_health(integer) is
  'Saúde agregada da outbox de mídia, sem PII e sem expor payloads.';
