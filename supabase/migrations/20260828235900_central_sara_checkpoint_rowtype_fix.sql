-- Corrige a leitura do rowtype usada pelo agendador de checkpoint. A versão
-- anterior selecionava o composto inteiro como uma única coluna.
begin;

do $fix$
declare v_def text; v_novo text;
begin
  select pg_get_functiondef(
    'public.f2_sara_agendar_checkpoint(uuid,integer,text,text,timestamp with time zone,jsonb)'::regprocedure
  ) into v_def;
  v_novo:=replace(v_def,'select f into v_lead','select f.* into v_lead');
  if v_novo=v_def then
    if position('select f.* into v_lead' in v_def)>0 then return; end if;
    raise exception 'CHECKPOINT_ROWTYPE_FIX_BLOCKED: ancora inesperada';
  end if;
  execute v_novo;
end
$fix$;

do $verify$
declare v_def text;
begin
  select pg_get_functiondef(
    'public.f2_sara_agendar_checkpoint(uuid,integer,text,text,timestamp with time zone,jsonb)'::regprocedure
  ) into v_def;
  if position('select f.* into v_lead' in v_def)=0 then
    raise exception 'CHECKPOINT_ROWTYPE_FIX_FAILED';
  end if;
end
$verify$;

commit;
