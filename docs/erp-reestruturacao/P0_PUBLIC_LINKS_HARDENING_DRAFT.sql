-- DRAFT NÃO APLICADO — P0: links públicos de agenda e financiamento.
--
-- Fase A aditiva e reversível. Mantém as RPCs legadas durante o canário,
-- cria contratos V2 service-only, guarda somente hash para novos links,
-- adiciona expiração/revogação, uso único da ficha, rate limit persistente e
-- auditoria sanitizada. Executar primeiro em Supabase/Postgres isolado.
--
-- O código do ERP só usa V2 quando PUBLIC_LINK_HARDENING_ENABLED=true. A ordem
-- segura é: ensaio isolado -> aplicar Fase A -> configurar pepper -> publicar
-- código -> ativar flag -> validar -> executar Fase B em migration separada.

begin;

alter table public.agenda_share
  alter column token drop not null,
  add column if not exists token_hash text,
  add column if not exists token_expira_em timestamptz,
  add column if not exists token_revogado_em timestamptz,
  add column if not exists expor_cliente boolean not null default false,
  add column if not exists expor_local boolean not null default false;

alter table public.financiamento_fichas
  add column if not exists link_token_hash text,
  add column if not exists link_expira_em timestamptz,
  add column if not exists link_revogada_em timestamptz;

-- Compatibilidade temporária: links existentes recebem hash e sete dias de
-- graça. O texto só é removido na Fase B, depois de o canário V2 ser provado.
update public.agenda_share
   set token_hash = encode(extensions.digest(token, 'sha256'), 'hex'),
       token_expira_em = coalesce(token_expira_em, now() + interval '7 days')
 where token is not null
   and token <> ''
   and token_hash is null;

update public.financiamento_fichas
   set link_token_hash = encode(extensions.digest(link_token, 'sha256'), 'hex'),
       link_expira_em = coalesce(link_expira_em, now() + interval '7 days')
 where link_token is not null
   and link_token <> ''
   and link_token_hash is null;

create unique index if not exists uq_agenda_share_token_hash
  on public.agenda_share(token_hash)
  where token_hash is not null;

create unique index if not exists uq_financiamento_fichas_link_token_hash
  on public.financiamento_fichas(link_token_hash)
  where link_token_hash is not null;

create table if not exists public.public_link_rate_limits (
  scope text not null,
  subject_hash text not null,
  window_started_at timestamptz not null,
  request_count integer not null default 0 check (request_count >= 0),
  last_seen_at timestamptz not null default now(),
  primary key (scope, subject_hash),
  check (scope in ('agenda:read', 'financing:read', 'financing:write')),
  check (subject_hash ~ '^(client|token):[a-f0-9]{64}$')
);

create table if not exists public.public_link_audit (
  id bigint generated always as identity primary key,
  scope text not null,
  resource_type text,
  resource_id text,
  token_fingerprint text not null,
  client_fingerprint text not null,
  outcome text not null,
  detail jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  check (scope in ('agenda:read', 'financing:read', 'financing:write')),
  check (token_fingerprint ~ '^[a-f0-9]{64}$'),
  check (client_fingerprint ~ '^[a-f0-9]{64}$'),
  check (outcome in ('ok', 'invalid', 'expired', 'revoked', 'already_used', 'rejected'))
);

create index if not exists ix_public_link_audit_created
  on public.public_link_audit(created_at desc);
create index if not exists ix_public_link_audit_resource
  on public.public_link_audit(resource_type, resource_id, created_at desc);

alter table public.public_link_rate_limits enable row level security;
alter table public.public_link_audit enable row level security;
revoke all on table public.public_link_rate_limits from public, anon, authenticated;
revoke all on table public.public_link_audit from public, anon, authenticated;
revoke all on sequence public.public_link_audit_id_seq from public, anon, authenticated;
grant select, insert, update, delete on table public.public_link_rate_limits to service_role;
grant select, insert on table public.public_link_audit to service_role;
grant usage, select on sequence public.public_link_audit_id_seq to service_role;

