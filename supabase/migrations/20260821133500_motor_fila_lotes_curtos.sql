begin;

-- A IA faz chamadas externas. Limitar cada pulso evita que uma recuperação
-- extensa retenha a fila e atrase eventos novos de mensagem por vários minutos.
create or replace function public.motor_processar_fila()
returns integer
language plpgsql
security definer
set search_path=''
as $fn$
declare
  r record; n integer:=0; claimed integer; v_ok boolean; v_erro text; v_delay integer;
begin
  for r in
    select id,automacao_id,automacao_versao_id,bloco_id,lead,tentativas
      from public.motor_fila
     where status='pendente' and due_at<=now()
     order by
       case when lead->>'__motor_priority' ~ '^[0-9]+$'
         then (lead->>'__motor_priority')::integer else 10 end,
       due_at,id
     limit 10 for update skip locked
  loop
    select a.ativa is true and a.status='publicado'
           and not coalesce(a.arquivada,false)
      into v_ok from public.automacoes a where a.id=r.automacao_id;
    if coalesce(v_ok,false) is not true then
      update public.motor_fila
         set status='cancelado',processado_em=now(),ultimo_erro='AUTOMATION_NOT_RUNNABLE'
       where id=r.id;
      continue;
    end if;

    update public.motor_fila
       set status='processando',tentativas=tentativas+1,ultimo_erro=null
     where id=r.id and status='pendente';
    get diagnostics claimed=row_count;
    if claimed=0 then continue; end if;

    begin
      perform public.motor_rodar(
        r.automacao_id,
        (r.lead-'__automacao_versao_id')||
          jsonb_build_object('__automacao_versao_id',r.automacao_versao_id),
        nullif(r.bloco_id,'START'),case when r.bloco_id='START' then 0 else 1 end
      );
      update public.motor_fila
         set status='ok',processado_em=now(),ultimo_erro=null where id=r.id;
    exception when others then
      v_erro:=left(sqlstate||': '||sqlerrm,1000);
      if sqlerrm like 'AUTOMATION_RETRY:%' and r.tentativas<5 then
        v_delay:=least(900,(30*power(2,least(r.tentativas,5)))::integer);
        update public.motor_fila
           set status='pendente',due_at=now()+make_interval(secs=>v_delay),
               processado_em=null,ultimo_erro=v_erro where id=r.id;
        insert into public.motor_execucoes(
          automacao_id,automacao_nome,bloco_id,evento,status,
          lead_nome,lead_telefone,detalhe
        ) values(
          r.automacao_id,(select a.nome from public.automacoes a where a.id=r.automacao_id),
          r.bloco_id,'fila','alerta',r.lead->>'nome',r.lead->>'telefone',
          'Retry '||(r.tentativas+1)||'/5 em '||v_delay||'s: '||left(v_erro,180)
        );
      else
        update public.motor_fila
           set status='erro',processado_em=now(),ultimo_erro=v_erro where id=r.id;
        insert into public.motor_execucoes(
          automacao_id,automacao_nome,bloco_id,evento,status,
          lead_nome,lead_telefone,detalhe
        ) values(
          r.automacao_id,(select a.nome from public.automacoes a where a.id=r.automacao_id),
          r.bloco_id,'fila','erro',r.lead->>'nome',r.lead->>'telefone',
          'Execucao encerrada sem presumir sucesso: '||left(v_erro,240)
        );
      end if;
    end;
    n:=n+1;
  end loop;
  return n;
end
$fn$;

revoke all on function public.motor_processar_fila()
  from public,anon,authenticated;
grant execute on function public.motor_processar_fila() to service_role;

commit;
