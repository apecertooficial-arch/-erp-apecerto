-- Esteira: a ordem inteira muda de uma vez, sem colisão no índice único ativo.

create unique index if not exists erp_auditoria_esteira_etapas_ordem_request_uidx
  on public.erp_auditoria ((depois->>'request_id'))
  where modulo='Esteira' and entidade='esteira_etapas'
    and acao='reordenar etapas' and depois ? 'request_id';

create or replace function public.esteira_etapas_reordenar(
  p_ids uuid[],
  p_request_id uuid
)
returns jsonb
language plpgsql
security invoker
set search_path=public,pg_temp
as $function$
declare
  v_uid uuid:=auth.uid();
  v_total integer:=coalesce(array_length(p_ids,1),0);
  v_distintas integer;
  v_ativas integer;
  v_encontradas integer;
  v_auditoria public.erp_auditoria;
  v_solicitacao jsonb;
  v_antes jsonb;
  v_depois jsonb;
  v_resultado jsonb;
begin
  if v_uid is null or not coalesce(public.papel_no_grupo('esteira_config'),false) then
    raise exception 'ESTEIRA_ETAPAS_SEM_PERMISSAO: Apenas administradores podem reordenar as etapas.' using errcode='42501';
  end if;
  if p_request_id is null or v_total<2 then
    raise exception 'ESTEIRA_ETAPAS_DADOS_INVALIDOS: Informe a sequência completa e a solicitação.';
  end if;

  v_solicitacao:=jsonb_build_object('ids',to_jsonb(p_ids));
  perform pg_advisory_xact_lock(hashtextextended('esteira_etapas_ordem',0));
  select * into v_auditoria
  from public.erp_auditoria a
  where a.modulo='Esteira' and a.entidade='esteira_etapas' and a.acao='reordenar etapas'
    and a.depois->>'request_id'=p_request_id::text
  order by a.criado_em desc,a.id desc limit 1;
  if found then
    if v_auditoria.depois->'solicitacao'=v_solicitacao then
      v_resultado:=v_auditoria.depois->'resultado';
      return v_resultado||jsonb_build_object('ok',true,'idempotente',true);
    end if;
    raise exception 'ESTEIRA_ETAPAS_REQUEST_CONFLITANTE: Esta solicitação já foi usada com outra ordem. Atualize a tela.';
  end if;

  select count(distinct item.id)::integer into v_distintas from unnest(p_ids) as item(id);
  select count(*)::integer into v_ativas from public.esteira_etapas where ativo;
  select count(*)::integer into v_encontradas from public.esteira_etapas where ativo and id=any(p_ids);
  if v_distintas<>v_total or v_ativas<>v_total or v_encontradas<>v_total then
    raise exception 'ESTEIRA_ETAPAS_DADOS_INVALIDOS: A sequência precisa conter cada etapa ativa exatamente uma vez.';
  end if;

  perform 1 from public.esteira_etapas where ativo order by ordem,id for update;
  select coalesce(jsonb_agg(jsonb_build_object('id',id,'slug',slug,'ordem',ordem) order by ordem,id),'[]'::jsonb)
  into v_antes from public.esteira_etapas where ativo;

  update public.esteira_etapas
  set ordem=-array_position(p_ids,id)
  where ativo and id=any(p_ids);
  update public.esteira_etapas
  set ordem=array_position(p_ids,id)
  where ativo and id=any(p_ids);

  select coalesce(jsonb_agg(jsonb_build_object('id',id,'slug',slug,'ordem',ordem) order by ordem,id),'[]'::jsonb)
  into v_depois from public.esteira_etapas where ativo;
  v_resultado:=jsonb_build_object('etapas',v_total);
  insert into public.erp_auditoria(
    usuario_id,usuario_nome,acao,modulo,entidade,entidade_id,antes,depois,detalhe
  ) values (
    v_uid,coalesce((select u.nome from public.usuarios u where u.id=v_uid),'sistema/automação'),
    'reordenar etapas','Esteira','esteira_etapas','configuracao',v_antes,
    jsonb_build_object('request_id',p_request_id,'solicitacao',v_solicitacao,'resultado',v_resultado,'ordem',v_depois),
    'Sequência completa das etapas alterada em transação auditada e idempotente.'
  );
  return v_resultado||jsonb_build_object('ok',true,'idempotente',false);
exception when unique_violation then
  raise exception 'ESTEIRA_ETAPAS_CONFLITO: A ordem mudou enquanto você trabalhava. Atualize a tela.';
end
$function$;

comment on function public.esteira_etapas_reordenar(uuid[],uuid) is
  'Reordena todas as etapas ativas sem colisão intermediária, com auditoria e retry idempotente. SECURITY INVOKER.';
revoke all on function public.esteira_etapas_reordenar(uuid[],uuid) from public,anon;
grant execute on function public.esteira_etapas_reordenar(uuid[],uuid) to authenticated,service_role;
notify pgrst,'reload schema';
