-- Garante que toda atribuicao Meta valida tente produzir o estagio inicial
-- `Lead`, inclusive os caminhos que chamam o registrador privado diretamente.
-- Nao reprocessa historico: a chamada vale somente para novas execucoes.
-- A idempotencia continua no outbox existente (`on conflict (channel,event_id)
-- do nothing`) e a funcao auxiliar preserva opt-out e horario original.

begin;

do $patch_common_path$
declare
  v_def text;
  v_new text;
begin
  v_def:=pg_get_functiondef(
    'private.motor_atribuicao_meta_por_campos(bigint,jsonb)'::regprocedure
  );
  if position(
    'enqueue_meta_initial_lead_event(p_lead_id,null,v_meta_lead_id)' in
    regexp_replace(v_def,'\s+','','g')
  )>0 then
    return;
  end if;

  v_new:=replace(
    v_def,
    $old$  get diagnostics v_updated_current_count=row_count;
  return jsonb_build_object($old$,
    $new$  get diagnostics v_updated_current_count=row_count;
  perform private.enqueue_meta_initial_lead_event(
    p_lead_id,
    null,
    v_meta_lead_id
  );
  return jsonb_build_object($new$
  );

  if v_new=v_def or position(
    'enqueue_meta_initial_lead_event(p_lead_id,null,v_meta_lead_id)' in
    regexp_replace(v_new,'\s+','','g')
  )=0 then
    raise exception 'META_INITIAL_LEAD_COMMON_PATH_PATCH_FAILED';
  end if;
  execute v_new;
end
$patch_common_path$;

do $unpatch_wrapper$
declare
  v_def text;
  v_new text;
begin
  v_def:=pg_get_functiondef(
    'public.motor_campos_deterministico(bigint,text,text,jsonb,jsonb,bigint,bigint)'::regprocedure
  );
  if position('enqueue_meta_initial_lead_event' in v_def)=0 then
    return;
  end if;

  v_new:=replace(
    v_def,
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
      );$with_initial$,
    $without_initial$      v_sync:=private.motor_atribuicao_meta_por_campos(v_lead_id,v_contexto);$without_initial$
  );

  if v_new=v_def or position('enqueue_meta_initial_lead_event' in v_new)>0 then
    raise exception 'META_INITIAL_LEAD_WRAPPER_UNPATCH_FAILED';
  end if;
  execute v_new;
end
$unpatch_wrapper$;

commit;
