-- Nas duas entradas de campanha, um telefone conhecido pode reutilizar o
-- cadastro do lead, mas nunca o negocio/card legado. A nova captacao ganha
-- uma oportunidade fresca e independente.

begin;

do $patch_create_business$
declare v_def text;v_new text;v_old text;v_insert text;
begin
  select pg_get_functiondef(p.oid) into v_def from pg_proc p
  join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='public' and p.proname='motor_acoes' limit 1;

  v_old:='select id into v_exist from negocios where lead_id=v_lead_id and pipeline_id=v_pipe and status=''aberto'' order by id desc limit 1;'||chr(10)||
         '        if v_exist is not null then';
  v_insert:='select id into v_exist from negocios where lead_id=v_lead_id and pipeline_id=v_pipe and status=''aberto'' order by id desc limit 1;'||chr(10)||
         '        if v_exist is not null and p_auto in (65,66) and exists('||chr(10)||
         '          select 1 from public.f2_lead f where f.origem_negocio_id=v_exist'||chr(10)||
         '            and not public.f2_lead_automatico_elegivel(f.id)'||chr(10)||
         '        ) then'||chr(10)||
         '          v_exist:=null;'||chr(10)||
         '        end if;'||chr(10)||
         '        if v_exist is not null then';
  v_new:=replace(v_def,v_old,v_insert);
  if v_new=v_def then raise exception 'CREATE_BUSINESS_SEM_ANCORA_LEGADO'; end if;
  execute v_new;
end
$patch_create_business$;

commit;
