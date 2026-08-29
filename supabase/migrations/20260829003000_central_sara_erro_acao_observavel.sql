-- Preserva a causa concreta de uma falha atomica no bloco de acao.
-- A fila continua falhando de forma fechada, mas deixa de esconder o SQLERRM
-- que permite corrigir o caso sem replay ou dados sinteticos em producao.
do $migration$
declare
  v_oid regprocedure := 'public.motor_rodar_unchecked(bigint,jsonb,text,integer)'::regprocedure;
  v_def text := pg_get_functiondef(v_oid);
  v_new text;
begin
  if md5(v_def) <> '4c1b3251f4efc73244cf71ef3080a1c7' then
    raise exception 'SARA_ACTION_OBSERVABILITY_STALE_VERSION: motor_rodar_unchecked mudou: %', md5(v_def);
  end if;

  v_new := replace(
    v_def,
    $old$message='AUTOMATION_MODULE_FAILED: action';$old$,
    $new$message='AUTOMATION_MODULE_FAILED: action: '||
              left(coalesce(_module_error,'unknown'),220);$new$
  );

  if v_new = v_def then
    raise exception 'SARA_ACTION_OBSERVABILITY_PATCH_FAILED';
  end if;

  execute v_new;
end
$migration$;
