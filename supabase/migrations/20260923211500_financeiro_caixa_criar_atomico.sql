-- Financeiro / criação de caixa: lançamento + baixa + auditoria atômicos.
-- O estado produtivo anterior já satisfaz as duas novas unicidades; não há
-- backfill nem alteração de valores históricos nesta migration.

alter table public.lancamentos_caixa
  add column if not exists request_id uuid;

comment on column public.lancamentos_caixa.request_id is
  'Idempotência de financeiro_caixa_criar: repetir a mesma solicitação não duplica o caixa.';

create unique index if not exists lancamentos_caixa_request_id_key
  on public.lancamentos_caixa (request_id) where request_id is not null;

create unique index if not exists lancamentos_caixa_recebimento_unique
  on public.lancamentos_caixa (recebimento_id) where recebimento_id is not null;

create or replace function public.financeiro_caixa_criar(payload jsonb)
returns jsonb
language plpgsql
security invoker
set search_path = public, pg_temp
as $function$
declare
  v_uid uuid := auth.uid();
  v_request uuid;
  v_existente public.lancamentos_caixa;
  v_recebimento public.recebimentos;
  v_lancamento public.lancamentos_caixa;
  v_data date;
  v_tipo text;
  v_categoria text;
  v_valor numeric;
  v_descricao text;
  v_venda uuid;
  v_recebimento_id uuid;
  v_comissao uuid;
  v_beneficiario uuid;
  v_papel text;
  v_natureza text;
  v_baixar boolean;
  v_n integer;
  v_constraint text;
