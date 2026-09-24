-- Esteira: parte, flag de cônjuge e auditoria mudam na mesma transação.

create unique index if not exists erp_auditoria_esteira_parte_request_uidx
  on public.erp_auditoria ((depois->>'request_id'))
  where modulo='Esteira' and entidade='venda_partes'
    and acao='mutar parte' and depois ? 'request_id';

create or replace function public.esteira_parte_mutar(
  p_acao text,
  p_processo_id uuid,
  p_parte_id uuid,
  p_payload jsonb,
  p_request_id uuid
)
returns jsonb
language plpgsql
security invoker
set search_path=public,pg_temp
as $function$
declare
  v_uid uuid:=auth.uid();
  v_acao text:=lower(btrim(p_acao));
  v_auditoria public.erp_auditoria;
  v_parte_antes public.venda_partes;
  v_parte_depois public.venda_partes;
  v_cond_antes public.venda_condicoes;
  v_cond_depois public.venda_condicoes;
  v_papel text;
  v_ordem integer;
  v_nome text;
  v_telefone text;
  v_email text;
  v_cpf text;
  v_observacao text;
  v_flag text;
  v_tem_conjuge boolean;
  v_solicitacao jsonb;
  v_antes jsonb;
  v_depois jsonb;
  v_resultado jsonb;