create or replace function public.public_link_rate_consume(
  p_scope text,
  p_token_fingerprint text,
  p_client_fingerprint text
) returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $function$
declare
  v_now timestamptz := clock_timestamp();
  v_window interval;
  v_client_limit integer;
  v_token_limit integer;
  v_client_count integer;
  v_token_count integer;
  v_client_started timestamptz;
  v_token_started timestamptz;
  v_retry integer;
begin
  if p_scope not in ('agenda:read', 'financing:read', 'financing:write')
     or p_token_fingerprint !~ '^[a-f0-9]{64}$'
     or p_client_fingerprint !~ '^[a-f0-9]{64}$' then
    raise exception 'public_link_rate_invalid_input';
  end if;

  if p_scope = 'financing:write' then
    v_window := interval '15 minutes';
    v_client_limit := 6;
    v_token_limit := 15;
  elsif p_scope = 'financing:read' then
    v_window := interval '5 minutes';
    v_client_limit := 60;
    v_token_limit := 180;
  else
    v_window := interval '5 minutes';
    v_client_limit := 120;
    v_token_limit := 600;
  end if;

  insert into public.public_link_rate_limits(
    scope, subject_hash, window_started_at, request_count, last_seen_at
  ) values (
    p_scope, 'client:' || p_client_fingerprint, v_now, 1, v_now
  )
  on conflict (scope, subject_hash) do update set
    window_started_at = case
      when public.public_link_rate_limits.window_started_at + v_window <= v_now then v_now
      else public.public_link_rate_limits.window_started_at end,
    request_count = case
      when public.public_link_rate_limits.window_started_at + v_window <= v_now then 1
      else public.public_link_rate_limits.request_count + 1 end,
    last_seen_at = v_now
  returning request_count, window_started_at into v_client_count, v_client_started;

  insert into public.public_link_rate_limits(
    scope, subject_hash, window_started_at, request_count, last_seen_at
  ) values (
    p_scope, 'token:' || p_token_fingerprint, v_now, 1, v_now
  )
  on conflict (scope, subject_hash) do update set
    window_started_at = case
      when public.public_link_rate_limits.window_started_at + v_window <= v_now then v_now
      else public.public_link_rate_limits.window_started_at end,
    request_count = case
      when public.public_link_rate_limits.window_started_at + v_window <= v_now then 1
      else public.public_link_rate_limits.request_count + 1 end,
    last_seen_at = v_now
  returning request_count, window_started_at into v_token_count, v_token_started;

  if v_client_count > v_client_limit or v_token_count > v_token_limit then
    v_retry := greatest(
      1,
      case when v_client_count > v_client_limit
        then ceil(extract(epoch from v_client_started + v_window - v_now))::integer
        else 0 end,
      case when v_token_count > v_token_limit
        then ceil(extract(epoch from v_token_started + v_window - v_now))::integer
        else 0 end
    );
    return jsonb_build_object('allowed', false, 'retry_after_seconds', v_retry);
  end if;

  return jsonb_build_object('allowed', true, 'retry_after_seconds', 0);
end;
$function$;

create or replace function public.agenda_publica_v2(
  p_token text,
  p_de date default null,
  p_ate date default null,
  p_client_fingerprint text default null
) returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $function$
declare
  v_share public.agenda_share%rowtype;
  v_hash text := encode(extensions.digest(coalesce(p_token, ''), 'sha256'), 'hex');
  v_scope constant text := 'agenda:read';
  v_data jsonb;
