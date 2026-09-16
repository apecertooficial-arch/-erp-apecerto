-- Fase 2 / Financeiro no banco: criação e exclusão de venda ATÔMICAS.
--
-- Antes: app/api/finance/route.ts fazia 6 gravações sequenciais em createSale
-- (vendas, venda_corretores, comissoes, recebimentos, pagamentos_comissao,
-- negocios) e 5 em deleteSale sem checar erro. Qualquer falha no meio deixava
-- venda pela metade. Valores vinham do navegador em float, sem arredondar e
-- sem conferir soma.
--
-- Agora: duas funções, cada uma roda numa transação única (uma chamada RPC do
-- PostgREST = uma transação). Qualquer exceção desfaz TUDO.
--
--   venda_criar(payload jsonb)  -> jsonb
--   venda_excluir(p_venda_id)   -> jsonb
--
-- SECURITY INVOKER: rodam com o papel de quem chama, então a RLS de cada tabela
-- continua valendo. A checagem explícita de can_manage_all() só antecipa, com
-- mensagem clara, o que a RLS de vendas (vendas_admin) já exige hoje — quem
-- pode não muda.
--
-- Erros de negócio saem como  'VENDA_<CODIGO>: <mensagem em português>'.
-- A rota repassa só a parte depois dos dois pontos; qualquer outro erro vira
-- mensagem genérica (sem detalhe interno).
--
-- Regras de valor:
--   * todo valor em R$ é arredondado para centavos (round(x, 2));
--   * negativo é rejeitado (não é mais convertido em 0 ou 1 em silêncio);
--   * percentual chega em % (0..100) e é gravado como fração com 6 casas;
--   * comissão bruta = round(vgv * percentual, 2), calculada AQUI;
--   * soma das comissões nunca passa da bruta (pode ficar abaixo: a ficha
--     permite completar depois, como hoje);
--   * comissão de corretor com "ratear": true é dividida no banco pelo rateio
--     de venda_corretores, e o último corretor absorve o centavo de sobra;
--   * rateio de corretores, quando informado, soma exatamente 1 (100%);
--   * papel validado contra o enum papel_comissao;
--   * soma dos repasses nunca passa da soma das comissões.
--
-- Idempotência: payload.request_id (uuid) opcional. Repetir a chamada com o
-- mesmo request_id devolve a venda já criada em vez de duplicar.

-- ---------------------------------------------------------------------------
-- Idempotência
-- ---------------------------------------------------------------------------
alter table public.vendas add column if not exists request_id uuid;
comment on column public.vendas.request_id is
  'Chave de idempotência de venda_criar: a mesma requisição repetida não duplica a venda.';
create unique index if not exists vendas_request_id_key
  on public.vendas (request_id) where request_id is not null;

-- ---------------------------------------------------------------------------
-- venda_criar
-- ---------------------------------------------------------------------------
create or replace function public.venda_criar(payload jsonb)
returns jsonb
language plpgsql
security invoker
set search_path = public, pg_temp
as $function$
declare
  v_uid uuid := auth.uid();
  v_request uuid;
  v_existente uuid;
  v_data date;
  v_vgv numeric;
  v_pct_informado numeric;
  v_pct numeric;
  v_custos numeric;
  v_status_txt text;
  v_bruta numeric;
  v_corretor bigint;
  v_negocio_id bigint;
  v_negocio record;
  v_empreendimento uuid;
  v_documentos jsonb;
  v_venda uuid;
  v_constraint text;

  v_lista jsonb;
  v_item jsonb;
  v_idx integer;
  v_n integer;

  -- corretores
  v_c_id uuid;
  v_c_nome text;
  v_c_frac numeric;
  v_c_indicador boolean;
  v_qtd_corretores integer := 0;
  v_soma_frac numeric := 0;

  -- comissões
  v_papel text;
  v_benef uuid;
  v_valor numeric;
  v_ratear boolean;
  v_parte numeric;
  v_restante numeric;
  v_rateio record;
  v_qtd_rateio integer;
  v_i integer;
  v_soma_com numeric := 0;
  v_qtd_com integer := 0;

  -- recebimentos
  v_parcela integer;
  v_data_prev date;
  v_qtd_rec integer := 0;

  -- repasses
  v_rep_status text;
  v_data_pag date;
  v_ordem integer;
  v_comissao_id uuid;
  v_soma_rep numeric := 0;
  v_qtd_rep integer := 0;

  c_papeis constant text[] := enum_range(null::public.papel_comissao)::text[];
