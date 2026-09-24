-- Esteira: a decisão gerencial cria ou recusa uma venda uma única vez, com auditoria.

alter table public.venda_solicitacoes
  add column if not exists decisao_request_id uuid;

create unique index if not exists venda_solicitacoes_decisao_request_uidx
  on public.venda_solicitacoes(decisao_request_id)
  where decisao_request_id is not null;

create unique index if not exists venda_solicitacoes_negocio_pendente_uidx
  on public.venda_solicitacoes(negocio_id)
  where status='pendente' and negocio_id is not null;

drop policy if exists vsol_decide_manage on public.venda_solicitacoes;
create policy vsol_decide_manage on public.venda_solicitacoes
  for update to authenticated
  using (public.can_manage_all())
  with check (public.can_manage_all());

create or replace function public.esteira_solicitacao_decidir(
  p_id uuid,
  p_aprovar boolean,
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
  v_motivo text:=left(nullif(btrim(coalesce(p_motivo,'')),''),300);
  v_existente public.venda_solicitacoes;
  v_solicitacao public.venda_solicitacoes;
  v_negocio public.negocios;
  v_produto public.empreendimentos;
  v_venda_id uuid;
  v_processo_id uuid;
  v_responsavel uuid;
  v_tipo text;
  v_status text:=case when p_aprovar then 'aprovada' else 'recusada' end;
  v_antes jsonb;
  v_resultado jsonb;
begin
  if v_uid is null or not coalesce(public.can_manage_all(),false) then
    raise exception 'ESTEIRA_SOLICITACAO_SEM_PERMISSAO: Apenas administradores ou gestores podem decidir solicitações.' using errcode='42501';
  end if;
  if p_id is null or p_aprovar is null or p_request_id is null then
    raise exception 'ESTEIRA_SOLICITACAO_DADOS_INVALIDOS: Solicitação, decisão ou identificador inválido.';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_request_id::text,0));
  select * into v_existente
  from public.venda_solicitacoes
  where decisao_request_id=p_request_id;
  if found then
    if v_existente.id=p_id and v_existente.status=v_status
       and (p_aprovar or coalesce(v_existente.motivo_recusa,'')=coalesce(v_motivo,'')) then
      if v_existente.venda_id is not null then
        select p.id into v_processo_id
        from public.venda_processos p
        where p.venda_id=v_existente.venda_id
        order by p.criado_em,p.id limit 1;
      end if;
      return jsonb_build_object(
        'ok',true,'solicitacao_id',v_existente.id,'status',v_existente.status,
        'venda_id',v_existente.venda_id,'processo_id',v_processo_id,'idempotente',true
      );
    end if;
    raise exception 'ESTEIRA_SOLICITACAO_REQUEST_CONFLITANTE: Esta solicitação de decisão já foi usada com outro conteúdo. Atualize a tela.';
  end if;

  select * into v_solicitacao
  from public.venda_solicitacoes
  where id=p_id
  for update;
  if not found then
    raise exception 'ESTEIRA_SOLICITACAO_NAO_ENCONTRADA: Solicitação não encontrada.';
  end if;
  if v_solicitacao.status<>'pendente' then
    raise exception 'ESTEIRA_SOLICITACAO_JA_DECIDIDA: Esta solicitação já foi decidida. Atualize a tela.';
  end if;
  v_antes:=to_jsonb(v_solicitacao);

  if not p_aprovar then
    update public.venda_solicitacoes set
      status='recusada',motivo_recusa=v_motivo,decidido_por=v_uid,decidido_em=now(),
      decisao_request_id=p_request_id
    where id=p_id and status='pendente';
    v_resultado:=jsonb_build_object(
      'solicitacao_id',p_id,'status','recusada','venda_id',null,'processo_id',null
    );
  else
    select * into v_produto
    from public.empreendimentos
    where id=v_solicitacao.produto_id;
    if not found then
      raise exception 'ESTEIRA_SOLICITACAO_DADOS_INVALIDOS: O produto da solicitação não existe.';
    end if;

    select * into v_negocio
    from public.negocios
    where id=v_solicitacao.negocio_id
    for update;
    if not found or v_negocio.venda_id is not null then
      raise exception 'ESTEIRA_SOLICITACAO_NEGOCIO_INDISPONIVEL: O negócio não existe ou já foi convertido em venda.';
    end if;

    v_tipo:=case when v_produto.origem='terceiros' then 'revenda' else 'construtora' end;
    select c.usuario_id into v_responsavel
    from public.corretores c
    where c.id=v_solicitacao.corretor_id;

    insert into public.vendas(
      data_venda,empreendimento_id,empreendimento_nome,vgv,forma_pgto,status,obs,corretor_id
    ) values (
      public.hoje_operacao(),v_produto.id,v_produto.nome,v_solicitacao.vgv,
      v_solicitacao.forma_pgto,'pendente',v_solicitacao.obs,v_solicitacao.corretor_id
    ) returning id into v_venda_id;

    update public.negocios set
      venda_id=v_venda_id,status='ganho',ultima_movimentacao=now()
    where id=v_solicitacao.negocio_id and venda_id is null;
    if not found then
      raise exception 'ESTEIRA_SOLICITACAO_NEGOCIO_INDISPONIVEL: O negócio mudou enquanto a solicitação era decidida.';
    end if;

    insert into public.venda_processos(
      venda_id,negocio_id,etapa,tipo_venda,responsavel_usuario_id,criado_por
    ) values (
      v_venda_id,v_solicitacao.negocio_id,'inicio',v_tipo,v_responsavel,v_uid
    ) returning id into v_processo_id;

    update public.venda_solicitacoes set
      status='aprovada',venda_id=v_venda_id,motivo_recusa=null,decidido_por=v_uid,
      decidido_em=now(),decisao_request_id=p_request_id
    where id=p_id and status='pendente';
    v_resultado:=jsonb_build_object(
      'solicitacao_id',p_id,'status','aprovada','venda_id',v_venda_id,'processo_id',v_processo_id
    );
  end if;

  insert into public.erp_auditoria(
    usuario_id,usuario_nome,acao,modulo,entidade,entidade_id,antes,depois,detalhe
  ) values (
    v_uid,coalesce((select u.nome from public.usuarios u where u.id=v_uid),'sistema/automação'),
    case when p_aprovar then 'aprovar solicitação de venda' else 'recusar solicitação de venda' end,
    'Esteira','venda_solicitacoes',p_id::text,v_antes,
    jsonb_build_object('request_id',p_request_id,'resultado',v_resultado),
    'Decisão gerencial, venda, processo e negócio persistidos em uma transação idempotente.'
  );
  return v_resultado||jsonb_build_object('ok',true,'idempotente',false);
