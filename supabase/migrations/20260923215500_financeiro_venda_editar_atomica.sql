-- Financeiro / edição de venda: uma chamada, validação dos dependentes e auditoria.
-- Não baixa parcelas em lote nem reconcilia o legado: cada recebimento continua
-- exigindo sua decisão explícita, com caixa, pela RPC própria.

create or replace function public.venda_editar(p_venda_id uuid,payload jsonb)
returns jsonb
language plpgsql
security invoker
set search_path = public, pg_temp
as $function$
declare
  v_antes public.vendas;
  v_depois public.vendas;
  v_data date;
  v_vgv numeric;
  v_pct_informado numeric;
  v_pct numeric;
  v_custos numeric;
  v_status text;
  v_forma text;
  v_obs text;
  v_empreendimento uuid;
  v_empreendimento_nome text;
  v_unidade text;
  v_cliente text;
  v_proprietario text;
  v_documentos jsonb;
  v_conclusao date;
  v_bruta numeric;
  v_soma_comissoes numeric;
  v_soma_recebimentos numeric;
  v_financeiro_mudou boolean;
begin
  if not coalesce(public.can_manage_all(),false) then
    raise exception 'VENDA_SEM_PERMISSAO: Você não tem permissão para editar vendas no financeiro.' using errcode='42501';
  end if;
  if p_venda_id is null or payload is null or jsonb_typeof(payload)<>'object' then
    raise exception 'VENDA_DADOS_INVALIDOS: Venda ou dados de edição inválidos.';
  end if;
  begin
    v_data:=nullif(btrim(payload->>'data_venda'),'')::date;
    v_vgv:=round((payload->>'vgv')::numeric,2);
    v_pct_informado:=(payload->>'percentual')::numeric;
    v_custos:=round((payload->>'custos')::numeric,2);
    v_empreendimento:=nullif(btrim(payload->>'empreendimento_id'),'')::uuid;
  exception when invalid_text_representation or invalid_datetime_format
    or datetime_field_overflow or numeric_value_out_of_range then
    raise exception 'VENDA_DADOS_INVALIDOS: Data, valor, percentual ou empreendimento inválido.';
  end;
  if v_data is null then raise exception 'VENDA_DADOS_INVALIDOS: Informe a data da venda.'; end if;
  if v_vgv is null or v_vgv='NaN'::numeric or v_vgv<=0 or v_vgv>=100000000000 then
    raise exception 'VENDA_VALOR_INVALIDO: Informe um VGV maior que zero.';
  end if;
  if v_pct_informado is null or v_pct_informado='NaN'::numeric or v_pct_informado<0 or v_pct_informado>100 then
    raise exception 'VENDA_VALOR_INVALIDO: O percentual de comissão precisa estar entre 0 e 100.';
  end if;
  if v_custos is null or v_custos='NaN'::numeric or v_custos<0 or v_custos>=100000000000 then
    raise exception 'VENDA_VALOR_INVALIDO: Custos não podem ser negativos.';
  end if;
  v_pct:=round(v_pct_informado/100,6);
  v_bruta:=round(v_vgv*v_pct,2);
  v_status:=btrim(coalesce(payload->>'status',''));
  if not (v_status=any(enum_range(null::public.status_venda)::text[])) then
    raise exception 'VENDA_DADOS_INVALIDOS: Status da venda inválido.';
  end if;
  v_forma:=left(nullif(btrim(payload->>'forma_pgto'),''),100);
  v_obs:=left(nullif(btrim(payload->>'obs'),''),1000);
  v_empreendimento_nome:=left(nullif(btrim(payload->>'empreendimento_nome'),''),200);
  v_unidade:=left(nullif(btrim(payload->>'unidade_rotulo'),''),120);
  v_cliente:=left(nullif(btrim(payload->>'cliente_nome'),''),200);
  v_proprietario:=left(nullif(btrim(payload->>'proprietario_nome'),''),200);

  select * into v_antes from public.vendas where id=p_venda_id for update;
  if not found then raise exception 'VENDA_NAO_ENCONTRADA: Venda não encontrada ou indisponível.'; end if;

  -- Serializa os registros financeiros antes de validar os totais e o status.
  perform 1 from public.comissoes where venda_id=p_venda_id order by id for update;
  perform 1 from public.recebimentos where venda_id=p_venda_id order by id for update;
  perform 1 from public.pagamentos_comissao where venda_id=p_venda_id order by id for update;
  perform 1 from public.lancamentos_caixa where venda_id=p_venda_id order by id for update;

  select coalesce(sum(c.valor_final),0) into v_soma_comissoes
    from public.comissoes c where c.venda_id=p_venda_id;
  select coalesce(sum(r.valor_total),0) into v_soma_recebimentos
    from public.recebimentos r where r.venda_id=p_venda_id;
  v_financeiro_mudou:=v_antes.vgv<>v_vgv or v_antes.percentual_comissao is distinct from v_pct;
  if v_financeiro_mudou and (v_soma_comissoes>v_bruta or v_soma_recebimentos>v_bruta) then
    raise exception 'VENDA_VALOR_DEPENDENTE: O novo VGV/percentual gera comissão bruta de R$ %, abaixo das comissões (R$ %) ou parcelas (R$ %) já lançadas. Ajuste os dependentes primeiro.',
      replace(to_char(v_bruta,'FM999999999990.00'),'.',','),
      replace(to_char(v_soma_comissoes,'FM999999999990.00'),'.',','),
      replace(to_char(v_soma_recebimentos,'FM999999999990.00'),'.',',');
  end if;

  if v_status in ('pendente','distrato') and v_antes.status::text<>v_status
     and (exists(select 1 from public.recebimentos r where r.venda_id=p_venda_id and r.status='recebido')
       or exists(select 1 from public.pagamentos_comissao p where p.venda_id=p_venda_id and p.status='pago')) then
    raise exception 'VENDA_MOVIMENTOS_ATIVOS: Reabra os recebimentos e repasses pagos antes de voltar a venda para pendente ou distrato.';
  end if;

  if v_status='pago' and v_antes.status::text<>'pago'
     and exists(select 1 from public.recebimentos r where r.venda_id=p_venda_id)
     and exists(
       select 1 from public.recebimentos r
       left join public.lancamentos_caixa l on l.recebimento_id=r.id
       where r.venda_id=p_venda_id and (
         r.status<>'recebido' or r.data_recebimento is null or l.id is null
         or l.tipo<>'entrada' or l.venda_id is distinct from p_venda_id
         or l.valor<>round(r.valor_total,2) or l.data is distinct from r.data_recebimento
       )
     ) then
    raise exception 'VENDA_RECEBIMENTOS_PENDENTES: Baixe e reconcilie cada parcela antes de marcar a venda como paga pela construtora.';
  end if;

  if payload ? 'documentos' then
    if jsonb_typeof(payload->'documentos')<>'array' then
      raise exception 'VENDA_DADOS_INVALIDOS: Lista de documentos inválida.';
    end if;
    select coalesce(jsonb_agg(jsonb_build_object(
      'nome',left(btrim(coalesce(d.value->>'nome','')),200),
      'path',left(btrim(d.value->>'path'),1000),
      'bucket',coalesce(nullif(left(btrim(coalesce(d.value->>'bucket','')),60),''),'esteira-docs'))),'[]'::jsonb)
      into v_documentos from (
        select value from jsonb_array_elements(payload->'documentos')
        where jsonb_typeof(value)='object' and coalesce(btrim(value->>'path'),'')<>'' limit 30
      ) d;
  else
    v_documentos:=v_antes.documentos;
  end if;

  v_conclusao:=case when v_status in ('concluido','pago')
    then coalesce(v_antes.data_conclusao,v_data) else null end;
  if v_antes.data_venda=v_data and v_antes.vgv=v_vgv
     and v_antes.percentual_comissao is not distinct from v_pct
     and v_antes.custos=v_custos and v_antes.status::text=v_status
     and v_antes.forma_pgto is not distinct from v_forma
     and v_antes.obs is not distinct from v_obs
     and v_antes.empreendimento_id is not distinct from v_empreendimento
     and v_antes.empreendimento_nome is not distinct from v_empreendimento_nome
     and v_antes.unidade_rotulo is not distinct from v_unidade
     and v_antes.cliente_nome is not distinct from v_cliente
     and v_antes.proprietario_nome is not distinct from v_proprietario
     and v_antes.documentos=v_documentos
     and v_antes.data_conclusao is not distinct from v_conclusao then
    return jsonb_build_object('ok',true,'venda_id',p_venda_id,'data_conclusao',v_conclusao,'idempotente',true);
  end if;

  update public.vendas set
    data_venda=v_data,vgv=v_vgv,percentual_comissao=v_pct,custos=v_custos,
    forma_pgto=v_forma,status=v_status::public.status_venda,obs=v_obs,
    empreendimento_id=v_empreendimento,empreendimento_nome=v_empreendimento_nome,
    unidade_rotulo=v_unidade,cliente_nome=v_cliente,proprietario_nome=v_proprietario,
    documentos=v_documentos,data_conclusao=v_conclusao
  where id=p_venda_id returning * into v_depois;

  return jsonb_build_object(
    'ok',true,'venda_id',p_venda_id,'data_conclusao',v_depois.data_conclusao,
    'idempotente',false
  );
end
$function$;

comment on function public.venda_editar(uuid,jsonb) is
  'Edita dados/status da venda numa transação, preserva auditoria por trigger e bloqueia estados incompatíveis com valores, recebimentos ou repasses. Sem backfill.';
revoke all on function public.venda_editar(uuid,jsonb) from public,anon;
grant execute on function public.venda_editar(uuid,jsonb) to authenticated,service_role;
notify pgrst,'reload schema';
