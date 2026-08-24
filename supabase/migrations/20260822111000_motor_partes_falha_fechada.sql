-- Uma parte posterior nunca fica pendente para sempre. Recusa definitiva da
-- parte anterior fecha a sequencia; falhas transitorias continuam no backoff.
do $patch$
declare
  v_def text;
  v_novo text;
begin
  select pg_get_functiondef('private.motor_despachar_parte(bigint)'::regprocedure)
    into v_def;
  if md5(v_def)<>'f6ac2fb00d24aa0f1054515c1e4a5d7e' then
    raise exception 'motor_despachar_parte mudou: %',md5(v_def);
  end if;
  v_novo:=replace(
    v_def,
    $old$    return jsonb_build_object('ok',false,'erro','HTTP_'||v_resp.status);
  end if;$old$,
    $new$    if v_resp.status not in (408,409,425,429)
       and v_resp.status not between 500 and 599 then
      update public.motor_mensagem_partes p
         set status='erro',
             erro='Parte anterior recusada definitivamente [HTTP '||v_resp.status||']'
       where p.execution_id=v_parte.execution_id
         and p.automacao_id=v_parte.automacao_id
         and p.bloco_id=v_parte.bloco_id
         and p.parte>v_parte.parte
         and p.status='pendente';
    end if;
    return jsonb_build_object('ok',false,'erro','HTTP_'||v_resp.status);
  end if;$new$
  );
  if v_novo=v_def then raise exception 'ancora HTTP nao encontrada'; end if;
  execute v_novo;
end
$patch$;

do $patch$
declare
  v_def text;
  v_novo text;
begin
  select pg_get_functiondef(
    'private.motor_reprocessar_mensagens_recusadas(integer)'::regprocedure
  ) into v_def;
  if md5(v_def)<>'9b1237785f6bc746646b010875a6452b' then
    raise exception 'motor_reprocessar_mensagens_recusadas mudou: %',md5(v_def);
  end if;
  v_novo:=replace(
    v_def,
    $old$    if coalesce((v_resultado->>'ok')::boolean,false) then
      v_recuperadas := v_recuperadas+1;
      update public.motor_mensagem_partes
         set proxima_tentativa_em=null
       where id=r.id;
    end if;$old$,
    $new$    if coalesce((v_resultado->>'ok')::boolean,false) then
      v_recuperadas := v_recuperadas+1;
      update public.motor_mensagem_partes
         set proxima_tentativa_em=null
       where id=r.id;
    elsif exists(
      select 1 from public.motor_mensagem_partes p
       where p.id=r.id and p.status='erro' and p.retentativas_transporte>=5
    ) then
      update public.motor_mensagem_partes p
         set status='erro',erro='Parte anterior esgotou as retentativas de transporte'
       where p.execution_id=(select x.execution_id from public.motor_mensagem_partes x where x.id=r.id)
         and p.automacao_id=(select x.automacao_id from public.motor_mensagem_partes x where x.id=r.id)
         and p.bloco_id=(select x.bloco_id from public.motor_mensagem_partes x where x.id=r.id)
         and p.parte>(select x.parte from public.motor_mensagem_partes x where x.id=r.id)
         and p.status='pendente';
    end if;$new$
  );
  if v_novo=v_def then raise exception 'ancora de retentativa nao encontrada'; end if;
  execute v_novo;
end
$patch$;
