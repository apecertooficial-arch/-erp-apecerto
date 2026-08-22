-- O bloco seguinte so pode iniciar depois que a ultima parte da abordagem
-- receber confirmacao real de envio da D-API.

alter table public.motor_mensagem_partes
  add column if not exists continuacao_bloco_id text,
  add column if not exists continuacao_contexto jsonb,
  add column if not exists continuacao_depth integer,
  add column if not exists continuacao_em timestamptz,
  add column if not exists continuacao_erro text;

alter table public.motor_mensagem_partes
  add constraint motor_mensagem_partes_continuacao_depth_check
  check(continuacao_depth is null or continuacao_depth between 0 and 200);

create or replace function private.motor_continuar_apos_mensagem(p_parte_id bigint)
returns jsonb
language plpgsql
security definer
set search_path='pg_catalog','public','private'
as $function$
declare
  v_ultima public.motor_mensagem_partes%rowtype;
  v_trace text;
begin
  select p.* into v_ultima
    from public.motor_mensagem_partes p
   where p.execution_id=(select execution_id from public.motor_mensagem_partes where id=p_parte_id)
     and p.automacao_id=(select automacao_id from public.motor_mensagem_partes where id=p_parte_id)
     and p.bloco_id=(select bloco_id from public.motor_mensagem_partes where id=p_parte_id)
   order by p.parte desc
   limit 1
   for update;
  if not found then
    return jsonb_build_object('ok',false,'erro','PARTE_INEXISTENTE');
  end if;
  if exists(
    select 1 from public.motor_mensagem_partes p
     where p.execution_id=v_ultima.execution_id
       and p.automacao_id=v_ultima.automacao_id
       and p.bloco_id=v_ultima.bloco_id
       and p.status not in ('enviada','entregue','lida')
  ) then
    return jsonb_build_object('ok',true,'status','aguardando_partes');
  end if;
  if v_ultima.continuacao_em is not null then
    return jsonb_build_object('ok',true,'status','continuada','idempotente',true);
  end if;
  if nullif(v_ultima.continuacao_bloco_id,'') is null then
    update public.motor_mensagem_partes
       set continuacao_em=now(),continuacao_erro=null
     where id=v_ultima.id;
    return jsonb_build_object('ok',true,'status','fluxo_encerrado');
  end if;

  begin
    v_trace:=public.motor_rodar(
      v_ultima.automacao_id,
      coalesce(v_ultima.continuacao_contexto,'{}'::jsonb)
        - '__motor_next_block_id' - '__motor_next_depth',
      v_ultima.continuacao_bloco_id,
      coalesce(v_ultima.continuacao_depth,0)
    );
    update public.motor_mensagem_partes
       set continuacao_em=now(),continuacao_erro=null
     where id=v_ultima.id;
    return jsonb_build_object('ok',true,'status','continuada','trace',v_trace);
  exception when others then
    update public.motor_mensagem_partes
       set continuacao_erro=left(sqlerrm,1000)
     where id=v_ultima.id;
    return jsonb_build_object('ok',false,'erro','CONTINUACAO_FALHOU','detalhe',left(sqlerrm,300));
  end;
end
$function$;

revoke all on function private.motor_continuar_apos_mensagem(bigint)
  from public,anon,authenticated,service_role;

do $patch_sender$
declare
  v_def text;
  v_new text;
begin
  select pg_get_functiondef(
    'public.motor_envia_abordagem(bigint,text,text,jsonb,bigint,bigint,bigint,jsonb)'::regprocedure
  ) into v_def;
  if md5(v_def)<>'e881092b4ada95f3dafdc6792bd55b89' then
    raise exception 'motor_envia_abordagem mudou: %',md5(v_def);
  end if;
  v_new:=replace(v_def,
    $old$      corpo,status,atraso_antes_segundos
    ) values ($old$,
    $new$      corpo,status,atraso_antes_segundos,
      continuacao_bloco_id,continuacao_contexto,continuacao_depth
    ) values ($new$);
  v_new:=replace(v_new,
    $old$      nullif(v_url,''),v_body,'pendente',v_delay
    )$old$,
    $new$      nullif(v_url,''),v_body,'pendente',v_delay,
      nullif(p_lead->>'__motor_next_block_id',''),p_lead,
      coalesce(nullif(p_lead->>'__motor_next_depth','')::integer,0)
    )$new$);
  if v_new=v_def
     or position('continuacao_bloco_id,continuacao_contexto,continuacao_depth' in v_new)=0 then
    raise exception 'patch da continuacao no emissor nao encontrou as ancoras';
  end if;
  execute v_new;
end
$patch_sender$;

do $patch_dispatch$
declare
  v_def text;
  v_new text;
