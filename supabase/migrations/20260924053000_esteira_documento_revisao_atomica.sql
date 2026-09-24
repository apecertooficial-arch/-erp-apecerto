-- Esteira: revisão do documento e respectiva trilha são uma única transação.

create unique index if not exists esteira_anexo_eventos_status_request_uidx
  on public.esteira_anexo_eventos ((detalhe->>'request_id'))
  where evento='status_alterado' and detalhe ? 'request_id';

create or replace function public.esteira_anexo_revisar(
  p_anexo_id uuid,
  p_status text,
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
  v_status text:=lower(btrim(coalesce(p_status,'')));
  v_motivo text:=nullif(left(btrim(coalesce(p_motivo,'')),400),'');
  v_antes public.esteira_anexos;
  v_depois public.esteira_anexos;
  v_evento public.esteira_anexo_eventos;
  v_solicitacao jsonb;
  v_resultado jsonb;
begin
  if v_uid is null or not coalesce(public.papel_no_grupo('esteira_config'),false) then
    raise exception 'ESTEIRA_DOC_SEM_PERMISSAO: Apenas administradores podem revisar documentos.' using errcode='42501';
  end if;
  if p_anexo_id is null or p_request_id is null
     or v_status not in ('anexado','em_analise','aprovado','recusado','correcao') then
    raise exception 'ESTEIRA_DOC_DADOS_INVALIDOS: Documento, status ou solicitação inválida.';
  end if;
  if v_status in ('recusado','correcao') and v_motivo is null then
    raise exception 'ESTEIRA_DOC_DADOS_INVALIDOS: Informe o motivo da recusa/correção.';
  end if;

  v_solicitacao:=jsonb_build_object(
    'anexo_id',p_anexo_id,'status',v_status,'motivo',v_motivo
  );
  perform pg_advisory_xact_lock(hashtextextended(p_request_id::text,0));
  select * into v_evento
  from public.esteira_anexo_eventos e
  where e.evento='status_alterado' and e.detalhe->>'request_id'=p_request_id::text
  order by e.criado_em desc,e.id desc limit 1;
  if found then
    if v_evento.detalhe->'solicitacao'=v_solicitacao then
      v_resultado:=v_evento.detalhe->'resultado';
      return v_resultado||jsonb_build_object('ok',true,'idempotente',true);
    end if;
    raise exception 'ESTEIRA_DOC_REQUEST_CONFLITANTE: Esta solicitação já foi usada com outros dados. Atualize a tela.';
  end if;

  select * into v_antes
  from public.esteira_anexos a
  where a.id=p_anexo_id
  for update;
  if not found then
    raise exception 'ESTEIRA_DOC_NAO_ENCONTRADO: Documento não encontrado ou indisponível.';
  end if;

  update public.esteira_anexos
  set status=v_status,
      status_motivo=v_motivo,
      revisado_por=v_uid,
      revisado_em=now()
  where id=p_anexo_id
  returning * into v_depois;

  v_resultado:=jsonb_build_object('anexo_id',v_depois.id,'status',v_depois.status);
  insert into public.esteira_anexo_eventos(
    anexo_id,processo_ref,evento,detalhe,ator,ator_nome
  ) values (
    v_depois.id,v_depois.processo_ref,'status_alterado',
    jsonb_build_object(
      'arquivo',v_depois.nome,'de',v_antes.status,'para',v_depois.status,'motivo',v_depois.status_motivo,
      'request_id',p_request_id,'solicitacao',v_solicitacao,'resultado',v_resultado
    ),
    v_uid,coalesce((select u.nome from public.usuarios u where u.id=v_uid),'sistema/automação')
  );
  return v_resultado||jsonb_build_object('ok',true,'idempotente',false);
exception when unique_violation then
  raise exception 'ESTEIRA_DOC_CONFLITO: A revisão mudou enquanto você trabalhava. Atualize a tela.';
end
$function$;

comment on function public.esteira_anexo_revisar(uuid,text,text,uuid) is
  'Atualiza status de anexo e grava a trilha na mesma transação, com retry idempotente. SECURITY INVOKER.';
revoke all on function public.esteira_anexo_revisar(uuid,text,text,uuid) from public,anon;
grant execute on function public.esteira_anexo_revisar(uuid,text,text,uuid) to authenticated,service_role;
notify pgrst,'reload schema';
