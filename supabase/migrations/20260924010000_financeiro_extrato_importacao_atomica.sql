-- Financeiro / importação bancária: cabeçalho, linhas e auditoria são uma
-- transação. O fingerprint do conteúdo deduplica retries e reenvios completos;
-- sobreposição parcial nunca cria uma importação ambígua.

alter table public.extrato_importacao add column if not exists fingerprint text;
create unique index if not exists extrato_importacao_fingerprint_uidx
  on public.extrato_importacao(fingerprint) where fingerprint is not null;

create or replace function public.financeiro_extrato_importar(payload jsonb, linhas jsonb)
returns jsonb
language plpgsql
security invoker
set search_path=public,pg_temp
as $function$
declare
  v_uid uuid:=auth.uid();
  v_fingerprint text;
  v_existente public.extrato_importacao;
  v_importacao public.extrato_importacao;
  v_item jsonb;
  v_impressao text;
  v_data date;
  v_descricao text;
  v_valor numeric;
  v_saldo numeric;
  v_sugestao text;
  v_sugestao_lancamento_id uuid;
  v_categoria text;
  v_total integer;
  v_distintas integer;
  v_sobrepostas integer;
  v_importacoes_sobrepostas integer;
  v_importacao_sobreposta uuid;
  v_linhas_existentes integer;
