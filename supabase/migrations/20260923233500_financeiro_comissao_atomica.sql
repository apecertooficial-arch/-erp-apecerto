-- Financeiro / comissões avulsas: limite, vínculos, auditoria e retry na mesma transação.
-- Não reconcilia as duas vendas legadas acima da comissão bruta nem o repasse
-- histórico sem comissão válida; apenas impede que novas mutações piorem o estado.

alter table public.comissoes add column if not exists request_id uuid;
create unique index if not exists comissoes_request_id_uidx
  on public.comissoes(request_id) where request_id is not null;

create or replace function public.financeiro_comissao_salvar(
  p_comissao_id uuid,
  payload jsonb
)
returns jsonb
language plpgsql
security invoker
set search_path=public,pg_temp
as $function$
declare
  v_uid uuid:=auth.uid();
  v_antes public.comissoes;
  v_depois public.comissoes;
  v_existente public.comissoes;
  v_venda public.vendas;
  v_venda_id uuid;
  v_beneficiario_id uuid;
  v_request_id uuid;
  v_papel_text text;
  v_papel public.papel_comissao;
  v_valor numeric;
  v_soma_antes numeric;
  v_soma_depois numeric;
  v_bruta numeric;
begin
  if v_uid is null or not coalesce(public.can_manage_all(),false) then
    raise exception 'COMISSAO_SEM_PERMISSAO: Você não tem permissão para alterar comissões.' using errcode='42501';
  end if;
  if payload is null or jsonb_typeof(payload)<>'object' then
    raise exception 'COMISSAO_DADOS_INVALIDOS: Dados da comissão inválidos.';
  end if;
  begin
    v_venda_id:=nullif(btrim(payload->>'venda_id'),'')::uuid;
    v_beneficiario_id:=nullif(btrim(payload->>'beneficiario_id'),'')::uuid;
    v_request_id:=nullif(btrim(payload->>'request_id'),'')::uuid;
    v_papel_text:=btrim(payload->>'papel');
    v_valor:=round((payload->>'valor')::numeric,2);
  exception when invalid_text_representation or numeric_value_out_of_range then
    raise exception 'COMISSAO_DADOS_INVALIDOS: Venda, beneficiário, valor ou identificador inválido.';
  end;
  if v_papel_text is null or v_papel_text not in ('corretor','executivo','indicacao','apecerto','gerente')
     or v_valor is null or v_valor='NaN'::numeric or v_valor<0 or v_valor>=100000000000 then
    raise exception 'COMISSAO_DADOS_INVALIDOS: Informe papel e valor não negativo válidos.';
  end if;
  v_papel:=v_papel_text::public.papel_comissao;
  if v_beneficiario_id is not null and not exists(select 1 from public.usuarios u where u.id=v_beneficiario_id) then
    raise exception 'COMISSAO_DADOS_INVALIDOS: Beneficiário não encontrado.';
  end if;

  if p_comissao_id is not null then
    select * into v_antes from public.comissoes where id=p_comissao_id for update;
    if not found then raise exception 'COMISSAO_NAO_ENCONTRADA: Comissão não encontrada ou indisponível.'; end if;
    v_venda_id:=v_antes.venda_id;
    if v_antes.papel=v_papel and v_antes.beneficiario_id is not distinct from v_beneficiario_id
       and v_antes.valor_final=v_valor then
      return jsonb_build_object('ok',true,'comissao_id',p_comissao_id,'criada',false,'idempotente',true);
    end if;
    perform 1 from public.pagamentos_comissao p
      where p.comissao_id=p_comissao_id
         or (p.comissao_id is null and p.venda_id=v_antes.venda_id
             and p.beneficiario_id is not distinct from v_antes.beneficiario_id
             and p.papel=v_antes.papel::text)
      order by p.id for update;
    perform 1 from public.lancamentos_caixa l where l.comissao_id=p_comissao_id order by l.id for update;
    if exists(select 1 from public.pagamentos_comissao p
        where p.comissao_id=p_comissao_id
           or (p.comissao_id is null and p.venda_id=v_antes.venda_id
               and p.beneficiario_id is not distinct from v_antes.beneficiario_id
               and p.papel=v_antes.papel::text))
       or exists(select 1 from public.lancamentos_caixa l where l.comissao_id=p_comissao_id) then
      raise exception 'COMISSAO_MOVIMENTO_ATIVO: Remova primeiro os repasses ou lançamentos de caixa vinculados; a comissão precisa continuar reconciliada.';
    end if;
  else
    if v_venda_id is null or v_request_id is null then
      raise exception 'COMISSAO_DADOS_INVALIDOS: Venda e identificador da solicitação são obrigatórios.';
    end if;
    perform pg_advisory_xact_lock(hashtextextended(v_request_id::text,0));
    select * into v_existente from public.comissoes where request_id=v_request_id for update;
    if found then
      if v_existente.venda_id=v_venda_id and v_existente.papel=v_papel
         and v_existente.beneficiario_id is not distinct from v_beneficiario_id
         and v_existente.valor_final=v_valor then
        return jsonb_build_object('ok',true,'comissao_id',v_existente.id,'criada',true,'idempotente',true);
      end if;
      raise exception 'COMISSAO_REQUEST_CONFLITANTE: Esta solicitação já criou outra comissão. Atualize a tela antes de tentar novamente.';
    end if;
  end if;

  select * into v_venda from public.vendas where id=v_venda_id for update;
  if not found then raise exception 'COMISSAO_NAO_ENCONTRADA: Venda não encontrada ou indisponível.'; end if;
  perform 1 from public.comissoes where venda_id=v_venda_id order by id for update;
  if exists(select 1 from public.comissoes c where c.venda_id=v_venda_id
      and c.papel=v_papel and c.beneficiario_id is not distinct from v_beneficiario_id
      and c.id is distinct from p_comissao_id) then
    raise exception 'COMISSAO_DUPLICADA: Esta parte já possui uma comissão com o mesmo papel nesta venda.';
  end if;

  select coalesce(sum(c.valor_final),0) into v_soma_antes from public.comissoes c where c.venda_id=v_venda_id;
  v_soma_depois:=v_soma_antes-coalesce(v_antes.valor_final,0)+v_valor;
  v_bruta:=round(v_venda.vgv*coalesce(v_venda.percentual_comissao,0),2);
  if v_soma_depois>v_bruta and v_soma_depois>v_soma_antes then
    raise exception 'COMISSAO_TOTAL_EXCEDE: A distribuição passaria de R$ % para R$ %, acima da comissão bruta de R$ %. Reduza o valor ou confira a venda.',
      replace(to_char(v_soma_antes,'FM999999999990.00'),'.',','),
      replace(to_char(v_soma_depois,'FM999999999990.00'),'.',','),
      replace(to_char(v_bruta,'FM999999999990.00'),'.',',');
  end if;

  if p_comissao_id is not null then
    update public.comissoes
      set papel=v_papel,beneficiario_id=v_beneficiario_id,valor_final=v_valor
      where id=p_comissao_id returning * into v_depois;
  else
    insert into public.comissoes(venda_id,papel,beneficiario_id,valor_calculado,valor_final,request_id)
      values(v_venda_id,v_papel,v_beneficiario_id,v_valor,v_valor,v_request_id)
      returning * into v_depois;
    -- UPDATE/DELETE já são auditados por trg_audit_comissoes; INSERT não é.
    insert into public.erp_auditoria(usuario_id,usuario_nome,acao,modulo,entidade,entidade_id,antes,depois,detalhe)
    values(v_uid,coalesce((select u.nome from public.usuarios u where u.id=v_uid),'sistema/automação'),
      'criar','Financeiro','comissoes',v_depois.id::text,null,to_jsonb(v_depois),
      'Financeiro: registro criado em comissoes por operação idempotente.');
  end if;
  return jsonb_build_object('ok',true,'comissao_id',v_depois.id,'criada',p_comissao_id is null,'idempotente',false);
