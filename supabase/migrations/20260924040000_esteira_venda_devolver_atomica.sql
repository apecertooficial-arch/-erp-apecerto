-- Esteira: devolver uma venda atualiza processo, negócio e auditoria juntos.

create unique index if not exists erp_auditoria_esteira_devolucao_request_uidx
  on public.erp_auditoria ((depois->>'request_id'))
  where modulo='Esteira' and entidade='venda_processos'
    and acao='devolver ao funil' and depois ? 'request_id';

create or replace function public.esteira_venda_devolver(
  p_processo_id uuid,
  p_stage_id bigint,
  p_motivo text,
  p_request_id uuid
)
returns jsonb
language plpgsql
security invoker
set search_path=public,pg_temp
as $function$
declare
  v_uid uuid:=auth.uid();
  v_motivo text:=nullif(left(btrim(p_motivo),400),'');
  v_processo_antes public.venda_processos;
  v_processo_depois public.venda_processos;
  v_negocio_antes public.negocios;
  v_negocio_depois public.negocios;
  v_stage public.pipeline_stages;
  v_auditoria public.erp_auditoria;
  v_solicitacao jsonb;
begin
  if v_uid is null or not coalesce(public.papel_no_grupo('esteira_config'),false) then
    raise exception 'VENDA_DEVOLVER_SEM_PERMISSAO: Apenas administradores podem devolver vendas.' using errcode='42501';
  end if;
  if p_processo_id is null or p_stage_id is null or p_stage_id<=0 or p_request_id is null then
    raise exception 'VENDA_DEVOLVER_DADOS_INVALIDOS: Venda, etapa ou solicitação inválida.';
  end if;
  v_solicitacao:=jsonb_build_object('processo_id',p_processo_id,'stage_id',p_stage_id,'motivo',v_motivo);
  perform pg_advisory_xact_lock(hashtextextended(p_request_id::text,0));
  select * into v_auditoria from public.erp_auditoria a
    where a.modulo='Esteira' and a.entidade='venda_processos'
      and a.acao='devolver ao funil' and a.depois->>'request_id'=p_request_id::text
    order by a.criado_em desc,a.id desc limit 1;
  if found then
    if v_auditoria.depois->'solicitacao'=v_solicitacao then
      return jsonb_build_object('ok',true,'processo_id',p_processo_id,
        'negocio_id',(v_auditoria.depois->'negocio'->>'id')::bigint,'idempotente',true);
    end if;
    raise exception 'VENDA_DEVOLVER_REQUEST_CONFLITANTE: Esta solicitação já foi usada com outros dados. Atualize a tela.';
  end if;

  select * into v_processo_antes from public.venda_processos p where p.id=p_processo_id for update;
  if not found or v_processo_antes.negocio_id is null then
    raise exception 'VENDA_DEVOLVER_NAO_ENCONTRADA: Venda ou negócio vinculado não encontrado.';
  end if;
  select * into v_stage from public.pipeline_stages s where s.id=p_stage_id;
  if not found then raise exception 'VENDA_DEVOLVER_DADOS_INVALIDOS: Etapa de destino inválida.'; end if;
  select * into v_negocio_antes from public.negocios n where n.id=v_processo_antes.negocio_id for update;
  if not found then raise exception 'VENDA_DEVOLVER_NAO_ENCONTRADA: Negócio vinculado não encontrado.'; end if;

  if v_processo_antes.aprovacao_status='devolvida' and v_negocio_antes.venda_id is null
     and v_negocio_antes.status='aberto' and v_negocio_antes.stage_id=p_stage_id
     and v_processo_antes.aprovacao_motivo is not distinct from v_motivo then
    return jsonb_build_object('ok',true,'processo_id',p_processo_id,
      'negocio_id',v_negocio_antes.id,'idempotente',true);
  end if;
  if v_processo_antes.aprovacao_status in ('devolvida','recusada')
     or v_negocio_antes.venda_id is distinct from v_processo_antes.venda_id then
    raise exception 'VENDA_DEVOLVER_CONFLITO: Venda e negócio não estão mais no estado esperado. Atualize a tela.';
  end if;

  update public.negocios set status='aberto',venda_id=null,pipeline_id=v_stage.pipeline_id,
    stage_id=v_stage.id,estagio_desde=now(),ultima_movimentacao=now()
    where id=v_negocio_antes.id returning * into v_negocio_depois;
  update public.venda_processos set aprovacao_status='devolvida',aprovacao_motivo=v_motivo,
    atualizado_em=now() where id=p_processo_id returning * into v_processo_depois;

  insert into public.erp_auditoria(
    usuario_id,usuario_nome,acao,modulo,entidade,entidade_id,antes,depois,detalhe
  ) values (
    v_uid,coalesce((select u.nome from public.usuarios u where u.id=v_uid),'sistema/automação'),
    'devolver ao funil','Esteira','venda_processos',p_processo_id::text,
    jsonb_build_object('processo',to_jsonb(v_processo_antes),'negocio',to_jsonb(v_negocio_antes)),
    jsonb_build_object('request_id',p_request_id,'solicitacao',v_solicitacao,
      'processo',to_jsonb(v_processo_depois),'negocio',to_jsonb(v_negocio_depois)),
    'Processo e negócio devolvidos ao atendimento em transação auditada e idempotente.'
  );
  return jsonb_build_object('ok',true,'processo_id',p_processo_id,
    'negocio_id',v_negocio_depois.id,'idempotente',false);
exception when unique_violation then
  raise exception 'VENDA_DEVOLVER_CONFLITO: A devolução já foi processada em paralelo. Atualize a tela.';
end
$function$;

comment on function public.esteira_venda_devolver(uuid,bigint,text,uuid) is
  'Devolve processo e negócio ao funil com auditoria e retry idempotente. SECURITY INVOKER.';
revoke all on function public.esteira_venda_devolver(uuid,bigint,text,uuid) from public,anon;
grant execute on function public.esteira_venda_devolver(uuid,bigint,text,uuid) to authenticated,service_role;
notify pgrst,'reload schema';
