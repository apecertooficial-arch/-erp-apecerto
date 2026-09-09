begin;

do $unpatch_after_action$
declare
  v_def text;
  v_new text;
begin
  v_def:=pg_get_functiondef(
    'public.motor_rodar_unchecked(bigint,jsonb,text,integer)'::regprocedure
  );
  if position('META_INITIAL_LEAD_AFTER_ACTION' in v_def)=0 then
    return;
  end if;

  v_new:=replace(
    v_def,
    $with_fallback$        v_negocio_id:=nullif(_res->>'negocio_id','')::bigint;
        -- META_INITIAL_LEAD_AFTER_ACTION
        begin
          perform private.enqueue_meta_initial_lead_event(
            v_lead_id,
            v_negocio_id,
            btrim(coalesce(
              p_lead->'entrada_payload'->>'meta_lead_id',
              p_lead->'entrada_payload'->>'leadgen_id',
              p_lead->>'meta_lead_id',
              p_lead->>'leadgen_id',
              ''
            ))
          );
        exception when others then
          insert into public.motor_execucoes(
            automacao_id,automacao_nome,bloco_id,evento,status,
            lead_nome,lead_telefone,detalhe
          ) values (
            p_auto_id,a_nome,cur,'tracking','alerta',p_lead->>'nome',v_tel,
            'TRACKING_META_INITIAL_AFTER_ACTION_FAILED: '||left(sqlerrm,120)
          );
        end;$with_fallback$,
    $without_fallback$        v_negocio_id:=nullif(_res->>'negocio_id','')::bigint;$without_fallback$
  );

  if v_new=v_def or position('META_INITIAL_LEAD_AFTER_ACTION' in v_new)>0 then
    raise exception 'META_INITIAL_LEAD_AFTER_ACTION_UNPATCH_FAILED';
  end if;
  execute v_new;
end
$unpatch_after_action$;

commit;
