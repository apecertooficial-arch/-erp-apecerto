-- Financeiro / agenda de recebimentos: gravação e exclusão auditadas.
-- Recebimento já baixado precisa ser reaberto pela RPC que sincroniza o caixa.

alter table public.recebimentos add column if not exists request_id uuid;
create unique index if not exists recebimentos_request_id_uidx
  on public.recebimentos(request_id) where request_id is not null;

create or replace function public.financeiro_recebimento_salvar(
  p_recebimento_id uuid,
  payload jsonb
)
returns jsonb
language plpgsql
security invoker
set search_path=public,pg_temp
as $function$
declare
  v_uid uuid:=auth.uid();
  v_antes public.recebimentos;
  v_depois public.recebimentos;
  v_existente public.recebimentos;
  v_venda public.vendas;
  v_venda_id uuid;
  v_request_id uuid;
  v_parcela_num numeric;
  v_parcela integer;
  v_valor numeric;
  v_data date;
  v_soma_antes numeric;
  v_soma_depois numeric;
  v_bruta numeric;
begin
  if v_uid is null or not coalesce(public.can_manage_all(),false) then
    raise exception 'RECEBIMENTO_SEM_PERMISSAO: Você não tem permissão para alterar recebimentos.' using errcode='42501';
  end if;
  if payload is null or jsonb_typeof(payload)<>'object' then
    raise exception 'RECEBIMENTO_DADOS_INVALIDOS: Dados do recebimento inválidos.';
  end if;
  begin
    v_parcela_num:=(payload->>'numero_parcela')::numeric;
    v_parcela:=v_parcela_num::integer;
    v_valor:=round((payload->>'valor_total')::numeric,2);
    v_data:=nullif(btrim(payload->>'data_prevista'),'')::date;
    v_venda_id:=nullif(btrim(payload->>'venda_id'),'')::uuid;
    v_request_id:=nullif(btrim(payload->>'request_id'),'')::uuid;
  exception when invalid_text_representation or invalid_datetime_format
    or datetime_field_overflow or numeric_value_out_of_range then
    raise exception 'RECEBIMENTO_DADOS_INVALIDOS: Parcela, valor, data ou identificador inválido.';
  end;
  if v_parcela is null or v_parcela_num<>trunc(v_parcela_num) or v_parcela<1
     or v_valor is null or v_valor='NaN'::numeric or v_valor<=0 or v_valor>=100000000000 then
    raise exception 'RECEBIMENTO_DADOS_INVALIDOS: Informe parcela e valor maior que zero.';
  end if;

  if p_recebimento_id is not null then
    select * into v_antes from public.recebimentos where id=p_recebimento_id for update;
    if not found then raise exception 'RECEBIMENTO_NAO_ENCONTRADO: Recebimento não encontrado ou indisponível.'; end if;
    v_venda_id:=v_antes.venda_id;
    if v_antes.status='recebido' or v_antes.data_recebimento is not null
       or exists(select 1 from public.lancamentos_caixa l where l.recebimento_id=p_recebimento_id) then
      raise exception 'RECEBIMENTO_MOVIMENTO_ATIVO: Desfaça a baixa antes de editar a parcela; o caixa precisa continuar reconciliado.';
    end if;
  else
    if v_venda_id is null or v_request_id is null then
      raise exception 'RECEBIMENTO_DADOS_INVALIDOS: Venda e identificador da solicitação são obrigatórios.';
    end if;
    -- Serializa retries simultâneos mesmo antes de existir uma linha para travar.
    perform pg_advisory_xact_lock(hashtextextended(v_request_id::text,0));
    select * into v_existente from public.recebimentos where request_id=v_request_id for update;
    if found then
      if v_existente.venda_id=v_venda_id and v_existente.numero_parcela=v_parcela
         and v_existente.valor_total=v_valor and v_existente.data_prevista is not distinct from v_data then
        return jsonb_build_object('ok',true,'recebimento_id',v_existente.id,'criado',true,'idempotente',true);
      end if;
      raise exception 'RECEBIMENTO_REQUEST_CONFLITANTE: Esta solicitação já criou outra parcela. Atualize a tela antes de tentar novamente.';
    end if;
  end if;

  select * into v_venda from public.vendas where id=v_venda_id for update;
  if not found then raise exception 'RECEBIMENTO_NAO_ENCONTRADO: Venda não encontrada ou indisponível.'; end if;
  perform 1 from public.recebimentos where venda_id=v_venda_id order by id for update;
  if exists(select 1 from public.recebimentos r where r.venda_id=v_venda_id
    and r.numero_parcela=v_parcela and r.id is distinct from p_recebimento_id) then
    raise exception 'RECEBIMENTO_PARCELA_DUPLICADA: Esta venda já possui uma parcela com esse número.';
  end if;

  select coalesce(sum(r.valor_total),0) into v_soma_antes from public.recebimentos r where r.venda_id=v_venda_id;
  v_soma_depois:=v_soma_antes-coalesce(v_antes.valor_total,0)+v_valor;
  v_bruta:=round(v_venda.vgv*coalesce(v_venda.percentual_comissao,0),2);
  if v_soma_depois>v_bruta and v_soma_depois>v_soma_antes then
    raise exception 'RECEBIMENTO_TOTAL_EXCEDE: As parcelas passariam de R$ % para R$ %, acima da comissão bruta de R$ %. Reduza o valor ou confira a venda.',
      replace(to_char(v_soma_antes,'FM999999999990.00'),'.',','),
      replace(to_char(v_soma_depois,'FM999999999990.00'),'.',','),
      replace(to_char(v_bruta,'FM999999999990.00'),'.',',');
  end if;

  if p_recebimento_id is not null then
    if v_antes.numero_parcela=v_parcela and v_antes.valor_total=v_valor
       and v_antes.data_prevista is not distinct from v_data then
      return jsonb_build_object('ok',true,'recebimento_id',p_recebimento_id,'criado',false,'idempotente',true);
    end if;
    update public.recebimentos set numero_parcela=v_parcela,valor_total=v_valor,data_prevista=v_data
      where id=p_recebimento_id returning * into v_depois;
  else
    insert into public.recebimentos(venda_id,numero_parcela,valor_total,data_prevista,status,data_recebimento,request_id)
      values(v_venda_id,v_parcela,v_valor,v_data,'pendente',null,v_request_id)
      returning * into v_depois;
  end if;

  insert into public.erp_auditoria(usuario_id,usuario_nome,acao,modulo,entidade,entidade_id,antes,depois,detalhe)
  values(v_uid,coalesce((select u.nome from public.usuarios u where u.id=v_uid),'sistema/automação'),
    case when p_recebimento_id is null then 'criar recebimento' else 'editar recebimento' end,
    'Financeiro','recebimentos',v_depois.id::text,
    case when p_recebimento_id is null then null else to_jsonb(v_antes) end,to_jsonb(v_depois),
    case when p_recebimento_id is null then 'Parcela prevista criada em transação auditada e idempotente.' else 'Parcela pendente editada em transação auditada.' end);
  return jsonb_build_object('ok',true,'recebimento_id',v_depois.id,'criado',p_recebimento_id is null,'idempotente',false);
