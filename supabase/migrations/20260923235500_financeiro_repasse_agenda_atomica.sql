-- Financeiro / agenda de repasses: criação e edição transacionais, auditadas e idempotentes.
-- O legado pago permanece intacto; linhas novas sempre apontam para uma comissão
-- canônica e nunca podem aumentar um total já acima do valor distribuído.

alter table public.pagamentos_comissao add column if not exists request_id uuid;
create unique index if not exists pagamentos_comissao_request_id_uidx
  on public.pagamentos_comissao(request_id) where request_id is not null;

create or replace function public.financeiro_repasse_salvar(
  p_repasse_id uuid,
  payload jsonb
)
returns jsonb
language plpgsql
security invoker
set search_path=public,pg_temp
as $function$
declare
  v_uid uuid:=auth.uid();
  v_antes public.pagamentos_comissao;
  v_depois public.pagamentos_comissao;
  v_existente public.pagamentos_comissao;
  v_venda public.vendas;
  v_comissao public.comissoes;
  v_payload_venda_id uuid;
  v_venda_id uuid;
  v_comissao_id uuid;
  v_beneficiario_id uuid;
  v_request_id uuid;
  v_papel text;
  v_valor numeric;
  v_ordem_num numeric;
  v_ordem integer;
  v_data date;
  v_observacao text;
  v_qtd integer;
  v_soma_antes numeric;
  v_soma_depois numeric;
  v_antes_pertence boolean:=false;
