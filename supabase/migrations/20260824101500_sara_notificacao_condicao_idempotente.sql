-- Uma analise reutilizada pelo context_hash ja foi aplicada em outra execucao.
-- Reaplica-la e seguro, mas nao representa uma nova mudanca e nao pode gerar
-- novamente os avisos condicionais. Tambem evita casts booleanos ambiguos no
-- avaliador das condicoes de notificacao.

begin;

set local statement_timeout = '60s';
set local lock_timeout = '10s';

select pg_advisory_xact_lock(hashtext('central_sara_notificacao_condicional'));

do $patch_apply$
declare
  v_def text;
  v_new text;
begin
  select pg_get_functiondef(
    'public.f2_sara_aplicar_analise_v2(bigint,boolean,boolean,boolean,boolean,boolean)'::regprocedure
  ) into v_def;
  if md5(v_def) <> '28e3af5dda902c5c653e15c3bd5c9aaa' then
    raise exception 'f2_sara_aplicar_analise_v2 mudou: %',md5(v_def);
  end if;
  v_new:=replace(
    v_def,
    $old$    return jsonb_build_object('ok',true,'aplicado',true,'idempotente',true,
      'analise_id',v_a.id,'status',v_a.status);$old$,
    $new$    return jsonb_build_object('ok',true,'aplicado',false,'idempotente',true,
      'analise_id',v_a.id,'status',v_a.status);$new$
  );
  if v_new=v_def then raise exception 'ancora idempotente da Sara nao encontrada'; end if;
  execute v_new;
end
$patch_apply$;

do $patch_notification$
declare
  v_def text;
  v_new text;
begin
  select pg_get_functiondef(
    'public.motor_acoes(bigint,text,text,jsonb,jsonb,bigint,bigint,integer)'::regprocedure
  ) into v_def;
  if md5(v_def) <> 'c3d5edfefaa01ccb79e84441b585773e' then
    raise exception 'motor_acoes mudou: %',md5(v_def);
  end if;

  v_new:=replace(
    v_def,
    $old$        if nullif(ao->>'somenteAiEtapaAlteradaPara','') is not null
           and not (
             coalesce((p_lead->>'__ai_aplicado')::boolean,false)
             and p_lead->>'__ai_etapa_nova'=ao->>'somenteAiEtapaAlteradaPara'
             and p_lead->>'__ai_etapa_anterior' is distinct from p_lead->>'__ai_etapa_nova'
           ) then
          insert into motor_execucoes(
            automacao_id,automacao_nome,bloco_id,evento,status,
            lead_nome,lead_telefone,detalhe
          ) values(
            p_auto,p_nome,p_bloco,'acao','ok',p_lead->>'nome',v_tel,
            'Aviso ignorado: a etapa nao mudou para '||ao->>'somenteAiEtapaAlteradaPara'
          );
          continue;
        end if;$old$,
    $new$        if nullif(ao->>'somenteAiEtapaAlteradaPara','') is not null then
          if not (
            coalesce(p_lead->>'__ai_aplicado','false')='true'
            and coalesce(p_lead->>'__ai_etapa_nova','')=ao->>'somenteAiEtapaAlteradaPara'
            and coalesce(p_lead->>'__ai_etapa_anterior','')<>coalesce(p_lead->>'__ai_etapa_nova','')
          ) then
            insert into motor_execucoes(
              automacao_id,automacao_nome,bloco_id,evento,status,
              lead_nome,lead_telefone,detalhe
            ) values(
              p_auto,p_nome,p_bloco,'acao','ok',p_lead->>'nome',v_tel,
              'Aviso ignorado: a etapa nao mudou para '||ao->>'somenteAiEtapaAlteradaPara'
            );
            continue;
          end if;
        end if;$new$
  );

  v_new:=replace(
    v_new,
    $old$        if nullif(ao->>'somenteAiTemperaturaAlteradaPara','') is not null
           and not (
             coalesce((p_lead->>'__ai_aplicado')::boolean,false)
             and p_lead->>'__ai_temperatura_nova'=ao->>'somenteAiTemperaturaAlteradaPara'
             and p_lead->>'__ai_temperatura_anterior' is distinct from p_lead->>'__ai_temperatura_nova'
           ) then
          insert into motor_execucoes(automacao_id,automacao_nome,bloco_id,evento,status,lead_nome,lead_telefone,detalhe)
          values(p_auto,p_nome,p_bloco,'acao','ok',p_lead->>'nome',v_tel,
            'Aviso ignorado: a temperatura nao mudou para '||ao->>'somenteAiTemperaturaAlteradaPara');
          continue;
        end if;$old$,
    $new$        if nullif(ao->>'somenteAiTemperaturaAlteradaPara','') is not null then
          if not (
            coalesce(p_lead->>'__ai_aplicado','false')='true'
            and coalesce(p_lead->>'__ai_temperatura_nova','')=ao->>'somenteAiTemperaturaAlteradaPara'
            and coalesce(p_lead->>'__ai_temperatura_anterior','')<>coalesce(p_lead->>'__ai_temperatura_nova','')
          ) then
            insert into motor_execucoes(automacao_id,automacao_nome,bloco_id,evento,status,lead_nome,lead_telefone,detalhe)
            values(p_auto,p_nome,p_bloco,'acao','ok',p_lead->>'nome',v_tel,
              'Aviso ignorado: a temperatura nao mudou para '||ao->>'somenteAiTemperaturaAlteradaPara');
            continue;
          end if;
        end if;$new$
  );

  if v_new=v_def then raise exception 'ancoras de notificacao condicional nao encontradas'; end if;
  execute v_new;
end
$patch_notification$;

commit;