begin
  select pg_get_functiondef('private.motor_despachar_parte(bigint)'::regprocedure) into v_def;
  if md5(v_def)<>'ef060baaedf75080a1db8b7b00506834' then
    raise exception 'motor_despachar_parte mudou: %',md5(v_def);
  end if;
  v_new:=replace(v_def,
    $old$    if v_proxima_id is not null then
      execute 'select private.motor_despachar_parte($1)'
        into v_confirmacao using v_proxima_id;
    end if;
  end if;
  return jsonb_build_object($old$,
    $new$    if v_proxima_id is not null then
      execute 'select private.motor_despachar_parte($1)'
        into v_confirmacao using v_proxima_id;
    else
      v_confirmacao:=private.motor_continuar_apos_mensagem(v_parte.id);
    end if;
  end if;
  return jsonb_build_object($new$);
  if v_new=v_def or position('motor_continuar_apos_mensagem' in v_new)=0 then
    raise exception 'patch da continuacao no despacho nao encontrou as ancoras';
  end if;
  execute v_new;
end
$patch_dispatch$;

do $patch_confirmation$
declare
  v_def text;
  v_new text;
begin
  select pg_get_functiondef(
    'public.motor_confirmar_mensagem_evento(text,text,text,text,text,text,text,timestamptz,text)'::regprocedure
  ) into v_def;
  if md5(v_def)<>'ce107b3b261b56ba7e13f46a2ee278ef' then
    raise exception 'motor_confirmar_mensagem_evento mudou: %',md5(v_def);
  end if;
  v_new:=replace(v_def,
    $old$  v_despacho jsonb;
begin$old$,
    $new$  v_despacho jsonb;
  v_continuacao jsonb;
begin$new$);
  v_new:=replace(v_new,
    $old$  return jsonb_build_object(
    'ok',true,'parte_id',v_parte.id,'status',v_parte.status,
    'proxima_parte_id',v_proxima_id,'despacho',v_despacho,'trace_id',p_trace_id
  );$old$,
    $new$  if v_parte.status in ('enviada','entregue','lida') then
    v_continuacao:=private.motor_continuar_apos_mensagem(v_parte.id);
  end if;
  return jsonb_build_object(
    'ok',true,'parte_id',v_parte.id,'status',v_parte.status,
    'proxima_parte_id',v_proxima_id,'despacho',v_despacho,
    'continuacao',v_continuacao,'trace_id',p_trace_id
  );$new$);
  if v_new=v_def or position('v_continuacao:=private.motor_continuar_apos_mensagem' in v_new)=0 then
    raise exception 'patch da confirmacao nao encontrou as ancoras';
  end if;
  execute v_new;
end
$patch_confirmation$;

do $patch_runtime$
declare
  v_def text;
  v_new text;
begin
  select pg_get_functiondef(p.oid) into v_def
    from pg_proc p join pg_namespace n on n.oid=p.pronamespace
   where n.nspname='public' and p.proname='motor_rodar_unchecked'
     and pg_get_function_identity_arguments(p.oid)=
       'p_auto_id bigint, p_lead jsonb, p_start_block text, p_depth integer';
  if md5(v_def)<>'5879ade9ac779a4b8dcba280e3ccf8b7' then
    raise exception 'motor_rodar_unchecked mudou: %',md5(v_def);
  end if;
  v_new:=replace(v_def,
    $old$      perform motor_envia_abordagem(p_auto_id,a_nome,cur,p_lead,v_lead_id,_dist_cor,
        nullif(b#>>'{options,produtoId}','')::bigint,
        coalesce(b#>'{options,abordagemIds}','[]'::jsonb));$old$,
    $new$      p_lead:=p_lead||jsonb_build_object(
        '__motor_next_block_id',nullif(b#>>'{options,nextBlockId}',''),
        '__motor_next_depth',p_depth+1
      );
      perform motor_envia_abordagem(p_auto_id,a_nome,cur,p_lead,v_lead_id,_dist_cor,
        nullif(b#>>'{options,produtoId}','')::bigint,
        coalesce(b#>'{options,abordagemIds}','[]'::jsonb));$new$);
  v_new:=replace(v_new,
    $old$      trace:=trace||E'>> Abordagem enviada\n';
      cur:=b#>>'{options,nextBlockId}';$old$,
    $new$      trace:=trace||E'>> Abordagem aceita; aguardando confirmacao real\n';
      return trace||'-- aguardando confirmacao da mensagem --';$new$);
  if v_new=v_def
     or position('__motor_next_block_id' in v_new)=0
     or position('aguardando confirmacao da mensagem' in v_new)=0 then
    raise exception 'patch da pausa do runtime nao encontrou as ancoras';
  end if;
  execute v_new;
end
$patch_runtime$;