begin
  if v_uid is null then
    raise exception 'CAIXA_SEM_PERMISSAO: Sessão inválida ou expirada.' using errcode = '42501';
  end if;
  if payload is null or jsonb_typeof(payload) <> 'object' then
    raise exception 'CAIXA_DADOS_INVALIDOS: Dados do lançamento ausentes.';
  end if;

  begin
    v_request := nullif(btrim(payload->>'request_id'), '')::uuid;
    v_data := nullif(btrim(payload->>'data'), '')::date;
    v_valor := round((payload->>'valor')::numeric, 2);
    v_venda := nullif(btrim(payload->>'venda_id'), '')::uuid;
    v_recebimento_id := nullif(btrim(payload->>'recebimento_id'), '')::uuid;
    v_comissao := nullif(btrim(payload->>'comissao_id'), '')::uuid;
    v_beneficiario := nullif(btrim(payload->>'beneficiario_id'), '')::uuid;
    v_baixar := coalesce((payload->>'baixar_recebimento')::boolean, false);
  exception
    when invalid_text_representation or invalid_datetime_format
      or datetime_field_overflow or numeric_value_out_of_range then
      raise exception 'CAIXA_DADOS_INVALIDOS: Data, valor ou identificador inválido.';
  end;

  if v_request is not null then
    select * into v_existente from public.lancamentos_caixa where request_id = v_request;
    if found then
      return jsonb_build_object(
        'ok', true, 'lancamento_id', v_existente.id,
        'recebimento_baixado', coalesce((select r.status = 'recebido' from public.recebimentos r where r.id = v_existente.recebimento_id), false),
        'idempotente', true
      );
    end if;
  end if;

  v_tipo := btrim(coalesce(payload->>'tipo', ''));
  v_categoria := left(btrim(coalesce(payload->>'categoria', '')), 100);
  v_descricao := left(nullif(btrim(payload->>'descricao'), ''), 500);
  v_papel := nullif(btrim(payload->>'papel'), '');
  v_natureza := coalesce(nullif(btrim(payload->>'natureza'), ''), 'normal');

  if v_tipo not in ('entrada', 'saida') or v_categoria = '' or v_data is null
     or v_valor is null or v_valor = 'NaN'::numeric or v_valor <= 0
     or v_valor >= 100000000000 then
    raise exception 'CAIXA_DADOS_INVALIDOS: Preencha tipo, categoria, data e valor maior que zero.';
  end if;
  if v_natureza not in ('normal', 'comissao_recebida', 'comissao_paga') then
    raise exception 'CAIXA_DADOS_INVALIDOS: Natureza do lançamento inválida.';
  end if;
  if v_papel is not null and not (v_papel = any(enum_range(null::public.papel_comissao)::text[])) then
    raise exception 'CAIXA_DADOS_INVALIDOS: Papel da comissão inválido.';
  end if;
  if v_baixar and v_recebimento_id is null then
    raise exception 'CAIXA_DADOS_INVALIDOS: Para baixar uma parcela, informe o recebimento.';
  end if;

  if v_recebimento_id is not null then
    if v_tipo <> 'entrada' then
      raise exception 'CAIXA_RECEBIMENTO_INVALIDO: Recebimento só pode ser vinculado a uma entrada.';
    end if;
    select * into v_recebimento from public.recebimentos
     where id = v_recebimento_id for update;
    if not found then
      raise exception 'CAIXA_RECEBIMENTO_NAO_ENCONTRADO: Recebimento não encontrado ou indisponível.';
    end if;
    if v_venda is null then v_venda := v_recebimento.venda_id; end if;
    if v_venda is distinct from v_recebimento.venda_id then
      raise exception 'CAIXA_RECEBIMENTO_INVALIDO: A parcela não pertence à venda informada.';
    end if;
    if v_valor <> round(v_recebimento.valor_total, 2) then
      raise exception 'CAIXA_RECEBIMENTO_INVALIDO: O lançamento vinculado deve ter o valor integral da parcela.';
    end if;
    if exists (select 1 from public.lancamentos_caixa l where l.recebimento_id = v_recebimento_id) then
      raise exception 'CAIXA_RECEBIMENTO_JA_LANCADO: Esta parcela já possui um lançamento de caixa.';
    end if;
    if v_recebimento.status = 'recebido' then
      raise exception 'CAIXA_RECEBIMENTO_JA_BAIXADO: Esta parcela já está recebida.';
    end if;
  end if;

  begin
    insert into public.lancamentos_caixa (
      data, tipo, categoria, descricao, valor, venda_id, recebimento_id,
      papel, origem, beneficiario_id, comissao_id, natureza, request_id
    ) values (
      v_data, v_tipo::public.tipo_caixa, v_categoria, v_descricao, v_valor,
      v_venda, v_recebimento_id, v_papel::public.papel_comissao, 'erp',
      v_beneficiario, v_comissao, v_natureza, v_request
    ) returning * into v_lancamento;
  exception when unique_violation then
    get stacked diagnostics v_constraint = constraint_name;
    if v_constraint = 'lancamentos_caixa_request_id_key' then
      select * into v_existente from public.lancamentos_caixa where request_id = v_request;
      return jsonb_build_object(
        'ok', true, 'lancamento_id', v_existente.id,
        'recebimento_baixado', coalesce((select r.status = 'recebido' from public.recebimentos r where r.id = v_existente.recebimento_id), false),
        'idempotente', true
      );
    end if;
    if v_constraint = 'lancamentos_caixa_recebimento_unique' then
      raise exception 'CAIXA_RECEBIMENTO_JA_LANCADO: Esta parcela já possui um lançamento de caixa.';
    end if;
    raise;
  end;

  if v_baixar then
    update public.recebimentos
       set status = 'recebido', data_recebimento = v_data
     where id = v_recebimento_id and status <> 'recebido';
    get diagnostics v_n = row_count;
    if v_n <> 1 then
      raise exception 'CAIXA_RECEBIMENTO_JA_BAIXADO: A baixa da parcela não pôde ser confirmada. Nada foi alterado.';
    end if;
  end if;

  insert into public.erp_auditoria (
    usuario_id, usuario_nome, acao, modulo, entidade, entidade_id, depois, detalhe
  ) values (
    v_uid,
    coalesce((select u.nome from public.usuarios u where u.id = v_uid), 'sistema/automação'),
    'criar lançamento', 'Financeiro', 'lancamentos_caixa', v_lancamento.id::text,
    jsonb_build_object(
      'lancamento_caixa', to_jsonb(v_lancamento),
      'recebimento', case when v_recebimento_id is null then null else
        (select to_jsonb(r) from public.recebimentos r where r.id = v_recebimento_id) end
    ),
    case when v_baixar
      then 'Lançamento criado e recebimento baixado em transação única.'
      else 'Lançamento criado em transação única.'
    end
  );

  return jsonb_build_object(
    'ok', true, 'lancamento_id', v_lancamento.id,
    'recebimento_baixado', v_baixar, 'idempotente', false
  );
end
$function$;

comment on function public.financeiro_caixa_criar(jsonb) is
  'Cria lançamento, baixa opcionalmente uma parcela e audita tudo numa transação; retries por request_id não duplicam. SECURITY INVOKER preserva RLS.';

revoke all on function public.financeiro_caixa_criar(jsonb) from public, anon;
grant execute on function public.financeiro_caixa_criar(jsonb) to authenticated, service_role;

notify pgrst, 'reload schema';
