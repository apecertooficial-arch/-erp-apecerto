-- O texto do log tambem precisa separar explicitamente a extracao JSON da
-- concatenacao textual. Sem parenteses, o PostgreSQL escolhia o operador de
-- concatenacao JSON e tentava converter "Aviso ignorado" em JSON.

begin;

do $patch$
declare
  v_def text;
  v_new text;
begin
  select pg_get_functiondef(
    'public.motor_acoes(bigint,text,text,jsonb,jsonb,bigint,bigint,integer)'::regprocedure
  ) into v_def;
  if md5(v_def)<>'7b9eb9d823f2d27b79867a1fc0d88af7' then
    raise exception 'motor_acoes mudou: %',md5(v_def);
  end if;
  v_new:=replace(
    v_def,
    $old$'Aviso ignorado: a etapa nao mudou para '||ao->>'somenteAiEtapaAlteradaPara'$old$,
    $new$'Aviso ignorado: a etapa nao mudou para '||(ao->>'somenteAiEtapaAlteradaPara')$new$
  );
  v_new:=replace(
    v_new,
    $old$'Aviso ignorado: a temperatura nao mudou para '||ao->>'somenteAiTemperaturaAlteradaPara'$old$,
    $new$'Aviso ignorado: a temperatura nao mudou para '||(ao->>'somenteAiTemperaturaAlteradaPara')$new$
  );
  if v_new=v_def then raise exception 'textos condicionais da Sara nao encontrados'; end if;
  execute v_new;
end
$patch$;

commit;
