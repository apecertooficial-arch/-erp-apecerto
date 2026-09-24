-- Esteira: confirmar/corrigir a triagem e registrar a trilha são uma única transação.

create unique index if not exists esteira_anexo_eventos_triagem_request_uidx
  on public.esteira_anexo_eventos ((detalhe->>'request_id'))
  where evento in ('confirmado','corrigido') and detalhe ? 'request_id';

create or replace function public.esteira_anexo_triagem_confirmar(
  p_anexo_id uuid,
  p_grupo text,
  p_doc_nome text,
  p_obrigatorio boolean,
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
  v_grupo text:=lower(btrim(coalesce(p_grupo,'')));
  v_doc_nome text:=nullif(left(btrim(coalesce(p_doc_nome,'')),200),'');
  v_bloco text;
  v_antes public.esteira_anexos;
  v_depois public.esteira_anexos;
  v_etapa public.esteira_etapas;
  v_evento public.esteira_anexo_eventos;
  v_evento_nome text;
  v_solicitacao jsonb;
  v_resultado jsonb;
begin
  if v_uid is null then
    raise exception 'ESTEIRA_TRIAGEM_SEM_PERMISSAO: Sessão inválida ou expirada.' using errcode='42501';
  end if;
  if p_anexo_id is null or p_request_id is null or p_obrigatorio is null
     or v_grupo not in ('comprador','conjuge_comprador','vendedor','conjuge_vendedor','imovel') then
    raise exception 'ESTEIRA_TRIAGEM_DADOS_INVALIDOS: Documento, grupo ou solicitação inválida.';
  end if;
  v_bloco:=case
    when v_grupo in ('comprador','conjuge_comprador') then 'docs_comprador'
    when v_grupo in ('vendedor','conjuge_vendedor') then 'docs_vendedor'
    else 'docs_imovel'
  end;
  v_solicitacao:=jsonb_build_object(
    'anexo_id',p_anexo_id,'grupo',v_grupo,'doc_nome',v_doc_nome,'obrigatorio',p_obrigatorio
  );

  perform pg_advisory_xact_lock(hashtextextended(p_request_id::text,0));
  select * into v_evento
  from public.esteira_anexo_eventos e
  where e.evento in ('confirmado','corrigido') and e.detalhe->>'request_id'=p_request_id::text
  order by e.criado_em desc,e.id desc limit 1;
  if found then
    if v_evento.detalhe->'solicitacao'=v_solicitacao then
      v_resultado:=v_evento.detalhe->'resultado';
      return v_resultado||jsonb_build_object('ok',true,'idempotente',true);
    end if;
    raise exception 'ESTEIRA_TRIAGEM_REQUEST_CONFLITANTE: Esta solicitação já foi usada com outros dados. Atualize a tela.';
  end if;

  select u.role::text into v_role from public.usuarios u where u.id=v_uid and u.ativo;
  select * into v_antes from public.esteira_anexos a where a.id=p_anexo_id for update;
  if not found then
    raise exception 'ESTEIRA_TRIAGEM_NAO_ENCONTRADO: Documento não encontrado ou indisponível.';
  end if;
  select e.* into v_etapa
  from public.venda_processos p
  join public.esteira_etapas e on e.slug=p.etapa and e.ativo
  where p.id::text=v_antes.processo_ref
  limit 1;
  if v_role is null or v_etapa.id is null or not (v_bloco=any(coalesce(v_etapa.libera,'{}'::text[])))
     or (coalesce(array_length(v_etapa.restrito_a,1),0)>0 and v_role<>'admin' and not (v_role=any(v_etapa.restrito_a))) then
    raise exception 'ESTEIRA_TRIAGEM_SEM_PERMISSAO: A etapa atual não permite confirmar este grupo.' using errcode='42501';
  end if;
  if v_antes.status<>'triagem' then
    raise exception 'ESTEIRA_TRIAGEM_CONFLITO: Este documento já saiu da triagem. Atualize a tela.';
  end if;

  v_evento_nome:=case when v_antes.ia_grupo is distinct from v_grupo
    or coalesce(v_antes.ia_doc_nome,'') is distinct from coalesce(v_doc_nome,'')
    then 'corrigido' else 'confirmado' end;
  update public.esteira_anexos
  set grupo=v_grupo,doc_nome=v_doc_nome,status='anexado',obrigatorio=p_obrigatorio,
      confirmado_por=v_uid,confirmado_em=now()
  where id=p_anexo_id
  returning * into v_depois;

  v_resultado:=jsonb_build_object('anexo_id',v_depois.id,'status',v_depois.status,'evento',v_evento_nome);
  insert into public.esteira_anexo_eventos(
    anexo_id,processo_ref,lote_id,evento,detalhe,ator,ator_nome
  ) values (
    v_depois.id,v_depois.processo_ref,v_depois.lote_id,v_evento_nome,
    jsonb_build_object(
      'arquivo',v_depois.nome,
      'sugerido',jsonb_build_object('grupo',v_antes.ia_grupo,'doc_nome',v_antes.ia_doc_nome,'confianca',v_antes.ia_confianca),
      'aplicado',jsonb_build_object('grupo',v_depois.grupo,'doc_nome',v_depois.doc_nome),
      'request_id',p_request_id,'solicitacao',v_solicitacao,'resultado',v_resultado
    ),
    v_uid,coalesce((select u.nome from public.usuarios u where u.id=v_uid),'sistema/automação')
  );
  return v_resultado||jsonb_build_object('ok',true,'idempotente',false);
exception when unique_violation then
  raise exception 'ESTEIRA_TRIAGEM_CONFLITO: A triagem mudou enquanto você trabalhava. Atualize a tela.';
end
$function$;

comment on function public.esteira_anexo_triagem_confirmar(uuid,text,text,boolean,uuid) is
  'Confirma ou corrige a classificação de um anexo e grava a trilha na mesma transação, com retry idempotente. SECURITY INVOKER.';
revoke all on function public.esteira_anexo_triagem_confirmar(uuid,text,text,boolean,uuid) from public,anon;
grant execute on function public.esteira_anexo_triagem_confirmar(uuid,text,text,boolean,uuid) to authenticated,service_role;
notify pgrst,'reload schema';