end
$function$;

comment on function public.esteira_solicitacao_decidir(uuid,boolean,text,uuid) is
  'Decide solicitação gerencial com trava, criação atômica da venda e retry idempotente. SECURITY INVOKER com RLS e autorização interna.';
revoke all on function public.esteira_solicitacao_decidir(uuid,boolean,text,uuid) from public,anon;
grant execute on function public.esteira_solicitacao_decidir(uuid,boolean,text,uuid) to authenticated,service_role;

-- Compatibilidade: clientes antigos também passam pela trava transacional.
create or replace function public.aprovar_solicitacao(p_id uuid)
returns jsonb
language sql
security invoker
set search_path=public,pg_temp
as $function$
  select public.esteira_solicitacao_decidir(p_id,true,null,gen_random_uuid())
$function$;

create or replace function public.recusar_solicitacao(p_id uuid,p_motivo text)
returns jsonb
language sql
security invoker
set search_path=public,pg_temp
as $function$
  select public.esteira_solicitacao_decidir(p_id,false,p_motivo,gen_random_uuid())
$function$;

revoke all on function public.aprovar_solicitacao(uuid) from public,anon;
revoke all on function public.recusar_solicitacao(uuid,text) from public,anon;
grant execute on function public.aprovar_solicitacao(uuid) to authenticated,service_role;
grant execute on function public.recusar_solicitacao(uuid,text) to authenticated,service_role;
notify pgrst,'reload schema';
