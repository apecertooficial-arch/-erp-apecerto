-- Sara hibrida: fatos objetivos pertencem ao banco; a IA interpreta somente
-- intencoes dentro de uma transicao segura. Defesa aplicada no registro e,
-- novamente, imediatamente antes de qualquer alteracao do card.
begin;

set local statement_timeout='90s';
set local lock_timeout='10s';
select pg_advisory_xact_lock(hashtextextended('sara_inteligencia_hibrida_guardas',0));

create or replace function public.f2_sara_transicao_automatica_permitida(
  p_etapa_atual text,
  p_momento_atual text,
  p_etapa_sugerida text,
  p_momento_sugerido text,
  p_confianca numeric,
  p_evidencias jsonb,
  p_prazo_sugerido timestamptz
) returns boolean
language sql
stable
set search_path=''
as $fn$
  select case
    -- Manter o estado atual permite atualizar somente qualidade/temperatura.
    when p_momento_sugerido=p_momento_atual then true
    -- Visita, pos-visita, pescado, legado e atualizacao manual dependem de
    -- eventos operacionais do CRM; conversa nao regressa nem avanca essas etapas.
    when p_etapa_atual in ('visita','pos_visita','pescado','legado','atualizar_manual') then false
    -- Estes codigos representam fatos, nao intencoes inferidas.
    when p_momento_sugerido in (
      'PRIMEIRA_ABORDAGEM','CADENCIA_CONTATO','CADENCIA_SEM_RESPOSTA','CADENCIA_PESCADO',
      'VISITA_AGENDADA','VISITA_REALIZADA','VISITA_CANCELADA','COLETAR_FEEDBACK',
      'REMARCAR_VISITA','ACOMPANHAMENTO_POS_VISITA'
    ) then false
    when p_etapa_sugerida<>'em_atendimento' then false
    when jsonb_typeof(coalesce(p_evidencias,'[]'::jsonb))<>'array'
      or jsonb_array_length(coalesce(p_evidencias,'[]'::jsonb))=0 then false
    when p_momento_sugerido in ('TENTANDO_AGENDAMENTO','RETORNO_PROGRAMADO','RETOMAR_NA_DATA')
      and coalesce(p_confianca,0)<0.90 then false
    when p_etapa_atual='em_atendimento' and coalesce(p_confianca,0)<0.80 then false
    when p_etapa_atual in ('novo','tentando_contato') and coalesce(p_confianca,0)<0.85 then false
    when p_momento_sugerido in ('RETORNO_PROGRAMADO','RETOMAR_NA_DATA')
      and (p_prazo_sugerido is null or p_prazo_sugerido<=now()
        or p_prazo_sugerido>now()+interval '30 days') then false
    else true
  end;
$fn$;

revoke all on function public.f2_sara_transicao_automatica_permitida(
  text,text,text,text,numeric,jsonb,timestamptz
) from public,anon,authenticated;
grant execute on function public.f2_sara_transicao_automatica_permitida(
  text,text,text,text,numeric,jsonb,timestamptz
) to service_role;

do $registrar$
declare v_def text; v_novo text;
begin
  select pg_get_functiondef(
    'public.f2_sara_registrar_sugestao_v2(uuid,integer,text,text,text,text,text,jsonb,numeric,integer,timestamp with time zone,numeric,text,text,numeric,jsonb)'::regprocedure
  ) into v_def;
  if position('f2_sara_transicao_automatica_permitida' in v_def)>0 then return; end if;
  v_novo:=replace(v_def,
    $old$    else 'sugerida' end;$old$,
    $new$    when p_origem='deterministica' and p_momento_codigo='CADENCIA_SEM_RESPOSTA'
      and v_lead.etapa not in ('novo','tentando_contato') then 'revisao_humana'
    when p_origem='ia' and not public.f2_sara_transicao_automatica_permitida(
      v_lead.etapa,v_lead.momento_codigo,v_m.etapa,v_m.codigo,
      p_confianca,p_evidencias,p_prazo_sugerido
    ) then 'revisao_humana'
    else 'sugerida' end;$new$);
  if v_novo=v_def then raise exception 'sara_registro_sem_anchor_de_guarda'; end if;
  execute v_novo;
end
$registrar$;

do $aplicar$
declare v_def text; v_novo text;
begin
  select pg_get_functiondef(
    'public.f2_sara_aplicar_analise_v2(bigint,boolean,boolean,boolean,boolean,boolean)'::regprocedure
  ) into v_def;
  if position('transicao_ia_bloqueada' in v_def)>0 then return; end if;
  v_novo:=replace(v_def,
    $old$  v_prazo:=case when$old$,
    $new$  if v_a.origem='deterministica' and v_m.codigo='CADENCIA_SEM_RESPOSTA'
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

  v_prazo:=case when$new$);
  if v_novo=v_def then raise exception 'sara_aplicacao_sem_anchor_de_guarda'; end if;
  execute v_novo;
end
$aplicar$;

comment on function public.f2_sara_transicao_automatica_permitida(
  text,text,text,text,numeric,jsonb,timestamptz
) is 'Guarda hibrida: banco confirma fatos; IA so altera intencao semantica com evidencia, confianca e transicao permitida.';

commit;
