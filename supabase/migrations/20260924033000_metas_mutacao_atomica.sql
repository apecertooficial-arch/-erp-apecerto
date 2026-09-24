-- Metas: criação/edição/exclusão e auditoria são uma única transação.
-- O request UUID sobrevive à exclusão dentro da auditoria e torna retries seguros.

create unique index if not exists erp_auditoria_metas_request_uidx
  on public.erp_auditoria ((depois->>'request_id'))
  where modulo='Financeiro' and entidade='metas' and depois ? 'request_id';

create or replace function public.metas_mutar(
  p_operacao text,
  p_meta_id uuid,
  p_request_id uuid,
  payload jsonb
)
returns jsonb
language plpgsql
security invoker
set search_path=public,pg_temp
as $function$
declare
  v_uid uuid:=auth.uid();
  v_operacao text:=lower(btrim(p_operacao));
  v_corretor_id bigint;
  v_periodo_tipo text;
  v_ano integer;
  v_periodo integer;
  v_meta_vgv numeric;
  v_meta_vendas integer;
  v_antes public.metas;
  v_depois public.metas;
  v_auditoria public.erp_auditoria;
  v_solicitacao jsonb;
  v_acao text;
begin
  if v_uid is null or not coalesce(public.can_manage_all(),false) then
    raise exception 'META_SEM_PERMISSAO: Você não tem permissão para alterar metas.' using errcode='42501';
  end if;
  if p_request_id is null or v_operacao not in ('salvar','remover')
     or payload is null or jsonb_typeof(payload)<>'object' then
    raise exception 'META_DADOS_INVALIDOS: Operação, solicitação ou dados da meta inválidos.';
  end if;

  if v_operacao='salvar' then
    begin
      v_corretor_id:=nullif(btrim(payload->>'corretor_id'),'')::bigint;
      v_periodo_tipo:=btrim(payload->>'periodo_tipo');
      v_ano:=nullif(btrim(payload->>'ano'),'')::integer;
      v_periodo:=nullif(btrim(payload->>'periodo'),'')::integer;
      v_meta_vgv:=round(nullif(btrim(payload->>'meta_vgv'),'')::numeric,2);
      v_meta_vendas:=nullif(btrim(payload->>'meta_vendas'),'')::integer;
    exception when invalid_text_representation or numeric_value_out_of_range then
      raise exception 'META_DADOS_INVALIDOS: Período, ano ou valores inválidos.';
    end;
    if v_periodo_tipo not in ('mensal','semestral','anual')
       or v_ano not between 2000 and 2100
       or (v_periodo_tipo='mensal' and v_periodo not between 1 and 12)
       or (v_periodo_tipo='semestral' and v_periodo not between 1 and 2)
       or (v_periodo_tipo='anual' and v_periodo<>0)
       or v_meta_vgv is null or v_meta_vgv='NaN'::numeric or v_meta_vgv<0 or v_meta_vgv>=1000000000000
       or v_meta_vendas is null or v_meta_vendas<0 then
      raise exception 'META_DADOS_INVALIDOS: Preencha período, ano e valores válidos.';
    end if;
    if v_corretor_id is not null and not exists(select 1 from public.corretores c where c.id=v_corretor_id) then
      raise exception 'META_CORRETOR_NAO_ENCONTRADO: Corretor não encontrado ou indisponível.';
    end if;
    v_solicitacao:=jsonb_build_object('operacao','salvar','corretor_id',v_corretor_id,
      'periodo_tipo',v_periodo_tipo,'ano',v_ano,'periodo',v_periodo,
      'meta_vgv',v_meta_vgv,'meta_vendas',v_meta_vendas);
  else
    if p_meta_id is null then raise exception 'META_DADOS_INVALIDOS: Meta inválida.'; end if;
    v_solicitacao:=jsonb_build_object('operacao','remover','meta_id',p_meta_id);
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_request_id::text,0));
  select * into v_auditoria from public.erp_auditoria a
    where a.modulo='Financeiro' and a.entidade='metas'
      and a.depois->>'request_id'=p_request_id::text
    order by a.criado_em desc,a.id desc limit 1;
  if found then
    if v_auditoria.depois->'solicitacao'=v_solicitacao then
      return jsonb_build_object('ok',true,'meta_id',v_auditoria.entidade_id::uuid,
        'operacao',v_operacao,'idempotente',true);
    end if;
    raise exception 'META_REQUEST_CONFLITANTE: Esta solicitação já foi usada com outros dados. Atualize a tela.';
  end if;

  if v_operacao='salvar' then
    perform pg_advisory_xact_lock(hashtextextended(coalesce(v_corretor_id::text,'global')||'|'||v_periodo_tipo||'|'||v_ano||'|'||v_periodo,0));
    select * into v_antes from public.metas m
      where m.corretor_id is not distinct from v_corretor_id
        and m.periodo_tipo=v_periodo_tipo and m.ano=v_ano and m.periodo=v_periodo
      for update;
    if found then
      if v_antes.meta_vgv=v_meta_vgv and v_antes.meta_vendas=v_meta_vendas then
        return jsonb_build_object('ok',true,'meta_id',v_antes.id,
          'operacao','salvar','idempotente',true);
      end if;
      update public.metas set meta_vgv=v_meta_vgv,meta_vendas=v_meta_vendas,updated_at=now()
        where id=v_antes.id returning * into v_depois;
      v_acao:='editar meta';
    else
      insert into public.metas(corretor_id,periodo_tipo,ano,periodo,meta_vgv,meta_vendas,criado_por)
        values(v_corretor_id,v_periodo_tipo,v_ano,v_periodo,v_meta_vgv,v_meta_vendas,v_uid)
        returning * into v_depois;
      v_acao:='criar meta';
    end if;
  else
    select * into v_antes from public.metas m where m.id=p_meta_id for update;
    if not found then raise exception 'META_NAO_ENCONTRADA: Meta não encontrada ou indisponível.'; end if;
    delete from public.metas where id=v_antes.id returning * into v_depois;
    v_acao:='apagar meta';
  end if;

  insert into public.erp_auditoria(
    usuario_id,usuario_nome,acao,modulo,entidade,entidade_id,antes,depois,detalhe
  ) values (
    v_uid,coalesce((select u.nome from public.usuarios u where u.id=v_uid),'sistema/automação'),
    v_acao,'Financeiro','metas',v_depois.id::text,
    case when v_antes.id is null then null else to_jsonb(v_antes) end,
    jsonb_build_object('request_id',p_request_id,'solicitacao',v_solicitacao,
      'meta',case when v_operacao='remover' then null else to_jsonb(v_depois) end),
    'Meta alterada em transação auditada e idempotente.'
  );
  return jsonb_build_object('ok',true,'meta_id',v_depois.id,
    'operacao',v_operacao,'idempotente',false);
exception when unique_violation then
  raise exception 'META_CONFLITO: A meta ou solicitação já foi alterada em paralelo. Atualize a tela.';
end
$function$;

comment on function public.metas_mutar(text,uuid,uuid,jsonb) is
  'Cria, edita ou exclui uma meta com auditoria e retry idempotente. SECURITY INVOKER.';
revoke all on function public.metas_mutar(text,uuid,uuid,jsonb) from public,anon;
grant execute on function public.metas_mutar(text,uuid,uuid,jsonb) to authenticated,service_role;
notify pgrst,'reload schema';