begin
  if not coalesce(public.can_manage_all(), false) then
    raise exception 'VENDA_SEM_PERMISSAO: Você não tem permissão para lançar vendas no financeiro.'
      using errcode = '42501';
  end if;

  if payload is null or jsonb_typeof(payload) <> 'object' then
    raise exception 'VENDA_DADOS_INVALIDOS: Dados da venda ausentes.';
  end if;

  -- ---- campos simples ----------------------------------------------------
  begin
    v_request        := nullif(btrim(payload->>'request_id'), '')::uuid;
    v_data           := nullif(btrim(payload->>'data_venda'), '')::date;
    v_vgv            := round((payload->>'vgv')::numeric, 2);
    v_pct_informado  := (payload->>'percentual')::numeric;
    v_custos         := round(coalesce((payload->>'custos')::numeric, 0), 2);
    v_corretor       := nullif(btrim(payload->>'corretor_id'), '')::bigint;
    v_negocio_id     := nullif(btrim(payload->>'negocio_id'), '')::bigint;
    v_empreendimento := nullif(btrim(payload->>'empreendimento_id'), '')::uuid;
  exception
    when invalid_text_representation or invalid_datetime_format
      or datetime_field_overflow or numeric_value_out_of_range then
      raise exception 'VENDA_DADOS_INVALIDOS: Algum campo da venda está em formato inválido (data, valor ou identificador).';
  end;

  if v_request is not null then
    select v.id into v_existente from public.vendas v where v.request_id = v_request;
    if found then
      return jsonb_build_object('ok', true, 'venda_id', v_existente, 'idempotente', true);
    end if;
  end if;

  if v_data is null then
    raise exception 'VENDA_DADOS_INVALIDOS: Informe a data da venda.';
  end if;
  if v_vgv is null or v_vgv = 'NaN'::numeric or v_vgv <= 0 or v_vgv >= 100000000000 then
    raise exception 'VENDA_VALOR_INVALIDO: Informe um VGV maior que zero.';
  end if;
  if v_custos = 'NaN'::numeric or v_custos < 0 or v_custos >= 100000000000 then
    raise exception 'VENDA_VALOR_INVALIDO: Custos não podem ser negativos.';
  end if;
  if v_pct_informado is not null then
    if v_pct_informado = 'NaN'::numeric or v_pct_informado < 0 or v_pct_informado > 100 then
      raise exception 'VENDA_VALOR_INVALIDO: O percentual de comissão precisa estar entre 0 e 100.';
    end if;
    v_pct := round(v_pct_informado / 100, 6);
    v_bruta := round(v_vgv * v_pct, 2);
  end if;

  v_status_txt := coalesce(nullif(btrim(payload->>'status'), ''), 'pendente');
  if not (v_status_txt = any (enum_range(null::public.status_venda)::text[])) then
    raise exception 'VENDA_DADOS_INVALIDOS: Status da venda inválido.';
  end if;

  if v_corretor is not null and v_corretor <= 0 then v_corretor := null; end if;

  -- ---- negócio do CRM (trava a linha até o fim da transação) --------------
  if v_negocio_id is not null and v_negocio_id > 0 then
    select n.id, n.venda_id, n.corretor_id into v_negocio
      from public.negocios n where n.id = v_negocio_id for update;
    if not found then
      raise exception 'VENDA_NEGOCIO_NAO_ENCONTRADO: O negócio selecionado não existe ou não está acessível.';
    end if;
    if v_negocio.venda_id is not null then
      raise exception 'VENDA_NEGOCIO_JA_VINCULADO: Este negócio já está ligado a outra venda.';
    end if;
    v_corretor := coalesce(v_corretor, v_negocio.corretor_id);
  else
    v_negocio_id := null;
  end if;

  -- ---- documentos (mesma sanitização que a rota fazia) --------------------
  v_lista := coalesce(payload->'documentos', '[]'::jsonb);
  if jsonb_typeof(v_lista) <> 'array' then v_lista := '[]'::jsonb; end if;
  select coalesce(jsonb_agg(jsonb_build_object(
           'nome', left(btrim(coalesce(d.value->>'nome', '')), 200),
           'path', left(btrim(d.value->>'path'), 1000),
           'bucket', coalesce(nullif(left(btrim(coalesce(d.value->>'bucket', '')), 60), ''), 'esteira-docs'))), '[]'::jsonb)
    into v_documentos
    from (select value from jsonb_array_elements(v_lista)
           where jsonb_typeof(value) = 'object' and coalesce(btrim(value->>'path'), '') <> ''
           limit 30) d;

  -- ---- venda ---------------------------------------------------------------
  begin
    insert into public.vendas (
      data_venda, vgv, custos, percentual_comissao, forma_pgto, status, obs,
      empreendimento_id, empreendimento_nome, unidade_rotulo, cliente_nome,
      proprietario_nome, corretor_id, documentos, data_conclusao, request_id
    ) values (
      v_data, v_vgv, v_custos, v_pct,
      left(nullif(btrim(payload->>'forma_pgto'), ''), 100),
      v_status_txt::public.status_venda,
      left(nullif(btrim(payload->>'obs'), ''), 1000),
      v_empreendimento,
      left(nullif(btrim(payload->>'empreendimento_nome'), ''), 200),
      left(nullif(btrim(payload->>'unidade_rotulo'), ''), 120),
      left(nullif(btrim(payload->>'cliente_nome'), ''), 200),
      left(nullif(btrim(payload->>'proprietario_nome'), ''), 200),
      v_corretor,
      v_documentos,
      -- Carimbo da conclusão: mesma regra da rota (ver comentário lá).
      case when v_status_txt in ('concluido', 'pago') then v_data end,
      v_request
    ) returning id into v_venda;
  exception when unique_violation then
    get stacked diagnostics v_constraint = constraint_name;
    if v_constraint = 'vendas_request_id_key' then
      select v.id into v_existente from public.vendas v where v.request_id = v_request;
      return jsonb_build_object('ok', true, 'venda_id', v_existente, 'idempotente', true);
    end if;
    raise;
  end;

  -- ---- corretores (rateio) -------------------------------------------------
  v_lista := coalesce(payload->'corretores', '[]'::jsonb);
  if jsonb_typeof(v_lista) <> 'array' then
    raise exception 'VENDA_DADOS_INVALIDOS: Lista de corretores inválida.';
  end if;
  for v_item in select value from jsonb_array_elements(v_lista) loop
    if jsonb_typeof(v_item) <> 'object' then
      raise exception 'VENDA_DADOS_INVALIDOS: Corretor em formato inválido.';
    end if;
    begin
      v_c_id   := nullif(btrim(v_item->>'corretor_id'), '')::uuid;
      v_c_frac := round((v_item->>'fracao')::numeric, 4);
      v_c_indicador := coalesce((v_item->>'eh_indicador')::boolean, false);
    exception when invalid_text_representation or numeric_value_out_of_range then
      raise exception 'VENDA_DADOS_INVALIDOS: Corretor com identificador ou fração inválidos.';
    end;
    v_c_nome := left(nullif(btrim(v_item->>'corretor_nome'), ''), 200);
    if v_c_id is null and v_c_nome is null then
      raise exception 'VENDA_DADOS_INVALIDOS: Informe o corretor.';
    end if;
    if v_c_frac is null or v_c_frac = 'NaN'::numeric or v_c_frac < 0 or v_c_frac > 1 then
      raise exception 'VENDA_RATEIO: A fração de cada corretor precisa estar entre 0%% e 100%%.';
    end if;
    insert into public.venda_corretores (venda_id, corretor_id, corretor_nome, fracao, eh_indicador)
    values (v_venda, v_c_id, v_c_nome, v_c_frac, v_c_indicador);
    v_qtd_corretores := v_qtd_corretores + 1;
    v_soma_frac := v_soma_frac + v_c_frac;
  end loop;
  if v_qtd_corretores > 0 and v_soma_frac <> 1 then
    raise exception 'VENDA_RATEIO: O rateio dos corretores precisa somar exatamente 100%% (soma atual: %).',
      replace(to_char(v_soma_frac * 100, 'FM990.00'), '.', ',') || '%';
  end if;

  -- ---- comissões -----------------------------------------------------------
  v_lista := coalesce(payload->'comissoes', '[]'::jsonb);
  if jsonb_typeof(v_lista) <> 'array' then
    raise exception 'VENDA_DADOS_INVALIDOS: Lista de comissões inválida.';
  end if;
  for v_item in select value from jsonb_array_elements(v_lista) loop
    if jsonb_typeof(v_item) <> 'object' then
      raise exception 'VENDA_DADOS_INVALIDOS: Comissão em formato inválido.';
    end if;
    v_papel := btrim(coalesce(v_item->>'papel', ''));
    if not (v_papel = any (c_papeis)) then
      raise exception 'VENDA_PAPEL_INVALIDO: Papel de comissão inválido: "%".', left(v_papel, 40);
    end if;
    begin
      v_benef  := nullif(btrim(v_item->>'beneficiario_id'), '')::uuid;
      v_valor  := round((v_item->>'valor')::numeric, 2);
      v_ratear := coalesce((v_item->>'ratear')::boolean, false);
    exception when invalid_text_representation or numeric_value_out_of_range then
      raise exception 'VENDA_DADOS_INVALIDOS: Comissão com beneficiário ou valor inválidos.';
    end;
    if v_valor is null or v_valor = 'NaN'::numeric or v_valor < 0 or v_valor >= 100000000000 then
      raise exception 'VENDA_VALOR_INVALIDO: Comissão não pode ser negativa.';
    end if;
    continue when v_valor = 0;

    if v_ratear then
      if v_papel <> 'corretor' then
        raise exception 'VENDA_RATEIO: Só a comissão de corretor pode ser rateada.';
      end if;
      select count(*) into v_qtd_rateio from public.venda_corretores vc
       where vc.venda_id = v_venda and vc.fracao > 0;
      if v_qtd_rateio = 0 then
        raise exception 'VENDA_RATEIO: Para ratear a comissão, informe os corretores e suas frações.';
      end if;
      if exists (select 1 from public.venda_corretores vc
                  where vc.venda_id = v_venda and vc.fracao > 0 and vc.corretor_id is null) then
        raise exception 'VENDA_RATEIO: Todo corretor com fração no rateio precisa estar cadastrado.';
      end if;
      v_restante := v_valor;
      v_i := 0;
      for v_rateio in
        select vc.corretor_id, vc.fracao from public.venda_corretores vc
         where vc.venda_id = v_venda and vc.fracao > 0
         order by vc.fracao desc, vc.corretor_id
      loop
        v_i := v_i + 1;
        v_parte := case when v_i = v_qtd_rateio then v_restante
                        else round(v_valor * v_rateio.fracao / v_soma_frac, 2) end;
        v_restante := v_restante - v_parte;
        if v_parte > 0 then
          insert into public.comissoes (venda_id, papel, beneficiario_id, valor_calculado, valor_final)
          values (v_venda, 'corretor', v_rateio.corretor_id, v_parte, v_parte);
          v_qtd_com := v_qtd_com + 1;
        end if;
      end loop;
    else
      insert into public.comissoes (venda_id, papel, beneficiario_id, valor_calculado, valor_final)
      values (v_venda, v_papel::public.papel_comissao, v_benef, v_valor, v_valor);
      v_qtd_com := v_qtd_com + 1;
    end if;
    v_soma_com := v_soma_com + v_valor;
  end loop;

  if v_soma_com > 0 then
    if v_bruta is null or v_bruta = 0 then
      raise exception 'VENDA_COMISSAO_SEM_PERCENTUAL: Informe o percentual de comissão da venda antes de distribuir comissões.';
    end if;
    if v_soma_com > v_bruta then
      raise exception 'VENDA_COMISSAO_EXCEDE: As comissões somam R$ % e passam da comissão bruta de R$ % (VGV × percentual).',
        replace(to_char(v_soma_com, 'FM999999999990.00'), '.', ','), replace(to_char(v_bruta, 'FM999999999990.00'), '.', ',');
    end if;
  end if;

  -- ---- recebimentos --------------------------------------------------------
  v_lista := coalesce(payload->'recebimentos', '[]'::jsonb);
  if jsonb_typeof(v_lista) <> 'array' then
    raise exception 'VENDA_DADOS_INVALIDOS: Lista de parcelas inválida.';
  end if;
  v_idx := 0;
  for v_item in select value from jsonb_array_elements(v_lista) loop
    v_idx := v_idx + 1;
    if jsonb_typeof(v_item) <> 'object' then
      raise exception 'VENDA_DADOS_INVALIDOS: Parcela em formato inválido.';
    end if;
    begin
      v_valor     := round((v_item->>'valor')::numeric, 2);
      v_parcela   := (v_item->>'numero_parcela')::numeric::integer;
      v_data_prev := nullif(btrim(v_item->>'data_prevista'), '')::date;
    exception when invalid_text_representation or invalid_datetime_format
      or datetime_field_overflow or numeric_value_out_of_range then
      raise exception 'VENDA_DADOS_INVALIDOS: Parcela com valor, número ou data inválidos.';
    end;
    if v_valor is null or v_valor = 'NaN'::numeric or v_valor < 0 or v_valor >= 100000000000 then
      raise exception 'VENDA_VALOR_INVALIDO: Parcela não pode ter valor negativo.';
    end if;
    continue when v_valor = 0;
    insert into public.recebimentos (venda_id, numero_parcela, valor_total, data_prevista, status)
    values (v_venda, case when v_parcela > 0 then v_parcela else v_idx end, v_valor, v_data_prev, 'pendente');
    v_qtd_rec := v_qtd_rec + 1;
  end loop;

  -- ---- repasses (agenda de pagamento de comissão) --------------------------
  v_lista := coalesce(payload->'repasses', '[]'::jsonb);
  if jsonb_typeof(v_lista) <> 'array' then
    raise exception 'VENDA_DADOS_INVALIDOS: Lista de repasses inválida.';
  end if;
  v_idx := 0;
  for v_item in select value from jsonb_array_elements(v_lista) loop
    v_idx := v_idx + 1;
    if jsonb_typeof(v_item) <> 'object' then
      raise exception 'VENDA_DADOS_INVALIDOS: Repasse em formato inválido.';
    end if;
    v_papel := btrim(coalesce(v_item->>'papel', ''));
    if not (v_papel = any (c_papeis)) then
      raise exception 'VENDA_PAPEL_INVALIDO: Papel de repasse inválido: "%".', left(v_papel, 40);
    end if;
    begin
      v_benef     := nullif(btrim(v_item->>'beneficiario_id'), '')::uuid;
      v_valor     := round((v_item->>'valor')::numeric, 2);
      v_ordem     := (v_item->>'ordem')::numeric::integer;
      v_data_prev := nullif(btrim(v_item->>'data_prevista'), '')::date;
      v_data_pag  := nullif(btrim(v_item->>'data_pagamento'), '')::date;
    exception when invalid_text_representation or invalid_datetime_format
      or datetime_field_overflow or numeric_value_out_of_range then
      raise exception 'VENDA_DADOS_INVALIDOS: Repasse com beneficiário, valor ou data inválidos.';
    end;
    v_rep_status := coalesce(nullif(btrim(v_item->>'status'), ''), 'previsto');
    if v_valor is null or v_valor = 'NaN'::numeric or v_valor < 0 or v_valor >= 100000000000 then
      raise exception 'VENDA_VALOR_INVALIDO: Repasse não pode ter valor negativo.';
    end if;
    continue when v_valor = 0;
    if v_benef is null then
      raise exception 'VENDA_DADOS_INVALIDOS: Escolha quem vai receber cada repasse.';
    end if;
    if v_rep_status not in ('previsto', 'pago') then
      raise exception 'VENDA_DADOS_INVALIDOS: Status de repasse inválido.';
    end if;
    if v_rep_status = 'pago' and v_data_pag is null then
      raise exception 'VENDA_DADOS_INVALIDOS: Repasse marcado como pago precisa da data do pagamento.';
    end if;
    -- Liga à comissão quando existe exatamente uma do mesmo beneficiário e papel.
    select min(c.id::text)::uuid, count(*) into v_comissao_id, v_n
      from public.comissoes c
     where c.venda_id = v_venda and c.beneficiario_id = v_benef and c.papel::text = v_papel;
    if v_n <> 1 then v_comissao_id := null; end if;

    insert into public.pagamentos_comissao (
      venda_id, comissao_id, beneficiario_id, papel, valor, ordem,
      data_prevista, status, data_pagamento
    ) values (
      v_venda, v_comissao_id, v_benef, v_papel, v_valor,
      case when v_ordem > 0 then v_ordem else v_idx end,
      v_data_prev, v_rep_status,
      case when v_rep_status = 'pago' then v_data_pag end
    );
    v_qtd_rep := v_qtd_rep + 1;
    v_soma_rep := v_soma_rep + v_valor;
  end loop;
  if v_soma_rep > v_soma_com then
    raise exception 'VENDA_REPASSE_EXCEDE: Os repasses somam R$ % e passam das comissões lançadas (R$ %).',
      replace(to_char(v_soma_rep, 'FM999999999990.00'), '.', ','), replace(to_char(v_soma_com, 'FM999999999990.00'), '.', ',');
  end if;

  -- ---- vínculo com o CRM ---------------------------------------------------
  if v_negocio_id is not null then
    update public.negocios set venda_id = v_venda
     where id = v_negocio_id and venda_id is null;
    get diagnostics v_n = row_count;
    if v_n = 0 then
      raise exception 'VENDA_NEGOCIO_JA_VINCULADO: Não foi possível vincular a venda ao negócio do CRM.';
    end if;
  end if;

  -- ---- auditoria -----------------------------------------------------------
  insert into public.erp_auditoria (usuario_id, usuario_nome, acao, modulo, entidade, entidade_id, depois, detalhe)
  values (
    v_uid,
    coalesce((select u.nome from public.usuarios u where u.id = v_uid), 'sistema/automação'),
    'criar', 'financeiro', 'venda', v_venda::text,
    jsonb_build_object(
      'venda_id', v_venda, 'request_id', v_request, 'negocio_id', v_negocio_id,
      'vgv', v_vgv, 'percentual_comissao', v_pct, 'comissao_bruta', v_bruta,
      'comissoes', v_qtd_com, 'comissao_distribuida', v_soma_com,
      'corretores', v_qtd_corretores, 'recebimentos', v_qtd_rec,
      'repasses', v_qtd_rep, 'repasse_agendado', v_soma_rep),
    'Venda lançada em transação única (venda_criar).'
  );

  return jsonb_build_object(
    'ok', true,
    'venda_id', v_venda,
    'idempotente', false,
    'comissao_bruta', v_bruta,
    'comissao_distribuida', v_soma_com,
    'repasse_agendado', v_soma_rep
  );
