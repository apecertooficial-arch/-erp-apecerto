-- Esteira: cabeçalho, parcelas e auditoria da comissão são uma única mutação.

create unique index if not exists venda_comissao_parcelas_processo_ordem_uidx
  on public.venda_comissao_parcelas(processo_ref,ordem);

create unique index if not exists erp_auditoria_esteira_comissao_request_uidx
  on public.erp_auditoria ((depois->>'request_id'))
  where modulo='Esteira' and entidade='venda_comissao'
    and acao='salvar comissão' and depois ? 'request_id';

create or replace function public.esteira_comissao_salvar(
  p_processo_id uuid,
  p_comissao jsonb,
  p_parcelas jsonb,
  p_request_id uuid
)
returns jsonb
language plpgsql
security invoker
set search_path=public,pg_temp
as $function$
declare
  v_uid uuid:=auth.uid();
  v_auditoria public.erp_auditoria;
  v_solicitacao jsonb;
  v_antes jsonb;
  v_depois jsonb;
  v_percentual numeric;
  v_total numeric;
  v_participantes jsonb;
  v_item jsonb;
  v_ordem bigint;
  v_valor numeric;
  v_prevista date;
  v_efetiva date;
  v_status text;
  v_parcelas_count integer;
begin
  if v_uid is null or not coalesce(public.can_manage_all(),false) then
    raise exception 'ESTEIRA_COMISSAO_SEM_PERMISSAO: Você não tem permissão para alterar comissões.' using errcode='42501';
  end if;
  if p_processo_id is null or p_request_id is null or p_comissao is null
     or jsonb_typeof(p_comissao)<>'object'
     or (p_parcelas is not null and jsonb_typeof(p_parcelas)<>'array') then
    raise exception 'ESTEIRA_COMISSAO_DADOS_INVALIDOS: Venda, comissão, parcelas ou solicitação inválida.';
  end if;
  v_participantes:=coalesce(p_comissao->'participantes','[]'::jsonb);
  if jsonb_typeof(v_participantes)<>'array' or jsonb_array_length(v_participantes)>50
     or (p_parcelas is not null and jsonb_array_length(p_parcelas)>60) then
    raise exception 'ESTEIRA_COMISSAO_DADOS_INVALIDOS: Participantes ou parcelas excedem o limite permitido.';
  end if;
  if exists(select 1 from jsonb_array_elements(v_participantes) e where jsonb_typeof(e.value)<>'object')
     or (p_parcelas is not null and exists(select 1 from jsonb_array_elements(p_parcelas) e where jsonb_typeof(e.value)<>'object')) then
    raise exception 'ESTEIRA_COMISSAO_DADOS_INVALIDOS: Participantes e parcelas devem ser registros válidos.';
  end if;
  begin
    v_percentual:=nullif(btrim(p_comissao->>'percentual_total'),'')::numeric;
    v_total:=nullif(btrim(p_comissao->>'valor_total'),'')::numeric;
  exception when invalid_text_representation or numeric_value_out_of_range then
    raise exception 'ESTEIRA_COMISSAO_DADOS_INVALIDOS: Percentual ou valor total inválido.';
  end;
  if v_percentual='NaN'::numeric or v_total='NaN'::numeric
     or v_percentual<0 or v_percentual>100 or v_total<0 or v_total>=100000000000 then
    raise exception 'ESTEIRA_COMISSAO_DADOS_INVALIDOS: Percentual ou valor total fora do intervalo permitido.';
  end if;

  v_solicitacao:=jsonb_build_object(
    'processo_id',p_processo_id,
    'comissao',jsonb_build_object(
      'percentual_total',v_percentual,'valor_total',v_total,
      'imobiliaria',nullif(left(btrim(p_comissao->>'imobiliaria'),160),''),
      'forma_pgto',nullif(left(btrim(p_comissao->>'forma_pgto'),80),''),
      'participantes',v_participantes
    ),
    'parcelas',p_parcelas
  );
  perform pg_advisory_xact_lock(hashtextextended(p_request_id::text,0));
  select * into v_auditoria from public.erp_auditoria a
    where a.modulo='Esteira' and a.entidade='venda_comissao'
      and a.acao='salvar comissão' and a.depois->>'request_id'=p_request_id::text
    order by a.criado_em desc,a.id desc limit 1;
  if found then
    if v_auditoria.depois->'solicitacao'=v_solicitacao then
      return jsonb_build_object('ok',true,'processo_id',p_processo_id,
        'parcelas',coalesce(jsonb_array_length(v_auditoria.depois->'estado'->'parcelas'),0),'idempotente',true);
    end if;
    raise exception 'ESTEIRA_COMISSAO_REQUEST_CONFLITANTE: Esta solicitação já foi usada com outros dados. Atualize a tela.';
  end if;

  perform 1 from public.venda_processos p where p.id=p_processo_id for update;
  if not found then raise exception 'ESTEIRA_COMISSAO_NAO_ENCONTRADA: Venda não encontrada ou indisponível.'; end if;
  perform 1 from public.venda_comissao c where c.processo_ref=p_processo_id for update;
  perform 1 from public.venda_comissao_parcelas p where p.processo_ref=p_processo_id order by p.id for update;
  v_antes:=jsonb_build_object(
    'comissao',(select to_jsonb(c) from public.venda_comissao c where c.processo_ref=p_processo_id),
    'parcelas',coalesce((select jsonb_agg(to_jsonb(p) order by p.ordem,p.id) from public.venda_comissao_parcelas p where p.processo_ref=p_processo_id),'[]'::jsonb)
  );

  insert into public.venda_comissao(
    processo_ref,percentual_total,valor_total,imobiliaria,forma_pgto,participantes,atualizado_por,atualizado_em
  ) values (
    p_processo_id,v_percentual,v_total,
    v_solicitacao->'comissao'->>'imobiliaria',v_solicitacao->'comissao'->>'forma_pgto',
    v_participantes,v_uid,now()
  ) on conflict(processo_ref) do update set
    percentual_total=excluded.percentual_total,valor_total=excluded.valor_total,
    imobiliaria=excluded.imobiliaria,forma_pgto=excluded.forma_pgto,
    participantes=excluded.participantes,atualizado_por=excluded.atualizado_por,atualizado_em=excluded.atualizado_em;

  if p_parcelas is not null then
    delete from public.venda_comissao_parcelas where processo_ref=p_processo_id;
    for v_item,v_ordem in select value,ordinality from jsonb_array_elements(p_parcelas) with ordinality loop
      begin
        v_valor:=nullif(btrim(v_item->>'valor'),'')::numeric;
        v_prevista:=nullif(btrim(v_item->>'data_prevista'),'')::date;
        v_efetiva:=nullif(btrim(v_item->>'data_efetiva'),'')::date;
      exception when invalid_text_representation or numeric_value_out_of_range or datetime_field_overflow then
        raise exception 'ESTEIRA_COMISSAO_DADOS_INVALIDOS: Valor ou data inválida na parcela %.',v_ordem;
      end;
      v_status:=coalesce(nullif(left(btrim(v_item->>'status'),20),''),'previsto');
      if v_valor='NaN'::numeric or v_valor<0 or v_valor>=100000000000
         or v_status not in ('previsto','recebido','atrasado','cancelado') then
        raise exception 'ESTEIRA_COMISSAO_DADOS_INVALIDOS: Valor ou status inválido na parcela %.',v_ordem;
      end if;
      insert into public.venda_comissao_parcelas(
        processo_ref,valor,gatilho,data_prevista,data_efetiva,responsavel,status,ordem
      ) values (
        p_processo_id,v_valor,nullif(left(btrim(v_item->>'gatilho'),80),''),v_prevista,v_efetiva,
        nullif(left(btrim(v_item->>'responsavel'),120),''),v_status,v_ordem
      );
    end loop;
  end if;

  v_depois:=jsonb_build_object(
    'comissao',(select to_jsonb(c) from public.venda_comissao c where c.processo_ref=p_processo_id),
    'parcelas',coalesce((select jsonb_agg(to_jsonb(p) order by p.ordem,p.id) from public.venda_comissao_parcelas p where p.processo_ref=p_processo_id),'[]'::jsonb)
  );
  v_parcelas_count:=jsonb_array_length(v_depois->'parcelas');
  insert into public.erp_auditoria(
    usuario_id,usuario_nome,acao,modulo,entidade,entidade_id,antes,depois,detalhe
  ) values (
    v_uid,coalesce((select u.nome from public.usuarios u where u.id=v_uid),'sistema/automação'),
    'salvar comissão','Esteira','venda_comissao',p_processo_id::text,v_antes,
    jsonb_build_object('request_id',p_request_id,'solicitacao',v_solicitacao,'estado',v_depois),
    'Cabeçalho e parcelas da comissão salvos em transação auditada e idempotente.'
  );
  return jsonb_build_object('ok',true,'processo_id',p_processo_id,'parcelas',v_parcelas_count,'idempotente',false);
exception when unique_violation then
  raise exception 'ESTEIRA_COMISSAO_CONFLITO: A comissão mudou enquanto você trabalhava. Atualize a tela.';
end
$function$;

comment on function public.esteira_comissao_salvar(uuid,jsonb,jsonb,uuid) is
  'Salva cabeçalho e parcelas da comissão da Esteira com auditoria e retry idempotente. SECURITY INVOKER.';
revoke all on function public.esteira_comissao_salvar(uuid,jsonb,jsonb,uuid) from public,anon;
grant execute on function public.esteira_comissao_salvar(uuid,jsonb,jsonb,uuid) to authenticated,service_role;
notify pgrst,'reload schema';
