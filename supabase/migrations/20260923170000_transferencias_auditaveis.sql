-- Decisões 7–9: transferência voluntária, gerencial e por fit comercial.
--
-- O contrato anterior tinha três falhas observáveis:
-- 1. RPCs SECURITY DEFINER não validavam o dono/escopo gerencial;
-- 2. o aceite não confirmava que o usuário era o corretor de destino;
-- 3. negócio e lead mudavam, mas o card do Funil 2 mantinha o dono antigo.
--
-- A operação nova grava intenção e decisão, atualiza as três entidades na mesma
-- transação e não altera etapa, momento, visita ou negociação em andamento.

create table if not exists public.crm_transferencias (
  id bigint generated always as identity primary key,
  negocio_id bigint not null references public.negocios(id) on delete cascade,
  lead_id bigint not null references public.leads(id) on delete cascade,
  de_corretor_id bigint references public.corretores(id),
  para_corretor_id bigint not null references public.corretores(id),
  tipo text not null check (tipo in ('voluntaria', 'gestao', 'fit_comercial')),
  motivo text not null check (char_length(trim(motivo)) between 3 and 500),
  fit_comercial text,
  status text not null check (status in ('pendente', 'aplicada', 'recusada', 'cancelada')),
  solicitada_por uuid not null,
  decidida_por uuid,
  criado_em timestamptz not null default now(),
  decidida_em timestamptz,
  aplicada_em timestamptz,
  constraint crm_transferencias_destino_diferente check (de_corretor_id is distinct from para_corretor_id),
  constraint crm_transferencias_fit_explicado check (
    tipo <> 'fit_comercial'
    or char_length(trim(coalesce(fit_comercial, ''))) between 3 and 500
  )
);

create unique index if not exists crm_transferencias_uma_pendente_por_negocio
  on public.crm_transferencias (negocio_id)
  where status = 'pendente';

create index if not exists crm_transferencias_destino_pendente
  on public.crm_transferencias (para_corretor_id, criado_em)
  where status = 'pendente';

alter table public.crm_transferencias enable row level security;
revoke all on table public.crm_transferencias from public, anon, authenticated;
revoke all on sequence public.crm_transferencias_id_seq from public, anon, authenticated;
grant select, insert, update on table public.crm_transferencias to service_role;
grant usage, select on sequence public.crm_transferencias_id_seq to service_role;

