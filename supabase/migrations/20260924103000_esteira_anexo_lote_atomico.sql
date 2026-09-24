-- Esteira: anexos do lote e sua trilha de auditoria são uma única transação idempotente.

create unique index if not exists esteira_anexo_eventos_upload_lote_uidx
  on public.esteira_anexo_eventos (lote_id)
  where evento='upload_lote' and lote_id is not null;

create or replace function public.esteira_anexo_lote_registrar(
  p_processo_id uuid,
  p_lote_id uuid,
  p_etapa_slug text,
  p_arquivos jsonb
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
  v_processo public.venda_processos;
  v_etapa public.esteira_etapas;
  v_evento public.esteira_anexo_eventos;
  v_arquivos jsonb;
  v_solicitacao jsonb;
  v_resultado jsonb;
begin
  if v_uid is null then
    raise exception 'ESTEIRA_LOTE_SEM_PERMISSAO: Sessão inválida ou expirada.' using errcode='42501';
  end if;
  if p_processo_id is null or p_lote_id is null or jsonb_typeof(p_arquivos)<>'array'
     or jsonb_array_length(p_arquivos) not between 1 and 15 then
    raise exception 'ESTEIRA_LOTE_DADOS_INVALIDOS: Venda, lote ou arquivos inválidos.';
  end if;

  select jsonb_agg(jsonb_build_object(
    'nome',left(btrim(a.item->>'nome'),200),
    'path',left(btrim(a.item->>'path'),400),
    'mime',nullif(left(btrim(coalesce(a.item->>'mime','')),100),''),
    'tamanho',case when coalesce(a.item->>'tamanho','')~'^\d+$' then (a.item->>'tamanho')::bigint else null end
  ) order by a.ordem) into v_arquivos
  from jsonb_array_elements(p_arquivos) with ordinality as a(item,ordem);

  if exists (
    select 1 from jsonb_array_elements(v_arquivos) a
    where nullif(a->>'nome','') is null or nullif(a->>'path','') is null
       or not ((a->>'path') like 'esteira/'||p_processo_id::text||'/_lote/'||p_lote_id::text||'/%')
       or coalesce((a->>'tamanho')::bigint,0)<0
  ) or (
    select count(*)<>count(distinct a->>'path') from jsonb_array_elements(v_arquivos) a
  ) then
    raise exception 'ESTEIRA_LOTE_DADOS_INVALIDOS: Há arquivos inválidos ou repetidos no lote.';
  end if;

  v_solicitacao:=jsonb_build_object(
    'processo_id',p_processo_id,
    'etapa_slug',nullif(left(btrim(coalesce(p_etapa_slug,'')),40),''),
    'arquivos',v_arquivos
  );
  perform pg_advisory_xact_lock(hashtextextended(p_lote_id::text,0));
  select * into v_evento
  from public.esteira_anexo_eventos e
  where e.evento='upload_lote' and e.lote_id=p_lote_id
  order by e.criado_em desc,e.id desc limit 1;
  if found then
    if v_evento.detalhe->'solicitacao'=v_solicitacao then
      v_resultado:=v_evento.detalhe->'resultado';
      return v_resultado||jsonb_build_object('ok',true,'idempotente',true);
    end if;
    raise exception 'ESTEIRA_LOTE_REQUEST_CONFLITANTE: Este lote já foi registrado com outros arquivos. Atualize a tela.';
  end if;

  select u.role::text,u.nome into v_role,v_nome from public.usuarios u where u.id=v_uid and u.ativo;
  select * into v_processo from public.venda_processos p where p.id=p_processo_id for update;
  if not found then
    raise exception 'ESTEIRA_LOTE_NAO_ENCONTRADO: Venda não encontrada ou sem acesso.';
  end if;
  select * into v_etapa from public.esteira_etapas e where e.slug=v_processo.etapa and e.ativo limit 1;
  if v_role is null or v_etapa.id is null
     or not exists (select 1 from unnest(coalesce(v_etapa.libera,'{}'::text[])) b where b like 'docs_%')
     or (coalesce(array_length(v_etapa.restrito_a,1),0)>0 and v_role<>'admin' and not (v_role=any(v_etapa.restrito_a))) then
    raise exception 'ESTEIRA_LOTE_SEM_PERMISSAO: A etapa atual não permite enviar documentos em lote.' using errcode='42501';
  end if;
  if nullif(left(btrim(coalesce(p_etapa_slug,'')),40),'') is not null
     and p_etapa_slug<>v_processo.etapa then
    raise exception 'ESTEIRA_LOTE_CONFLITO: A venda mudou de etapa enquanto os arquivos eram enviados. Atualize a tela.';
  end if;

  with inseridos as (
    insert into public.esteira_anexos(
      processo_ref,negocio_id,nome,path,mime,tamanho,enviado_por,etapa_slug,
      grupo,doc_nome,status,obrigatorio,lote_id,origem,ia_status
    )
    select
      p_processo_id::text,v_processo.negocio_id,a->>'nome',a->>'path',a->>'mime',
      (a->>'tamanho')::bigint,v_uid::text,nullif(left(btrim(coalesce(p_etapa_slug,'')),40),''),
      null,null,'triagem',false,p_lote_id,'lote_ia','nao_processado'
    from jsonb_array_elements(v_arquivos) a
    returning id,nome,path
  )
  select jsonb_build_object(
    'lote_id',p_lote_id,
    'anexos',coalesce(jsonb_agg(jsonb_build_object('id',id,'nome',nome,'path',path) order by nome),'[]'::jsonb)
  ) into v_resultado
  from inseridos;

  insert into public.esteira_anexo_eventos(
    anexo_id,processo_ref,lote_id,evento,detalhe,ator,ator_nome
  ) values (
    null,p_processo_id::text,p_lote_id,'upload_lote',
    jsonb_build_object(
      'quantidade',jsonb_array_length(v_arquivos),
      'arquivos',(select jsonb_agg(a->>'nome') from jsonb_array_elements(v_arquivos) a),
      'solicitacao',v_solicitacao,
      'resultado',v_resultado
    ),
    v_uid,coalesce(v_nome,'sistema/automação')
  );
  return v_resultado||jsonb_build_object('ok',true,'idempotente',false);
exception when unique_violation then
  raise exception 'ESTEIRA_LOTE_CONFLITO: O lote mudou enquanto você trabalhava. Atualize a tela.';
end
$function$;

comment on function public.esteira_anexo_lote_registrar(uuid,uuid,text,jsonb) is
  'Registra anexos de um lote e sua trilha na mesma transação, com retry idempotente. SECURITY INVOKER.';
revoke all on function public.esteira_anexo_lote_registrar(uuid,uuid,text,jsonb) from public,anon;
grant execute on function public.esteira_anexo_lote_registrar(uuid,uuid,text,jsonb) to authenticated,service_role;
notify pgrst,'reload schema';
