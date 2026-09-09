begin;

do $restore_wrapper$
declare
  v_def text;
  v_new text;
begin
  v_def:=pg_get_functiondef(
    'public.motor_campos_deterministico(bigint,text,text,jsonb,jsonb,bigint,bigint)'::regprocedure
  );
  if position('enqueue_meta_initial_lead_event' in v_def)=0 then
    v_new:=replace(
      v_def,
      $without_initial$      v_sync:=private.motor_atribuicao_meta_por_campos(v_lead_id,v_contexto);$without_initial$,
      $with_initial$      v_sync:=private.motor_atribuicao_meta_por_campos(v_lead_id,v_contexto);
      perform private.enqueue_meta_initial_lead_event(
        v_lead_id,
        p_neg_id,
        btrim(coalesce(
          v_contexto->'entrada_payload'->>'meta_lead_id',
          v_contexto->'entrada_payload'->>'leadgen_id',
          v_contexto->>'meta_lead_id',
          v_contexto->>'leadgen_id',
          ''
        ))
      );$with_initial$
    );
    if v_new=v_def then
      raise exception 'META_INITIAL_LEAD_WRAPPER_RESTORE_FAILED';
    end if;
    execute v_new;
  end if;
end
$restore_wrapper$;

do $unpatch_common_path$
declare
  v_def text;
  v_new text;
begin
  v_def:=pg_get_functiondef(
    'private.motor_atribuicao_meta_por_campos(bigint,jsonb)'::regprocedure
  );
  v_new:=replace(
    v_def,
    $with_initial$  get diagnostics v_updated_current_count=row_count;
  perform private.enqueue_meta_initial_lead_event(
    p_lead_id,
    null,
    v_meta_lead_id
  );
  return jsonb_build_object($with_initial$,
    $without_initial$  get diagnostics v_updated_current_count=row_count;
  return jsonb_build_object($without_initial$
  );
  if v_new=v_def then
    raise exception 'META_INITIAL_LEAD_COMMON_PATH_UNPATCH_FAILED';
  end if;
  execute v_new;
end
$unpatch_common_path$;

commit;
