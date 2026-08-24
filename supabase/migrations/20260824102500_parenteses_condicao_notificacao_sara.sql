-- Operadores JSON e comparacao precisam de operandos explicitamente
-- parentizados dentro do PL/pgSQL. Sem isso o parser tentava interpretar o
-- texto do aviso como JSON antes de decidir se o aviso deveria ser ignorado.

begin;

do $patch$
declare
  v_def text;
  v_new text;
begin
  select pg_get_functiondef(
    'public.motor_acoes(bigint,text,text,jsonb,jsonb,bigint,bigint,integer)'::regprocedure
  ) into v_def;
  if md5(v_def)<>'23146544360f7568a5db3e70eafdea50' then
    raise exception 'motor_acoes mudou: %',md5(v_def);
  end if;
  v_new:=replace(
    v_def,
    $old$            coalesce(p_lead->>'__ai_aplicado','false')='true'
            and coalesce(p_lead->>'__ai_etapa_nova','')=ao->>'somenteAiEtapaAlteradaPara'
            and coalesce(p_lead->>'__ai_etapa_anterior','')<>coalesce(p_lead->>'__ai_etapa_nova','')$old$,
    $new$            coalesce((p_lead->>'__ai_aplicado'),'false')='true'
            and coalesce((p_lead->>'__ai_etapa_nova'),'')=(ao->>'somenteAiEtapaAlteradaPara')
            and coalesce((p_lead->>'__ai_etapa_anterior'),'')<>coalesce((p_lead->>'__ai_etapa_nova'),'')$new$
  );
  v_new:=replace(
    v_new,
    $old$            coalesce(p_lead->>'__ai_aplicado','false')='true'
            and coalesce(p_lead->>'__ai_temperatura_nova','')=ao->>'somenteAiTemperaturaAlteradaPara'
            and coalesce(p_lead->>'__ai_temperatura_anterior','')<>coalesce(p_lead->>'__ai_temperatura_nova','')$old$,
    $new$            coalesce((p_lead->>'__ai_aplicado'),'false')='true'
            and coalesce((p_lead->>'__ai_temperatura_nova'),'')=(ao->>'somenteAiTemperaturaAlteradaPara')
            and coalesce((p_lead->>'__ai_temperatura_anterior'),'')<>coalesce((p_lead->>'__ai_temperatura_nova'),'')$new$
  );
  if v_new=v_def then raise exception 'condicoes da Sara nao encontradas'; end if;
  execute v_new;
end
$patch$;

commit;