begin
  if p_token !~ '^[a-f0-9]{40,80}$'
     or p_client_fingerprint !~ '^[a-f0-9]{64}$' then
    return jsonb_build_object('ok', false, 'code', 'INVALID');
  end if;

  select * into v_share
    from public.agenda_share
   where id = 1 and token_hash = v_hash;

  if not found then
    insert into public.public_link_audit(scope, token_fingerprint, client_fingerprint, outcome)
    values (v_scope, v_hash, p_client_fingerprint, 'invalid');
    return jsonb_build_object('ok', false, 'code', 'INVALID');
  elsif v_share.token_revogado_em is not null then
    insert into public.public_link_audit(scope, resource_type, resource_id, token_fingerprint, client_fingerprint, outcome)
    values (v_scope, 'agenda_share', v_share.id::text, v_hash, p_client_fingerprint, 'revoked');
    return jsonb_build_object('ok', false, 'code', 'REVOKED');
  elsif v_share.token_expira_em is null or v_share.token_expira_em <= now() then
    insert into public.public_link_audit(scope, resource_type, resource_id, token_fingerprint, client_fingerprint, outcome)
    values (v_scope, 'agenda_share', v_share.id::text, v_hash, p_client_fingerprint, 'expired');
    return jsonb_build_object('ok', false, 'code', 'EXPIRED');
  end if;

  with lim as (
    select greatest(
      coalesce(p_de, (now() at time zone 'America/Sao_Paulo')::date),
      (now() at time zone 'America/Sao_Paulo')::date - 180
    ) as de,
    least(
      coalesce(p_ate, (now() at time zone 'America/Sao_Paulo')::date + 14),
      (now() at time zone 'America/Sao_Paulo')::date + 180
    ) as ate
  )
  select jsonb_build_object(
    'hoje', to_char((now() at time zone 'America/Sao_Paulo')::date, 'YYYY-MM-DD'),
    'visitas', coalesce((
      select jsonb_agg(jsonb_build_object(
        'dia', to_char(v.data, 'YYYY-MM-DD'),
        'hora', coalesce(to_char(v.hora_inicio, 'HH24:MI'), '--:--'),
        'horaFim', to_char(v.hora_fim, 'HH24:MI'),
        'cliente', case when v_share.expor_cliente
          then left(split_part(trim(coalesce(v.cliente_nome, 'Cliente')), ' ', 1), 40)
          else 'Cliente' end,
        'corretor', coalesce(split_part(trim(c.nome), ' ', 1), '—'),
        'produto', coalesce(nullif(v.produto, ''), e.nome, en.nome, ''),
        'unidade', coalesce(v.unidade, ''),
        'local', case when v_share.expor_local then coalesce(v.local, '') else '' end,
        'status', coalesce(v.status, 'agendada'),
        'comGerente', coalesce(v.com_gerente, false)
      ) order by v.data, v.hora_inicio nulls last)
      from public.visitas v
      left join public.corretores c on c.id = v.corretor_id
      left join public.empreendimentos e on e.id = v.empreendimento_id
      left join public.negocios n on n.id = v.negocio_id
      left join public.empreendimentos en on en.id = n.empreendimento_id, lim
      where v.data between lim.de and lim.ate
        and coalesce(v.status, 'agendada') <> 'cancelada'
    ), '[]'::jsonb)
  ) into v_data;

  insert into public.public_link_audit(
    scope, resource_type, resource_id, token_fingerprint, client_fingerprint, outcome
  ) values (v_scope, 'agenda_share', v_share.id::text, v_hash, p_client_fingerprint, 'ok');
  return jsonb_build_object('ok', true, 'data', v_data);
end;
$function$;

create or replace function public.ficha_publica_obter_v2(
  p_token text,
  p_client_fingerprint text
) returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $function$
declare
  v_f public.financiamento_fichas%rowtype;
  v_hash text := encode(extensions.digest(coalesce(p_token, ''), 'sha256'), 'hex');
  v_scope constant text := 'financing:read';