create or replace function ncrm_private.crm_transferencia_aplicar(
  p_transferencia_id bigint,
  p_ator uuid
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_transferencia public.crm_transferencias%rowtype;
  v_destino_nome text;
begin
  select *
    into v_transferencia
    from public.crm_transferencias
   where id = p_transferencia_id
   for update;

  if v_transferencia.id is null then
    return jsonb_build_object('ok', false, 'error', 'transferencia_nao_encontrada');
  end if;
  if v_transferencia.status <> 'pendente' then
    return jsonb_build_object('ok', false, 'error', 'transferencia_ja_decidida');
  end if;

  select c.nome
    into v_destino_nome
    from public.corretores c
   where c.id = v_transferencia.para_corretor_id
     and coalesce(c.ativo, true);
  if v_destino_nome is null then
    return jsonb_build_object('ok', false, 'error', 'corretor_destino_indisponivel');
  end if;

  update public.negocios n
     set corretor_id = v_transferencia.para_corretor_id,
         transferencia_para = null,
         transferencia_status = 'aceito',
         ultima_movimentacao = now()
   where n.id = v_transferencia.negocio_id
     and n.lead_id = v_transferencia.lead_id
     and n.status = 'aberto'
     and n.corretor_id is not distinct from v_transferencia.de_corretor_id;

  if not found then
    update public.crm_transferencias
       set status = 'cancelada', decidida_por = p_ator, decidida_em = now()
     where id = v_transferencia.id;
    return jsonb_build_object('ok', false, 'error', 'dono_ou_estado_alterado');
  end if;

  update public.leads
     set corretor_id = v_transferencia.para_corretor_id,
         atualizado_em = now()
   where id = v_transferencia.lead_id;

  update public.f2_lead
     set corretor_id = v_transferencia.para_corretor_id,
         corretor_nome = v_destino_nome,
         atualizado_em = now()
   where origem_negocio_id = v_transferencia.negocio_id;

  update public.crm_transferencias
     set status = 'aplicada',
         decidida_por = p_ator,
         decidida_em = now(),
         aplicada_em = now()
   where id = v_transferencia.id;

  return jsonb_build_object(
    'ok', true,
    'transferencia_id', v_transferencia.id,
    'negocio', v_transferencia.negocio_id,
    'lead', v_transferencia.lead_id,
    'corretor', v_transferencia.para_corretor_id
  );
end;
$$;

create or replace function public.crm_solicitar_transferencia(
  p_negocio_id bigint,
  p_corretor_id bigint,
  p_tipo text,
  p_motivo text,
  p_fit_comercial text default null
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_usuario uuid := auth.uid();
  v_corretor_atual bigint;
  v_negocio public.negocios%rowtype;
  v_transferencia_id bigint;
  v_tipo text := lower(trim(coalesce(p_tipo, '')));
  v_motivo text := trim(coalesce(p_motivo, ''));
  v_fit text := nullif(trim(coalesce(p_fit_comercial, '')), '');
begin
  if v_usuario is null then
    return jsonb_build_object('ok', false, 'error', 'sem_sessao');
  end if;
  v_corretor_atual := public.current_broker_id();
  if v_corretor_atual is null then
    return jsonb_build_object('ok', false, 'error', 'corretor_atual_nao_encontrado');
  end if;
  if v_tipo not in ('voluntaria', 'fit_comercial') then
    return jsonb_build_object('ok', false, 'error', 'tipo_invalido');
  end if;
  if char_length(v_motivo) not between 3 and 500 then
    return jsonb_build_object('ok', false, 'error', 'motivo_invalido');
  end if;
  if v_tipo = 'fit_comercial' and char_length(coalesce(v_fit, '')) not between 3 and 500 then
    return jsonb_build_object('ok', false, 'error', 'fit_invalido');
  end if;
  if p_corretor_id is null or p_corretor_id = v_corretor_atual or not exists (
    select 1 from public.corretores c
     where c.id = p_corretor_id and coalesce(c.ativo, true)
  ) then
    return jsonb_build_object('ok', false, 'error', 'corretor_destino_indisponivel');
  end if;

  select * into v_negocio
    from public.negocios
   where id = p_negocio_id
   for update;
  if v_negocio.id is null or v_negocio.status <> 'aberto' then
    return jsonb_build_object('ok', false, 'error', 'negocio_indisponivel');
  end if;
  if v_negocio.corretor_id is distinct from v_corretor_atual then
    return jsonb_build_object('ok', false, 'error', 'nao_e_dono_do_negocio');
  end if;
  if exists (
    select 1 from public.crm_transferencias t
     where t.negocio_id = v_negocio.id and t.status = 'pendente'
  ) then
    return jsonb_build_object('ok', false, 'error', 'transferencia_pendente');
  end if;

  insert into public.crm_transferencias (
    negocio_id, lead_id, de_corretor_id, para_corretor_id,
    tipo, motivo, fit_comercial, status, solicitada_por
  ) values (
    v_negocio.id, v_negocio.lead_id, v_negocio.corretor_id, p_corretor_id,
    v_tipo, v_motivo, v_fit, 'pendente', v_usuario
  ) returning id into v_transferencia_id;

  update public.negocios
     set transferencia_para = p_corretor_id,
         transferencia_status = 'pendente',
         ultima_movimentacao = now()
   where id = v_negocio.id;

  return jsonb_build_object(
    'ok', true,
    'transferencia_id', v_transferencia_id,
    'status', 'pendente'
  );
end;
$$;

create or replace function public.crm_transferir_gestao(
  p_negocio_id bigint,
  p_corretor_id bigint,
  p_tipo text,
  p_motivo text,
  p_fit_comercial text default null
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_usuario uuid := auth.uid();
  v_negocio public.negocios%rowtype;
  v_transferencia_id bigint;
  v_tipo text := lower(trim(coalesce(p_tipo, '')));
  v_motivo text := trim(coalesce(p_motivo, ''));
  v_fit text := nullif(trim(coalesce(p_fit_comercial, '')), '');
begin
  if v_usuario is null then
    return jsonb_build_object('ok', false, 'error', 'sem_sessao');
  end if;
  if v_tipo not in ('gestao', 'fit_comercial') then
    return jsonb_build_object('ok', false, 'error', 'tipo_invalido');
  end if;
  if char_length(v_motivo) not between 3 and 500 then
    return jsonb_build_object('ok', false, 'error', 'motivo_invalido');
  end if;
  if v_tipo = 'fit_comercial' and char_length(coalesce(v_fit, '')) not between 3 and 500 then
    return jsonb_build_object('ok', false, 'error', 'fit_invalido');
  end if;

  select * into v_negocio
    from public.negocios
   where id = p_negocio_id
   for update;
  if v_negocio.id is null or v_negocio.status <> 'aberto' then
    return jsonb_build_object('ok', false, 'error', 'negocio_indisponivel');
  end if;
  if not (
    coalesce(public.papel_no_grupo('gestao'), false)
    and (
      coalesce(public.can_manage_all(), false)
      or coalesce(public.manages_broker(v_negocio.corretor_id), false)
      or public.current_broker_id() = v_negocio.corretor_id
    )
  ) then
    return jsonb_build_object('ok', false, 'error', 'sem_permissao');
  end if;
  if p_corretor_id is null or p_corretor_id = v_negocio.corretor_id or not exists (
    select 1 from public.corretores c
     where c.id = p_corretor_id and coalesce(c.ativo, true)
  ) then
    return jsonb_build_object('ok', false, 'error', 'corretor_destino_indisponivel');
  end if;
  if exists (
    select 1 from public.crm_transferencias t
     where t.negocio_id = v_negocio.id and t.status = 'pendente'
  ) then
    return jsonb_build_object('ok', false, 'error', 'transferencia_pendente');
  end if;

  insert into public.crm_transferencias (
    negocio_id, lead_id, de_corretor_id, para_corretor_id,
    tipo, motivo, fit_comercial, status, solicitada_por
  ) values (
    v_negocio.id, v_negocio.lead_id, v_negocio.corretor_id, p_corretor_id,
    v_tipo, v_motivo, v_fit, 'pendente', v_usuario
  ) returning id into v_transferencia_id;

  return ncrm_private.crm_transferencia_aplicar(v_transferencia_id, v_usuario);
end;
$$;

create or replace function public.crm_aceitar_transferencia(
  p_transferencia_id bigint,
  p_aceitar boolean
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_usuario uuid := auth.uid();
  v_corretor_atual bigint;
  v_transferencia public.crm_transferencias%rowtype;
begin
  if v_usuario is null then
    return jsonb_build_object('ok', false, 'error', 'sem_sessao');
  end if;
  v_corretor_atual := public.current_broker_id();
  if v_corretor_atual is null then
    return jsonb_build_object('ok', false, 'error', 'corretor_atual_nao_encontrado');
  end if;

  select * into v_transferencia
    from public.crm_transferencias
   where id = p_transferencia_id
   for update;
  if v_transferencia.id is null or v_transferencia.status <> 'pendente' then
    return jsonb_build_object('ok', false, 'error', 'transferencia_indisponivel');
  end if;
  if v_transferencia.para_corretor_id <> v_corretor_atual then
    return jsonb_build_object('ok', false, 'error', 'nao_e_o_destino');
  end if;

  if not coalesce(p_aceitar, false) then
    update public.crm_transferencias
       set status = 'recusada', decidida_por = v_usuario, decidida_em = now()
     where id = v_transferencia.id;
    update public.negocios
       set transferencia_para = null,
           transferencia_status = 'recusado',
           ultima_movimentacao = now()
     where id = v_transferencia.negocio_id
       and transferencia_para = v_transferencia.para_corretor_id
       and transferencia_status = 'pendente';
    return jsonb_build_object('ok', true, 'status', 'recusada');
  end if;

  return ncrm_private.crm_transferencia_aplicar(v_transferencia.id, v_usuario);
end;
$$;

create or replace function public.crm_transferencias_pendentes()
returns table (
  id bigint,
  negocio_id bigint,
  lead_id bigint,
  cliente text,
  corretor_origem text,
  tipo text,
  motivo text,
  fit_comercial text,
  criado_em timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select t.id, t.negocio_id, t.lead_id, l.nome, c.nome,
         t.tipo, t.motivo, t.fit_comercial, t.criado_em
    from public.crm_transferencias t
    join public.leads l on l.id = t.lead_id
    left join public.corretores c on c.id = t.de_corretor_id
   where t.status = 'pendente'
     and t.para_corretor_id = public.current_broker_id()
   order by t.criado_em;
$$;

-- Compatibilidade segura para clientes antigos. Os wrappers passam pelas mesmas
-- guardas; o frontend novo sempre envia motivo e fit explícitos.
create or replace function public.transferir_com_aceite(p_negocio bigint, p_corretor bigint)
returns jsonb
language sql
security definer
set search_path = ''
as $$
  select public.crm_solicitar_transferencia(
    p_negocio, p_corretor, 'voluntaria',
    'Transferência solicitada pelo fluxo legado.', null
  );
$$;

create or replace function public.transferir_negocio(p_negocio_id bigint, p_corretor_id bigint)
returns jsonb
language sql
security definer
set search_path = ''
as $$
  select public.crm_transferir_gestao(
    p_negocio_id, p_corretor_id, 'gestao',
    'Transferência direta solicitada pelo fluxo legado.', null
  );
$$;

create or replace function public.aceitar_transferencia(p_negocio bigint)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_transferencia_id bigint;
begin
  select t.id into v_transferencia_id
    from public.crm_transferencias t
   where t.negocio_id = p_negocio
     and t.para_corretor_id = public.current_broker_id()
     and t.status = 'pendente'
   order by t.criado_em desc
   limit 1;
  if v_transferencia_id is null then
    return jsonb_build_object('ok', false, 'error', 'transferencia_indisponivel');
  end if;
  return public.crm_aceitar_transferencia(v_transferencia_id, true);
end;
$$;

create or replace function public.listar_corretores_transferencia()
returns table(id bigint, nome text, online boolean)
language sql
stable
security definer
set search_path = ''
as $$
  select c.id, c.nome, coalesce(c.online, false)
    from public.corretores c
   where coalesce(c.ativo, true)
     and auth.uid() is not null
   order by c.nome;
$$;

revoke all on function ncrm_private.crm_transferencia_aplicar(bigint, uuid) from public, anon, authenticated;
grant execute on function ncrm_private.crm_transferencia_aplicar(bigint, uuid) to service_role;

revoke all on function public.crm_solicitar_transferencia(bigint, bigint, text, text, text) from public, anon;
revoke all on function public.crm_transferir_gestao(bigint, bigint, text, text, text) from public, anon;
revoke all on function public.crm_aceitar_transferencia(bigint, boolean) from public, anon;
revoke all on function public.crm_transferencias_pendentes() from public, anon;
revoke all on function public.transferir_com_aceite(bigint, bigint) from public, anon;
revoke all on function public.transferir_negocio(bigint, bigint) from public, anon;
revoke all on function public.aceitar_transferencia(bigint) from public, anon;
revoke all on function public.listar_corretores_transferencia() from public, anon;

grant execute on function public.crm_solicitar_transferencia(bigint, bigint, text, text, text) to authenticated, service_role;
grant execute on function public.crm_transferir_gestao(bigint, bigint, text, text, text) to authenticated, service_role;
grant execute on function public.crm_aceitar_transferencia(bigint, boolean) to authenticated, service_role;
grant execute on function public.crm_transferencias_pendentes() to authenticated, service_role;
grant execute on function public.transferir_com_aceite(bigint, bigint) to authenticated, service_role;
grant execute on function public.transferir_negocio(bigint, bigint) to authenticated, service_role;
grant execute on function public.aceitar_transferencia(bigint) to authenticated, service_role;
grant execute on function public.listar_corretores_transferencia() to authenticated, service_role;

do $$
begin
  if has_function_privilege('anon', 'public.crm_solicitar_transferencia(bigint,bigint,text,text,text)', 'execute')
     or has_function_privilege('anon', 'public.crm_transferir_gestao(bigint,bigint,text,text,text)', 'execute')
     or has_function_privilege('anon', 'public.crm_aceitar_transferencia(bigint,boolean)', 'execute')
     or has_function_privilege('anon', 'public.transferir_negocio(bigint,bigint)', 'execute') then
    raise exception 'RPC de transferência ainda exposta a anon';
  end if;
end;
$$;
