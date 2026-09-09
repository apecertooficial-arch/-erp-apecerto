-- Leads novos podem registrar a atribuicao Meta antes de o bloco de acao
-- criar o negocio. Este fallback idempotente roda imediatamente depois de a
-- acao devolver lead_id/negocio_id. Nao reprocessa historico e uma falha de
-- tracking nunca reverte a criacao operacional do lead ou do negocio.

begin;

do $patch_after_action$
declare
  v_def text;
  v_new text;
begin
  v_def:=pg_get_functiondef(
    'public.motor_rodar_unchecked(bigint,jsonb,text,integer)'::regprocedure
  );
  if position('META_INITIAL_LEAD_AFTER_ACTION' in v_def)>0 then
    return;
  end if;

  v_new:=replace(
    v_def,
    $old$        v_negocio_id:=nullif(_res->>'negocio_id','')::bigint;$old$,
    $new$        v_negocio_id:=nullif(_res->>'negocio_id','')::bigint;
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
        end;$new$
  );

  if v_new=v_def or position('META_INITIAL_LEAD_AFTER_ACTION' in v_new)=0 then
    raise exception 'META_INITIAL_LEAD_AFTER_ACTION_PATCH_FAILED';
  end if;
  execute v_new;
end
$patch_after_action$;

commit;