begin
  if p_token !~ '^[a-f0-9]{30,80}$'
     or p_client_fingerprint !~ '^[a-f0-9]{64}$' then
    return jsonb_build_object('ok', false, 'code', 'INVALID');
  end if;

  select * into v_f
    from public.financiamento_fichas
   where link_token_hash = v_hash;
  if not found then
    insert into public.public_link_audit(scope, token_fingerprint, client_fingerprint, outcome)
    values (v_scope, v_hash, p_client_fingerprint, 'invalid');
    return jsonb_build_object('ok', false, 'code', 'INVALID');
  elsif v_f.link_revogada_em is not null then
    insert into public.public_link_audit(scope, resource_type, resource_id, token_fingerprint, client_fingerprint, outcome)
    values (v_scope, 'financiamento_fichas', v_f.id::text, v_hash, p_client_fingerprint, 'revoked');
    return jsonb_build_object('ok', false, 'code', 'REVOKED');
  elsif v_f.link_expira_em is null or v_f.link_expira_em <= now() then
    insert into public.public_link_audit(scope, resource_type, resource_id, token_fingerprint, client_fingerprint, outcome)
    values (v_scope, 'financiamento_fichas', v_f.id::text, v_hash, p_client_fingerprint, 'expired');
    return jsonb_build_object('ok', false, 'code', 'EXPIRED');
  elsif v_f.preenchida_em is not null then
    insert into public.public_link_audit(scope, resource_type, resource_id, token_fingerprint, client_fingerprint, outcome)
    values (v_scope, 'financiamento_fichas', v_f.id::text, v_hash, p_client_fingerprint, 'already_used');
    return jsonb_build_object('ok', false, 'code', 'ALREADY_USED');
  end if;

  update public.financiamento_fichas
     set aberta_em = coalesce(aberta_em, now()), atualizado_em = now()
   where id = v_f.id;
  insert into public.public_link_audit(scope, resource_type, resource_id, token_fingerprint, client_fingerprint, outcome)
  values (v_scope, 'financiamento_fichas', v_f.id::text, v_hash, p_client_fingerprint, 'ok');

  -- Não devolve nome, telefone nem e-mail já armazenados. Um link vazado não
  -- pode ser usado para consultar PII preexistente.
  return jsonb_build_object('ok', true, 'data', jsonb_build_object(
    'comprador_nome', null,
    'telefone', null,
    'email', null,
    'status', v_f.status,
    'produto', v_f.produto,
    'valor_imovel', v_f.valor_imovel,
    'corretor_nome', (
      select split_part(trim(c.nome), ' ', 1)
        from public.corretores c where c.id = v_f.corretor_id
    )
  ));
end;
$function$;

create or replace function public.ficha_publica_enviar_v2(
  p_token text,
  p_dados jsonb,
  p_client_fingerprint text
) returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $function$
declare
  v_f public.financiamento_fichas%rowtype;
  v_hash text := encode(extensions.digest(coalesce(p_token, ''), 'sha256'), 'hex');
  v_scope constant text := 'financing:write';
  v_nome text := left(trim(coalesce(p_dados->>'comprador_nome', '')), 160);
  v_telefone text := left(regexp_replace(coalesce(p_dados->>'telefone', ''), '[^0-9]', '', 'g'), 14);
  v_email text := left(lower(trim(coalesce(p_dados->>'email', ''))), 180);
  v_cpf text := left(regexp_replace(coalesce(p_dados->>'cpf', ''), '[^0-9]', '', 'g'), 11);
  v_nascimento date;
  v_renda numeric;
  v_imovel numeric;
  v_entrada numeric;
  v_financiar numeric;
