-- Esteira: observações são gravadas uma única vez mesmo quando o cliente repete a solicitação.

alter table public.venda_observacoes
  add column if not exists request_id uuid;

create unique index if not exists venda_observacoes_request_uidx
  on public.venda_observacoes(request_id)
  where request_id is not null;

create or replace function public.esteira_observacao_adicionar(
  p_processo_id uuid,
  p_texto text,
  p_request_id uuid
)
returns jsonb
language plpgsql
security invoker
set search_path=public,pg_temp
as $function$
declare
  v_uid uuid:=auth.uid();
  v_texto text:=btrim(coalesce(p_texto,''));
  v_existente public.venda_observacoes;
  v_id uuid;
  v_nome text;
begin
  if v_uid is null then
    raise exception 'ESTEIRA_OBSERVACAO_SEM_PERMISSAO: Entre novamente para registrar a observação.' using errcode='42501';
  end if;
  if p_processo_id is null or p_request_id is null or v_texto='' or length(v_texto)>4000 then
    raise exception 'ESTEIRA_OBSERVACAO_DADOS_INVALIDOS: Informe uma observação válida.';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_request_id::text,0));

  -- SECURITY INVOKER mantém a autorização no RLS do processo dentro da mesma transação.
  perform 1 from public.venda_processos p where p.id=p_processo_id for share;
  if not found then
    raise exception 'ESTEIRA_OBSERVACAO_NAO_ENCONTRADA: Venda não encontrada ou sem acesso.';
  end if;

  select * into v_existente
  from public.venda_observacoes o
  where o.request_id=p_request_id;
  if found then
    if v_existente.processo_ref=p_processo_id and v_existente.autor=v_uid and v_existente.texto=v_texto then
      return jsonb_build_object(
        'ok',true,
        'observacao_id',v_existente.id,
        'processo_id',p_processo_id,
        'idempotente',true
      );
    end if;
    raise exception 'ESTEIRA_OBSERVACAO_REQUEST_CONFLITANTE: Esta solicitação já foi usada com outra observação. Atualize a tela.';
  end if;

  select u.nome into v_nome from public.usuarios u where u.id=v_uid;
  insert into public.venda_observacoes(processo_ref,texto,autor,autor_nome,request_id)
  values (p_processo_id,v_texto,v_uid,v_nome,p_request_id)
  returning id into v_id;

  return jsonb_build_object(
    'ok',true,
    'observacao_id',v_id,
    'processo_id',p_processo_id,
    'idempotente',false
  );
end
$function$;

comment on function public.esteira_observacao_adicionar(uuid,text,uuid) is
  'Registra observação na venda acessível com retry idempotente. SECURITY INVOKER.';
revoke all on function public.esteira_observacao_adicionar(uuid,text,uuid) from public,anon;
grant execute on function public.esteira_observacao_adicionar(uuid,text,uuid) to authenticated,service_role;
notify pgrst,'reload schema';
