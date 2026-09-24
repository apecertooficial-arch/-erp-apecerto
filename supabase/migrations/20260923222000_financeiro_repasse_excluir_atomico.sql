-- Financeiro / exclusão de repasse: agenda, caixa derivado e auditoria atômicos.

create or replace function public.financeiro_excluir_repasse(p_repasse_id uuid)
returns jsonb
language plpgsql
security invoker
set search_path = public, pg_temp
as $function$
declare
  v_uid uuid:=auth.uid();
  v_repasse public.pagamentos_comissao;
  v_caixa public.lancamentos_caixa;
  v_auditoria public.erp_auditoria;
  v_removeu_caixa boolean:=false;
  v_n integer;
begin
  if v_uid is null then
    raise exception 'REPASSE_SEM_PERMISSAO: Sessão inválida ou expirada.' using errcode='42501';
  end if;
  if p_repasse_id is null then raise exception 'REPASSE_DADOS_INVALIDOS: Repasse inválido.'; end if;

  select * into v_repasse from public.pagamentos_comissao
   where id=p_repasse_id for update;
  if not found then
    select * into v_auditoria from public.erp_auditoria a
     where a.entidade='pagamentos_comissao' and a.entidade_id=p_repasse_id::text
       and a.acao='excluir repasse'
     order by a.id desc limit 1;
    if found then
      return jsonb_build_object(
        'ok',true,'repasse_id',p_repasse_id,
        'lancamento_removido',coalesce((v_auditoria.antes->'lancamento_caixa'->>'id') is not null,false),
        'idempotente',true
      );
    end if;
    raise exception 'REPASSE_NAO_ENCONTRADO: Repasse não encontrado ou já excluído.';
  end if;

  if v_repasse.lancamento_id is not null then
    select * into v_caixa from public.lancamentos_caixa
     where id=v_repasse.lancamento_id for update;
    if not found then
      raise exception 'REPASSE_INCONSISTENTE: O repasse aponta para um lançamento de caixa inexistente. Nada foi alterado; solicite conferência financeira.';
    end if;
    if v_caixa.tipo<>'saida' or v_caixa.natureza<>'comissao_paga'
       or v_caixa.valor<>v_repasse.valor
       or v_caixa.venda_id is distinct from v_repasse.venda_id
       or v_caixa.comissao_id is distinct from v_repasse.comissao_id
       or v_caixa.beneficiario_id is distinct from v_repasse.beneficiario_id
       or v_caixa.papel::text is distinct from v_repasse.papel then
      raise exception 'REPASSE_INCONSISTENTE: O caixa ligado diverge do repasse. Nada foi alterado; solicite conferência financeira.';
    end if;
    delete from public.lancamentos_caixa where id=v_caixa.id;
    get diagnostics v_n=row_count;
    if v_n<>1 then
      raise exception 'REPASSE_INCONSISTENTE: Não foi possível remover o caixa ligado. Nada foi alterado; solicite conferência financeira.';
    end if;
    v_removeu_caixa:=true;
  elsif v_repasse.status='pago' then
    raise exception 'REPASSE_INCONSISTENTE: O repasse está pago sem caixa ligado. Nada foi alterado; solicite conferência financeira.';
  end if;

  delete from public.pagamentos_comissao where id=p_repasse_id;
  get diagnostics v_n=row_count;
  if v_n<>1 then
    raise exception 'REPASSE_INCONSISTENTE: Não foi possível remover o repasse. Nada foi alterado; solicite conferência financeira.';
  end if;
  insert into public.erp_auditoria(
    usuario_id,usuario_nome,acao,modulo,entidade,entidade_id,antes,depois,detalhe
  ) values (
    v_uid,coalesce((select u.nome from public.usuarios u where u.id=v_uid),'sistema/automação'),
    'excluir repasse','Financeiro','pagamentos_comissao',p_repasse_id::text,
    jsonb_build_object(
      'repasse',to_jsonb(v_repasse),
      'lancamento_caixa',case when v_removeu_caixa then to_jsonb(v_caixa) else null end
    ),
    jsonb_build_object('repasse',null,'lancamento_caixa',null),
    case when v_removeu_caixa
      then 'Repasse e lançamento de caixa excluídos em transação única.'
      else 'Repasse previsto excluído em transação única.' end
  );
  return jsonb_build_object(
    'ok',true,'repasse_id',p_repasse_id,
    'lancamento_removido',v_removeu_caixa,'idempotente',false
  );
end
$function$;

comment on function public.financeiro_excluir_repasse(uuid) is
  'Exclui repasse e eventual caixa derivado em uma transação auditada e idempotente. SECURITY INVOKER.';
revoke all on function public.financeiro_excluir_repasse(uuid) from public,anon;
grant execute on function public.financeiro_excluir_repasse(uuid) to authenticated,service_role;
notify pgrst,'reload schema';
