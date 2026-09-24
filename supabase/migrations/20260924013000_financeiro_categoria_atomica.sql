-- Financeiro / categorias de caixa: cadastro e auditoria são uma transação.
-- As naturezas de comissão sustentam baixas automáticas e não podem sumir.

create unique index if not exists categorias_caixa_natureza_especial_uidx
  on public.categorias_caixa(natureza)
  where ativo and natureza in ('comissao_recebida','comissao_paga');

create or replace function public.financeiro_categoria_mutar(p_categoria_id uuid,p_operacao text,payload jsonb)
returns jsonb
language plpgsql
security invoker
set search_path=public,pg_temp
as $function$
declare
  v_uid uuid:=auth.uid();
  v_operacao text:=lower(btrim(p_operacao));
  v_antes public.categorias_caixa;
  v_depois public.categorias_caixa;
  v_existente public.categorias_caixa;
  v_tinha_existente boolean:=false;
  v_nome text;
  v_tipo text;
  v_natureza text;
  v_cor text;
  v_acao text;
begin
  if v_uid is null or not coalesce(public.can_manage_all(),false) then
    raise exception 'CATEGORIA_SEM_PERMISSAO: Você não tem permissão para gerenciar categorias.' using errcode='42501';
  end if;
  if v_operacao is null or v_operacao not in ('criar','editar','remover')
     or payload is null or jsonb_typeof(payload)<>'object' then
    raise exception 'CATEGORIA_DADOS_INVALIDOS: Operação ou dados da categoria inválidos.';
  end if;

  if v_operacao='criar' then
    v_nome:=left(btrim(payload->>'nome'),80);
    v_tipo:=btrim(payload->>'tipo');
    v_natureza:=coalesce(nullif(btrim(payload->>'natureza'),''),'normal');
    v_cor:=nullif(left(btrim(payload->>'cor'),20),'');
    if v_nome is null or v_nome='' or v_tipo not in ('entrada','saida','ambos')
       or v_natureza not in ('normal','comissao_recebida','comissao_paga') then
      raise exception 'CATEGORIA_DADOS_INVALIDOS: Informe nome, tipo e natureza válidos.';
    end if;
    if (v_natureza='comissao_recebida' and v_tipo<>'entrada')
       or (v_natureza='comissao_paga' and v_tipo<>'saida') then
      raise exception 'CATEGORIA_DADOS_INVALIDOS: A natureza de comissão exige o tipo financeiro correspondente.';
    end if;
    perform pg_advisory_xact_lock(hashtextextended(lower(v_nome)||'|'||v_tipo,0));
    select * into v_existente from public.categorias_caixa c
      where lower(c.nome)=lower(v_nome) and c.tipo=v_tipo
      order by c.ativo desc,c.created_at desc,c.id
      limit 1 for update;
    v_tinha_existente:=found;
    if v_tinha_existente and v_existente.ativo then
      if v_existente.natureza=v_natureza and v_existente.cor is not distinct from v_cor then
        return jsonb_build_object('ok',true,'categoria_id',v_existente.id,
          'criada',true,'idempotente',true);
      end if;
      raise exception 'CATEGORIA_DUPLICADA: Já existe uma categoria ativa com esse nome e tipo.';
    end if;
    if v_natureza<>'normal' and exists(
      select 1 from public.categorias_caixa c where c.ativo and c.natureza=v_natureza
    ) then
      raise exception 'CATEGORIA_ESPECIAL_DUPLICADA: Já existe uma categoria estrutural para esta natureza de comissão.';
    end if;
    if v_tinha_existente then
      v_antes:=v_existente;
      update public.categorias_caixa
        set nome=v_nome,natureza=v_natureza,cor=v_cor,ativo=true
        where id=v_existente.id returning * into v_depois;
      v_acao:='reativar categoria';
    else
      insert into public.categorias_caixa(nome,tipo,natureza,cor,ordem)
        values(v_nome,v_tipo,v_natureza,v_cor,99)
        returning * into v_depois;
      v_acao:='criar categoria';
    end if;
  else
    if p_categoria_id is null then
      raise exception 'CATEGORIA_DADOS_INVALIDOS: Categoria inválida.';
    end if;
    select * into v_antes from public.categorias_caixa c where c.id=p_categoria_id for update;
    if not found then
      raise exception 'CATEGORIA_NAO_ENCONTRADA: Categoria não encontrada ou indisponível.';
    end if;
    if v_operacao='remover' then
      if not v_antes.ativo then
        return jsonb_build_object('ok',true,'categoria_id',v_antes.id,
          'criada',false,'idempotente',true);
      end if;
      if v_antes.natureza in ('comissao_recebida','comissao_paga') then
        raise exception 'CATEGORIA_ESTRUTURAL: Categorias estruturais de comissão não podem ser removidas.';
      end if;
      update public.categorias_caixa set ativo=false where id=v_antes.id returning * into v_depois;
      v_acao:='remover categoria';
    else
      if not v_antes.ativo then
        raise exception 'CATEGORIA_NAO_ENCONTRADA: Categoria não encontrada ou indisponível.';
      end if;
      v_nome:=case when payload?'nome' then left(btrim(payload->>'nome'),80) else v_antes.nome end;
      v_tipo:=case when payload?'tipo' then btrim(payload->>'tipo') else v_antes.tipo end;
      v_natureza:=case when payload?'natureza' then btrim(payload->>'natureza') else v_antes.natureza end;
      v_cor:=case when payload?'cor' then nullif(left(btrim(payload->>'cor'),20),'') else v_antes.cor end;
      if v_nome is null or v_nome='' or v_tipo not in ('entrada','saida','ambos')
         or v_natureza not in ('normal','comissao_recebida','comissao_paga') then
        raise exception 'CATEGORIA_DADOS_INVALIDOS: Informe nome, tipo e natureza válidos.';
      end if;
      if v_antes.natureza<>'normal' and v_natureza<>v_antes.natureza then
        raise exception 'CATEGORIA_ESTRUTURAL: A natureza estrutural de comissão não pode ser alterada.';
      end if;
      if (v_natureza='comissao_recebida' and v_tipo<>'entrada')
         or (v_natureza='comissao_paga' and v_tipo<>'saida') then
        raise exception 'CATEGORIA_ESTRUTURAL: A categoria estrutural precisa manter o tipo financeiro correspondente.';
      end if;
      if v_nome=v_antes.nome and v_tipo=v_antes.tipo and v_natureza=v_antes.natureza
         and v_cor is not distinct from v_antes.cor then
        return jsonb_build_object('ok',true,'categoria_id',v_antes.id,
          'criada',false,'idempotente',true);
      end if;
      perform pg_advisory_xact_lock(hashtextextended(lower(v_nome)||'|'||v_tipo,0));
      if exists(select 1 from public.categorias_caixa c
        where c.ativo and lower(c.nome)=lower(v_nome) and c.tipo=v_tipo and c.id<>v_antes.id) then
        raise exception 'CATEGORIA_DUPLICADA: Já existe uma categoria ativa com esse nome e tipo.';
      end if;
      if v_natureza<>'normal' and exists(select 1 from public.categorias_caixa c
        where c.ativo and c.natureza=v_natureza and c.id<>v_antes.id) then
        raise exception 'CATEGORIA_ESPECIAL_DUPLICADA: Já existe uma categoria estrutural para esta natureza de comissão.';
      end if;
      update public.categorias_caixa
        set nome=v_nome,tipo=v_tipo,natureza=v_natureza,cor=v_cor
        where id=v_antes.id returning * into v_depois;
      v_acao:='editar categoria';
    end if;
  end if;

  insert into public.erp_auditoria(
    usuario_id,usuario_nome,acao,modulo,entidade,entidade_id,antes,depois,detalhe
  ) values (
    v_uid,coalesce((select u.nome from public.usuarios u where u.id=v_uid),'sistema/automação'),
    v_acao,'Financeiro','categorias_caixa',v_depois.id::text,
    case when v_antes.id is null then null else to_jsonb(v_antes) end,to_jsonb(v_depois),
    'Categoria de caixa alterada em transação auditada e idempotente.'
  );
  return jsonb_build_object('ok',true,'categoria_id',v_depois.id,
    'criada',v_operacao='criar','idempotente',false);
exception when unique_violation then
  raise exception 'CATEGORIA_DUPLICADA: Já existe uma categoria ativa com esse nome, tipo ou natureza.';
end
$function$;

comment on function public.financeiro_categoria_mutar(uuid,text,jsonb) is
  'Cria, edita, reativa ou remove categoria de caixa com proteção estrutural e auditoria. SECURITY INVOKER.';
revoke all on function public.financeiro_categoria_mutar(uuid,text,jsonb) from public,anon;
grant execute on function public.financeiro_categoria_mutar(uuid,text,jsonb) to authenticated,service_role;
notify pgrst,'reload schema';
