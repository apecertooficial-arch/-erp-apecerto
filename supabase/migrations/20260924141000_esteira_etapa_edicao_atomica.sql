-- Esteira: edição de etapa e auditoria mudam na mesma transação idempotente.

create unique index if not exists erp_auditoria_esteira_etapa_atualizar_request_uidx
  on public.erp_auditoria ((depois->>'request_id'))
  where modulo='Esteira' and entidade='esteira_etapas'
    and acao='atualizar etapa' and depois ? 'request_id';

create or replace function public.esteira_etapa_atualizar(
  p_etapa_id uuid,
  p_patch jsonb,
  p_request_id uuid
)
returns jsonb
language plpgsql
security invoker
set search_path=public,pg_temp
as $function$
declare
  v_uid uuid:=auth.uid();
  v_etapa_antes public.esteira_etapas;
  v_etapa_depois public.esteira_etapas;
  v_auditoria public.erp_auditoria;
  v_patch jsonb:='{}'::jsonb;
  v_text text;
  v_sla integer;
  v_resultado jsonb;
begin
  if v_uid is null or not coalesce(public.papel_no_grupo('esteira_config'),false) then
    raise exception 'ESTEIRA_ETAPA_EDICAO_SEM_PERMISSAO: Apenas administradores podem editar etapas.' using errcode='42501';
  end if;
  if p_etapa_id is null or p_request_id is null or p_patch is null or jsonb_typeof(p_patch)<>'object'
     or p_patch='{}'::jsonb or exists(
       select 1 from jsonb_object_keys(p_patch) as k(chave)
       where k.chave not in ('nome','cor','papel','sla_dias','resale','exige_docs')
     ) then
    raise exception 'ESTEIRA_ETAPA_EDICAO_DADOS_INVALIDOS: Etapa, campos ou solicitação inválida.';
  end if;
  if p_patch ? 'nome' then
    if jsonb_typeof(p_patch->'nome')<>'string' then raise exception 'ESTEIRA_ETAPA_EDICAO_DADOS_INVALIDOS: Nome inválido.'; end if;
    v_text:=btrim(p_patch->>'nome');
    if v_text='' or length(v_text)>80 then raise exception 'ESTEIRA_ETAPA_EDICAO_DADOS_INVALIDOS: Nome inválido.'; end if;
    v_patch:=v_patch||jsonb_build_object('nome',v_text);
  end if;
  if p_patch ? 'cor' then
    if jsonb_typeof(p_patch->'cor')<>'string' then raise exception 'ESTEIRA_ETAPA_EDICAO_DADOS_INVALIDOS: Cor inválida.'; end if;
    v_text:=btrim(p_patch->>'cor');
    if v_text='' or length(v_text)>20 then raise exception 'ESTEIRA_ETAPA_EDICAO_DADOS_INVALIDOS: Cor inválida.'; end if;
    v_patch:=v_patch||jsonb_build_object('cor',v_text);
  end if;
  if p_patch ? 'papel' then
    if jsonb_typeof(p_patch->'papel')<>'string' then raise exception 'ESTEIRA_ETAPA_EDICAO_DADOS_INVALIDOS: Papel inválido.'; end if;
    v_text:=btrim(p_patch->>'papel');
    if v_text='' or length(v_text)>40 then raise exception 'ESTEIRA_ETAPA_EDICAO_DADOS_INVALIDOS: Papel inválido.'; end if;
    v_patch:=v_patch||jsonb_build_object('papel',v_text);
  end if;
  if p_patch ? 'sla_dias' then
    if jsonb_typeof(p_patch->'sla_dias')<>'number' then raise exception 'ESTEIRA_ETAPA_EDICAO_DADOS_INVALIDOS: SLA inválido.'; end if;
    begin v_sla:=(p_patch->>'sla_dias')::integer;
    exception when invalid_text_representation or numeric_value_out_of_range then
      raise exception 'ESTEIRA_ETAPA_EDICAO_DADOS_INVALIDOS: SLA inválido.';
    end;
    if v_sla<0 or v_sla>3650 or v_sla::numeric<>(p_patch->>'sla_dias')::numeric then
      raise exception 'ESTEIRA_ETAPA_EDICAO_DADOS_INVALIDOS: SLA inválido.';
    end if;
    v_patch:=v_patch||jsonb_build_object('sla_dias',v_sla);
  end if;
  if p_patch ? 'resale' then
    if jsonb_typeof(p_patch->'resale')<>'boolean' then raise exception 'ESTEIRA_ETAPA_EDICAO_DADOS_INVALIDOS: Indicador de revenda inválido.'; end if;
    v_patch:=v_patch||jsonb_build_object('resale',(p_patch->>'resale')::boolean);
  end if;
  if p_patch ? 'exige_docs' then
    if jsonb_typeof(p_patch->'exige_docs')<>'boolean' then raise exception 'ESTEIRA_ETAPA_EDICAO_DADOS_INVALIDOS: Indicador de documentos inválido.'; end if;
    v_patch:=v_patch||jsonb_build_object('exige_docs',(p_patch->>'exige_docs')::boolean);
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_request_id::text,0));
  select * into v_auditoria from public.erp_auditoria a
    where a.modulo='Esteira' and a.entidade='esteira_etapas' and a.acao='atualizar etapa'
      and a.depois->>'request_id'=p_request_id::text
    order by a.criado_em desc,a.id desc limit 1;
  if found then
    if v_auditoria.depois->'solicitacao'=jsonb_build_object('etapa_id',p_etapa_id,'patch',v_patch) then
      v_resultado:=v_auditoria.depois->'resultado';
      return v_resultado||jsonb_build_object('ok',true,'idempotente',true);
    end if;
    raise exception 'ESTEIRA_ETAPA_EDICAO_REQUEST_CONFLITANTE: Esta solicitação já foi usada com outra alteração. Atualize a tela.';
  end if;

  select * into v_etapa_antes from public.esteira_etapas e where e.id=p_etapa_id and e.ativo for update;
  if not found then raise exception 'ESTEIRA_ETAPA_EDICAO_NAO_ENCONTRADA: A etapa não existe ou não está ativa.'; end if;
  update public.esteira_etapas set
    nome=case when v_patch ? 'nome' then v_patch->>'nome' else nome end,
    cor=case when v_patch ? 'cor' then v_patch->>'cor' else cor end,
    papel=case when v_patch ? 'papel' then v_patch->>'papel' else papel end,
    sla_dias=case when v_patch ? 'sla_dias' then (v_patch->>'sla_dias')::integer else sla_dias end,
    resale=case when v_patch ? 'resale' then (v_patch->>'resale')::boolean else resale end,
    exige_docs=case when v_patch ? 'exige_docs' then (v_patch->>'exige_docs')::boolean else exige_docs end
  where id=p_etapa_id and ativo returning * into v_etapa_depois;

  v_resultado:=jsonb_build_object('etapa_id',v_etapa_depois.id,'slug',v_etapa_depois.slug);
  insert into public.erp_auditoria(
    usuario_id,usuario_nome,acao,modulo,entidade,entidade_id,antes,depois,detalhe
  ) values (
    v_uid,coalesce((select u.nome from public.usuarios u where u.id=v_uid),'sistema/automação'),
    'atualizar etapa','Esteira','esteira_etapas',p_etapa_id::text,to_jsonb(v_etapa_antes),
    jsonb_build_object('request_id',p_request_id,'solicitacao',jsonb_build_object('etapa_id',p_etapa_id,'patch',v_patch),
      'resultado',v_resultado,'estado',to_jsonb(v_etapa_depois)),
    'Configuração da etapa alterada em transação auditada e idempotente.'
  );
  return v_resultado||jsonb_build_object('ok',true,'idempotente',false);
end
$function$;

comment on function public.esteira_etapa_atualizar(uuid,jsonb,uuid) is
  'Atualiza campos permitidos de uma etapa ativa com auditoria e retry idempotente. SECURITY INVOKER.';
revoke all on function public.esteira_etapa_atualizar(uuid,jsonb,uuid) from public,anon;
grant execute on function public.esteira_etapa_atualizar(uuid,jsonb,uuid) to authenticated,service_role;
notify pgrst,'reload schema';
