-- A aprovação e a reprovação de uma captação pertencem à mesma decisão
-- gerencial, com lock, publicação e auditoria na mesma transação.

set lock_timeout = '5s';
set statement_timeout = '60s';

create or replace function private.produto_bloquear_decisao_unidade_direta()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_contexto text := nullif(pg_catalog.current_setting('apecerto.produto_decisao_context', true), '');
  v_contexto_esperado text;
begin
  if new.aprovacao is not distinct from old.aprovacao
     or new.aprovacao not in ('aprovado', 'reprovado') then
    return new;
  end if;

  v_contexto_esperado := case when v_uid is null then null else
    v_uid::text || ':' || new.empreendimento_id::text || ':' || new.id::text
  end;
  if v_uid is null or v_contexto is distinct from v_contexto_esperado then
    raise insufficient_privilege using
      message = 'CAPTURE_DECISION_RPC_REQUIRED: aprove ou reprove pela decisão oficial de Produtos.';
  end if;

  return new;
end;
$$;

revoke all on function private.produto_bloquear_decisao_unidade_direta() from public, anon, authenticated;

drop trigger if exists trg_unidades_bloquear_decisao_direta on public.unidades;
create trigger trg_unidades_bloquear_decisao_direta
before update of aprovacao on public.unidades
for each row execute function private.produto_bloquear_decisao_unidade_direta();

create or replace function public.produto_decidir_captacao(
  p_empreendimento_id uuid,
  p_unidade_id uuid,
  p_aprovar boolean,
  p_motivo text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_emp public.empreendimentos%rowtype;
  v_unidade public.unidades%rowtype;
  v_motivo text := nullif(pg_catalog.btrim(coalesce(p_motivo, '')), '');
  v_publicacao jsonb;
  v_auditoria_id bigint;
  v_decisao text := case when p_aprovar then 'aprovar' else 'reprovar' end;
  v_txid text := pg_catalog.txid_current()::text;
begin
  if p_aprovar is null then
    raise invalid_parameter_value using message = 'CAPTURE_DECISION_INVALID: informe a decisão gerencial.';
  end if;
  if not p_aprovar and v_motivo is null then
    raise check_violation using message = 'CAPTURE_DECISION_REASON_REQUIRED: informe o motivo da reprovação.';
  end if;
  if v_uid is null or not coalesce(public.is_product_manager(), false) then
    raise insufficient_privilege using message = 'CAPTURE_DECISION_FORBIDDEN: apenas a gestão de Produtos pode decidir captações.';
  end if;

  select e.* into v_emp
  from public.empreendimentos e
  where e.id = p_empreendimento_id
  for update;
  if not found then
    raise no_data_found using message = 'CAPTURE_DECISION_NOT_FOUND: captação não encontrada.';
  end if;

  select u.* into v_unidade
  from public.unidades u
  where u.id = p_unidade_id and u.empreendimento_id = p_empreendimento_id
  for update;
  if not found then
    raise no_data_found using message = 'CAPTURE_DECISION_NOT_FOUND: unidade da captação não encontrada.';
  end if;
  if v_unidade.de_terceiros is not true then
    raise check_violation using message = 'CAPTURE_DECISION_INVALID: a unidade não é uma captação de terceiro.';
  end if;

  -- Retry da mesma decisão não publica nem audita novamente.
  if (p_aprovar and v_unidade.aprovacao = 'aprovado' and v_unidade.publicado)
     or (not p_aprovar and v_unidade.aprovacao = 'reprovado' and not v_unidade.publicado
         and v_unidade.reprovacao_motivo is not distinct from v_motivo) then
    select a.id into v_auditoria_id
    from public.erp_auditoria a
    where a.modulo = 'produtos'
      and a.entidade = 'unidade'
      and a.entidade_id = p_unidade_id::text
      and a.depois ->> 'decisao' = v_decisao
    order by a.id desc
    limit 1;
    if v_auditoria_id is null then
      raise data_exception using message = 'CAPTURE_DECISION_AUDIT_MISSING: a decisão anterior não possui auditoria canônica.';
    end if;
    return jsonb_build_object(
      'ok', true, 'replayed', true, 'decisao', v_decisao,
      'empreendimento_id', p_empreendimento_id, 'unidade_id', p_unidade_id,
      'aprovacao', v_unidade.aprovacao, 'publicado', v_unidade.publicado,
      'site_visivel', v_unidade.publicado, 'auditoria_id', v_auditoria_id
    );
  end if;

  if v_unidade.aprovacao is distinct from 'pendente' or v_unidade.publicado then
    raise serialization_failure using message = 'CAPTURE_DECISION_CONFLICT: a captação já recebeu outra decisão.';
  end if;

  perform pg_catalog.set_config(
    'apecerto.produto_decisao_context',
    v_uid::text || ':' || p_empreendimento_id::text || ':' || p_unidade_id::text,
    true
  );

  if p_aprovar then
    v_publicacao := public.produto_definir_publicacao(p_empreendimento_id, true, p_unidade_id);
    if not coalesce((v_publicacao ->> 'ok')::boolean, false)
       or not coalesce((v_publicacao ->> 'site_visivel')::boolean, false) then
      raise data_exception using message = 'CAPTURE_DECISION_NOT_CONFIRMED: a aprovação não ficou visível no site.';
    end if;
  else
    update public.unidades u
    set aprovacao = 'reprovado',
        publicado = false,
        reprovacao_motivo = pg_catalog.left(v_motivo, 300)
    where u.id = p_unidade_id;
  end if;

  perform pg_catalog.set_config('apecerto.produto_decisao_context', '', true);

  select a.id into v_auditoria_id
  from public.erp_auditoria a
  where a.modulo = 'produtos'
    and a.entidade = 'unidade'
    and a.entidade_id = p_unidade_id::text
    and a.detalhe = 'Mudança editorial transacional txid=' || v_txid
  order by a.id desc
  limit 1
  for update;

  if v_auditoria_id is null then
    raise data_exception using message = 'CAPTURE_DECISION_AUDIT_MISSING: a decisão não gerou auditoria.';
  end if;

  update public.erp_auditoria a
  set acao = case when p_aprovar then 'aprovar_publicar' else 'reprovar' end,
      depois = coalesce(a.depois, '{}'::jsonb) || jsonb_build_object(
        'decisao', v_decisao,
        'motivo', case when p_aprovar then null else pg_catalog.left(v_motivo, 300) end
      ),
      detalhe = 'Decisão gerencial de captação txid=' || v_txid
  where a.id = v_auditoria_id;

  select u.* into v_unidade from public.unidades u where u.id = p_unidade_id;
  return jsonb_build_object(
    'ok', true, 'replayed', false, 'decisao', v_decisao,
    'empreendimento_id', p_empreendimento_id, 'unidade_id', p_unidade_id,
    'aprovacao', v_unidade.aprovacao, 'publicado', v_unidade.publicado,
    'site_visivel', case when p_aprovar then coalesce((v_publicacao ->> 'site_visivel')::boolean, false) else false end,
    'auditoria_id', v_auditoria_id,
    'publication', v_publicacao
  );
end;
$$;

revoke all on function public.produto_decidir_captacao(uuid, uuid, boolean, text) from public, anon, authenticated, service_role;
grant execute on function public.produto_decidir_captacao(uuid, uuid, boolean, text) to authenticated;

comment on function public.produto_decidir_captacao(uuid, uuid, boolean, text) is
  'Decisão gerencial idempotente: reprovar mantém a unidade fora do site; aprovar publica pela RPC canônica e enriquece uma única auditoria.';
