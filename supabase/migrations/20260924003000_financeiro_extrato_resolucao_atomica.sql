-- Financeiro / conciliação bancária: a decisão da linha e o caixa mudam juntos.
-- Não reprocessa as 36 linhas históricas já conciliadas; protege somente novas
-- decisões e retries explícitos.

create unique index if not exists extrato_linha_lancamento_id_uidx
  on public.extrato_linha(lancamento_id) where lancamento_id is not null;

create or replace function public.financeiro_extrato_resolver(
  p_linha_id uuid,
  p_decisao text,
  payload jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security invoker
set search_path=public,pg_temp
as $function$
declare
  v_uid uuid:=auth.uid();
  v_decisao text:=lower(btrim(coalesce(p_decisao,'')));
  v_linha public.extrato_linha;
  v_linha_depois public.extrato_linha;
  v_caixa public.lancamentos_caixa;
  v_caixa_depois public.lancamentos_caixa;
  v_categoria public.categorias_caixa;
  v_comissao public.comissoes;
  v_target_id uuid;
  v_venda_id uuid;
  v_comissao_id uuid;
  v_categoria_nome text;
  v_descricao text;
  v_tipo text;
begin
  if v_uid is null or not coalesce(public.can_manage_all(),false) then
    raise exception 'EXTRATO_SEM_PERMISSAO: Você não tem permissão para conciliar o extrato.' using errcode='42501';
  end if;
  if p_linha_id is null or v_decisao not in ('lancar','vincular','ignorar')
     or payload is null or jsonb_typeof(payload)<>'object' then
    raise exception 'EXTRATO_DADOS_INVALIDOS: Linha, decisão ou dados inválidos.';
  end if;

  select * into v_linha from public.extrato_linha where id=p_linha_id for update;
  if not found then
    raise exception 'EXTRATO_NAO_ENCONTRADO: Linha de extrato não encontrada ou indisponível.';
  end if;

  begin
    v_target_id:=coalesce(nullif(btrim(payload->>'lancamento_id'),'')::uuid,v_linha.sugestao_lancamento_id);
    v_venda_id:=nullif(btrim(payload->>'venda_id'),'')::uuid;
    v_comissao_id:=nullif(btrim(payload->>'comissao_id'),'')::uuid;
  exception when invalid_text_representation then
    raise exception 'EXTRATO_DADOS_INVALIDOS: Venda, comissão ou lançamento relacionado inválido.';
  end;
  v_categoria_nome:=coalesce(nullif(left(btrim(payload->>'categoria'),80),''),v_linha.categoria_sugerida,'Outros');
  v_descricao:=coalesce(nullif(left(btrim(payload->>'descricao'),400),''),v_linha.descricao);
  v_tipo:=case when v_linha.valor<0 then 'saida' else 'entrada' end;

  -- A própria linha é a chave idempotente: um retry igual confirma o resultado;
  -- uma decisão diferente é conflito e nunca cria outro lançamento.
  if v_linha.situacao<>'pendente' then
    if v_decisao='ignorar' and v_linha.situacao='ignorado' and v_linha.lancamento_id is null then
      return jsonb_build_object('ok',true,'linha_id',v_linha.id,'lancamento_id',null,'situacao','ignorado','idempotente',true);
    end if;
    if v_decisao='vincular' and v_linha.situacao='vinculado'
       and v_target_id is not null and v_linha.lancamento_id=v_target_id then
      return jsonb_build_object('ok',true,'linha_id',v_linha.id,'lancamento_id',v_target_id,'situacao','vinculado','idempotente',true);
    end if;
    if v_decisao='lancar' and v_linha.situacao='lancado' and v_linha.lancamento_id is not null then
      select * into v_caixa from public.lancamentos_caixa where id=v_linha.lancamento_id for update;
      if found and v_caixa.origem='extrato' and v_caixa.data=v_linha.data
         and v_caixa.tipo::text=v_tipo and v_caixa.valor=round(abs(v_linha.valor),2)
         and v_caixa.categoria=v_categoria_nome and v_caixa.descricao is not distinct from v_descricao
         and v_caixa.venda_id is not distinct from v_venda_id
         and v_caixa.comissao_id is not distinct from v_comissao_id then
        return jsonb_build_object('ok',true,'linha_id',v_linha.id,'lancamento_id',v_caixa.id,'situacao','lancado','idempotente',true);
      end if;
    end if;
    raise exception 'EXTRATO_JA_RESOLVIDO: Esta linha já foi conciliada de outra forma. Atualize a tela antes de tentar novamente.';
  end if;

  if v_decisao='ignorar' then
    update public.extrato_linha set situacao='ignorado',lancamento_id=null,
      resolvido_por=v_uid,resolvido_em=now()
      where id=v_linha.id returning * into v_linha_depois;
  elsif v_decisao='vincular' then
    if v_target_id is null or v_target_id is distinct from v_linha.sugestao_lancamento_id then
      raise exception 'EXTRATO_DADOS_INVALIDOS: O lançamento sugerido não está mais disponível para esta linha.';
    end if;
    select * into v_caixa from public.lancamentos_caixa where id=v_target_id for update;
    if not found then
      raise exception 'EXTRATO_LANCAMENTO_NAO_ENCONTRADO: O lançamento sugerido não existe mais.';
    end if;
    if exists(select 1 from public.extrato_linha e
      where e.lancamento_id=v_target_id and e.id<>v_linha.id) then
      raise exception 'EXTRATO_INCONSISTENTE: Este lançamento já está conciliado com outra linha bancária. Nada foi alterado.';
    end if;
    if v_caixa.tipo::text<>v_tipo or abs(v_caixa.valor-abs(v_linha.valor))>0.02
       or abs(v_caixa.data-v_linha.data)>3 then
      raise exception 'EXTRATO_INCONSISTENTE: O lançamento sugerido diverge em tipo, valor ou data. Nada foi alterado.';
    end if;
    update public.extrato_linha set situacao='vinculado',lancamento_id=v_target_id,
      resolvido_por=v_uid,resolvido_em=now()
      where id=v_linha.id returning * into v_linha_depois;
    v_caixa_depois:=v_caixa;
  else
    select * into v_categoria from public.categorias_caixa c
      where c.ativo=true and c.nome=v_categoria_nome
        and c.tipo::text in (v_tipo,'ambos')
      order by c.id limit 1;
    if not found then
      raise exception 'EXTRATO_DADOS_INVALIDOS: A categoria escolhida não está ativa para este tipo de lançamento.';
    end if;
    if v_categoria.natureza in ('comissao_paga','comissao_recebida') and v_venda_id is null then
      raise exception 'EXTRATO_DADOS_INVALIDOS: Categoria de comissão exige a venda relacionada.';
    end if;
    if v_venda_id is not null and not exists(select 1 from public.vendas v where v.id=v_venda_id) then
      raise exception 'EXTRATO_DADOS_INVALIDOS: Venda relacionada não encontrada.';
    end if;
    if v_comissao_id is not null then
      select * into v_comissao from public.comissoes c
        where c.id=v_comissao_id and c.venda_id=v_venda_id for update;
      if not found then
        raise exception 'EXTRATO_DADOS_INVALIDOS: A comissão não pertence à venda relacionada.';
      end if;
    end if;
    if v_categoria.natureza='comissao_paga' and v_venda_id is not null
       and v_comissao_id is null
       and exists(select 1 from public.comissoes c where c.venda_id=v_venda_id) then
      raise exception 'EXTRATO_DADOS_INVALIDOS: Escolha qual comissão ou corretor está sendo pago.';
    end if;

    insert into public.lancamentos_caixa(
      tipo,categoria,data,valor,descricao,origem,natureza,venda_id,
      comissao_id,beneficiario_id,papel
    ) values (
      v_tipo::public.tipo_caixa,v_categoria.nome,v_linha.data,round(abs(v_linha.valor),2),v_descricao,
      'extrato',v_categoria.natureza,v_venda_id,v_comissao_id,
      case when v_comissao_id is null then null else v_comissao.beneficiario_id end,
      case when v_comissao_id is null then null else v_comissao.papel end
    ) returning * into v_caixa_depois;
    update public.extrato_linha set situacao='lancado',lancamento_id=v_caixa_depois.id,
      resolvido_por=v_uid,resolvido_em=now()
      where id=v_linha.id returning * into v_linha_depois;
  end if;

  insert into public.erp_auditoria(
    usuario_id,usuario_nome,acao,modulo,entidade,entidade_id,antes,depois,detalhe
  ) values (
    v_uid,coalesce((select u.nome from public.usuarios u where u.id=v_uid),'sistema/automação'),
    case v_decisao when 'lancar' then 'lançar linha de extrato' when 'vincular' then 'vincular linha de extrato' else 'ignorar linha de extrato' end,
    'Financeiro','extrato_linha',v_linha.id::text,to_jsonb(v_linha),
    jsonb_build_object('linha',to_jsonb(v_linha_depois),'lancamento_caixa',case when v_caixa_depois.id is null then null else to_jsonb(v_caixa_depois) end),
    'Linha de extrato e caixa conciliados em uma transação auditada e idempotente.'
  );
  return jsonb_build_object('ok',true,'linha_id',v_linha.id,
    'lancamento_id',v_linha_depois.lancamento_id,'situacao',v_linha_depois.situacao,'idempotente',false);
end
$function$;

create or replace function public.financeiro_extrato_resolver_lote(p_importacao_id uuid)
returns jsonb
language plpgsql
security invoker
set search_path=public,pg_temp
as $function$
declare
  v_uid uuid:=auth.uid();
  v_linha public.extrato_linha;
  v_categoria_nome text;
  v_natureza text;
  v_lancadas integer:=0;
  v_vinculadas integer:=0;
  v_ignoradas integer:=0;
  v_pulou integer:=0;
  v_total integer:=0;
begin
  if v_uid is null or not coalesce(public.can_manage_all(),false) then
    raise exception 'EXTRATO_SEM_PERMISSAO: Você não tem permissão para conciliar o extrato.' using errcode='42501';
  end if;
  if p_importacao_id is null then
    raise exception 'EXTRATO_DADOS_INVALIDOS: Importação inválida.';
  end if;
  perform 1 from public.extrato_importacao where id=p_importacao_id for update;
  if not found then
    raise exception 'EXTRATO_NAO_ENCONTRADO: Importação não encontrada ou indisponível.';
  end if;

  for v_linha in
    select * from public.extrato_linha
      where importacao_id=p_importacao_id and situacao='pendente'
      order by id for update
  loop
    v_total:=v_total+1;
    if v_linha.sugestao='transferencia' then
      perform public.financeiro_extrato_resolver(v_linha.id,'ignorar','{}'::jsonb);
      v_ignoradas:=v_ignoradas+1;
    elsif v_linha.sugestao='vincular' and v_linha.sugestao_lancamento_id is not null then
      perform public.financeiro_extrato_resolver(v_linha.id,'vincular','{}'::jsonb);
      v_vinculadas:=v_vinculadas+1;
    else
      v_categoria_nome:=coalesce(v_linha.categoria_sugerida,'Outros');
      select c.natureza into v_natureza from public.categorias_caixa c
        where c.ativo=true and c.nome=v_categoria_nome
          and c.tipo::text in (case when v_linha.valor<0 then 'saida' else 'entrada' end,'ambos')
        order by c.id limit 1;
      if v_natureza in ('comissao_paga','comissao_recebida') then
        v_pulou:=v_pulou+1;
      else
        perform public.financeiro_extrato_resolver(v_linha.id,'lancar',
          jsonb_build_object('categoria',v_categoria_nome,'descricao',v_linha.descricao));
        v_lancadas:=v_lancadas+1;
      end if;
    end if;
  end loop;
  return jsonb_build_object('ok',true,'importacao_id',p_importacao_id,
    'lancadas',v_lancadas,'vinculadas',v_vinculadas,'ignoradas',v_ignoradas,
    'pulou',v_pulou,'idempotente',v_total=0);
end
$function$;

comment on function public.financeiro_extrato_resolver(uuid,text,jsonb) is
  'Resolve uma linha de extrato junto do caixa e auditoria. SECURITY INVOKER, idempotente pela linha.';
comment on function public.financeiro_extrato_resolver_lote(uuid) is
  'Aplica sugestões pendentes de uma importação em uma única transação; comissões sem vínculo permanecem pendentes.';
revoke all on function public.financeiro_extrato_resolver(uuid,text,jsonb) from public,anon;
revoke all on function public.financeiro_extrato_resolver_lote(uuid) from public,anon;
grant execute on function public.financeiro_extrato_resolver(uuid,text,jsonb) to authenticated,service_role;
grant execute on function public.financeiro_extrato_resolver_lote(uuid) to authenticated,service_role;
notify pgrst,'reload schema';
