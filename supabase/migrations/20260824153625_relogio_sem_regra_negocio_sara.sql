-- O cron e somente o relogio/transportador. Frequencia, atraso e lote da Sara
-- continuam no gatilho publicado da Central de Automacoes.

begin;
set local lock_timeout='10s';
select pg_advisory_xact_lock(hashtextextended('relogio_sem_regra_negocio_sara',0));

do $patch$
declare v_def text; v_new text;
begin
  select pg_get_functiondef('public.motor_relogio_central()'::regprocedure)
    into v_def;
  if md5(v_def)<>'cbb177427722cb4d5fae09ae77cb15c3' then
    raise exception 'motor_relogio_central mudou: %',md5(v_def);
  end if;
  v_new:=replace(
    v_def,
    'public.sara_checagem_diaria(12)',
    'public.sara_checagem_diaria(null)'
  );
  if v_new=v_def or position('public.sara_checagem_diaria(null)' in v_new)=0 then
    raise exception 'lote oculto da Sara nao foi removido do relogio';
  end if;
  execute v_new;
end
$patch$;

do $verify$
declare v_def text;
begin
  select pg_get_functiondef('public.motor_relogio_central()'::regprocedure)
    into v_def;
  if position('public.sara_checagem_diaria(12)' in v_def)>0
     or position('public.sara_checagem_diaria(null)' in v_def)=0 then
    raise exception 'relogio ainda sobrepoe a configuracao do gatilho';
  end if;
  if not exists(
    select 1
      from public.automacoes a,
           lateral jsonb_array_elements(a.mapa#>'{automation,blocks}') b,
           lateral jsonb_array_elements(coalesce(b#>'{options,triggers}','[]'::jsonb)) t
     where a.ativa and a.status='publicado'
       and t->>'name'='checagem-diaria-trigger'
       and nullif(t#>>'{options,limitePorCiclo}','')::integer between 1 and 50
  ) then
    raise exception 'gatilho publicado da Sara nao declara o lote';
  end if;
end
$verify$;

commit;
