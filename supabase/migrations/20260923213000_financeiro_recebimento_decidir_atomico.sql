-- Financeiro / baixa direta: recebimento, caixa e auditoria em uma transação.
-- Não corrige nem infere os dois recebimentos legados de vendas pagas; a RPC
-- atua somente quando uma pessoa executa explicitamente baixar/desfazer.

create or replace function public.financeiro_recebimento_decidir(
  p_recebimento_id uuid,
  p_recebido boolean,
  p_data_recebimento date default null
)
returns jsonb
language plpgsql
security invoker
set search_path = public, pg_temp
as $function$
declare
  v_uid uuid:=auth.uid();
  v_rec public.recebimentos;
  v_rec_depois public.recebimentos;
  v_caixa public.lancamentos_caixa;
  v_caixa_depois public.lancamentos_caixa;
  v_caixa_antes jsonb;
  v_tem_caixa boolean;
  v_categoria text;
begin
  if v_uid is null then
    raise exception 'CAIXA_SEM_PERMISSAO: Sessão inválida ou expirada.' using errcode='42501';
  end if;
  if p_recebimento_id is null or p_recebido is null then
    raise exception 'CAIXA_DADOS_INVALIDOS: Recebimento inválido.';
  end if;
  if p_recebido and p_data_recebimento is null then
    raise exception 'CAIXA_DADOS_INVALIDOS: Informe a data do recebimento.';
  end if;

  select * into v_rec from public.recebimentos
   where id=p_recebimento_id for update;
  if not found then
    raise exception 'CAIXA_RECEBIMENTO_NAO_ENCONTRADO: Recebimento não encontrado ou indisponível.';
  end if;
  select * into v_caixa from public.lancamentos_caixa
   where recebimento_id=p_recebimento_id for update;
  v_tem_caixa:=found;
  if v_tem_caixa then v_caixa_antes:=to_jsonb(v_caixa); end if;

  if p_recebido then
    if v_tem_caixa then
      if v_caixa.tipo<>'entrada' or v_caixa.venda_id is distinct from v_rec.venda_id
         or v_caixa.valor<>round(v_rec.valor_total,2) then
        raise exception 'CAIXA_RECEBIMENTO_INCONSISTENTE: O caixa ligado à parcela diverge em tipo, venda ou valor. Nada foi alterado.';
      end if;
      if v_rec.status='recebido' then
        if v_rec.data_recebimento is distinct from v_caixa.data then
          raise exception 'CAIXA_RECEBIMENTO_INCONSISTENTE: A data da parcela diverge do caixa ligado. Nada foi alterado.';
        end if;
        return jsonb_build_object(
          'ok',true,'recebimento_id',p_recebimento_id,
          'lancamento_id',v_caixa.id,'idempotente',true
        );
      end if;
      update public.lancamentos_caixa set data=p_data_recebimento
       where id=v_caixa.id returning * into v_caixa_depois;
    else
      select c.nome into v_categoria from public.categorias_caixa c
       where c.ativo=true and c.natureza='comissao_recebida'
         and c.tipo in ('entrada','ambos')
       order by c.ordem,c.id limit 1;
      if v_categoria is null then
        raise exception 'CAIXA_CATEGORIA_AUSENTE: Não existe categoria ativa de entrada para comissão recebida.';
      end if;
      insert into public.lancamentos_caixa(
        data,tipo,categoria,descricao,valor,venda_id,recebimento_id,origem,natureza
      ) values (
        p_data_recebimento,'entrada',v_categoria,
        'Recebimento baixado pela ficha da venda.',v_rec.valor_total,
        v_rec.venda_id,v_rec.id,'erp','comissao_recebida'
      ) returning * into v_caixa_depois;
      v_caixa:=v_caixa_depois;
    end if;
    update public.recebimentos set status='recebido',data_recebimento=p_data_recebimento
     where id=p_recebimento_id returning * into v_rec_depois;
  else
    if v_rec.status<>'recebido' and not v_tem_caixa then
      return jsonb_build_object(
        'ok',true,'recebimento_id',p_recebimento_id,
        'lancamento_id',null,'idempotente',true
      );
    end if;
    if v_caixa.id is not null then
      if exists(select 1 from public.pagamentos_comissao p where p.lancamento_id=v_caixa.id) then
        raise exception 'CAIXA_RECEBIMENTO_INCONSISTENTE: O caixa da parcela também está ligado a um repasse. Nada foi alterado.';
      end if;
      delete from public.lancamentos_caixa where id=v_caixa.id;
    end if;
    update public.recebimentos set status='pendente',data_recebimento=null
     where id=p_recebimento_id returning * into v_rec_depois;
    v_caixa_depois:=null;
  end if;

  insert into public.erp_auditoria(
    usuario_id,usuario_nome,acao,modulo,entidade,entidade_id,antes,depois,detalhe
  ) values (
    v_uid,coalesce((select u.nome from public.usuarios u where u.id=v_uid),'sistema/automação'),
    case when p_recebido then 'baixar recebimento' else 'reabrir recebimento' end,
    'Financeiro','recebimentos',p_recebimento_id::text,
    jsonb_build_object('recebimento',to_jsonb(v_rec),'lancamento_caixa',v_caixa_antes),
    jsonb_build_object('recebimento',to_jsonb(v_rec_depois),'lancamento_caixa',case when v_caixa_depois.id is null then null else to_jsonb(v_caixa_depois) end),
    case when p_recebido
      then 'Recebimento baixado e caixa criado/confirmado em transação única.'
      else 'Recebimento reaberto e caixa removido em transação única.' end
  );
  return jsonb_build_object(
    'ok',true,'recebimento_id',p_recebimento_id,
    'lancamento_id',case when p_recebido then v_caixa.id else null end,
    'idempotente',false
  );
end
$function$;

comment on function public.financeiro_recebimento_decidir(uuid,boolean,date) is
  'Baixa ou reabre recebimento junto do caixa e auditoria, sem backfill automático. SECURITY INVOKER preserva RLS.';
revoke all on function public.financeiro_recebimento_decidir(uuid,boolean,date) from public,anon;
grant execute on function public.financeiro_recebimento_decidir(uuid,boolean,date) to authenticated,service_role;
notify pgrst,'reload schema';
