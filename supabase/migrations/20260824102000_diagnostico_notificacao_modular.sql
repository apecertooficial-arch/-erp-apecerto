-- Mantem no proprio log do modulo o ponto exato de uma falha de notificacao.
-- Isso evita que uma excecao interna seja reduzida a uma mensagem generica.

begin;

do $patch$
declare
  v_def text;
  v_new text;
begin
  select pg_get_functiondef(
    'public.motor_acoes(bigint,text,text,jsonb,jsonb,bigint,bigint,integer)'::regprocedure
  ) into v_def;
  if md5(v_def)<>'24d6c66067923dbc27336fdb936bcd8e' then
    raise exception 'motor_acoes mudou: %',md5(v_def);
  end if;
  v_new:=replace(
    v_def,
    $old$        v_titulo text; v_detalhe text; v_chave text; v_gravou int; v_tipo text;$old$,
    $new$        v_titulo text; v_detalhe text; v_chave text; v_gravou int; v_tipo text;
        v_erro_contexto text;$new$
  );
  v_new:=replace(
    v_new,
    $old$      exception when others then
        insert into motor_execucoes(automacao_id,automacao_nome,bloco_id,evento,status,lead_nome,lead_telefone,detalhe)
        values(p_auto,p_nome,p_bloco,'acao','erro',p_lead->>'nome',v_tel,
          'Nao consegui avisar: '||left(coalesce(SQLERRM,''),120));$old$,
    $new$      exception when others then
        get stacked diagnostics v_erro_contexto = pg_exception_context;
        insert into motor_execucoes(automacao_id,automacao_nome,bloco_id,evento,status,lead_nome,lead_telefone,detalhe)
        values(p_auto,p_nome,p_bloco,'acao','erro',p_lead->>'nome',v_tel,
          left('Nao consegui avisar ['||SQLSTATE||']: '||coalesce(SQLERRM,'')||' @ '||coalesce(v_erro_contexto,''),900));$new$
  );
  if v_new=v_def then raise exception 'ancora de diagnostico nao encontrada'; end if;
  execute v_new;
end
$patch$;

commit;
