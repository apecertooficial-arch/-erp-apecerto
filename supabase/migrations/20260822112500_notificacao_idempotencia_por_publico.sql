-- Duas acoes de aviso no mesmo bloco (corretor e gestao) sao independentes.
-- A idempotencia inclui o publico e o tipo, sem duplicar o mesmo destinatario.
do $patch$
declare
  v_def text;
  v_novo text;
begin
  select pg_get_functiondef(
    'public.motor_acoes(bigint,text,text,jsonb,jsonb,bigint,bigint,integer)'::regprocedure
  ) into v_def;
  if md5(v_def)<>'24e58c2f8ccb9d9237eab7d174064694' then
    raise exception 'motor_acoes mudou: %',md5(v_def);
  end if;
  v_novo:=replace(
    v_def,
    $old$        v_chave := 'automacao:'||p_auto||':'||p_bloco||':'||coalesce(v_lead_id::text,'0');$old$,
    $new$        v_chave := 'automacao:'||p_auto||':'||p_bloco||':'||coalesce(v_lead_id::text,'0')||
          ':'||coalesce(nullif(ao->>'publico',''),'corretor')||
          ':'||coalesce(nullif(ao->>'tipo',''),'acao_vencida');$new$
  );
  if v_novo=v_def then raise exception 'ancora de idempotencia nao encontrada'; end if;
  execute v_novo;
end
$patch$;
