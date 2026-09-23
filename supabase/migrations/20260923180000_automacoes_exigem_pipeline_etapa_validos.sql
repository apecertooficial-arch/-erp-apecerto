-- Decisão 12: criar ou mover negócio só pode usar uma etapa que ainda exista
-- e pertença ao funil publicado no bloco. A interface já exige as duas
-- escolhas; esta guarda repete o contrato no runtime para cobrir referências
-- removidas ou alteradas depois da publicação.

do $migration$
declare
  v_def text;
  v_new text;
begin
  select pg_get_functiondef(
    'public.motor_acoes(bigint,text,text,jsonb,jsonb,bigint,bigint,integer)'::regprocedure
  ) into v_def;

  v_new := replace(
    v_def,
    $old$    v_tambem := coalesce( (ao->>'tambemLead')::boolean, true );

    if act_name='apply-ai-analysis-action' then$old$,
    $new$    v_tambem := coalesce( (ao->>'tambemLead')::boolean, true );

    if act_name in ('create-business-action','move-business-action')
       and not exists (
         select 1
           from public.pipelines p
           join public.pipeline_stages s on s.pipeline_id = p.id
          where p.id = v_pipe
            and s.id = v_stage
       ) then
      insert into public.motor_execucoes(
        automacao_id,automacao_nome,bloco_id,evento,status,
        lead_nome,lead_telefone,detalhe
      ) values (
        p_auto,p_nome,p_bloco,'acao','erro',p_lead->>'nome',v_tel,
        'AUTOMATION_PIPELINE_STAGE_UNAVAILABLE: funil e etapa precisam existir e corresponder'
      );
      continue;
    end if;

    if act_name='apply-ai-analysis-action' then$new$
  );

  if v_new = v_def
     or position('AUTOMATION_PIPELINE_STAGE_UNAVAILABLE' in v_new) = 0
     or position('s.pipeline_id = p.id' in v_new) = 0 then
    raise exception 'motor_acoes sem ancora para validar funil e etapa';
  end if;

  execute v_new;
end
$migration$;

do $verify$
declare
  v_def text := pg_get_functiondef(
    'public.motor_acoes(bigint,text,text,jsonb,jsonb,bigint,bigint,integer)'::regprocedure
  );
begin
  if position('AUTOMATION_PIPELINE_STAGE_UNAVAILABLE' in v_def) = 0
     or position('join public.pipeline_stages s on s.pipeline_id = p.id' in v_def) = 0 then
    raise exception 'guarda de funil e etapa não foi instalada';
  end if;
end
$verify$;

