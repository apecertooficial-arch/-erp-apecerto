-- Esteira: registrar o anexo manual e sua trilha são uma única transação idempotente.

create unique index if not exists esteira_anexo_eventos_upload_request_uidx
  on public.esteira_anexo_eventos ((detalhe->>'request_id'))
  where evento='upload' and detalhe ? 'request_id';

create or replace function public.esteira_anexo_registrar(
  p_processo_id uuid,
  p_request_id uuid,
  p_payload jsonb
)
returns jsonb
language plpgsql
security invoker
set search_path=public,pg_temp
as $function$
declare
  v_uid uuid:=auth.uid();
  v_role text;
  v_nome_ator text;
  v_grupo text:=nullif(lower(left(btrim(coalesce(p_payload->>'grupo','')),40)),'');
  v_etapa_slug text:=nullif(left(btrim(coalesce(p_payload->>'etapa_slug','')),40),'');
  v_doc_nome text:=nullif(left(btrim(coalesce(p_payload->>'doc_nome','')),200),'');
  v_nome text:=nullif(left(btrim(coalesce(p_payload->>'nome','')),200),'');
  v_path text:=nullif(left(btrim(coalesce(p_payload->>'path','')),400),'');
  v_mime text:=nullif(left(btrim(coalesce(p_payload->>'mime','')),100),'');
  v_observacao text:=nullif(left(btrim(coalesce(p_payload->>'observacao','')),400),'');
  v_tamanho bigint;
  v_obrigatorio boolean:=coalesce((p_payload->>'obrigatorio')::boolean,false);
  v_bloco text;
  v_processo public.venda_processos;
  v_etapa public.esteira_etapas;
  v_anexo public.esteira_anexos;
  v_evento public.esteira_anexo_eventos;
  v_solicitacao jsonb;
  v_resultado jsonb;
