-- Rollback da guarda hibrida. Execute somente se o rollout for revertido.
begin;

do $registrar$
declare v_def text; v_novo text;
begin
  select pg_get_functiondef(
    'public.f2_sara_registrar_sugestao_v2(uuid,integer,text,text,text,text,text,jsonb,numeric,integer,timestamp with time zone,numeric,text,text,numeric,jsonb)'::regprocedure
  ) into v_def;
  v_novo:=replace(v_def,
    $old$    when p_origem='deterministica' and p_momento_codigo='CADENCIA_SEM_RESPOSTA'
      and v_lead.etapa not in ('novo','tentando_contato') then 'revisao_humana'
    when p_origem='ia' and not public.f2_sara_transicao_automatica_permitida(
      v_lead.etapa,v_lead.momento_codigo,v_m.etapa,v_m.codigo,
      p_confianca,p_evidencias,p_prazo_sugerido
    ) then 'revisao_humana'
    else 'sugerida' end;$old$,
    $new$    else 'sugerida' end;$new$);
  execute v_novo;
end
$registrar$;

do $aplicar$
declare v_def text; v_novo text;
begin
  select pg_get_functiondef(
    'public.f2_sara_aplicar_analise_v2(bigint,boolean,boolean,boolean,boolean,boolean)'::regprocedure
  ) into v_def;
  v_novo:=replace(v_def,
    $old$  if v_a.origem='deterministica' and v_m.codigo='CADENCIA_SEM_RESPOSTA'
     and v_f.etapa not in ('novo','tentando_contato') then
    update public.f2_sara_analise set status='revisao_humana' where id=v_a.id;
    return jsonb_build_object('ok',true,'aplicado',false,'terminal',true,
      'analise_id',v_a.id,'status','revisao_humana','motivo','regressao_deterministica_bloqueada');
  end if;

  if v_a.origem='ia' and not public.f2_sara_transicao_automatica_permitida(
    v_f.etapa,v_f.momento_codigo,v_m.etapa,v_m.codigo,
    v_a.confianca,v_a.evidencias,v_a.prazo_sugerido
  ) then
    update public.f2_sara_analise set status='revisao_humana' where id=v_a.id;
    return jsonb_build_object('ok',true,'aplicado',false,'terminal',true,
      'analise_id',v_a.id,'status','revisao_humana','motivo','transicao_ia_bloqueada');
  end if;

  v_prazo:=case when$old$,
    $new$  v_prazo:=case when$new$);
  execute v_novo;
end
$aplicar$;

drop function if exists public.f2_sara_transicao_automatica_permitida(
  text,text,text,text,numeric,jsonb,timestamptz
);

commit;