begin
  if p_token !~ '^[a-f0-9]{30,80}$'
     or p_client_fingerprint !~ '^[a-f0-9]{64}$'
     or p_dados is null
     or jsonb_typeof(p_dados) <> 'object' then
    return jsonb_build_object('ok', false, 'code', 'INVALID', 'error', 'Dados inválidos.');
  end if;

  select * into v_f
    from public.financiamento_fichas
   where link_token_hash = v_hash
   for update;
  if not found then
    insert into public.public_link_audit(scope, token_fingerprint, client_fingerprint, outcome)
    values (v_scope, v_hash, p_client_fingerprint, 'invalid');
    return jsonb_build_object('ok', false, 'code', 'INVALID', 'error', 'Link inválido.');
  elsif v_f.link_revogada_em is not null then
    return jsonb_build_object('ok', false, 'code', 'REVOKED', 'error', 'Link revogado.');
  elsif v_f.link_expira_em is null or v_f.link_expira_em <= now() then
    return jsonb_build_object('ok', false, 'code', 'EXPIRED', 'error', 'Link expirado.');
  elsif v_f.preenchida_em is not null then
    return jsonb_build_object('ok', false, 'code', 'ALREADY_USED', 'error', 'Ficha já enviada.');
  end if;

  begin
    v_nascimento := (p_dados->>'data_nascimento')::date;
    v_renda := (p_dados->>'renda')::numeric;
    v_imovel := (p_dados->>'valor_imovel')::numeric;
    v_entrada := (p_dados->>'valor_entrada')::numeric;
    v_financiar := (p_dados->>'valor_financiar')::numeric;
  exception when invalid_text_representation or datetime_field_overflow then
    return jsonb_build_object('ok', false, 'code', 'INVALID', 'error', 'Confira datas e valores.');
  end;

  if length(v_nome) < 3
     or length(v_telefone) not between 12 and 13
     or v_email !~* '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]{2,}$'
     or length(v_cpf) <> 11
     or v_nascimento is null
     or v_nascimento > current_date - interval '18 years'
     or v_nascimento < current_date - interval '110 years'
     or length(trim(coalesce(p_dados->>'rg', ''))) < 3
     or length(trim(coalesce(p_dados->>'endereco', ''))) < 5
     or length(regexp_replace(coalesce(p_dados->>'cep', ''), '[^0-9]', '', 'g')) <> 8
     or p_dados->>'estado_civil' not in
       ('casado', 'solteiro', 'divorciado', 'uniao_estavel', 'viuvo')
     or coalesce(v_renda, 0) <= 0
     or coalesce(v_imovel, 0) <= 0
     or coalesce(v_entrada, -1) < 0
     or coalesce(v_financiar, -1) < 0
     or coalesce((p_dados->>'consentimento_lgpd')::boolean, false) is not true then
    insert into public.public_link_audit(
      scope, resource_type, resource_id, token_fingerprint, client_fingerprint, outcome,
      detail
    ) values (
      v_scope, 'financiamento_fichas', v_f.id::text, v_hash,
      p_client_fingerprint, 'rejected', '{"reason":"validation"}'::jsonb
    );
    return jsonb_build_object('ok', false, 'code', 'INVALID', 'error', 'Confira os campos obrigatórios.');
  end if;

  update public.financiamento_fichas set
    comprador_nome = v_nome,
    telefone = v_telefone,
    email = v_email,
    data_nascimento = v_nascimento,
    cpf = v_cpf,
    rg = left(trim(coalesce(p_dados->>'rg', '')), 20),
    endereco = left(trim(coalesce(p_dados->>'endereco', '')), 300),
    cep = left(regexp_replace(coalesce(p_dados->>'cep', ''), '[^0-9]', '', 'g'), 8),
    estado_civil = case when p_dados->>'estado_civil' in
      ('casado', 'solteiro', 'divorciado', 'uniao_estavel', 'viuvo')
      then p_dados->>'estado_civil' else null end,
    renda = v_renda,
    valor_imovel = v_imovel,
    valor_entrada = v_entrada,
    valor_financiar = v_financiar,
    conjuge_nome = nullif(left(trim(coalesce(p_dados->>'conjuge_nome', '')), 160), ''),
    conjuge_cpf = nullif(left(regexp_replace(coalesce(p_dados->>'conjuge_cpf', ''), '[^0-9]', '', 'g'), 11), ''),
    conjuge_rg = nullif(left(trim(coalesce(p_dados->>'conjuge_rg', '')), 20), ''),
    conjuge_email = nullif(left(lower(trim(coalesce(p_dados->>'conjuge_email', ''))), 180), ''),
    conjuge_renda = nullif(p_dados->>'conjuge_renda', '')::numeric,
    conjuge_data_nascimento = nullif(p_dados->>'conjuge_data_nascimento', '')::date,
    consentimento_lgpd = true,
    status = 'preenchida',
    preenchida_em = now(),
    atualizado_em = now(),
    link_revogada_em = now()
  where id = v_f.id;

  insert into public.public_link_audit(
    scope, resource_type, resource_id, token_fingerprint, client_fingerprint, outcome
  ) values (v_scope, 'financiamento_fichas', v_f.id::text, v_hash, p_client_fingerprint, 'ok');
  return jsonb_build_object('ok', true);
exception when others then
  return jsonb_build_object('ok', false, 'code', 'FAILED', 'error', 'Não foi possível salvar. Confira os campos e tente de novo.');
end;
$function$;

create or replace function public.agenda_link_regenerar_v2()
returns text
language plpgsql
security definer
set search_path = public, extensions
as $function$
declare
  v_token text;
  v_id integer;
