-- Financeiro / repasse de comissão: caixa + status + auditoria em uma transação.
--
-- Antes, settlePayout fazia DELETE/INSERT/UPDATE em chamadas REST separadas.
-- Uma falha intermediária deixava o caixa e pagamentos_comissao contando
-- histórias diferentes. A RPC abaixo é SECURITY INVOKER: preserva exatamente
-- as RLS atuais e apenas reúne as gravações numa transação do Postgres.

create or replace function public.financeiro_decidir_repasse(
  p_repasse_id uuid,
  p_pago boolean,
  p_data_pagamento date default null
)
returns jsonb
language plpgsql
security invoker
set search_path = public, pg_temp
as $function$
declare
  v_uid uuid := auth.uid();
  v_repasse public.pagamentos_comissao;
  v_antes jsonb;
  v_depois jsonb;
  v_caixa public.lancamentos_caixa;
  v_caixa_antes jsonb;
  v_caixa_depois jsonb;
  v_categoria text;
  v_lancamento_id uuid;
  v_n integer;
begin
  if v_uid is null then
    raise exception 'REPASSE_SEM_PERMISSAO: Sessão inválida ou expirada.' using errcode = '42501';
  end if;
  if p_repasse_id is null or p_pago is null then
    raise exception 'REPASSE_DADOS_INVALIDOS: Repasse inválido.';
  end if;
  if p_pago and p_data_pagamento is null then
    raise exception 'REPASSE_DADOS_INVALIDOS: Informe a data do pagamento.';
  end if;

  select * into v_repasse
    from public.pagamentos_comissao
   where id = p_repasse_id
   for update;
  if not found then
    raise exception 'REPASSE_NAO_ENCONTRADO: Repasse não encontrado ou indisponível.';
  end if;
  v_antes := to_jsonb(v_repasse);
  v_lancamento_id := v_repasse.lancamento_id;

  if p_pago then
    if v_lancamento_id is not null then
      select * into v_caixa
        from public.lancamentos_caixa
       where id = v_lancamento_id
       for update;
      if not found then
        raise exception 'REPASSE_INCONSISTENTE: O repasse aponta para um lançamento de caixa inexistente. Nada foi alterado; solicite conferência financeira.';
      end if;
      v_caixa_antes := to_jsonb(v_caixa);

      if v_repasse.status = 'pago'
         and v_repasse.data_pagamento = p_data_pagamento
         and v_caixa.data = p_data_pagamento
         and v_caixa.valor = v_repasse.valor
         and v_caixa.tipo = 'saida'
         and v_caixa.natureza = 'comissao_paga'
         and v_caixa.venda_id is not distinct from v_repasse.venda_id
         and v_caixa.comissao_id is not distinct from v_repasse.comissao_id
         and v_caixa.beneficiario_id is not distinct from v_repasse.beneficiario_id
         and v_caixa.papel::text is not distinct from v_repasse.papel then
        return jsonb_build_object(
          'ok', true, 'repasse_id', p_repasse_id,
          'lancamento_id', v_lancamento_id, 'idempotente', true
        );
      end if;

      update public.lancamentos_caixa
         set data = p_data_pagamento,
             valor = v_repasse.valor,
             venda_id = v_repasse.venda_id,
             comissao_id = v_repasse.comissao_id,
             beneficiario_id = v_repasse.beneficiario_id,
             papel = v_repasse.papel::public.papel_comissao,
             natureza = 'comissao_paga',
             tipo = 'saida'
       where id = v_lancamento_id;
      get diagnostics v_n = row_count;
      if v_n <> 1 then
        raise exception 'REPASSE_INCONSISTENTE: Não foi possível atualizar o lançamento ligado ao repasse. Nada foi alterado.';
      end if;
    else
      select c.nome into v_categoria
        from public.categorias_caixa c
       where c.natureza = 'comissao_paga' and c.ativo = true
       order by c.ordem, c.id
       limit 1;
      if v_categoria is null then
        raise exception 'REPASSE_CATEGORIA_AUSENTE: Não existe categoria ativa de caixa para comissão paga.';
      end if;

      insert into public.lancamentos_caixa (
        tipo, categoria, data, valor, descricao, origem, venda_id,
        comissao_id, beneficiario_id, papel, natureza
      ) values (
        'saida', v_categoria, p_data_pagamento, v_repasse.valor,
        'Repasse de comissão lançado pela ficha da venda.', 'erp',
        v_repasse.venda_id, v_repasse.comissao_id, v_repasse.beneficiario_id,
        v_repasse.papel::public.papel_comissao, 'comissao_paga'
      ) returning id into v_lancamento_id;
    end if;

    update public.pagamentos_comissao
       set status = 'pago', data_pagamento = p_data_pagamento,
           lancamento_id = v_lancamento_id
     where id = p_repasse_id;
  else
    if v_repasse.status <> 'pago' and v_lancamento_id is null then
      return jsonb_build_object(
        'ok', true, 'repasse_id', p_repasse_id,
        'lancamento_id', null, 'idempotente', true
      );
    end if;

    if v_lancamento_id is not null then
      select * into v_caixa
        from public.lancamentos_caixa
       where id = v_lancamento_id
       for update;
      if not found then
        raise exception 'REPASSE_INCONSISTENTE: O repasse aponta para um lançamento de caixa inexistente. Nada foi alterado; solicite conferência financeira.';
      end if;
      v_caixa_antes := to_jsonb(v_caixa);
      delete from public.lancamentos_caixa where id = v_lancamento_id;
      get diagnostics v_n = row_count;
      if v_n <> 1 then
        raise exception 'REPASSE_INCONSISTENTE: Não foi possível remover o lançamento ligado ao repasse. Nada foi alterado.';
      end if;
    end if;

    update public.pagamentos_comissao
       set status = 'previsto', data_pagamento = null, lancamento_id = null
     where id = p_repasse_id;
  end if;

  select to_jsonb(p) into v_depois
    from public.pagamentos_comissao p where p.id = p_repasse_id;
  if p_pago then
    select to_jsonb(l) into v_caixa_depois
      from public.lancamentos_caixa l where l.id = v_lancamento_id;
  end if;

  insert into public.erp_auditoria (
    usuario_id, usuario_nome, acao, modulo, entidade, entidade_id,
    antes, depois, detalhe
  ) values (
    v_uid,
    coalesce((select u.nome from public.usuarios u where u.id = v_uid), 'sistema/automação'),
    case when p_pago then 'baixar repasse' else 'reabrir repasse' end,
    'Financeiro', 'pagamentos_comissao', p_repasse_id::text,
    jsonb_build_object('repasse', v_antes, 'lancamento_caixa', v_caixa_antes),
    jsonb_build_object('repasse', v_depois, 'lancamento_caixa', v_caixa_depois),
    case when p_pago
      then 'Repasse e lançamento de caixa confirmados em transação única.'
      else 'Repasse reaberto e lançamento de caixa removido em transação única.'
    end
  );

  return jsonb_build_object(
    'ok', true, 'repasse_id', p_repasse_id,
    'lancamento_id', case when p_pago then v_lancamento_id else null end,
    'idempotente', false
  );
end
$function$;

comment on function public.financeiro_decidir_repasse(uuid, boolean, date) is
  'Baixa ou reabre repasse, sincroniza o lançamento de caixa e audita tudo numa transação. SECURITY INVOKER preserva RLS.';

revoke all on function public.financeiro_decidir_repasse(uuid, boolean, date) from public, anon;
grant execute on function public.financeiro_decidir_repasse(uuid, boolean, date) to authenticated, service_role;

notify pgrst, 'reload schema';
