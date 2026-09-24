-- Esteira / conexão da venda: venda, negócio, processo e auditoria são uma
-- transação. O legado sem negócio não é inferido nem alterado.

create unique index if not exists venda_processos_negocio_id_uidx
  on public.venda_processos(negocio_id) where negocio_id is not null;

create or replace function public.esteira_venda_criar(payload jsonb)
returns jsonb
language plpgsql
security invoker
set search_path=public,pg_temp
as $function$
declare
  v_uid uuid:=auth.uid();
  v_request_id uuid;
  v_negocio_id bigint;
  v_produto_id uuid;
  v_vgv numeric;
  v_forma text;
  v_obs text;
  v_negocio_antes public.negocios;
  v_negocio_depois public.negocios;
  v_produto public.empreendimentos;
  v_venda public.vendas;
  v_processo public.venda_processos;
  v_tipo text;
begin
  if v_uid is null or not coalesce(public.can_manage_all(),false) then
    raise exception 'VENDA_CRM_SEM_PERMISSAO: Você não tem permissão para conectar vendas ao CRM.' using errcode='42501';
  end if;
  if payload is null or jsonb_typeof(payload)<>'object' then
    raise exception 'VENDA_CRM_DADOS_INVALIDOS: Dados da venda inválidos.';
  end if;
  begin
    v_request_id:=nullif(btrim(payload->>'request_id'),'')::uuid;
    v_negocio_id:=nullif(btrim(payload->>'negocio_id'),'')::bigint;
    v_produto_id:=nullif(btrim(payload->>'produto_id'),'')::uuid;
    v_vgv:=round(coalesce(nullif(btrim(payload->>'vgv'),''),'0')::numeric,2);
  exception when invalid_text_representation or numeric_value_out_of_range then
    raise exception 'VENDA_CRM_DADOS_INVALIDOS: Identificador, negócio, produto ou valor inválido.';
  end;
  if v_request_id is null or v_negocio_id is null or v_produto_id is null
     or v_vgv is null or v_vgv='NaN'::numeric or v_vgv<0 or v_vgv>=1000000000000 then
    raise exception 'VENDA_CRM_DADOS_INVALIDOS: Informe solicitação, negócio, produto e valor válidos.';
  end if;
  v_forma:=nullif(left(btrim(payload->>'forma_pgto'),120),'');
  v_obs:=nullif(left(btrim(payload->>'obs'),1000),'');

  perform pg_advisory_xact_lock(hashtextextended(v_request_id::text,0));
  select * into v_venda from public.vendas v where v.request_id=v_request_id for update;
  if found then
    select * into v_processo from public.venda_processos p where p.venda_id=v_venda.id;
    if v_venda.empreendimento_id=v_produto_id and v_processo.id is not null
       and v_processo.negocio_id=v_negocio_id then
      return jsonb_build_object('ok',true,'venda_id',v_venda.id,
        'processo_id',v_processo.id,'aprovacao',v_processo.aprovacao_status,
        'idempotente',true);
    end if;
    raise exception 'VENDA_CRM_REQUEST_CONFLITANTE: Esta solicitação já foi usada por outra venda. Atualize a tela antes de tentar novamente.';
  end if;

  select * into v_negocio_antes from public.negocios n where n.id=v_negocio_id for update;
  if not found then
    raise exception 'VENDA_CRM_NAO_ENCONTRADA: Negócio não encontrado ou indisponível.';
  end if;
  if v_negocio_antes.venda_id is not null then
    raise exception 'VENDA_CRM_NEGOCIO_VINCULADO: Este negócio já está conectado a uma venda. Atualize a tela.';
  end if;
  select * into v_produto from public.empreendimentos e where e.id=v_produto_id;
  if not found then
    raise exception 'VENDA_CRM_NAO_ENCONTRADA: Produto não encontrado ou indisponível.';
  end if;
  v_tipo:=case when v_produto.origem='terceiros' then 'revenda' else 'construtora' end;

  insert into public.vendas(
    data_venda,empreendimento_id,empreendimento_nome,vgv,forma_pgto,status,obs,request_id
  ) values (
    public.hoje_operacao(),v_produto.id,v_produto.nome,v_vgv,v_forma,'pendente',v_obs,v_request_id
  ) returning * into v_venda;

  update public.negocios
    set venda_id=v_venda.id,status='ganho',ultima_movimentacao=now()
    where id=v_negocio_id returning * into v_negocio_depois;
  if v_negocio_depois.id is null then
    raise exception 'VENDA_CRM_NAO_ENCONTRADA: O negócio deixou de estar disponível. Nada foi alterado.';
  end if;

  insert into public.venda_processos(
    venda_id,negocio_id,etapa,tipo_venda,criado_por,solicitado_por,
    aprovacao_status,aprovado_por,aprovado_em
  ) values (
    v_venda.id,v_negocio_id,'inicio',v_tipo,v_uid,v_uid,'aprovada',v_uid,now()
  ) returning * into v_processo;

  insert into public.erp_auditoria(
    usuario_id,usuario_nome,acao,modulo,entidade,entidade_id,antes,depois,detalhe
  ) values (
    v_uid,coalesce((select u.nome from public.usuarios u where u.id=v_uid),'sistema/automação'),
    'conectar venda ao CRM','Esteira','venda_processos',v_processo.id::text,
    jsonb_build_object('negocio',to_jsonb(v_negocio_antes)),
    jsonb_build_object('venda',to_jsonb(v_venda),'negocio',to_jsonb(v_negocio_depois),'processo',to_jsonb(v_processo)),
    'Venda, negócio e processo conectados em transação auditada e idempotente.'
  );
  return jsonb_build_object('ok',true,'venda_id',v_venda.id,
    'processo_id',v_processo.id,'aprovacao',v_processo.aprovacao_status,
    'idempotente',false);
exception when unique_violation then
  raise exception 'VENDA_CRM_NEGOCIO_VINCULADO: A solicitação, o negócio ou a venda já foi conectada. Atualize a tela.';
end
$function$;

comment on function public.esteira_venda_criar(jsonb) is
  'Conecta venda, negócio e processo com auditoria e retry idempotente. SECURITY INVOKER.';
revoke all on function public.esteira_venda_criar(jsonb) from public,anon;
grant execute on function public.esteira_venda_criar(jsonb) to authenticated,service_role;
notify pgrst,'reload schema';
