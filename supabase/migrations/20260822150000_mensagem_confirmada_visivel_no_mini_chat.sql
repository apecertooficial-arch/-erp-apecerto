-- O reconciliador da D-API tambem materializa a evidencia confirmada no
-- historico canonico lido pelo mini chat e pela Sara.

begin;

create or replace function private.motor_espelhar_parte_confirmada(p_parte_id bigint)
returns boolean
language plpgsql
security definer
set search_path='pg_catalog','public','private'
as $fn$
declare
  v_p public.motor_mensagem_partes%rowtype;
  v_wa_inst uuid;
  v_contato uuid;
  v_conversa uuid;
  v_tel text;
begin
  select * into v_p from public.motor_mensagem_partes where id=p_parte_id;
  if not found or v_p.status not in ('enviada','entregue','lida')
     or nullif(v_p.provider_message_id,'') is null then
    return false;
  end if;

  select w.id into v_wa_inst from public.wa_instancias w
   where w.session_id=v_p.session_id limit 1;
  if v_wa_inst is null then return false; end if;

  v_tel:=public.telefone_br_normalizado(v_p.destino);
  insert into public.wa_contatos(telefone,jid,nome,lead_id)
  values(v_tel,v_tel||'@s.whatsapp.net',v_p.lead_nome,v_p.lead_id)
  on conflict(telefone) do update set
    nome=coalesce(public.wa_contatos.nome,excluded.nome),
    lead_id=coalesce(public.wa_contatos.lead_id,excluded.lead_id)
  returning id into v_contato;

  insert into public.wa_conversas(contato_id,instancia_id,status,origem,ultima_msg_em)
  values(v_contato,v_wa_inst,'aberta','central_automacoes',
    coalesce(v_p.confirmada_em,v_p.aceita_em,now()))
  on conflict(contato_id,instancia_id) do update set
    ultima_msg_em=greatest(coalesce(public.wa_conversas.ultima_msg_em,'-infinity'::timestamptz),excluded.ultima_msg_em)
  returning id into v_conversa;

  insert into public.wa_mensagens(
    wa_message_id,conversa_id,instancia_id,direcao,tipo,conteudo,media_url,
    is_grupo,enviado_em,raw,status,status_detalhe,status_em
  ) values(
    v_p.provider_message_id,v_conversa,v_wa_inst,'enviada',v_p.tipo,
    nullif(v_p.conteudo,''),v_p.media_url,false,
    coalesce(v_p.confirmada_em,v_p.aceita_em,now()),
    jsonb_build_object('via','central_automacoes','parte_id',v_p.id,
      'execution_id',v_p.execution_id,'abordagem_id',v_p.abordagem_id,
      'confirmacao','historico_dapi'),
    v_p.status,'Confirmada no historico real da D-API',
    coalesce(v_p.lida_em,v_p.entregue_em,v_p.confirmada_em,v_p.aceita_em,now())
  )
  on conflict(wa_message_id) do update set
    media_url=coalesce(public.wa_mensagens.media_url,excluded.media_url),
    conteudo=coalesce(public.wa_mensagens.conteudo,excluded.conteudo),
    status=excluded.status,status_detalhe=excluded.status_detalhe,
    status_em=excluded.status_em;

  return true;
end
$fn$;

revoke all on function private.motor_espelhar_parte_confirmada(bigint)
  from public,anon,authenticated;
grant execute on function private.motor_espelhar_parte_confirmada(bigint) to service_role;

do $patch_confirmacao$
declare v_def text;v_new text;
begin
  select pg_get_functiondef(p.oid) into v_def from pg_proc p
  join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='public' and p.proname='motor_confirmar_mensagem_evento' limit 1;
  v_new:=replace(v_def,
    'if v_parte.status in (''enviada'',''entregue'',''lida'') then'||chr(10)||
    '    v_continuacao:=private.motor_continuar_apos_mensagem(v_parte.id);',
    'if v_parte.status in (''enviada'',''entregue'',''lida'') then'||chr(10)||
    '    perform private.motor_espelhar_parte_confirmada(v_parte.id);'||chr(10)||
    '    v_continuacao:=private.motor_continuar_apos_mensagem(v_parte.id);');
  if v_new=v_def then raise exception 'CONFIRMACAO_SEM_ANCORA_MINI_CHAT'; end if;
  execute v_new;
end
$patch_confirmacao$;

do $backfill$
declare r record;
begin
  for r in
    select p.id from public.motor_mensagem_partes p
     where p.status in ('enviada','entregue','lida')
       and nullif(p.provider_message_id,'') is not null
       and p.lead_id is not null
     order by p.id
  loop
    perform private.motor_espelhar_parte_confirmada(r.id);
  end loop;
end
$backfill$;

commit;
