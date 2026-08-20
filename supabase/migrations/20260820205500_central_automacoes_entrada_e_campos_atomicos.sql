-- O gatilho de webhook materializa ou identifica o contato uma unica vez.
-- Operacoes de campos passam a somente alterar os campos configurados; nunca
-- criam lead, negocio, distribuicao ou mensagem implicitamente.

create or replace function public.motor_materializar_entrada(p_lead jsonb)
returns jsonb
language plpgsql
security definer
set search_path=''
as $fn$
declare
  v_tel text:=regexp_replace(coalesce(p_lead->>'telefone',''),'\D','','g');
  v_email text:=lower(nullif(btrim(p_lead->>'email'),''));
  v_id bigint;
begin
  if v_tel='' and v_email is null then
    raise exception using errcode='22023',message='LEAD_WITHOUT_CONTACT';
  end if;
  perform pg_advisory_xact_lock(hashtext('motor_ingresso:'||coalesce(nullif(v_tel,''),v_email)));
  select l.id into v_id from public.leads l
   where (v_tel<>'' and regexp_replace(coalesce(l.telefone,''),'\D','','g')=v_tel)
      or (v_tel='' and v_email is not null and lower(l.email)=v_email)
   order by l.id desc limit 1;
  if v_id is null then
    insert into public.leads(nome,telefone,email,origem,status)
    values(coalesce(nullif(btrim(p_lead->>'nome'),''),'Lead'),nullif(v_tel,''),
      v_email,coalesce(nullif(btrim(p_lead->>'origem'),''),'automacao'),'novo')
    returning id into v_id;
  end if;
  return coalesce(p_lead,'{}'::jsonb)||jsonb_build_object('__lead_id',v_id);
end
$fn$;

revoke all on function public.motor_materializar_entrada(jsonb)
  from public,anon,authenticated;
grant execute on function public.motor_materializar_entrada(jsonb) to service_role;

do $patch$
declare v_def text; v_new text;
begin
  select pg_get_functiondef(p.oid) into v_def from pg_proc p
  join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='public' and p.proname='motor_enfileirar_idempotente';
  v_new:=replace(v_def,
    $old$  v_fila_id := public.motor_enfileirar(p_auto_id, p_lead);$old$,
    $new$  p_lead := public.motor_materializar_entrada(p_lead);
  v_fila_id := public.motor_enfileirar(p_auto_id, p_lead);$new$);
  if v_new=v_def or position('motor_materializar_entrada' in v_new)=0 then
    raise exception 'patch da entrada nao encontrou ancora';
  end if;
  execute v_new;

  select pg_get_functiondef(p.oid) into v_def from pg_proc p
  join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='public' and p.proname='motor_campos';
  v_new:=replace(v_def,
    $old$  for m in select value from jsonb_array_elements(coalesce(p_map,'[]'::jsonb)) as t(value) loop$old$,
    $new$  if v_lead_id is null then
    raise exception using errcode='P0001',
      message='FIELD_OPERATION_REQUIRES_EXISTING_LEAD';
  end if;
  for m in select value from jsonb_array_elements(coalesce(p_map,'[]'::jsonb)) as t(value) loop$new$);
  v_new:=replace(v_new,
    $old$        if v_lead_id is null then
          insert into leads(nome,telefone,email,origem,status)
          values(coalesce(p_lead->>'nome','Lead'),v_tel,nullif(p_lead->>'email',''),coalesce(p_lead->>'origem','automacao'),'novo') returning id into v_lead_id;
        end if;$old$,
    $new$        if v_lead_id is null then
          raise exception 'FIELD_OPERATION_REQUIRES_EXISTING_LEAD';
        end if;$new$);
  v_new:=replace(v_new,
    $old$          if v_lead_id is null then
            insert into leads(nome,telefone,email,origem,status)
            values(coalesce(p_lead->>'nome','Lead'),v_tel,nullif(p_lead->>'email',''),coalesce(p_lead->>'origem','automacao'),'novo') returning id into v_lead_id;
          end if;$old$,
    $new$          if v_lead_id is null then
            raise exception 'FIELD_OPERATION_REQUIRES_EXISTING_LEAD';
          end if;$new$);
  if v_new=v_def or position('FIELD_OPERATION_REQUIRES_EXISTING_LEAD' in v_new)=0
     or position('insert into leads(nome,telefone,email,origem,status)' in v_new)>0 then
    raise exception 'patch atomico de Operacoes de campos nao removeu criacao implicita';
  end if;
  execute v_new;
end
$patch$;
