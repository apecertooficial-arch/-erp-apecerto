-- Depois de um restart gracioso, o primeiro heartbeat confirma novamente que
-- o worker persistente esta ativo. Sem isso, o diagnostico continuava exibindo
-- "aguardando restart" mesmo com heartbeats saudaveis.
do $migration$
declare
  v_oid regprocedure := 'public.motor_dispatcher_heartbeat(text,integer)'::regprocedure;
  v_def text := pg_get_functiondef(v_oid);
  v_new text;
begin
  if md5(v_def) <> '89255ece0b9323f9de75682eec32b0b0' then
    raise exception 'DISPATCHER_HEARTBEAT_STALE_VERSION: %',md5(v_def);
  end if;

  v_new:=replace(
    v_def,
    $old$set worker_id=p_worker_id,
         heartbeat_em=clock_timestamp(),$old$,
    $new$set worker_id=p_worker_id,
         motivo=case when v_estado.modo='worker'
           then 'worker_persistente_ativo' else v_estado.motivo end,
         heartbeat_em=clock_timestamp(),$new$
  );
  if v_new=v_def then raise exception 'DISPATCHER_HEARTBEAT_PATCH_FAILED'; end if;
  execute v_new;
end
$migration$;

