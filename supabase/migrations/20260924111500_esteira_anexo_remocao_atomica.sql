-- Esteira: remover o registro do anexo e gravar a trilha são uma única transação idempotente.

create unique index if not exists esteira_anexo_eventos_remocao_request_uidx
  on public.esteira_anexo_eventos ((detalhe->>'request_id'))
  where evento='removido' and detalhe ? 'request_id';

create or replace function public.esteira_anexo_remover(
  p_anexo_id uuid,
  p_request_id uuid
)
returns jsonb
language plpgsql
security invoker
set search_path=public,pg_temp
as $function$
declare
  v_uid uuid:=auth.uid();
  v_role text;
  v_nome text;
  v_bloco text;
  v_antes public.esteira_anexos;
  v_etapa public.esteira_etapas;
  v_evento public.esteira_anexo_eventos;
  v_solicitacao jsonb;
  v_resultado jsonb;
begin
  if v_uid is null then
    raise exception 'ESTEIRA_ANEXO_SEM_PERMISSAO: Sessão inválida ou expirada.' using errcode='42501';
  end if;
  if p_anexo_id is null or p_request_id is null then
    raise exception 'ESTEIRA_ANEXO_DADOS_INVALIDOS: Documento ou solicitação inválida.';
  end if;
  v_solicitacao:=jsonb_build_object('anexo_id',p_anexo_id);

  perform pg_advisory_xact_lock(hashtextextended(p_request_id::text,0));
  select * into v_evento
  from public.esteira_anexo_eventos e
  where e.evento='removido' and e.detalhe->>'request_id'=p_request_id::text
  order by e.criado_em desc,e.id desc limit 1;
  if found then
    if v_evento.detalhe->'solicitacao'=v_solicitacao then
      v_resultado:=v_evento.detalhe->'resultado';
      return v_resultado||jsonb_build_object('ok',true,'idempotente',true);
    end if;
    raise exception 'ESTEIRA_ANEXO_REQUEST_CONFLITANTE: Esta solicitação já foi usada com outro documento. Atualize a tela.';
  end if;

  select u.role::text,u.nome into v_role,v_nome from public.usuarios u where u.id=v_uid and u.ativo;
  select * into v_antes from public.esteira_anexos a where a.id=p_anexo_id for update;
  if not found then
    raise exception 'ESTEIRA_ANEXO_NAO_ENCONTRADO: Documento não encontrado ou indisponível.';
  end if;
  select e.* into v_etapa
  from public.venda_processos p
  join public.esteira_etapas e on e.slug=p.etapa and e.ativo
  where p.id::text=v_antes.processo_ref
  limit 1;
  if v_role is null or v_etapa.id is null
     or (coalesce(array_length(v_etapa.restrito_a,1),0)>0 and v_role<>'admin' and not (v_role=any(v_etapa.restrito_a))) then
    raise exception 'ESTEIRA_ANEXO_SEM_PERMISSAO: A etapa atual não permite remover este documento.' using errcode='42501';
  end if;

  if v_antes.grupo is null and v_antes.etapa_slug is not null and v_antes.doc_nome is not null then
    if v_antes.etapa_slug<>v_etapa.slug or not exists (
      select 1 from public.esteira_etapa_docs d
      where d.ativo and d.etapa_slug=v_etapa.slug and d.nome=v_antes.doc_nome
    ) then
      raise exception 'ESTEIRA_ANEXO_CONFLITO: A venda mudou de etapa ou a comprovação não está mais configurada. Atualize a tela.';
    end if;
  else
    v_bloco:=case
      when v_antes.grupo in ('comprador','conjuge_comprador') then 'docs_comprador'
      when v_antes.grupo in ('vendedor','conjuge_vendedor') then 'docs_vendedor'
      when v_antes.grupo='imovel' then 'docs_imovel'
      else null
    end;
    if (v_bloco is not null and not (v_bloco=any(coalesce(v_etapa.libera,'{}'::text[]))))
       or (v_bloco is null and not exists (
         select 1 from unnest(coalesce(v_etapa.libera,'{}'::text[])) b where b like 'docs_%'
       )) then
      raise exception 'ESTEIRA_ANEXO_CONFLITO: A venda mudou de etapa e este documento não pode mais ser removido. Atualize a tela.';
    end if;
  end if;

  v_resultado:=jsonb_build_object(
    'anexo_id',v_antes.id,
    'path',v_antes.path,
    'processo_ref',v_antes.processo_ref
  );
  delete from public.esteira_anexos where id=p_anexo_id;
  insert into public.esteira_anexo_eventos(
    anexo_id,processo_ref,lote_id,evento,detalhe,ator,ator_nome
  ) values (
    null,v_antes.processo_ref,v_antes.lote_id,'removido',
    jsonb_build_object(
      'anexo_id',v_antes.id,'arquivo',v_antes.nome,'path',v_antes.path,
      'grupo',v_antes.grupo,'etapa_slug',v_antes.etapa_slug,'doc_nome',v_antes.doc_nome,'status',v_antes.status,
      'request_id',p_request_id,'solicitacao',v_solicitacao,'resultado',v_resultado
    ),
    v_uid,coalesce(v_nome,'sistema/automação')
  );
  return v_resultado||jsonb_build_object('ok',true,'idempotente',false);
exception when unique_violation then
  raise exception 'ESTEIRA_ANEXO_CONFLITO: O documento mudou enquanto você trabalhava. Atualize a tela.';
end
$function$;

comment on function public.esteira_anexo_remover(uuid,uuid) is
  'Remove o anexo e grava trilha preservada na mesma transação, com retry idempotente. SECURITY INVOKER.';
revoke all on function public.esteira_anexo_remover(uuid,uuid) from public,anon;
grant execute on function public.esteira_anexo_remover(uuid,uuid) to authenticated,service_role;
notify pgrst,'reload schema';