begin
  if v_uid is null or not coalesce(public.can_manage_all(),false) then
    raise exception 'ESTEIRA_PARTE_SEM_PERMISSAO: Você não tem permissão para alterar as partes da venda.' using errcode='42501';
  end if;
  if v_acao not in ('salvar','adicionar','remover') or p_processo_id is null or p_request_id is null
     or p_payload is null or jsonb_typeof(p_payload)<>'object' then
    raise exception 'ESTEIRA_PARTE_DADOS_INVALIDOS: Ação, venda, dados ou solicitação inválida.';
  end if;

  if v_acao='remover' then
    if p_parte_id is null then raise exception 'ESTEIRA_PARTE_DADOS_INVALIDOS: Parte inválida.'; end if;
    v_solicitacao:=jsonb_build_object('acao',v_acao,'processo_id',p_processo_id,'parte_id',p_parte_id);
  else
    v_papel:=left(btrim(p_payload->>'papel'),30);
    if v_papel not in ('comprador','conjuge_comprador','vendedor','conjuge_vendedor') then
      raise exception 'ESTEIRA_PARTE_DADOS_INVALIDOS: Papel da parte inválido.';
    end if;
    v_nome:=nullif(left(btrim(p_payload->>'nome'),160),'');
    v_telefone:=nullif(left(btrim(p_payload->>'telefone'),40),'');
    v_email:=nullif(lower(left(btrim(p_payload->>'email'),160)),'');
    v_cpf:=nullif(left(btrim(p_payload->>'cpf'),20),'');
    v_observacao:=nullif(left(btrim(p_payload->>'observacao'),400),'');
    if v_email is not null and (position('@' in v_email)<=1 or position('.' in split_part(v_email,'@',2))<=0) then
      raise exception 'ESTEIRA_PARTE_DADOS_INVALIDOS: E-mail inválido.';
    end if;
    if v_acao='salvar' then
      begin v_ordem:=(p_payload->>'ordem')::integer;
      exception when invalid_text_representation or numeric_value_out_of_range then
        raise exception 'ESTEIRA_PARTE_DADOS_INVALIDOS: Ordem inválida.';
      end;
      if v_ordem<1 or v_ordem>6 then raise exception 'ESTEIRA_PARTE_DADOS_INVALIDOS: Ordem fora do limite permitido.'; end if;
    end if;
    v_solicitacao:=jsonb_build_object(
      'acao',v_acao,'processo_id',p_processo_id,
      'payload',jsonb_build_object('papel',v_papel,'ordem',v_ordem,'nome',v_nome,'telefone',v_telefone,
        'email',v_email,'cpf',v_cpf,'observacao',v_observacao)
    );
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_request_id::text,0));
  select * into v_auditoria from public.erp_auditoria a
    where a.modulo='Esteira' and a.entidade='venda_partes' and a.acao='mutar parte'
      and a.depois->>'request_id'=p_request_id::text
    order by a.criado_em desc,a.id desc limit 1;
  if found then
    if v_auditoria.depois->'solicitacao'=v_solicitacao then
      v_resultado:=v_auditoria.depois->'resultado';
      return v_resultado||jsonb_build_object('ok',true,'idempotente',true);
    end if;
    raise exception 'ESTEIRA_PARTE_REQUEST_CONFLITANTE: Esta solicitação já foi usada com outros dados. Atualize a tela.';
  end if;

  perform 1 from public.venda_processos p where p.id=p_processo_id for update;
  if not found then raise exception 'ESTEIRA_PARTE_NAO_ENCONTRADA: Venda não encontrada ou indisponível.'; end if;
  perform 1 from public.venda_partes p where p.processo_ref=p_processo_id order by p.papel,p.ordem for update;
  select * into v_cond_antes from public.venda_condicoes c where c.processo_ref=p_processo_id for update;

  if v_acao='remover' then
    select * into v_parte_antes from public.venda_partes p
      where p.id=p_parte_id and p.processo_ref=p_processo_id for update;
    if not found then raise exception 'ESTEIRA_PARTE_NAO_ENCONTRADA: Parte não encontrada ou já removida.'; end if;
    v_papel:=v_parte_antes.papel;
    v_ordem:=v_parte_antes.ordem;
    if v_papel not like 'conjuge_%' and v_ordem=1 then
      raise exception 'ESTEIRA_PARTE_TITULAR: O titular não pode ser removido — edite os dados ou devolva a venda ao atendimento.';
    end if;
    delete from public.venda_partes where id=p_parte_id;
    v_parte_depois:=null;
  else
    if v_acao='adicionar' then
      select coalesce(max(p.ordem),0)+1 into v_ordem from public.venda_partes p
        where p.processo_ref=p_processo_id and p.papel=v_papel;
      if v_ordem>6 then raise exception 'ESTEIRA_PARTE_DADOS_INVALIDOS: Limite de 6 pessoas por papel.'; end if;
    end if;
    select * into v_parte_antes from public.venda_partes p
      where p.processo_ref=p_processo_id and p.papel=v_papel and p.ordem=v_ordem for update;
    insert into public.venda_partes(
      processo_ref,papel,ordem,nome,telefone,email,cpf,observacao,atualizado_por,atualizado_em
    ) values (
      p_processo_id,v_papel,v_ordem,v_nome,v_telefone,v_email,v_cpf,v_observacao,v_uid,now()
    ) on conflict(processo_ref,papel,ordem) do update set
      nome=excluded.nome,telefone=excluded.telefone,email=excluded.email,cpf=excluded.cpf,
      observacao=excluded.observacao,atualizado_por=excluded.atualizado_por,atualizado_em=excluded.atualizado_em
    returning * into v_parte_depois;
    p_parte_id:=v_parte_depois.id;
  end if;

  if v_papel like 'conjuge_%' then
    v_flag:=case when v_papel='conjuge_comprador' then 'comprador_tem_conjuge' else 'vendedor_tem_conjuge' end;
    select exists(select 1 from public.venda_partes p where p.processo_ref=p_processo_id and p.papel=v_papel) into v_tem_conjuge;
    insert into public.venda_condicoes(processo_ref,comprador_tem_conjuge,vendedor_tem_conjuge,atualizado_por,atualizado_em)
    values(
      p_processo_id,
      case when v_flag='comprador_tem_conjuge' then v_tem_conjuge else coalesce(v_cond_antes.comprador_tem_conjuge,false) end,
      case when v_flag='vendedor_tem_conjuge' then v_tem_conjuge else coalesce(v_cond_antes.vendedor_tem_conjuge,false) end,
      v_uid,now()
    ) on conflict(processo_ref) do update set
      comprador_tem_conjuge=case when v_flag='comprador_tem_conjuge' then v_tem_conjuge else venda_condicoes.comprador_tem_conjuge end,
      vendedor_tem_conjuge=case when v_flag='vendedor_tem_conjuge' then v_tem_conjuge else venda_condicoes.vendedor_tem_conjuge end,
      atualizado_por=v_uid,atualizado_em=now();
  end if;
  select * into v_cond_depois from public.venda_condicoes c where c.processo_ref=p_processo_id;

  v_antes:=jsonb_build_object('parte',to_jsonb(v_parte_antes),'condicoes',to_jsonb(v_cond_antes));
  v_depois:=jsonb_build_object('parte',to_jsonb(v_parte_depois),'condicoes',to_jsonb(v_cond_depois));
  v_resultado:=jsonb_build_object('processo_id',p_processo_id,'parte_id',p_parte_id,'ordem',v_ordem,'removida',v_acao='remover');
  insert into public.erp_auditoria(
    usuario_id,usuario_nome,acao,modulo,entidade,entidade_id,antes,depois,detalhe
  ) values (
    v_uid,coalesce((select u.nome from public.usuarios u where u.id=v_uid),'sistema/automação'),
    'mutar parte','Esteira','venda_partes',p_parte_id::text,v_antes,
    jsonb_build_object('request_id',p_request_id,'solicitacao',v_solicitacao,'resultado',v_resultado,'estado',v_depois),
    'Parte e flag de cônjuge alteradas em transação auditada e idempotente.'
  );
  return v_resultado||jsonb_build_object('ok',true,'idempotente',false);
exception when unique_violation then
  raise exception 'ESTEIRA_PARTE_CONFLITO: O cadastro das partes mudou enquanto você trabalhava. Atualize a tela.';
end
$function$;

comment on function public.esteira_parte_mutar(text,uuid,uuid,jsonb,uuid) is
  'Salva, adiciona ou remove parte e sincroniza cônjuge com auditoria e retry. SECURITY INVOKER.';
revoke all on function public.esteira_parte_mutar(text,uuid,uuid,jsonb,uuid) from public,anon;
grant execute on function public.esteira_parte_mutar(text,uuid,uuid,jsonb,uuid) to authenticated,service_role;
notify pgrst,'reload schema';
