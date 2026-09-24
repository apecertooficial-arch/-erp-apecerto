-- Financeiro / ciclo de vida do caixa: edição e exclusão atômicas e auditadas.
-- Lançamentos derivados de repasse só podem mudar pela decisão do repasse;
-- lançamentos de recebimento mantêm valor, tipo, data e status reconciliados.

create or replace function public.financeiro_caixa_editar(
  p_lancamento_id uuid,
  payload jsonb
)
returns jsonb
language plpgsql
security invoker
set search_path = public, pg_temp
as $function$
declare
  v_uid uuid := auth.uid();
  v_antes public.lancamentos_caixa;
  v_depois public.lancamentos_caixa;
  v_recebimento public.recebimentos;
  v_rec_antes jsonb;
  v_rec_depois jsonb;
  v_data date;
  v_tipo text;
  v_categoria text;
  v_valor numeric;
  v_descricao text;
begin
  if v_uid is null then
    raise exception 'CAIXA_SEM_PERMISSAO: Sessão inválida ou expirada.' using errcode='42501';
  end if;
  if p_lancamento_id is null or payload is null or jsonb_typeof(payload)<>'object' then
    raise exception 'CAIXA_DADOS_INVALIDOS: Lançamento ou dados de edição inválidos.';
  end if;
  begin
    v_data:=nullif(btrim(payload->>'data'),'')::date;
    v_valor:=round((payload->>'valor')::numeric,2);
  exception when invalid_text_representation or invalid_datetime_format
    or datetime_field_overflow or numeric_value_out_of_range then
    raise exception 'CAIXA_DADOS_INVALIDOS: Data ou valor inválido.';
  end;
  v_tipo:=btrim(coalesce(payload->>'tipo',''));
  v_categoria:=left(btrim(coalesce(payload->>'categoria','')),100);
  v_descricao:=left(nullif(btrim(payload->>'descricao'),''),500);
  if v_tipo not in ('entrada','saida') or v_categoria='' or v_data is null
     or v_valor is null or v_valor='NaN'::numeric or v_valor<=0
     or v_valor>=100000000000 then
    raise exception 'CAIXA_DADOS_INVALIDOS: Preencha tipo, categoria, data e valor maior que zero.';
  end if;

  select * into v_antes from public.lancamentos_caixa
   where id=p_lancamento_id for update;
  if not found then
    raise exception 'CAIXA_NAO_ENCONTRADO: Lançamento não encontrado ou já excluído.';
  end if;
  if exists(select 1 from public.pagamentos_comissao p where p.lancamento_id=p_lancamento_id) then
    raise exception 'CAIXA_REPASSE_VINCULADO: Este caixa pertence a um repasse. Reabra ou altere a baixa pela ficha da venda.';
  end if;

  if v_antes.recebimento_id is not null then
    select * into v_recebimento from public.recebimentos
     where id=v_antes.recebimento_id for update;
    if not found then
      raise exception 'CAIXA_RECEBIMENTO_NAO_ENCONTRADO: A parcela ligada ao caixa não existe. Nada foi alterado.';
    end if;
    v_rec_antes:=to_jsonb(v_recebimento);
    if v_tipo<>'entrada' or v_valor<>round(v_recebimento.valor_total,2) then
      raise exception 'CAIXA_RECEBIMENTO_INVALIDO: Caixa ligado a parcela deve continuar como entrada no valor integral.';
    end if;
  end if;

  if v_antes.tipo::text=v_tipo and v_antes.categoria=v_categoria
     and v_antes.data=v_data and v_antes.valor=v_valor
     and v_antes.descricao is not distinct from v_descricao
     and (v_antes.recebimento_id is null or
          (v_recebimento.status='recebido' and v_recebimento.data_recebimento=v_data)) then
    return jsonb_build_object('ok',true,'lancamento_id',p_lancamento_id,'idempotente',true);
  end if;

  update public.lancamentos_caixa
     set tipo=v_tipo::public.tipo_caixa, categoria=v_categoria, data=v_data,
         valor=v_valor, descricao=v_descricao
   where id=p_lancamento_id returning * into v_depois;

  if v_antes.recebimento_id is not null then
    update public.recebimentos set status='recebido',data_recebimento=v_data
     where id=v_antes.recebimento_id;
    select to_jsonb(r) into v_rec_depois from public.recebimentos r
     where r.id=v_antes.recebimento_id;
  end if;

  insert into public.erp_auditoria(
    usuario_id,usuario_nome,acao,modulo,entidade,entidade_id,antes,depois,detalhe
  ) values (
    v_uid,coalesce((select u.nome from public.usuarios u where u.id=v_uid),'sistema/automação'),
    'editar lançamento','Financeiro','lancamentos_caixa',p_lancamento_id::text,
    jsonb_build_object('lancamento_caixa',to_jsonb(v_antes),'recebimento',v_rec_antes),
    jsonb_build_object('lancamento_caixa',to_jsonb(v_depois),'recebimento',v_rec_depois),
    case when v_antes.recebimento_id is null
      then 'Lançamento editado em transação única.'
      else 'Lançamento e data do recebimento editados em transação única.' end
  );
  return jsonb_build_object('ok',true,'lancamento_id',p_lancamento_id,'idempotente',false);
