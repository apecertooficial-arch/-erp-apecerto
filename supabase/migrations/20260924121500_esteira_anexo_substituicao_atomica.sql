-- Esteira: substituir o anexo e registrar sua trilha são uma única transação idempotente.

create unique index if not exists esteira_anexo_eventos_substituicao_request_uidx
  on public.esteira_anexo_eventos ((detalhe->>'request_id'))
  where evento='substituido' and detalhe ? 'request_id';

create or replace function public.esteira_anexo_substituir(
  p_anexo_id uuid,
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
  v_antes public.esteira_anexos;
  v_depois public.esteira_anexos;
  v_etapa public.esteira_etapas;
  v_evento public.esteira_anexo_eventos;
  v_solicitacao jsonb;
  v_resultado jsonb;
begin
  if v_uid is null then
    raise exception 'ESTEIRA_SUBSTITUICAO_SEM_PERMISSAO: Sessão inválida ou expirada.' using errcode='42501';
  end if;
  if p_anexo_id is null or p_request_id is null or jsonb_typeof(p_payload)<>'object'
     or v_nome is null or v_path is null then
    raise exception 'ESTEIRA_SUBSTITUICAO_DADOS_INVALIDOS: Documento, arquivo ou solicitação inválida.';
  end if;
  if coalesce(p_payload->>'tamanho','')~'^\d+$' then
    v_tamanho:=(p_payload->>'tamanho')::bigint;
  elsif p_payload ? 'tamanho' and p_payload->'tamanho'<>'null'::jsonb then
    raise exception 'ESTEIRA_SUBSTITUICAO_DADOS_INVALIDOS: Tamanho do arquivo inválido.';
  end if;
  v_solicitacao:=jsonb_build_object(
    'anexo_id',p_anexo_id,'nome',v_nome,'path',v_path,'mime',v_mime,'tamanho',v_tamanho,
    'grupo',v_grupo,'etapa_slug',v_etapa_slug,'doc_nome',v_doc_nome,
    'obrigatorio',v_obrigatorio,'observacao',v_observacao
  );

  perform pg_advisory_xact_lock(hashtextextended(p_request_id::text,0));
  select * into v_evento
  from public.esteira_anexo_eventos e
  where e.evento='substituido' and e.detalhe->>'request_id'=p_request_id::text
  order by e.criado_em desc,e.id desc limit 1;
  if found then
    if v_evento.detalhe->'solicitacao'=v_solicitacao then
      v_resultado:=v_evento.detalhe->'resultado';
      return v_resultado||jsonb_build_object('ok',true,'idempotente',true);
    end if;
    raise exception 'ESTEIRA_SUBSTITUICAO_REQUEST_CONFLITANTE: Esta solicitação já foi usada com outro arquivo. Atualize a tela.';
  end if;

  select u.role::text,u.nome into v_role,v_nome_ator from public.usuarios u where u.id=v_uid and u.ativo;
  select * into v_antes from public.esteira_anexos a where a.id=p_anexo_id for update;
  if not found then
    raise exception 'ESTEIRA_SUBSTITUICAO_NAO_ENCONTRADO: Documento não encontrado ou indisponível.';
  end if;
  select e.* into v_etapa
  from public.venda_processos p join public.esteira_etapas e on e.slug=p.etapa and e.ativo
  where p.id::text=v_antes.processo_ref limit 1;
  if v_role is null or v_etapa.id is null
     or (coalesce(array_length(v_etapa.restrito_a,1),0)>0 and v_role<>'admin' and not (v_role=any(v_etapa.restrito_a))) then
    raise exception 'ESTEIRA_SUBSTITUICAO_SEM_PERMISSAO: A etapa atual não permite substituir este documento.' using errcode='42501';
  end if;

  if v_antes.grupo is not null then
    if v_grupo is distinct from v_antes.grupo or v_etapa_slug is not null then
      raise exception 'ESTEIRA_SUBSTITUICAO_DADOS_INVALIDOS: A substituição não pode mudar o grupo do documento.';
    end if;
    v_bloco:=case when v_grupo in ('comprador','conjuge_comprador') then 'docs_comprador'
      when v_grupo in ('vendedor','conjuge_vendedor') then 'docs_vendedor'
      when v_grupo='imovel' then 'docs_imovel' else null end;
    if v_bloco is null or not (v_bloco=any(coalesce(v_etapa.libera,'{}'::text[])))
       or v_path not like 'esteira/'||v_antes.processo_ref||'/'||v_grupo||'/'||p_request_id::text||'_%' then
      raise exception 'ESTEIRA_SUBSTITUICAO_CONFLITO: A venda mudou de etapa ou o caminho do novo arquivo é inválido. Atualize a tela.';
    end if;
  else
    if v_etapa_slug is distinct from v_antes.etapa_slug or v_doc_nome is distinct from v_antes.doc_nome
       or v_etapa_slug<>v_etapa.slug or not exists (
         select 1 from public.esteira_etapa_docs d where d.ativo and d.etapa_slug=v_etapa.slug and d.nome=v_doc_nome
       ) or v_path not like 'esteira/'||v_antes.processo_ref||'/_etapa/'||v_etapa_slug||'/'||p_request_id::text||'_%' then
      raise exception 'ESTEIRA_SUBSTITUICAO_CONFLITO: A venda mudou de etapa ou a comprovação não está mais configurada. Atualize a tela.';
    end if;
  end if;

  update public.esteira_anexos set
    nome=v_nome,path=v_path,mime=v_mime,tamanho=v_tamanho,obrigatorio=v_obrigatorio,
    observacao=v_observacao,status='anexado',status_motivo=null,revisado_por=null,revisado_em=null,
    lote_id=null,origem='manual',ia_status='nao_processado',ia_grupo=null,ia_doc_nome=null,
    ia_confianca=null,ia_extraido=null,ia_motivo=null,ia_processado_em=null,
    confirmado_por=null,confirmado_em=null,enviado_por=v_uid::text
  where id=p_anexo_id returning * into v_depois;
  v_resultado:=jsonb_build_object(
    'anexo_id',v_depois.id,'status',v_depois.status,'path_anterior',v_antes.path,'path_novo',v_depois.path
  );
  insert into public.esteira_anexo_eventos(
    anexo_id,processo_ref,evento,detalhe,ator,ator_nome
  ) values (
    v_depois.id,v_depois.processo_ref,'substituido',
    jsonb_build_object(
      'arquivo_anterior',v_antes.nome,'path_anterior',v_antes.path,
      'arquivo_novo',v_depois.nome,'path_novo',v_depois.path,
      'request_id',p_request_id,'solicitacao',v_solicitacao,'resultado',v_resultado
    ),
    v_uid,coalesce(v_nome_ator,'sistema/automação')
  );
  return v_resultado||jsonb_build_object('ok',true,'idempotente',false);
exception when unique_violation then
  raise exception 'ESTEIRA_SUBSTITUICAO_CONFLITO: O documento mudou enquanto você trabalhava. Atualize a tela.';
end
$function$;

comment on function public.esteira_anexo_substituir(uuid,uuid,jsonb) is
  'Substitui os dados do anexo e grava trilha na mesma transação, preservando o anterior até a confirmação. SECURITY INVOKER.';
revoke all on function public.esteira_anexo_substituir(uuid,uuid,jsonb) from public,anon;
grant execute on function public.esteira_anexo_substituir(uuid,uuid,jsonb) to authenticated,service_role;
notify pgrst,'reload schema';
