-- Esteira: condições comerciais e auditoria mudam na mesma transação idempotente.

create unique index if not exists erp_auditoria_esteira_condicoes_request_uidx
  on public.erp_auditoria ((depois->>'request_id'))
  where modulo='Esteira' and entidade='venda_condicoes'
    and acao='salvar condições' and depois ? 'request_id';

create or replace function public.esteira_condicoes_salvar(
  p_processo_id uuid,
  p_payload jsonb,
  p_somente_conjuge boolean,
  p_request_id uuid
)
returns jsonb
language plpgsql
security invoker
set search_path=public,pg_temp
as $function$
declare
  v_uid uuid:=auth.uid();
  v_processo public.venda_processos;
  v_etapa public.esteira_etapas;
  v_role public.user_role;
  v_antes public.venda_condicoes;
  v_nova public.venda_condicoes;
  v_depois public.venda_condicoes;
  v_auditoria public.erp_auditoria;
  v_solicitacao jsonb;
  v_resultado jsonb;
begin
  if v_uid is null then
    raise exception 'ESTEIRA_CONDICOES_SEM_PERMISSAO: Entre novamente para alterar as condições.' using errcode='42501';
  end if;
  if p_processo_id is null or p_request_id is null or p_payload is null
     or jsonb_typeof(p_payload)<>'object' or p_somente_conjuge is null then
    raise exception 'ESTEIRA_CONDICOES_DADOS_INVALIDOS: Venda, dados ou solicitação inválida.';
  end if;

  begin
    select * into v_nova
    from jsonb_populate_record(null::public.venda_condicoes,p_payload);
  exception when others then
    raise exception 'ESTEIRA_CONDICOES_DADOS_INVALIDOS: Revise os valores e datas das condições comerciais.';
  end;
  if v_nova.comprador_tem_conjuge is null or v_nova.vendedor_tem_conjuge is null
     or v_nova.forma_pagamento is not null and v_nova.forma_pagamento not in ('a_vista','financiamento','consorcio','misto')
     or v_nova.origem_recursos is null or jsonb_typeof(v_nova.origem_recursos)<>'array'
     or jsonb_array_length(v_nova.origem_recursos)>50 then
    raise exception 'ESTEIRA_CONDICOES_DADOS_INVALIDOS: Revise a forma de pagamento e a origem dos recursos.';
  end if;
  v_nova.processo_ref:=p_processo_id;
  v_nova.atualizado_por:=v_uid;
  v_nova.atualizado_em:=now();
  v_solicitacao:=jsonb_build_object(
    'processo_id',p_processo_id,'somente_conjuge',p_somente_conjuge,
    'payload',case when p_somente_conjuge then jsonb_build_object(
      'comprador_tem_conjuge',v_nova.comprador_tem_conjuge,
      'vendedor_tem_conjuge',v_nova.vendedor_tem_conjuge
    ) else to_jsonb(v_nova)-'processo_ref'-'atualizado_por'-'atualizado_em' end
  );

  perform pg_advisory_xact_lock(hashtextextended(p_request_id::text,0));
  select * into v_auditoria from public.erp_auditoria a
    where a.modulo='Esteira' and a.entidade='venda_condicoes' and a.acao='salvar condições'
      and a.depois->>'request_id'=p_request_id::text
    order by a.criado_em desc,a.id desc limit 1;
  if found then
    if v_auditoria.depois->'solicitacao'=v_solicitacao then
      v_resultado:=v_auditoria.depois->'resultado';
      return v_resultado||jsonb_build_object('ok',true,'idempotente',true);
    end if;
    raise exception 'ESTEIRA_CONDICOES_REQUEST_CONFLITANTE: Esta solicitação já foi usada com outros valores. Atualize a tela.';
  end if;

  select * into v_processo from public.venda_processos p where p.id=p_processo_id for update;
  if not found then
    raise exception 'ESTEIRA_CONDICOES_NAO_ENCONTRADA: Venda não encontrada ou sem acesso.';
  end if;
  select * into v_etapa from public.esteira_etapas e where e.slug=v_processo.etapa and e.ativo for share;
  if not found then
    raise exception 'ESTEIRA_CONDICOES_BLOQUEADAS: A etapa atual não está mais ativa. Atualize a tela.';
  end if;
  if not p_somente_conjuge then
    select u.role into v_role from public.usuarios u where u.id=v_uid and u.ativo;
    if not ('condicoes'=any(coalesce(v_etapa.libera,array[]::text[])))
       or (coalesce(array_length(v_etapa.restrito_a,1),0)>0
           and (v_role is null or (v_role<>'admin'::public.user_role and not (v_role::text=any(v_etapa.restrito_a))))) then
      raise exception 'ESTEIRA_CONDICOES_BLOQUEADAS: As condições comerciais não podem ser editadas nesta etapa pelo seu perfil.';
    end if;
  end if;

  select * into v_antes from public.venda_condicoes c where c.processo_ref=p_processo_id for update;
  if p_somente_conjuge then
    insert into public.venda_condicoes(
      processo_ref,comprador_tem_conjuge,vendedor_tem_conjuge,atualizado_por,atualizado_em
    ) values (
      p_processo_id,v_nova.comprador_tem_conjuge,v_nova.vendedor_tem_conjuge,v_uid,now()
    ) on conflict(processo_ref) do update set
      comprador_tem_conjuge=excluded.comprador_tem_conjuge,
      vendedor_tem_conjuge=excluded.vendedor_tem_conjuge,
      atualizado_por=excluded.atualizado_por,atualizado_em=excluded.atualizado_em;
  else
    insert into public.venda_condicoes(
      processo_ref,comprador_tem_conjuge,vendedor_tem_conjuge,
      valor_total,valor_entrada,data_entrada,valor_financiado,valor_fgts,
      valor_recursos_proprios,valor_parcelas_interm,qtd_parcelas,valor_parcela,
      valor_assinatura,valor_chaves,data_assinatura,data_conclusao,origem_recursos,
      atualizado_por,atualizado_em,forma_pagamento
    ) values (
      v_nova.processo_ref,v_nova.comprador_tem_conjuge,v_nova.vendedor_tem_conjuge,
      v_nova.valor_total,v_nova.valor_entrada,v_nova.data_entrada,v_nova.valor_financiado,v_nova.valor_fgts,
      v_nova.valor_recursos_proprios,v_nova.valor_parcelas_interm,v_nova.qtd_parcelas,v_nova.valor_parcela,
      v_nova.valor_assinatura,v_nova.valor_chaves,v_nova.data_assinatura,v_nova.data_conclusao,v_nova.origem_recursos,
      v_nova.atualizado_por,v_nova.atualizado_em,v_nova.forma_pagamento
    )
    on conflict(processo_ref) do update set
      comprador_tem_conjuge=excluded.comprador_tem_conjuge,
      vendedor_tem_conjuge=excluded.vendedor_tem_conjuge,
      valor_total=excluded.valor_total,valor_entrada=excluded.valor_entrada,data_entrada=excluded.data_entrada,
      valor_financiado=excluded.valor_financiado,valor_fgts=excluded.valor_fgts,
      valor_recursos_proprios=excluded.valor_recursos_proprios,valor_parcelas_interm=excluded.valor_parcelas_interm,
      qtd_parcelas=excluded.qtd_parcelas,valor_parcela=excluded.valor_parcela,
      valor_assinatura=excluded.valor_assinatura,valor_chaves=excluded.valor_chaves,
      data_assinatura=excluded.data_assinatura,data_conclusao=excluded.data_conclusao,
      origem_recursos=excluded.origem_recursos,forma_pagamento=excluded.forma_pagamento,
      atualizado_por=excluded.atualizado_por,atualizado_em=excluded.atualizado_em;
  end if;
  select * into v_depois from public.venda_condicoes c where c.processo_ref=p_processo_id;
  v_resultado:=jsonb_build_object('processo_id',p_processo_id);
  insert into public.erp_auditoria(
    usuario_id,usuario_nome,acao,modulo,entidade,entidade_id,antes,depois,detalhe
  ) values (
    v_uid,coalesce((select u.nome from public.usuarios u where u.id=v_uid),'sistema/automação'),
    'salvar condições','Esteira','venda_condicoes',p_processo_id::text,to_jsonb(v_antes),
    jsonb_build_object('request_id',p_request_id,'solicitacao',v_solicitacao,'resultado',v_resultado,'estado',to_jsonb(v_depois)),
    case when p_somente_conjuge then 'Flags de cônjuge alteradas em transação auditada e idempotente.'
      else 'Condições comerciais alteradas em transação auditada e idempotente.' end
  );
  return v_resultado||jsonb_build_object('ok',true,'idempotente',false);
end
$function$;

comment on function public.esteira_condicoes_salvar(uuid,jsonb,boolean,uuid) is
  'Salva condições comerciais ou somente flags de cônjuge com autorização, auditoria e retry. SECURITY INVOKER.';
revoke all on function public.esteira_condicoes_salvar(uuid,jsonb,boolean,uuid) from public,anon;
grant execute on function public.esteira_condicoes_salvar(uuid,jsonb,boolean,uuid) to authenticated,service_role;
notify pgrst,'reload schema';