end
$function$;

create or replace function public.financeiro_caixa_excluir(p_lancamento_id uuid)
returns jsonb
language plpgsql
security invoker
set search_path = public, pg_temp
as $function$
declare
  v_uid uuid:=auth.uid();
  v_antes public.lancamentos_caixa;
  v_recebimento public.recebimentos;
  v_rec_depois jsonb;
  v_reaberto boolean;
begin
  if v_uid is null then
    raise exception 'CAIXA_SEM_PERMISSAO: Sessão inválida ou expirada.' using errcode='42501';
  end if;
  if p_lancamento_id is null then
    raise exception 'CAIXA_DADOS_INVALIDOS: Lançamento inválido.';
  end if;
  select * into v_antes from public.lancamentos_caixa
   where id=p_lancamento_id for update;
  if not found then
    select (a.antes->'lancamento_caixa'->>'recebimento_id') is not null
      into v_reaberto from public.erp_auditoria a
      where a.entidade='lancamentos_caixa' and a.entidade_id=p_lancamento_id::text
        and a.acao='excluir lançamento'
      order by a.id desc limit 1;
    if found then
      return jsonb_build_object(
        'ok',true,'lancamento_id',p_lancamento_id,
        'recebimento_reaberto',coalesce(v_reaberto,false),'idempotente',true
      );
    end if;
    raise exception 'CAIXA_NAO_ENCONTRADO: Lançamento não encontrado ou já excluído.';
  end if;
  if exists(select 1 from public.pagamentos_comissao p where p.lancamento_id=p_lancamento_id) then
    raise exception 'CAIXA_REPASSE_VINCULADO: Este caixa pertence a um repasse. Reabra a baixa pela ficha da venda.';
  end if;
  if v_antes.recebimento_id is not null then
    select * into v_recebimento from public.recebimentos
     where id=v_antes.recebimento_id for update;
    if not found then
      raise exception 'CAIXA_RECEBIMENTO_NAO_ENCONTRADO: A parcela ligada ao caixa não existe. Nada foi alterado.';
    end if;
  end if;

  delete from public.lancamentos_caixa where id=p_lancamento_id;
  if v_antes.recebimento_id is not null then
    update public.recebimentos set status='pendente',data_recebimento=null
     where id=v_antes.recebimento_id;
    select to_jsonb(r) into v_rec_depois from public.recebimentos r
     where r.id=v_antes.recebimento_id;
  end if;

  insert into public.erp_auditoria(
    usuario_id,usuario_nome,acao,modulo,entidade,entidade_id,antes,depois,detalhe
  ) values (
    v_uid,coalesce((select u.nome from public.usuarios u where u.id=v_uid),'sistema/automação'),
    'excluir lançamento','Financeiro','lancamentos_caixa',p_lancamento_id::text,
    jsonb_build_object('lancamento_caixa',to_jsonb(v_antes),'recebimento',case when v_antes.recebimento_id is null then null else to_jsonb(v_recebimento) end),
    jsonb_build_object('lancamento_caixa',null,'recebimento',v_rec_depois),
    case when v_antes.recebimento_id is null
      then 'Lançamento excluído em transação única.'
      else 'Lançamento excluído e recebimento reaberto em transação única.' end
  );
  return jsonb_build_object(
    'ok',true,'lancamento_id',p_lancamento_id,
    'recebimento_reaberto',v_antes.recebimento_id is not null,'idempotente',false
  );
end
$function$;

comment on function public.financeiro_caixa_editar(uuid,jsonb) is
  'Edita caixa e sincroniza recebimento numa transação auditada; bloqueia caixa derivado de repasse. SECURITY INVOKER.';
comment on function public.financeiro_caixa_excluir(uuid) is
  'Exclui caixa e reabre recebimento numa transação auditada; bloqueia caixa derivado de repasse. SECURITY INVOKER.';

revoke all on function public.financeiro_caixa_editar(uuid,jsonb) from public,anon;
revoke all on function public.financeiro_caixa_excluir(uuid) from public,anon;
grant execute on function public.financeiro_caixa_editar(uuid,jsonb) to authenticated,service_role;
grant execute on function public.financeiro_caixa_excluir(uuid) to authenticated,service_role;

notify pgrst,'reload schema';