end
$function$;

create or replace function public.financeiro_recebimento_excluir(p_recebimento_id uuid)
returns jsonb
language plpgsql
security invoker
set search_path=public,pg_temp
as $function$
declare
  v_uid uuid:=auth.uid();
  v_antes public.recebimentos;
  v_auditoria public.erp_auditoria;
  v_n integer;
begin
  if v_uid is null or not coalesce(public.can_manage_all(),false) then
    raise exception 'RECEBIMENTO_SEM_PERMISSAO: Você não tem permissão para remover recebimentos.' using errcode='42501';
  end if;
  if p_recebimento_id is null then raise exception 'RECEBIMENTO_DADOS_INVALIDOS: Recebimento inválido.'; end if;
  select * into v_antes from public.recebimentos where id=p_recebimento_id for update;
  if not found then
    select * into v_auditoria from public.erp_auditoria a where a.entidade='recebimentos'
      and a.entidade_id=p_recebimento_id::text and a.acao='excluir recebimento' order by a.id desc limit 1;
    if found then return jsonb_build_object('ok',true,'recebimento_id',p_recebimento_id,'idempotente',true); end if;
    raise exception 'RECEBIMENTO_NAO_ENCONTRADO: Recebimento não encontrado ou já excluído.';
  end if;
  if v_antes.status='recebido' or v_antes.data_recebimento is not null
     or exists(select 1 from public.lancamentos_caixa l where l.recebimento_id=p_recebimento_id) then
    raise exception 'RECEBIMENTO_MOVIMENTO_ATIVO: Desfaça a baixa antes de remover a parcela; o caixa precisa continuar reconciliado.';
  end if;
  delete from public.recebimentos where id=p_recebimento_id;
  get diagnostics v_n=row_count;
  if v_n<>1 then raise exception 'RECEBIMENTO_INCONSISTENTE: Não foi possível remover a parcela. Nada foi alterado.'; end if;
  insert into public.erp_auditoria(usuario_id,usuario_nome,acao,modulo,entidade,entidade_id,antes,depois,detalhe)
  values(v_uid,coalesce((select u.nome from public.usuarios u where u.id=v_uid),'sistema/automação'),
    'excluir recebimento','Financeiro','recebimentos',p_recebimento_id::text,to_jsonb(v_antes),null,
    'Parcela pendente excluída em transação auditada e idempotente.');
  return jsonb_build_object('ok',true,'recebimento_id',p_recebimento_id,'idempotente',false);
end
$function$;

comment on function public.financeiro_recebimento_salvar(uuid,jsonb) is
  'Cria ou edita parcela pendente, audita e preserva movimentos baixados. SECURITY INVOKER.';
comment on function public.financeiro_recebimento_excluir(uuid) is
  'Exclui somente parcela pendente, audita e trata retry. SECURITY INVOKER.';
revoke all on function public.financeiro_recebimento_salvar(uuid,jsonb),public.financeiro_recebimento_excluir(uuid) from public,anon;
grant execute on function public.financeiro_recebimento_salvar(uuid,jsonb),public.financeiro_recebimento_excluir(uuid) to authenticated,service_role;
notify pgrst,'reload schema';
