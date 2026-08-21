-- Remove os dois atalhos de entrada que ainda decidiam fora do mapa:
-- 1) site_lead_sync_crm criava lead/negocio e chamava uma automacao hardcoded;
-- 2) wa_automacao_fila abria um segundo consumidor de mensagens.

do $migrate_site_flow$
declare
  v_def text; v_auto_id bigint; v_map jsonb; v_blocks jsonb:='[]'::jsonb;
  v_block jsonb; v_validation jsonb; v_version integer; v_name text;
begin
  select pg_get_functiondef(p.oid) into v_def from pg_proc p
  join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='public' and p.proname='site_lead_sync_crm';
  begin
    v_auto_id:=(substring(v_def from 'automacao_id = ([0-9]+)'))::bigint;
  exception when others then
    v_auto_id:=null;
  end;
  if v_auto_id is null then
    raise exception 'nao foi possivel identificar a automacao hardcoded do site';
  end if;
  select mapa,nome into v_map,v_name from public.automacoes
   where id=v_auto_id and status='publicado' and not coalesce(arquivada,false);
  if v_map is null then
    raise exception 'automacao antiga do site nao esta publicada: %',v_auto_id;
  end if;

  for v_block in select value from jsonb_array_elements(v_map->'automation'->'blocks')
  loop
    if v_block->>'type'='trigger'
       and v_block#>>'{options,triggers,0,name}'='json-http-request-trigger' then
      v_block:=jsonb_set(v_block,'{options,triggers,0,name}',
        to_jsonb('site-lead-created-trigger'::text),false);
    end if;
    v_blocks:=v_blocks||jsonb_build_array(v_block);
  end loop;
  v_map:=jsonb_set(v_map,'{automation,blocks}',v_blocks,false);
  v_map:=jsonb_set(v_map,'{editor,blocks}','{}'::jsonb,true);
  v_map:=jsonb_set(v_map,'{editor,wires}','[]'::jsonb,true);
  v_validation:=public.automacao_validar_mapa(v_map);
  if coalesce((v_validation->>'ok')::boolean,false) is not true then
    raise exception 'mapa do site nao pode ser migrado: %',v_validation;
  end if;
  select coalesce(max(versao),0)+1 into v_version
    from public.automacao_versoes where automacao_id=v_auto_id;
  insert into public.automacao_versoes(
    automacao_id,versao,nome,mapa,observacao,criado_por
  ) values (
    v_auto_id,v_version,v_name,v_map,
    'Migracao: entrada do site agora e um gatilho explicito da Central',
    'construtor'
  );
end
$migrate_site_flow$;

create or replace function public.site_lead_sync_crm()
returns trigger
language plpgsql
security definer
set search_path=''
as $fn$
declare
  r record; v_payload jsonb; v_link text; v_slug text; v_enfileiradas integer:=0;
begin
  if new.empreendimento_id is not null then
    select slug into v_slug from public.empreendimentos
     where id=new.empreendimento_id;
    if nullif(v_slug,'') is not null then
      v_link:='https://apecerto.com/imovel/'||v_slug;
    end if;
  end if;
  v_payload:=jsonb_build_object(
    'nome',new.nome,'telefone',regexp_replace(coalesce(new.telefone,''),'\D','','g'),
    'email',coalesce(new.email,''),'origem',coalesce(new.origem,'site'),
    'site_lead_id',new.id,'lead_type',new.lead_type,
    'empreendimento_id',coalesce(new.empreendimento_id::text,''),
    'empreendimento_nome',coalesce(new.empreendimento_nome,''),
    'preferencia_horario',coalesce(new.preferencia_horario,''),
    'imovel_link',coalesce(v_link,''),'tracking',coalesce(new.tracking,'{}'::jsonb),
    'context',coalesce(new.context,'{}'::jsonb)
  );
  for r in
    select distinct a.id from public.automacoes a,
      lateral jsonb_array_elements(a.mapa->'automation'->'blocks') b,
      lateral jsonb_array_elements(coalesce(b#>'{options,triggers}','[]'::jsonb)) t
     where a.ativa is true and a.status='publicado'
       and not coalesce(a.arquivada,false)
       and t->>'name'='site-lead-created-trigger'
  loop
    perform public.motor_enfileirar_idempotente(
      r.id,v_payload,'site-lead:'||new.id::text
    );
    v_enfileiradas:=v_enfileiradas+1;
  end loop;
  if v_enfileiradas=0 then
    raise exception using errcode='P0001',
      message='SITE_AUTOMATION_MISSING: publique e ative um fluxo com o gatilho Lead criado no site';
  end if;
  return new;
end
$fn$;

revoke all on function public.site_lead_sync_crm() from public,anon,authenticated;

drop trigger if exists trg_wa_enfileirar on public.wa_mensagens;
revoke execute on function public.wa_enfileirar_automacao() from service_role;
