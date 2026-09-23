-- Um lote Sara em processamento pode receber outro lote pendente para o mesmo
-- card. Se o lease expirar, devolver o primeiro a pendente viola o indice unico.
-- Consolida as mensagens no lote pendente antes de cancelar o lease antigo.
create or replace function private.motor_dispatcher_recuperar_leases(
  p_limite integer default 20
)
returns integer
language plpgsql
security definer
set search_path=''
as $function$
declare
  v_antigo public.motor_fila%rowtype;
  v_pendente public.motor_fila%rowtype;
  v_recuperados integer:=0;
begin
  for v_antigo in
    select * from public.motor_fila
     where status='processando'
       and worker_id is not null
       and lease_ate<clock_timestamp()
     order by lease_ate,id
     limit greatest(1,least(coalesce(p_limite,20),100))
     for update skip locked
  loop
    if not pg_try_advisory_xact_lock(private.motor_dispatcher_item_lock(v_antigo.id)) then
      continue;
    end if;

    if v_antigo.lead->>'__sara_batch'='true'
       and nullif(v_antigo.lead->>'__funil_lead_id','') is not null then
      select * into v_pendente from public.motor_fila
       where automacao_id=v_antigo.automacao_id
         and status='pendente'
         and lead->>'__sara_batch'='true'
         and lead->>'__funil_lead_id'=v_antigo.lead->>'__funil_lead_id'
       order by id limit 1 for update;
    else
      v_pendente.id:=null;
    end if;

    if v_pendente.id is not null then
      update public.motor_fila
         set lead=lead||jsonb_build_object(
           '__sara_message_ids',coalesce(v_antigo.lead->'__sara_message_ids','[]'::jsonb)
             ||coalesce(lead->'__sara_message_ids','[]'::jsonb),
           '__sara_event_types',coalesce(v_antigo.lead->'__sara_event_types','[]'::jsonb)
             ||coalesce(lead->'__sara_event_types','[]'::jsonb),
           '__sara_message_count',
             coalesce(nullif(v_antigo.lead->>'__sara_message_count','')::integer,0)
             +coalesce(nullif(lead->>'__sara_message_count','')::integer,0),
           '__sara_first_message_at',coalesce(
             v_antigo.lead->'__sara_first_message_at',lead->'__sara_first_message_at')
         )
       where id=v_pendente.id and status='pendente';

      update private.sara_evento_mensagem
         set fila_id=v_pendente.id
       where fila_id=v_antigo.id;

      update public.motor_fila
         set status='cancelado',processado_em=clock_timestamp(),
             worker_id=null,lease_token=null,lease_ate=null,worker_heartbeat_em=null,
             ultimo_erro='LEASE_EXPIRED_MERGED_INTO_PENDING_BATCH'
       where id=v_antigo.id and status='processando';
    else
      update public.motor_fila
         set status='pendente',worker_id=null,lease_token=null,lease_ate=null,
             worker_heartbeat_em=null,processado_em=null,
             ultimo_erro='LEASE_EXPIRED_RECOVERED: execução anterior sem confirmação'
       where id=v_antigo.id and status='processando';
    end if;
    v_recuperados:=v_recuperados+1;
  end loop;
  return v_recuperados;
end
$function$;

revoke all on function private.motor_dispatcher_recuperar_leases(integer)
  from public,anon,authenticated;