begin
  if v_uid is null or not coalesce(public.can_manage_all(),false) then
    raise exception 'REPASSE_SEM_PERMISSAO: Você não tem permissão para alterar repasses.' using errcode='42501';
  end if;
  if payload is null or jsonb_typeof(payload)<>'object' then
    raise exception 'REPASSE_DADOS_INVALIDOS: Dados do repasse inválidos.';
  end if;
  begin
    v_payload_venda_id:=nullif(btrim(payload->>'venda_id'),'')::uuid;
    v_comissao_id:=nullif(btrim(payload->>'comissao_id'),'')::uuid;
    v_beneficiario_id:=nullif(btrim(payload->>'beneficiario_id'),'')::uuid;
    v_request_id:=nullif(btrim(payload->>'request_id'),'')::uuid;
    v_papel:=btrim(payload->>'papel');
    v_valor:=round((payload->>'valor')::numeric,2);
    v_ordem_num:=(payload->>'ordem')::numeric;
    v_ordem:=v_ordem_num::integer;
    v_data:=nullif(btrim(payload->>'data_prevista'),'')::date;
    v_observacao:=nullif(left(btrim(payload->>'observacao'),500),'');
  exception when invalid_text_representation or invalid_datetime_format
    or datetime_field_overflow or numeric_value_out_of_range then
    raise exception 'REPASSE_DADOS_INVALIDOS: Venda, comissão, valor, ordem, data ou identificador inválido.';
  end;
  if v_payload_venda_id is null or v_beneficiario_id is null
     or v_papel is null or v_papel not in ('corretor','executivo','indicacao','apecerto','gerente')
     or v_valor is null or v_valor='NaN'::numeric or v_valor<=0 or v_valor>=100000000000
     or v_ordem is null or v_ordem_num<>trunc(v_ordem_num) or v_ordem<1 then
    raise exception 'REPASSE_DADOS_INVALIDOS: Informe venda, destinatário, papel, ordem e valor maior que zero.';
  end if;
  if not exists(select 1 from public.usuarios u where u.id=v_beneficiario_id) then
    raise exception 'REPASSE_DADOS_INVALIDOS: Destinatário não encontrado.';
  end if;

  if p_repasse_id is not null then
    select * into v_antes from public.pagamentos_comissao where id=p_repasse_id;
    if not found then raise exception 'REPASSE_NAO_ENCONTRADO: Repasse não encontrado ou indisponível.'; end if;
    v_venda_id:=v_antes.venda_id;
    if v_payload_venda_id is distinct from v_venda_id then
      raise exception 'REPASSE_DADOS_INVALIDOS: O repasse não pertence à venda informada.';
    end if;
  else
    v_venda_id:=v_payload_venda_id;
    if v_request_id is null then
      raise exception 'REPASSE_DADOS_INVALIDOS: Identificador da solicitação é obrigatório.';
    end if;
    perform pg_advisory_xact_lock(hashtextextended(v_request_id::text,0));
    select * into v_existente from public.pagamentos_comissao where request_id=v_request_id for update;
    if found then
      if v_existente.venda_id=v_venda_id
         and (v_comissao_id is null or v_existente.comissao_id=v_comissao_id)
         and v_existente.beneficiario_id=v_beneficiario_id and v_existente.papel=v_papel
         and v_existente.valor=v_valor and v_existente.ordem=v_ordem
         and v_existente.data_prevista is not distinct from v_data
         and v_existente.observacao is not distinct from v_observacao then
        return jsonb_build_object('ok',true,'repasse_id',v_existente.id,
          'comissao_id',v_existente.comissao_id,'criado',true,'idempotente',true);
      end if;
      raise exception 'REPASSE_REQUEST_CONFLITANTE: Esta solicitação já criou outro repasse. Atualize a tela antes de tentar novamente.';
    end if;
  end if;

  select * into v_venda from public.vendas where id=v_venda_id for update;
  if not found then raise exception 'REPASSE_NAO_ENCONTRADO: Venda não encontrada ou indisponível.'; end if;
  perform 1 from public.comissoes c where c.venda_id=v_venda_id order by c.id for update;
  perform 1 from public.pagamentos_comissao p where p.venda_id=v_venda_id order by p.id for update;

  if p_repasse_id is not null then
    select * into v_antes from public.pagamentos_comissao where id=p_repasse_id for update;
    if not found then raise exception 'REPASSE_NAO_ENCONTRADO: Repasse não encontrado ou indisponível.'; end if;
    if v_antes.status<>'previsto' or v_antes.data_pagamento is not null or v_antes.lancamento_id is not null
       or exists(select 1 from public.lancamentos_caixa l where l.id=v_antes.lancamento_id) then
      raise exception 'REPASSE_MOVIMENTO_ATIVO: Desfaça a baixa antes de editar o repasse; o caixa precisa continuar reconciliado.';
    end if;
  end if;

  if v_comissao_id is not null then
    select * into v_comissao from public.comissoes c where c.id=v_comissao_id and c.venda_id=v_venda_id;
    if not found then
      raise exception 'REPASSE_COMISSAO_INVALIDA: A comissão vinculada não existe nesta venda.';
    end if;
    if v_comissao.beneficiario_id is distinct from v_beneficiario_id or v_comissao.papel::text<>v_papel then
      raise exception 'REPASSE_COMISSAO_INVALIDA: Destinatário e papel precisam corresponder à comissão vinculada.';
    end if;
  else
    select min(c.id::text)::uuid,count(*) into v_comissao_id,v_qtd
      from public.comissoes c where c.venda_id=v_venda_id
       and c.beneficiario_id=v_beneficiario_id and c.papel::text=v_papel;
    if v_qtd=0 then
      raise exception 'REPASSE_COMISSAO_INVALIDA: Cadastre primeiro a comissão desta parte na venda.';
    elsif v_qtd<>1 then
      raise exception 'REPASSE_COMISSAO_INVALIDA: Há mais de uma comissão possível; solicite conferência financeira.';
    end if;
    select * into v_comissao from public.comissoes where id=v_comissao_id;
  end if;

  if exists(select 1 from public.pagamentos_comissao p where p.venda_id=v_venda_id
      and p.ordem=v_ordem and p.id is distinct from p_repasse_id)
     and (p_repasse_id is null or v_antes.ordem<>v_ordem) then
    raise exception 'REPASSE_ORDEM_DUPLICADA: Esta venda já possui um repasse com a mesma ordem.';
  end if;

  select coalesce(sum(p.valor),0) into v_soma_antes from public.pagamentos_comissao p
    where p.comissao_id=v_comissao_id
       or (p.comissao_id is null and p.venda_id=v_venda_id
           and p.beneficiario_id=v_beneficiario_id and p.papel=v_papel);
  if p_repasse_id is not null then
    v_antes_pertence:=v_antes.comissao_id=v_comissao_id
      or (v_antes.comissao_id is null and v_antes.venda_id=v_venda_id
          and v_antes.beneficiario_id=v_beneficiario_id and v_antes.papel=v_papel);
  end if;
  v_soma_depois:=v_soma_antes-case when v_antes_pertence then v_antes.valor else 0 end+v_valor;
  if v_soma_depois>v_comissao.valor_final and v_soma_depois>v_soma_antes then
    raise exception 'REPASSE_TOTAL_EXCEDE: Os repasses desta comissão passariam de R$ % para R$ %, acima dos R$ % distribuídos. Reduza o valor ou confira a comissão.',
      replace(to_char(v_soma_antes,'FM999999999990.00'),'.',','),
      replace(to_char(v_soma_depois,'FM999999999990.00'),'.',','),
      replace(to_char(v_comissao.valor_final,'FM999999999990.00'),'.',',');
  end if;

  if p_repasse_id is not null
     and v_antes.comissao_id is not distinct from v_comissao_id
     and v_antes.beneficiario_id=v_beneficiario_id and v_antes.papel=v_papel
     and v_antes.valor=v_valor and v_antes.ordem=v_ordem
     and v_antes.data_prevista is not distinct from v_data
     and v_antes.observacao is not distinct from v_observacao then
    return jsonb_build_object('ok',true,'repasse_id',p_repasse_id,
      'comissao_id',v_comissao_id,'criado',false,'idempotente',true);
  end if;

  if p_repasse_id is not null then
    update public.pagamentos_comissao set
      comissao_id=v_comissao_id,beneficiario_id=v_beneficiario_id,papel=v_papel,
      valor=v_valor,ordem=v_ordem,data_prevista=v_data,observacao=v_observacao
      where id=p_repasse_id returning * into v_depois;
  else
    insert into public.pagamentos_comissao(
      venda_id,comissao_id,beneficiario_id,papel,valor,ordem,data_prevista,
      status,data_pagamento,lancamento_id,observacao,criado_por,request_id
    ) values (
      v_venda_id,v_comissao_id,v_beneficiario_id,v_papel,v_valor,v_ordem,v_data,
      'previsto',null,null,v_observacao,v_uid,v_request_id
    ) returning * into v_depois;
  end if;

  insert into public.erp_auditoria(usuario_id,usuario_nome,acao,modulo,entidade,entidade_id,antes,depois,detalhe)
  values(v_uid,coalesce((select u.nome from public.usuarios u where u.id=v_uid),'sistema/automação'),
    case when p_repasse_id is null then 'criar repasse' else 'editar repasse' end,
    'Financeiro','pagamentos_comissao',v_depois.id::text,
    case when p_repasse_id is null then null else to_jsonb(v_antes) end,to_jsonb(v_depois),
    case when p_repasse_id is null then 'Repasse previsto criado em transação auditada e idempotente.' else 'Repasse previsto editado em transação auditada.' end);
  return jsonb_build_object('ok',true,'repasse_id',v_depois.id,
    'comissao_id',v_depois.comissao_id,'criado',p_repasse_id is null,'idempotente',false);
end
$function$;

comment on function public.financeiro_repasse_salvar(uuid,jsonb) is
  'Cria/edita repasse previsto, vincula comissão canônica, limita total, audita e deduplica retries. SECURITY INVOKER.';
revoke all on function public.financeiro_repasse_salvar(uuid,jsonb) from public,anon;
grant execute on function public.financeiro_repasse_salvar(uuid,jsonb) to authenticated,service_role;
notify pgrst,'reload schema';