begin
  if v_uid is null then
    raise exception 'ESTEIRA_UPLOAD_SEM_PERMISSAO: Sessão inválida ou expirada.' using errcode='42501';
  end if;
  if p_processo_id is null or p_request_id is null or jsonb_typeof(p_payload)<>'object'
     or v_nome is null or v_path is null then
    raise exception 'ESTEIRA_UPLOAD_DADOS_INVALIDOS: Venda, arquivo, nome ou solicitação inválida.';
  end if;
  if coalesce(p_payload->>'tamanho','')~'^\d+$' then
    v_tamanho:=(p_payload->>'tamanho')::bigint;
  elsif p_payload ? 'tamanho' and p_payload->'tamanho'<>'null'::jsonb then
    raise exception 'ESTEIRA_UPLOAD_DADOS_INVALIDOS: Tamanho do arquivo inválido.';
  end if;
  if v_grupo is not null and v_grupo not in ('comprador','conjuge_comprador','vendedor','conjuge_vendedor','imovel') then
    raise exception 'ESTEIRA_UPLOAD_DADOS_INVALIDOS: Grupo de documento inválido.';
  end if;
  if v_grupo is null and (v_etapa_slug is null or v_doc_nome is null) then
    raise exception 'ESTEIRA_UPLOAD_DADOS_INVALIDOS: Informe a etapa e o tipo da comprovação.';
  end if;
  if v_grupo is not null then
    v_bloco:=case when v_grupo in ('comprador','conjuge_comprador') then 'docs_comprador'
      when v_grupo in ('vendedor','conjuge_vendedor') then 'docs_vendedor' else 'docs_imovel' end;
    if v_path not like 'esteira/'||p_processo_id::text||'/'||v_grupo||'/'||p_request_id::text||'_%' then
      raise exception 'ESTEIRA_UPLOAD_DADOS_INVALIDOS: Caminho do arquivo inválido.';
    end if;
  elsif v_path not like 'esteira/'||p_processo_id::text||'/_etapa/'||v_etapa_slug||'/'||p_request_id::text||'_%' then
    raise exception 'ESTEIRA_UPLOAD_DADOS_INVALIDOS: Caminho da comprovação inválido.';
  end if;

  v_solicitacao:=jsonb_build_object(
    'processo_id',p_processo_id,'nome',v_nome,'path',v_path,'mime',v_mime,'tamanho',v_tamanho,
    'grupo',v_grupo,'etapa_slug',v_etapa_slug,'doc_nome',v_doc_nome,
    'obrigatorio',v_obrigatorio,'observacao',v_observacao
  );
  perform pg_advisory_xact_lock(hashtextextended(p_request_id::text,0));
  select * into v_evento
  from public.esteira_anexo_eventos e
  where e.evento='upload' and e.detalhe->>'request_id'=p_request_id::text
  order by e.criado_em desc,e.id desc limit 1;
  if found then
    if v_evento.detalhe->'solicitacao'=v_solicitacao then
      v_resultado:=v_evento.detalhe->'resultado';
      return v_resultado||jsonb_build_object('ok',true,'idempotente',true);
    end if;
    raise exception 'ESTEIRA_UPLOAD_REQUEST_CONFLITANTE: Esta solicitação já foi usada com outro arquivo. Atualize a tela.';
  end if;

  select u.role::text,u.nome into v_role,v_nome_ator from public.usuarios u where u.id=v_uid and u.ativo;
  select * into v_processo from public.venda_processos p where p.id=p_processo_id for update;
  if not found then
    raise exception 'ESTEIRA_UPLOAD_NAO_ENCONTRADO: Venda não encontrada ou sem acesso.';
  end if;
  select * into v_etapa from public.esteira_etapas e where e.slug=v_processo.etapa and e.ativo limit 1;
  if v_role is null or v_etapa.id is null
     or (coalesce(array_length(v_etapa.restrito_a,1),0)>0 and v_role<>'admin' and not (v_role=any(v_etapa.restrito_a))) then
    raise exception 'ESTEIRA_UPLOAD_SEM_PERMISSAO: A etapa atual não permite anexar este documento.' using errcode='42501';
  end if;
  if v_grupo is not null and not (v_bloco=any(coalesce(v_etapa.libera,'{}'::text[]))) then
    raise exception 'ESTEIRA_UPLOAD_CONFLITO: A venda mudou de etapa e este grupo não está mais aberto. Atualize a tela.';
  end if;
  if v_grupo is null and (v_etapa_slug<>v_etapa.slug or not exists (
    select 1 from public.esteira_etapa_docs d
    where d.ativo and d.etapa_slug=v_etapa.slug and d.nome=v_doc_nome
  )) then
    raise exception 'ESTEIRA_UPLOAD_CONFLITO: A venda mudou de etapa ou a comprovação não está mais configurada. Atualize a tela.';
  end if;

  insert into public.esteira_anexos(
    processo_ref,negocio_id,nome,path,mime,tamanho,enviado_por,etapa_slug,
    doc_nome,grupo,status,obrigatorio,observacao
  ) values (
    p_processo_id::text,v_processo.negocio_id,v_nome,v_path,v_mime,v_tamanho,v_uid::text,v_etapa_slug,
    v_doc_nome,v_grupo,'anexado',v_obrigatorio,v_observacao
  ) returning * into v_anexo;
  v_resultado:=jsonb_build_object('anexo_id',v_anexo.id,'status',v_anexo.status);
  insert into public.esteira_anexo_eventos(
    anexo_id,processo_ref,evento,detalhe,ator,ator_nome
  ) values (
    v_anexo.id,v_anexo.processo_ref,'upload',
    jsonb_build_object(
      'arquivo',v_anexo.nome,'grupo',v_anexo.grupo,'etapa_slug',v_anexo.etapa_slug,
      'doc_nome',v_anexo.doc_nome,'origem','manual',
      'request_id',p_request_id,'solicitacao',v_solicitacao,'resultado',v_resultado
    ),
    v_uid,coalesce(v_nome_ator,'sistema/automação')
  );
  return v_resultado||jsonb_build_object('ok',true,'idempotente',false);
exception when unique_violation then
  raise exception 'ESTEIRA_UPLOAD_CONFLITO: O documento mudou enquanto você trabalhava. Atualize a tela.';
end
$function$;

comment on function public.esteira_anexo_registrar(uuid,uuid,jsonb) is
  'Registra anexo manual e trilha na mesma transação, com retry idempotente. SECURITY INVOKER.';
revoke all on function public.esteira_anexo_registrar(uuid,uuid,jsonb) from public,anon;
grant execute on function public.esteira_anexo_registrar(uuid,uuid,jsonb) to authenticated,service_role;
notify pgrst,'reload schema';