begin
  if not public.can_manage_all() then raise exception 'Apenas administradores.'; end if;
  v_token := encode(extensions.gen_random_bytes(32), 'hex');
  update public.agenda_share set
    token = null,
    token_hash = encode(extensions.digest(v_token, 'sha256'), 'hex'),
    token_expira_em = now() + interval '30 days',
    token_revogado_em = null,
    atualizado_em = now()
  where id = 1
  returning id into v_id;
  if v_id is null then raise exception 'Configuração da agenda não encontrada.'; end if;
  return v_token;
end;
$function$;

create or replace function public.financiamento_link_regenerar_v2(p_ficha_id uuid)
returns text
language plpgsql
security invoker
set search_path = public, extensions
as $function$
declare
  v_token text := encode(extensions.gen_random_bytes(24), 'hex');
  v_id uuid;
begin
  if auth.uid() is null then raise exception 'Sessão obrigatória.'; end if;
  update public.financiamento_fichas set
    link_token = null,
    link_token_hash = encode(extensions.digest(v_token, 'sha256'), 'hex'),
    link_expira_em = now() + interval '14 days',
    link_revogada_em = null,
    atualizado_em = now()
  where id = p_ficha_id
    and preenchida_em is null
  returning id into v_id;
  if v_id is null then raise exception 'Ficha indisponível, já preenchida ou acesso negado.'; end if;
  return v_token;
end;
$function$;

revoke execute on function public.public_link_rate_consume(text,text,text)
  from public, anon, authenticated;
revoke execute on function public.agenda_publica_v2(text,date,date,text)
  from public, anon, authenticated;
revoke execute on function public.ficha_publica_obter_v2(text,text)
  from public, anon, authenticated;
revoke execute on function public.ficha_publica_enviar_v2(text,jsonb,text)
  from public, anon, authenticated;
grant execute on function public.public_link_rate_consume(text,text,text) to service_role;
grant execute on function public.agenda_publica_v2(text,date,date,text) to service_role;
grant execute on function public.ficha_publica_obter_v2(text,text) to service_role;
grant execute on function public.ficha_publica_enviar_v2(text,jsonb,text) to service_role;

revoke execute on function public.agenda_link_regenerar_v2()
  from public, anon;
grant execute on function public.agenda_link_regenerar_v2()
  to authenticated, service_role;
revoke execute on function public.financiamento_link_regenerar_v2(uuid)
  from public, anon;
grant execute on function public.financiamento_link_regenerar_v2(uuid)
  to authenticated, service_role;

do $assert$
declare
  v_fn regprocedure;
begin
  foreach v_fn in array array[
    'public.public_link_rate_consume(text,text,text)'::regprocedure,
    'public.agenda_publica_v2(text,date,date,text)'::regprocedure,
    'public.ficha_publica_obter_v2(text,text)'::regprocedure,
    'public.ficha_publica_enviar_v2(text,jsonb,text)'::regprocedure
  ] loop
    if has_function_privilege('anon', v_fn, 'execute')
       or has_function_privilege('authenticated', v_fn, 'execute')
       or not has_function_privilege('service_role', v_fn, 'execute') then
      raise exception 'Contrato service-only inválido em %', v_fn;
    end if;
  end loop;
end;
$assert$;

commit;

-- FASE B — CUTOVER SEPARADO, SOMENTE APÓS CANÁRIO E ROLLBACK PROVADOS:
-- revoke execute on function public.agenda_publica(text,date,date)
--   from public, anon, authenticated;
-- revoke execute on function public.ficha_publica_obter(text)
--   from public, anon, authenticated;
-- revoke execute on function public.ficha_publica_enviar(text,jsonb)
--   from public, anon, authenticated;
-- update public.agenda_share set token = null where token_hash is not null;
-- update public.financiamento_fichas set link_token = null
--   where link_token_hash is not null;

-- ROLLBACK DA FASE A: manter flag false; remover apenas objetos V2 depois de
-- confirmar que nenhum canário os usa. Não apagar hashes nem auditoria até a
-- reconciliação. Nunca restaurar EXECUTE para PUBLIC como rollback genérico.