end
$function$;

create or replace function public.financeiro_comissao_excluir(p_comissao_id uuid)
returns jsonb
language plpgsql
security invoker
set search_path=public,pg_temp
as $function$
declare
  v_uid uuid:=auth.uid();
  v_antes public.comissoes;
  v_auditoria public.erp_auditoria;
  v_n integer;
begin
  if v_uid is null or not coalesce(public.can_manage_all(),false) then
    raise exception 'COMISSAO_SEM_PERMISSAO: Você não tem permissão para remover comissões.' using errcode='42501';
  end if;
  if p_comissao_id is null then raise exception 'COMISSAO_DADOS_INVALIDOS: Comissão inválida.'; end if;
  select * into v_antes from public.comissoes where id=p_comissao_id for update;
  if not found then
    select * into v_auditoria from public.erp_auditoria a where a.entidade='comissoes'
      and a.entidade_id=p_comissao_id::text and a.acao='excluir' order by a.id desc limit 1;
    if found then return jsonb_build_object('ok',true,'comissao_id',p_comissao_id,'idempotente',true); end if;
    raise exception 'COMISSAO_NAO_ENCONTRADA: Comissão não encontrada ou já excluída.';
  end if;
  perform 1 from public.pagamentos_comissao p
    where p.comissao_id=p_comissao_id
       or (p.comissao_id is null and p.venda_id=v_antes.venda_id
           and p.beneficiario_id is not distinct from v_antes.beneficiario_id
           and p.papel=v_antes.papel::text)
    order by p.id for update;
  perform 1 from public.lancamentos_caixa l where l.comissao_id=p_comissao_id order by l.id for update;
  if exists(select 1 from public.pagamentos_comissao p
      where p.comissao_id=p_comissao_id
         or (p.comissao_id is null and p.venda_id=v_antes.venda_id
             and p.beneficiario_id is not distinct from v_antes.beneficiario_id
             and p.papel=v_antes.papel::text))
     or exists(select 1 from public.lancamentos_caixa l where l.comissao_id=p_comissao_id) then
    raise exception 'COMISSAO_MOVIMENTO_ATIVO: Remova primeiro os repasses ou lançamentos de caixa vinculados; a comissão precisa continuar reconciliada.';
  end if;
  delete from public.comissoes where id=p_comissao_id;
  get diagnostics v_n=row_count;
  if v_n<>1 then raise exception 'COMISSAO_INCONSISTENTE: Não foi possível remover a comissão. Nada foi alterado.'; end if;
  -- trg_audit_comissoes grava o retrato anterior na mesma transação.
  return jsonb_build_object('ok',true,'comissao_id',p_comissao_id,'idempotente',false);
end
$function$;

comment on function public.financeiro_comissao_salvar(uuid,jsonb) is
  'Cria/edita comissão com limite da venda, retry e proteção dos repasses. SECURITY INVOKER.';
comment on function public.financeiro_comissao_excluir(uuid) is
  'Exclui comissão sem movimentos e usa o trigger existente para auditoria. SECURITY INVOKER.';
revoke all on function public.financeiro_comissao_salvar(uuid,jsonb),public.financeiro_comissao_excluir(uuid) from public,anon;
grant execute on function public.financeiro_comissao_salvar(uuid,jsonb),public.financeiro_comissao_excluir(uuid) to authenticated,service_role;
notify pgrst,'reload schema';