end
$function$;

comment on function public.venda_criar(jsonb) is
  'Cria venda + corretores + comissões + parcelas + repasses + vínculo com negócio numa transação única, com valores validados e arredondados no banco. SECURITY INVOKER (RLS vale).';

-- ---------------------------------------------------------------------------
-- venda_excluir
-- ---------------------------------------------------------------------------
create or replace function public.venda_excluir(p_venda_id uuid)
returns jsonb
language plpgsql
security invoker
set search_path = public, pg_temp
as $function$
declare
  v_uid uuid := auth.uid();
  v_venda public.vendas;
  v_snap jsonb;
  v_corretores integer;
  v_comissoes integer;
  v_recebimentos integer;
  v_repasses integer;
  v_negocios integer;
  v_caixa integer;
  v_n integer;
begin
  if not coalesce(public.can_manage_all(), false) then
    raise exception 'VENDA_SEM_PERMISSAO: Apenas administradores podem apagar vendas.'
      using errcode = '42501';
  end if;
  if p_venda_id is null then
    raise exception 'VENDA_DADOS_INVALIDOS: Venda inválida.';
  end if;

  select * into v_venda from public.vendas where id = p_venda_id for update;
  if not found then
    raise exception 'VENDA_NAO_ENCONTRADA: Venda não encontrada ou já apagada.';
  end if;

  -- Retrato completo ANTES de apagar, para a auditoria.
  v_snap := jsonb_build_object(
    'venda', to_jsonb(v_venda),
    'corretores',   (select coalesce(jsonb_agg(to_jsonb(x)), '[]'::jsonb) from public.venda_corretores x where x.venda_id = p_venda_id),
    'comissoes',    (select coalesce(jsonb_agg(to_jsonb(x)), '[]'::jsonb) from public.comissoes x where x.venda_id = p_venda_id),
    'recebimentos', (select coalesce(jsonb_agg(to_jsonb(x)), '[]'::jsonb) from public.recebimentos x where x.venda_id = p_venda_id),
    'repasses',     (select coalesce(jsonb_agg(to_jsonb(x)), '[]'::jsonb) from public.pagamentos_comissao x where x.venda_id = p_venda_id),
    'negocios',     (select coalesce(jsonb_agg(x.id), '[]'::jsonb) from public.negocios x where x.venda_id = p_venda_id),
    'processos',    (select coalesce(jsonb_agg(x.id), '[]'::jsonb) from public.venda_processos x where x.venda_id = p_venda_id),
    'lancamentos_caixa_desvinculados',
                    (select coalesce(jsonb_agg(x.id), '[]'::jsonb) from public.lancamentos_caixa x where x.venda_id = p_venda_id)
  );

  -- Lançamentos de caixa NÃO são apagados: representam dinheiro que entrou ou
  -- saiu de verdade. Perdem só o vínculo com a venda (mesmo comportamento de
  -- antes). Os ids ficam na auditoria para reconciliação.
  update public.lancamentos_caixa set venda_id = null where venda_id = p_venda_id;
  get diagnostics v_caixa = row_count;

  delete from public.pagamentos_comissao where venda_id = p_venda_id;
  get diagnostics v_repasses = row_count;
  delete from public.comissoes where venda_id = p_venda_id;
  get diagnostics v_comissoes = row_count;
  delete from public.recebimentos where venda_id = p_venda_id;
  get diagnostics v_recebimentos = row_count;
  delete from public.venda_corretores where venda_id = p_venda_id;
  get diagnostics v_corretores = row_count;

  update public.negocios set venda_id = null where venda_id = p_venda_id;
  get diagnostics v_negocios = row_count;

  -- venda_processos sai por ON DELETE CASCADE, como antes.
  delete from public.vendas where id = p_venda_id;
  get diagnostics v_n = row_count;
  if v_n = 0 then
    raise exception 'VENDA_SEM_PERMISSAO: Você não tem permissão para apagar esta venda.'
      using errcode = '42501';
  end if;

  insert into public.erp_auditoria (usuario_id, usuario_nome, acao, modulo, entidade, entidade_id, antes, detalhe)
  values (
    v_uid,
    coalesce((select u.nome from public.usuarios u where u.id = v_uid), 'sistema/automação'),
    'excluir', 'financeiro', 'venda', p_venda_id::text,
    v_snap,
    format('Venda apagada em transação única (venda_excluir): %s comissões, %s parcelas, %s repasses, %s corretores, %s negócios desvinculados, %s lançamentos de caixa desvinculados.',
           v_comissoes, v_recebimentos, v_repasses, v_corretores, v_negocios, v_caixa)
  );

  return jsonb_build_object(
    'ok', true,
    'venda_id', p_venda_id,
    'comissoes', v_comissoes,
    'recebimentos', v_recebimentos,
    'repasses', v_repasses,
    'corretores', v_corretores,
    'negocios_desvinculados', v_negocios,
    'lancamentos_caixa_desvinculados', v_caixa
  );
end
$function$;

comment on function public.venda_excluir(uuid) is
  'Apaga a venda e tudo que venda_criar gera (corretores, comissões, parcelas, repasses, vínculo com negócio) numa transação única, com retrato completo em erp_auditoria. SECURITY INVOKER (RLS vale).';

revoke all on function public.venda_criar(jsonb) from public, anon;
revoke all on function public.venda_excluir(uuid) from public, anon;
grant execute on function public.venda_criar(jsonb) to authenticated, service_role;
grant execute on function public.venda_excluir(uuid) to authenticated, service_role;

notify pgrst, 'reload schema';
