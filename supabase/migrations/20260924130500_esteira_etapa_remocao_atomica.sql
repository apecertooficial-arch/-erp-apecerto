-- Esteira: serializa a desativação de etapas com qualquer entrada de processo nelas.

create unique index if not exists erp_auditoria_esteira_etapa_remover_request_uidx
  on public.erp_auditoria ((depois->>'request_id'))
  where modulo='Esteira' and entidade='esteira_etapas'
    and acao='remover etapa' and depois ? 'request_id';

create or replace function public.esteira_processo_exigir_etapa_ativa()
returns trigger
language plpgsql
security invoker
set search_path=public,pg_temp
as $function$
begin
  if tg_op='UPDATE' and new.etapa is not distinct from old.etapa then
    return new;
  end if;

  perform 1
  from public.esteira_etapas
  where slug=new.etapa and ativo
  for share;
  if not found then
    raise exception 'ESTEIRA_PROCESSO_ETAPA_INATIVA: A etapa de destino não está mais ativa. Atualize a tela.';
  end if;
  return new;
end
$function$;

drop trigger if exists venda_processos_etapa_ativa_guard on public.venda_processos;
create trigger venda_processos_etapa_ativa_guard
before insert or update of etapa on public.venda_processos
for each row execute function public.esteira_processo_exigir_etapa_ativa();

create or replace function public.esteira_etapa_remover(
  p_etapa_id uuid,
  p_request_id uuid
)
returns jsonb
language plpgsql
security invoker
set search_path=public,pg_temp
as $function$
declare
  v_uid uuid:=auth.uid();
  v_etapa public.esteira_etapas;
  v_total_vendas integer;
  v_auditoria public.erp_auditoria;
  v_solicitacao jsonb;
  v_resultado jsonb;
begin
  if v_uid is null or not coalesce(public.papel_no_grupo('esteira_config'),false) then
    raise exception 'ESTEIRA_ETAPA_REMOCAO_SEM_PERMISSAO: Apenas administradores podem excluir etapas.' using errcode='42501';
  end if;
  if p_etapa_id is null or p_request_id is null then
    raise exception 'ESTEIRA_ETAPA_REMOCAO_DADOS_INVALIDOS: Informe a etapa e a solicitação.';
  end if;

  v_solicitacao:=jsonb_build_object('etapa_id',p_etapa_id);
  perform pg_advisory_xact_lock(hashtextextended('esteira_etapas_ordem',0));

  select * into v_auditoria
  from public.erp_auditoria a
  where a.modulo='Esteira' and a.entidade='esteira_etapas' and a.acao='remover etapa'
    and a.depois->>'request_id'=p_request_id::text
  order by a.criado_em desc,a.id desc limit 1;
  if found then
    if v_auditoria.depois->'solicitacao'=v_solicitacao then
      v_resultado:=v_auditoria.depois->'resultado';
      return v_resultado||jsonb_build_object('ok',true,'idempotente',true);
    end if;
    raise exception 'ESTEIRA_ETAPA_REMOCAO_REQUEST_CONFLITANTE: Esta solicitação já foi usada para outra etapa. Atualize a tela.';
  end if;

  select * into v_etapa
  from public.esteira_etapas
  where id=p_etapa_id and ativo
  for update;
  if not found then
    raise exception 'ESTEIRA_ETAPA_REMOCAO_NAO_ENCONTRADA: A etapa não existe ou já foi excluída. Atualize a tela.';
  end if;

  select count(*)::integer into v_total_vendas
  from public.venda_processos where etapa=v_etapa.slug;
  if v_total_vendas>0 then
    raise exception 'ESTEIRA_ETAPA_REMOCAO_COM_VENDAS: Esta etapa tem vendas. Mova cada venda individualmente antes de excluir.';
  end if;

  update public.esteira_etapas set ativo=false where id=v_etapa.id and ativo;
  v_resultado:=jsonb_build_object('etapa_id',v_etapa.id,'slug',v_etapa.slug);
  insert into public.erp_auditoria(
    usuario_id,usuario_nome,acao,modulo,entidade,entidade_id,antes,depois,detalhe
  ) values (
    v_uid,coalesce((select u.nome from public.usuarios u where u.id=v_uid),'sistema/automação'),
    'remover etapa','Esteira','esteira_etapas',v_etapa.id::text,
    jsonb_build_object('slug',v_etapa.slug,'nome',v_etapa.nome,'ativo',true),
    jsonb_build_object('request_id',p_request_id,'solicitacao',v_solicitacao,'resultado',v_resultado,'ativo',false),
    'Etapa desativada somente após bloquear sua linha e comprovar que não havia processos vinculados.'
  );
  return v_resultado||jsonb_build_object('ok',true,'idempotente',false);
end
$function$;

comment on function public.esteira_processo_exigir_etapa_ativa() is
  'Bloqueia a etapa compartilhada ao inserir ou mover um processo, impedindo corrida com sua desativação. SECURITY INVOKER.';
comment on function public.esteira_etapa_remover(uuid,uuid) is
  'Desativa uma etapa vazia sob lock exclusivo, com auditoria e retry idempotente. SECURITY INVOKER.';
revoke all on function public.esteira_processo_exigir_etapa_ativa() from public,anon,authenticated;
revoke all on function public.esteira_etapa_remover(uuid,uuid) from public,anon;
grant execute on function public.esteira_etapa_remover(uuid,uuid) to authenticated,service_role;
notify pgrst,'reload schema';
