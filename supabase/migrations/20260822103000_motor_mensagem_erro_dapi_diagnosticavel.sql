-- Preserva o motivo devolvido pela D-API em recusas deterministicas. Isso
-- permite corrigir a causa sem repetir no escuro nem perder a distribuicao.
do $patch$
declare
  v_def text;
  v_novo text;
begin
  select pg_get_functiondef('private.motor_despachar_parte(bigint)'::regprocedure)
    into v_def;
  if md5(v_def) <> '47551d0b639a18771df20f215a4f5eeb' then
    raise exception 'motor_despachar_parte mudou: %',md5(v_def);
  end if;
  v_novo := replace(
    v_def,
    $old$       set status='erro',erro='HTTP '||v_resp.status
     where id=v_parte.id;$old$,
    $new$       set status='erro',
           erro='HTTP '||v_resp.status||': '||left(coalesce(v_resp.content,''),420)
     where id=v_parte.id;$new$
  );
  v_novo := replace(
    v_novo,
    $old$'Parte '||v_parte.parte||' recusada pela D-API [HTTP '||v_resp.status||']'$old$,
    $new$'Parte '||v_parte.parte||' recusada pela D-API [HTTP '||v_resp.status||']: '||
      left(coalesce(v_resp.content,''),180)$new$
  );
  if v_novo=v_def then raise exception 'ancora de erro HTTP nao encontrada'; end if;
  execute v_novo;
end
$patch$;