begin
  if v_uid is null or not coalesce(public.can_manage_all(),false) then
    raise exception 'EXTRATO_IMPORTACAO_SEM_PERMISSAO: Você não tem permissão para importar extratos.' using errcode='42501';
  end if;
  if payload is null or jsonb_typeof(payload)<>'object'
     or linhas is null or jsonb_typeof(linhas)<>'array' then
    raise exception 'EXTRATO_IMPORTACAO_DADOS_INVALIDOS: Cabeçalho ou linhas inválidos.';
  end if;
  v_total:=jsonb_array_length(linhas);
  if v_total<1 or v_total>2000 then
    raise exception 'EXTRATO_IMPORTACAO_DADOS_INVALIDOS: O arquivo precisa ter entre 1 e 2.000 lançamentos.';
  end if;
  v_fingerprint:=lower(btrim(payload->>'fingerprint'));
  if v_fingerprint is null or v_fingerprint!~'^[0-9a-f]{64}$' then
    raise exception 'EXTRATO_IMPORTACAO_DADOS_INVALIDOS: Identificador de conteúdo inválido.';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(v_fingerprint,0));

  select * into v_existente from public.extrato_importacao
    where fingerprint=v_fingerprint for update;
  if found then
    select count(*) into v_linhas_existentes from public.extrato_linha
      where importacao_id=v_existente.id;
    if v_linhas_existentes<>v_total then
      raise exception 'EXTRATO_IMPORTACAO_CONFLITANTE: A importação existente diverge do conteúdo reenviado. Solicite conferência financeira.';
    end if;
    return jsonb_build_object('ok',true,'importacao_id',v_existente.id,
      'linhas',v_linhas_existentes,'idempotente',true);
  end if;

  select count(distinct btrim(item->>'impressao')) into v_distintas
    from jsonb_array_elements(linhas) as t(item);
  if v_distintas<>v_total then
    raise exception 'EXTRATO_IMPORTACAO_DADOS_INVALIDOS: O arquivo contém linhas bancárias repetidas.';
  end if;
  for v_impressao in
    select btrim(item->>'impressao') from jsonb_array_elements(linhas) as t(item)
    order by 1
  loop
    if v_impressao is null or v_impressao='' or length(v_impressao)>500 then
      raise exception 'EXTRATO_IMPORTACAO_DADOS_INVALIDOS: Uma linha não possui impressão bancária válida.';
    end if;
    perform pg_advisory_xact_lock(hashtextextended(v_impressao,0));
  end loop;

  select count(*),count(distinct e.importacao_id),min(e.importacao_id::text)::uuid
    into v_sobrepostas,v_importacoes_sobrepostas,v_importacao_sobreposta
    from public.extrato_linha e
    where e.impressao in (
      select btrim(item->>'impressao') from jsonb_array_elements(linhas) as t(item)
    );
  if v_sobrepostas>0 then
    if v_sobrepostas=v_total and v_importacoes_sobrepostas=1 then
      return jsonb_build_object('ok',true,'importacao_id',v_importacao_sobreposta,
        'linhas',v_total,'idempotente',true);
    end if;
    raise exception 'EXTRATO_IMPORTACAO_CONFLITANTE: Parte deste arquivo já foi importada. Nada foi alterado; solicite conferência financeira.';
  end if;

  -- Valida todas as linhas antes de criar o cabeçalho.
  for v_item in select value from jsonb_array_elements(linhas)
  loop
    begin
      v_data:=nullif(btrim(v_item->>'data'),'')::date;
      v_valor:=round((v_item->>'valor')::numeric,2);
      v_saldo:=nullif(btrim(v_item->>'saldo'),'')::numeric;
      v_sugestao_lancamento_id:=nullif(btrim(v_item->>'sugestao_lancamento_id'),'')::uuid;
    exception when invalid_text_representation or invalid_datetime_format
      or datetime_field_overflow or numeric_value_out_of_range then
      raise exception 'EXTRATO_IMPORTACAO_DADOS_INVALIDOS: Data, valor, saldo ou vínculo inválido em uma linha.';
    end;
    v_descricao:=coalesce(left(btrim(v_item->>'descricao'),400),'');
    v_sugestao:=btrim(v_item->>'sugestao');
    if v_data is null or v_valor is null or v_valor='NaN'::numeric or v_valor=0
       or v_sugestao not in ('novo','vincular','transferencia') then
      raise exception 'EXTRATO_IMPORTACAO_DADOS_INVALIDOS: Toda linha exige data, valor não zero e sugestão válida.';
    end if;
    if v_sugestao='vincular' and v_sugestao_lancamento_id is null then
      raise exception 'EXTRATO_IMPORTACAO_DADOS_INVALIDOS: Sugestão de vínculo exige um lançamento de caixa.';
    end if;
    if v_sugestao_lancamento_id is not null then
      perform 1 from public.lancamentos_caixa where id=v_sugestao_lancamento_id for update;
      if not found then
        raise exception 'EXTRATO_IMPORTACAO_DADOS_INVALIDOS: O lançamento sugerido não existe mais.';
      end if;
    end if;
  end loop;

  begin
    insert into public.extrato_importacao(
      banco,agencia,conta,titular,periodo_inicio,periodo_fim,saldo_abertura,
      saldo_fechamento,arquivo_nome,linhas_total,criado_por,fingerprint
    ) values (
      nullif(left(btrim(payload->>'banco'),20),''),
      nullif(left(btrim(payload->>'agencia'),20),''),
      nullif(left(btrim(payload->>'conta'),40),''),
      nullif(left(btrim(payload->>'titular'),200),''),
      nullif(btrim(payload->>'periodo_inicio'),'')::date,
      nullif(btrim(payload->>'periodo_fim'),'')::date,
      nullif(btrim(payload->>'saldo_abertura'),'')::numeric,
      nullif(btrim(payload->>'saldo_fechamento'),'')::numeric,
      nullif(left(btrim(payload->>'arquivo_nome'),200),''),
      v_total,v_uid,v_fingerprint
    ) returning * into v_importacao;
  exception when invalid_text_representation or invalid_datetime_format
    or datetime_field_overflow or numeric_value_out_of_range then
    raise exception 'EXTRATO_IMPORTACAO_DADOS_INVALIDOS: Período ou saldos do cabeçalho inválidos.';
  end;

  for v_item in select value from jsonb_array_elements(linhas)
  loop
    v_categoria:=nullif(left(btrim(v_item->>'categoria_sugerida'),80),'');
    insert into public.extrato_linha(
      importacao_id,data,descricao,valor,saldo,impressao,situacao,sugestao,
      sugestao_lancamento_id,categoria_sugerida
    ) values (
      v_importacao.id,(v_item->>'data')::date,coalesce(left(btrim(v_item->>'descricao'),400),''),
      round((v_item->>'valor')::numeric,2),nullif(btrim(v_item->>'saldo'),'')::numeric,
      btrim(v_item->>'impressao'),'pendente',btrim(v_item->>'sugestao'),
      nullif(btrim(v_item->>'sugestao_lancamento_id'),'')::uuid,v_categoria
    );
  end loop;

  insert into public.erp_auditoria(
    usuario_id,usuario_nome,acao,modulo,entidade,entidade_id,antes,depois,detalhe
  ) values (
    v_uid,coalesce((select u.nome from public.usuarios u where u.id=v_uid),'sistema/automação'),
    'importar extrato','Financeiro','extrato_importacao',v_importacao.id::text,null,
    jsonb_build_object('importacao',to_jsonb(v_importacao),'linhas',v_total),
    'Cabeçalho e linhas do extrato importados em transação auditada e idempotente.'
  );
  return jsonb_build_object('ok',true,'importacao_id',v_importacao.id,
    'linhas',v_total,'idempotente',false);
end
$function$;

comment on function public.financeiro_extrato_importar(jsonb,jsonb) is
  'Importa cabeçalho e linhas do extrato com fingerprint, auditoria e rollback integral. SECURITY INVOKER.';
revoke all on function public.financeiro_extrato_importar(jsonb,jsonb) from public,anon;
grant execute on function public.financeiro_extrato_importar(jsonb,jsonb) to authenticated,service_role;
notify pgrst,'reload schema';
