-- Central de Automacoes deterministica — fase 0/1.
--
-- Invariantes introduzidos por esta migration:
--   1. salvar edita apenas mapa_rascunho;
--   2. toda execucao usa uma versao publicada imutavel;
--   3. a fila fixa a versao no instante do enqueue;
--   4. webhook pode enfileirar com idempotencia;
--   5. abordagem bloqueada/falha interrompe a rota;
--   6. funcoes internas do motor deixam de ser RPC publica.

begin;

alter table public.automacoes
  add column if not exists mapa_rascunho jsonb,
  add column if not exists versao_publicada_id bigint;

update public.automacoes
   set mapa_rascunho = mapa
 where mapa_rascunho is null;

do $$
begin
  if not exists (
    select 1 from pg_constraint
     where conrelid = 'public.automacao_versoes'::regclass
       and conname = 'automacao_versoes_automacao_versao_key'
  ) then
    alter table public.automacao_versoes
      add constraint automacao_versoes_automacao_versao_key
      unique (automacao_id, versao);
  end if;
end $$;

-- Congela o mapa atual como ponto de partida. Nao reutiliza uma versao antiga
-- so porque tem o mesmo numero: o mapa atual de producao e a fonte do bootstrap.
do $$
declare
  r record;
  v_versao integer;
  v_id bigint;
begin
  for r in
    select id, nome, mapa
      from public.automacoes
     where mapa is not null
     order by id
  loop
    select av.id into v_id
      from public.automacao_versoes av
     where av.automacao_id = r.id
       and av.mapa = r.mapa
     order by av.versao desc
     limit 1;

    if v_id is null then
      select coalesce(max(av.versao), 0) + 1
        into v_versao
        from public.automacao_versoes av
       where av.automacao_id = r.id;

      insert into public.automacao_versoes(
        automacao_id, versao, nome, mapa, observacao, criado_por
      ) values (
        r.id, v_versao, r.nome, r.mapa,
        'Bootstrap da versao executavel deterministica', 'migration'
      ) returning id into v_id;
    end if;

    update public.automacoes
       set versao_publicada_id = v_id
     where id = r.id;
  end loop;
end $$;

-- Toda entrada HTTP publicada passa a ter autenticacao obrigatoria. O token
-- existente e preservado; so e gerado quando ausente ou fora do formato.
update public.automacoes a
   set webhook_token=case
         when coalesce(a.webhook_token,'') ~ '^[a-f0-9]{48}$' then a.webhook_token
         else encode(extensions.gen_random_bytes(24),'hex')
       end,
       webhook_token_enforced=true,
       webhook_token_updated_at=case
         when coalesce(a.webhook_token,'') ~ '^[a-f0-9]{48}$' then a.webhook_token_updated_at
         else now()
       end
  from public.automacao_versoes av
 where av.id=a.versao_publicada_id
   and exists (
     select 1
       from jsonb_array_elements(av.mapa->'automation'->'blocks') b,
            lateral jsonb_array_elements(coalesce(b->'options'->'triggers','[]'::jsonb)) t
      where t->>'name'='json-http-request-trigger'
   );

do $$
begin
  if not exists (
    select 1 from pg_constraint
     where conrelid = 'public.automacoes'::regclass
       and conname = 'automacoes_versao_publicada_fk'
  ) then
    alter table public.automacoes
      add constraint automacoes_versao_publicada_fk
      foreign key (versao_publicada_id)
      references public.automacao_versoes(id)
      on delete restrict;
  end if;
end $$;

create or replace function public.automacao_mapa_executavel(
  p_automacao_id bigint,
  p_versao_id bigint default null
) returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select av.mapa
    from public.automacoes a
    join public.automacao_versoes av
      on av.id = coalesce(p_versao_id, a.versao_publicada_id)
     and av.automacao_id = a.id
   where a.id = p_automacao_id
     and a.status = 'publicado'
     and a.ativa is true
     and coalesce(a.arquivada, false) is false
   limit 1;
$$;

revoke all on function public.automacao_mapa_executavel(bigint,bigint)
  from public, anon, authenticated;
grant execute on function public.automacao_mapa_executavel(bigint,bigint)
  to service_role;

create or replace function public.motor_contextualizar_lead(
  p_automacao_id bigint,
  p_lead jsonb
) returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_versao_id bigint;
begin
  begin
    v_versao_id := nullif(p_lead->>'__automacao_versao_id', '')::bigint;
  exception when others then
    v_versao_id := null;
  end;

  if v_versao_id is not null and not exists (
    select 1
      from public.automacao_versoes av
     where av.id = v_versao_id
       and av.automacao_id = p_automacao_id
  ) then
    v_versao_id := null;
  end if;

  if v_versao_id is null then
    select a.versao_publicada_id
      into v_versao_id
      from public.automacoes a
     where a.id = p_automacao_id;
  end if;

  if v_versao_id is null then
    raise exception using
      errcode = 'P0001',
      message = 'AUTOMATION_VERSION_MISSING: publique uma versao antes de executar';
  end if;

  return (coalesce(p_lead, '{}'::jsonb) - '__automacao_versao_id')
    || jsonb_build_object('__automacao_versao_id', v_versao_id);
end;
$$;

revoke all on function public.motor_contextualizar_lead(bigint,jsonb)
  from public, anon, authenticated;
grant execute on function public.motor_contextualizar_lead(bigint,jsonb)
  to service_role;

alter table public.motor_fila
  add column if not exists automacao_versao_id bigint,
  add column if not exists tentativas integer not null default 0,
  add column if not exists ultimo_erro text;

do $$
begin
  if not exists (
    select 1 from pg_constraint
     where conrelid = 'public.motor_fila'::regclass
       and conname = 'motor_fila_automacao_versao_fk'
  ) then
    alter table public.motor_fila
      add constraint motor_fila_automacao_versao_fk
      foreign key (automacao_versao_id)
      references public.automacao_versoes(id)
      on delete restrict;
  end if;
end $$;

create or replace function public.motor_fila_fixar_versao()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_contexto jsonb;
begin
  v_contexto := public.motor_contextualizar_lead(new.automacao_id, new.lead);
  new.automacao_versao_id := (v_contexto->>'__automacao_versao_id')::bigint;
  new.lead := v_contexto;
  return new;
end;
$$;

drop trigger if exists trg_motor_fila_fixar_versao on public.motor_fila;
create trigger trg_motor_fila_fixar_versao
before insert on public.motor_fila
for each row execute function public.motor_fila_fixar_versao();

update public.motor_fila f
   set automacao_versao_id = a.versao_publicada_id,
       lead = (f.lead - '__automacao_versao_id')
              || jsonb_build_object('__automacao_versao_id', a.versao_publicada_id)
  from public.automacoes a
 where a.id = f.automacao_id
   and f.automacao_versao_id is null
   and a.versao_publicada_id is not null;

create table if not exists public.automacao_eventos_entrada (
  id bigint generated by default as identity primary key,
  automacao_id bigint not null references public.automacoes(id) on delete cascade,
  idempotency_key text not null,
  payload_hash text not null,
  fila_id bigint references public.motor_fila(id) on delete set null,
  criado_em timestamptz not null default now(),
  unique (automacao_id, idempotency_key)
);

alter table public.automacao_eventos_entrada enable row level security;
revoke all on table public.automacao_eventos_entrada
  from public, anon, authenticated;
grant select, insert, update on table public.automacao_eventos_entrada
  to service_role;

create or replace function public.motor_enfileirar_idempotente(
  p_auto_id bigint,
  p_lead jsonb,
  p_idempotency_key text
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_key text := left(btrim(coalesce(p_idempotency_key, '')), 240);
  v_hash text := md5(coalesce(p_lead, '{}'::jsonb)::text);
  v_evento_id bigint;
  v_fila_id bigint;
  v_hash_existente text;
begin
  if v_key = '' then
    raise exception using
      errcode = '22023',
      message = 'IDEMPOTENCY_KEY_REQUIRED: informe x-idempotency-key ou um id externo no payload';
  end if;

  insert into public.automacao_eventos_entrada(
    automacao_id, idempotency_key, payload_hash
  ) values (p_auto_id, v_key, v_hash)
  on conflict (automacao_id, idempotency_key) do nothing
  returning id into v_evento_id;

  if v_evento_id is null then
    select e.payload_hash, e.fila_id
      into v_hash_existente, v_fila_id
      from public.automacao_eventos_entrada e
     where e.automacao_id = p_auto_id
       and e.idempotency_key = v_key;

    if v_hash_existente is distinct from v_hash then
      raise exception using
        errcode = '23505',
        message = 'IDEMPOTENCY_CONFLICT: a mesma chave chegou com outro payload';
    end if;

    return jsonb_build_object(
      'ok', true, 'duplicado', true, 'fila_id', v_fila_id
    );
  end if;

  v_fila_id := public.motor_enfileirar(p_auto_id, p_lead);

  update public.automacao_eventos_entrada
     set fila_id = v_fila_id
   where id = v_evento_id;

  return jsonb_build_object(
    'ok', true, 'duplicado', false, 'fila_id', v_fila_id
  );
end;
$$;

revoke all on function public.motor_enfileirar_idempotente(bigint,jsonb,text)
  from public, anon, authenticated;
grant execute on function public.motor_enfileirar_idempotente(bigint,jsonb,text)
  to service_role;

create or replace function public.automacao_validar_mapa(p_mapa jsonb)
returns jsonb
language plpgsql
immutable
set search_path = ''
as $$
declare
  v_blocks jsonb := coalesce(p_mapa->'automation'->'blocks', '[]'::jsonb);
  v_ids text[];
  v_erros jsonb := '[]'::jsonb;
  b jsonb;
  item jsonb;
  ref record;
  v_tipo text;
  v_nome text;
  v_allowed_types constant text[] := array[
    'trigger','field-operation','condition','action','randomizer',
    'distribution-simple','send-approach','time','resposta','ai-agent'
  ];
  v_allowed_triggers constant text[] := array[
    'json-http-request-trigger','initiated-by-another-automation-trigger',
    'manually-lead-trigger','tag-added-trigger','lead-entered-stage-trigger',
    'lead-moved-stage-trigger','lead-distribuido-trigger',
    'lead-mensagem-recebida-trigger','momento-prazo-vencido-trigger',
    'retomar-na-data-trigger','lead-entrou-momento-trigger',
    'checagem-diaria-trigger'
  ];
  v_allowed_actions constant text[] := array[
    'create-lead-action','create-business-action','move-business-action',
    'business-win-action','business-restore-action','business-lose-action',
    'add-attendant-on-business-action','clean-attendant-on-business-action',
    'assign-lead-attendant-action','clean-lead-attendant-action',
    'create-tags-action','add-tag-action','remove-tag-action',
    'set-lead-momento-action','send-notification-action',
    'start-another-automation-action'
  ];
  v_allowed_conditions constant text[] := array[
    'business-has-attendants','business-no-attendants','business-won',
    'business-lost','business-pending','lead-exists',
    'lead-has-business-on-pipeline','lead-has-business-on-stage',
    'lead-email-exists','lead-name-exists','lead-phone-exists',
    'lead-cpf-exists','lead-has-tag','lead-has-attendant',
    'time-day-hour','lead-respondeu','field-equals','field-contains',
    'field-has-value','field-between'
  ];
  v_allowed_waits constant text[] := array[
    'wait-seconds','wait-minutes','wait-hours','wait-days'
  ];
begin
  if jsonb_typeof(v_blocks) is distinct from 'array' or jsonb_array_length(v_blocks) = 0 then
    return jsonb_build_object('ok', false, 'erros', jsonb_build_array('AUTOMATION_EMPTY'));
  end if;

  select array_agg(x->>'id') into v_ids
    from jsonb_array_elements(v_blocks) x;

  if exists (
    select 1 from unnest(v_ids) x group by x having x is null or x = '' or count(*) > 1
  ) then
    v_erros := v_erros || jsonb_build_array('BLOCK_ID_INVALID_OR_DUPLICATED');
  end if;

  if (select count(*) from jsonb_array_elements(v_blocks) x where x->>'type'='trigger') <> 1 then
    v_erros := v_erros || jsonb_build_array('EXACTLY_ONE_TRIGGER_REQUIRED');
  end if;

  for b in select value from jsonb_array_elements(v_blocks)
  loop
    v_tipo := b->>'type';
    if not coalesce(v_tipo = any(v_allowed_types),false) then
      v_erros := v_erros || jsonb_build_array('UNSUPPORTED_BLOCK:'||coalesce(v_tipo,'NULL'));
    end if;

    if v_tipo = 'trigger' then
      if jsonb_array_length(coalesce(b->'options'->'triggers','[]'::jsonb)) <> 1 then
        v_erros := v_erros || jsonb_build_array('EXACTLY_ONE_TRIGGER_CONFIG_REQUIRED:'||(b->>'id'));
      end if;
      for item in select value from jsonb_array_elements(coalesce(b->'options'->'triggers','[]'::jsonb))
      loop
        v_nome := item->>'name';
        if not coalesce(v_nome = any(v_allowed_triggers),false) then
          v_erros := v_erros || jsonb_build_array('UNSUPPORTED_TRIGGER:'||coalesce(v_nome,'NULL'));
        end if;
      end loop;
    elsif v_tipo = 'action' then
      if jsonb_array_length(coalesce(b->'options'->'actions','[]'::jsonb)) = 0 then
        v_erros := v_erros || jsonb_build_array('ACTION_BLOCK_EMPTY:'||(b->>'id'));
      end if;
      for item in select value from jsonb_array_elements(coalesce(b->'options'->'actions','[]'::jsonb))
      loop
        v_nome := item->>'name';
        if not coalesce(v_nome = any(v_allowed_actions),false) then
          v_erros := v_erros || jsonb_build_array('UNSUPPORTED_ACTION:'||coalesce(v_nome,'NULL'));
        end if;
      end loop;
    elsif v_tipo = 'condition' then
      if jsonb_array_length(coalesce(b->'options'->'conditions','[]'::jsonb)) = 0 then
        v_erros := v_erros || jsonb_build_array('CONDITION_BLOCK_EMPTY:'||(b->>'id'));
      end if;
      for item in select value from jsonb_array_elements(coalesce(b->'options'->'conditions','[]'::jsonb))
      loop
        v_nome := replace(item->>'name','-condition','');
        if not coalesce(v_nome = any(v_allowed_conditions),false) then
          v_erros := v_erros || jsonb_build_array('UNSUPPORTED_CONDITION:'||coalesce(v_nome,'NULL'));
        end if;
      end loop;
    elsif v_tipo = 'send-approach' then
      if jsonb_array_length(coalesce(b->'options'->'abordagemIds','[]'::jsonb)) = 0 then
        v_erros := v_erros || jsonb_build_array('APPROACH_REQUIRED:'||(b->>'id'));
      end if;
    elsif v_tipo = 'resposta' then
      if coalesce(nullif(b->'options'->>'janelaValor','')::numeric,0) <= 0 then
        v_erros := v_erros || jsonb_build_array('RESPONSE_WINDOW_REQUIRED:'||(b->>'id'));
      end if;
      if nullif(b->'options'->>'respondeuNextBlockId','') is null
         or nullif(b->'options'->>'naoRespondeuNextBlockId','') is null then
        v_erros := v_erros || jsonb_build_array('RESPONSE_ROUTES_REQUIRED:'||(b->>'id'));
      end if;
    elsif v_tipo = 'time' then
      if not coalesce((b->'options'->>'wait_type') = any(v_allowed_waits),false)
         or coalesce(nullif(b->'options'->>'valor','')::numeric,0) <= 0 then
        v_erros := v_erros || jsonb_build_array('WAIT_CONFIG_INVALID:'||(b->>'id'));
      end if;
    elsif v_tipo = 'ai-agent' then
      if coalesce(nullif(b->'options'->>'agenteId','')::bigint,0) <= 0 then
        v_erros := v_erros || jsonb_build_array('AI_AGENT_REQUIRED:'||(b->>'id'));
      end if;
    elsif v_tipo = 'randomizer' then
      if coalesce((
        select sum(coalesce(nullif(x->>'perc','')::numeric,0))
          from jsonb_array_elements(coalesce(b->'options'->'randomizers','[]'::jsonb)) x
      ),0) <> 100 then
        v_erros := v_erros || jsonb_build_array('RANDOMIZER_MUST_SUM_100:'||(b->>'id'));
      end if;
    end if;

    for ref in
      select key, value #>> '{}' as target
        from jsonb_each(coalesce(b->'options','{}'::jsonb))
       where key ilike '%BlockId'
         and nullif(value #>> '{}','') is not null
    loop
      if not (ref.target = any(v_ids)) then
        v_erros := v_erros || jsonb_build_array(
          'BROKEN_ROUTE:'||(b->>'id')||':'||ref.key||':'||ref.target
        );
      end if;
    end loop;
  end loop;

  return jsonb_build_object(
    'ok', jsonb_array_length(v_erros) = 0,
    'erros', v_erros
  );
exception when others then
  return jsonb_build_object(
    'ok', false,
    'erros', jsonb_build_array('VALIDATION_EXCEPTION:'||sqlerrm)
  );
end;
$$;

revoke all on function public.automacao_validar_mapa(jsonb)
  from public, anon;
grant execute on function public.automacao_validar_mapa(jsonb)
  to authenticated, service_role;

-- Compatibilidade temporaria com o construtor que ainda esta publicado. O
-- cliente antigo inseria a versao e depois fazia outro PATCH; o trigger fixa a
-- versao executavel no mesmo commit e submete o mapa ao mesmo validador.
create or replace function public.automacao_versao_publicada_compat()
returns trigger
language plpgsql
security definer
set search_path=''
as $$
declare
  v_validacao jsonb;
  v_tem_webhook boolean;
  v_token text;
begin
  if new.criado_por is distinct from 'construtor' then
    return new;
  end if;

  v_validacao := public.automacao_validar_mapa(new.mapa);
  if coalesce((v_validacao->>'ok')::boolean,false) is not true then
    raise exception using errcode='22023',
      message='AUTOMATION_INVALID: '||(v_validacao->'erros')::text;
  end if;

  select exists (
    select 1
      from jsonb_array_elements(new.mapa->'automation'->'blocks') b,
           lateral jsonb_array_elements(coalesce(b->'options'->'triggers','[]'::jsonb)) t
     where t->>'name'='json-http-request-trigger'
  ) into v_tem_webhook;

  select a.webhook_token into v_token
    from public.automacoes a where a.id=new.automacao_id;
  if v_tem_webhook and coalesce(v_token,'') !~ '^[a-f0-9]{48}$' then
    v_token := encode(extensions.gen_random_bytes(24),'hex');
  end if;

  update public.automacoes
     set nome=coalesce(nullif(btrim(new.nome),''),nome),
         mapa=new.mapa,
         mapa_rascunho=new.mapa,
         versao_publicada_id=new.id,
         status='publicado',
         publicado_em=now(),
         atualizada_em=now(),
         webhook_token=case when v_tem_webhook then v_token else webhook_token end,
         webhook_token_enforced=case when v_tem_webhook then true else webhook_token_enforced end,
         webhook_token_updated_at=case when v_tem_webhook then now() else webhook_token_updated_at end
   where id=new.automacao_id;
  return new;
end;
$$;

drop trigger if exists trg_automacao_versao_publicada_compat
  on public.automacao_versoes;
create trigger trg_automacao_versao_publicada_compat
after insert on public.automacao_versoes
for each row execute function public.automacao_versao_publicada_compat();

revoke all on function public.automacao_versao_publicada_compat()
  from public, anon, authenticated;

create or replace function public.automacao_publicar(
  p_automacao_id bigint,
  p_nome text,
  p_mapa jsonb
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_validacao jsonb;
  v_versao integer;
  v_versao_id bigint;
  v_tem_webhook boolean;
  v_token text;
begin
  if not public.can_manage_all() then
    raise exception using errcode='42501', message='AUTOMATION_FORBIDDEN';
  end if;

  perform 1 from public.automacoes where id=p_automacao_id for update;
  if not found then
    raise exception using errcode='P0001', message='AUTOMATION_NOT_FOUND';
  end if;

  v_validacao := public.automacao_validar_mapa(p_mapa);
  if coalesce((v_validacao->>'ok')::boolean,false) is not true then
    raise exception using
      errcode='22023',
      message='AUTOMATION_INVALID: '||(v_validacao->'erros')::text;
  end if;

  select coalesce(max(versao),0)+1 into v_versao
    from public.automacao_versoes where automacao_id=p_automacao_id;

  insert into public.automacao_versoes(
    automacao_id,versao,nome,mapa,observacao,criado_por
  ) values (
    p_automacao_id,v_versao,nullif(btrim(p_nome),''),p_mapa,
    'Publicacao atomica pelo construtor',auth.uid()::text
  ) returning id into v_versao_id;

  select exists (
    select 1
      from jsonb_array_elements(p_mapa->'automation'->'blocks') b,
           lateral jsonb_array_elements(coalesce(b->'options'->'triggers','[]'::jsonb)) t
     where t->>'name'='json-http-request-trigger'
  ) into v_tem_webhook;

  select webhook_token into v_token
    from public.automacoes where id=p_automacao_id;
  if v_tem_webhook and coalesce(v_token,'') !~ '^[a-f0-9]{48}$' then
    v_token := encode(extensions.gen_random_bytes(24),'hex');
  end if;

  update public.automacoes
     set nome=coalesce(nullif(btrim(p_nome),''),nome),
         mapa=p_mapa,
         mapa_rascunho=p_mapa,
         versao_publicada_id=v_versao_id,
         status='publicado',
         publicado_em=now(),
         atualizada_em=now(),
         webhook_token=case when v_tem_webhook then v_token else webhook_token end,
         webhook_token_enforced=case when v_tem_webhook then true else webhook_token_enforced end,
         webhook_token_updated_at=case when v_tem_webhook then now() else webhook_token_updated_at end
   where id=p_automacao_id;

  return jsonb_build_object(
    'ok',true,'versao',v_versao,'versao_id',v_versao_id,
    'webhook_token',case when v_tem_webhook then v_token else null end,
    'webhook_token_enforced',v_tem_webhook
  );
end;
$$;

revoke all on function public.automacao_publicar(bigint,text,jsonb)
  from public, anon;
grant execute on function public.automacao_publicar(bigint,text,jsonb)
  to authenticated, service_role;

create or replace function public.motor_abordagem_preflight(
  p_lead_id bigint,
  p_telefone text
) returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_tel text := right(regexp_replace(coalesce(p_telefone,''),'\D','','g'),11);
  v_flag boolean;
  v_optout boolean;
begin
  select mf.ativo into v_flag
    from public.motor_flags mf
   where mf.nome='abordagem_automatica';
  if coalesce(v_flag,false) is not true then
    return jsonb_build_object('ok',false,'status','bloqueado','motivo','envio_automatico_desativado');
  end if;

  if p_lead_id is not null then
    select coalesce(l.disparo_optout,false) into v_optout
      from public.leads l where l.id=p_lead_id;
    if coalesce(v_optout,false) then
      return jsonb_build_object('ok',false,'status','bloqueado','motivo','lead_optout');
    end if;
  end if;

  if exists (
    select 1
      from public.wa_mensagens wm
      join public.wa_conversas wc on wc.id=wm.conversa_id
      join public.wa_contatos ct on ct.id=wc.contato_id
     where coalesce(wm.is_grupo,false) is false
       and (
         (p_lead_id is not null and ct.lead_id=p_lead_id)
         or (v_tel<>'' and right(regexp_replace(coalesce(ct.telefone,''),'\D','','g'),11)=v_tel)
       )
     limit 1
  ) then
    return jsonb_build_object('ok',false,'status','bloqueado','motivo','conversa_existente');
  end if;

  return jsonb_build_object('ok',true,'status','apto');
end;
$$;

revoke all on function public.motor_abordagem_preflight(bigint,text)
  from public, anon, authenticated;
grant execute on function public.motor_abordagem_preflight(bigint,text)
  to service_role;

create or replace function public.motor_enfileirar(p_auto_id bigint, p_lead jsonb)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_ativa boolean;
  v_status text;
  v_arquivada boolean;
  v_id bigint;
  v_lead jsonb;
begin
  select a.ativa,a.status,coalesce(a.arquivada,false)
    into v_ativa,v_status,v_arquivada
    from public.automacoes a where a.id=p_auto_id;
  if not found then
    raise exception using errcode='P0001',message='AUTOMATION_NOT_FOUND: automacao nao encontrada';
  end if;
  if v_ativa is distinct from true or v_status is distinct from 'publicado' or v_arquivada then
    raise exception using errcode='P0001',message='AUTOMATION_NOT_RUNNABLE: publique e ative a automacao antes de executar';
  end if;

  v_lead := public.motor_contextualizar_lead(p_auto_id,p_lead);
  insert into public.motor_fila(automacao_id,bloco_id,lead,due_at,status)
  values(p_auto_id,'START',v_lead,now(),'pendente')
  returning id into v_id;
  return v_id;
end;
$$;

revoke all on function public.motor_enfileirar(bigint,jsonb)
  from public, anon, authenticated;
grant execute on function public.motor_enfileirar(bigint,jsonb)
  to service_role;

create or replace function public.motor_evento_disparar(
  p_trigger text,
  p_lead jsonb,
  p_momento text default null
) returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  a record;
  n integer := 0;
  v_tel text;
begin
  v_tel := right(regexp_replace(coalesce(p_lead->>'telefone',''),'\D','','g'),11);

  for a in
    select au.id,nullif(t->'options'->>'momento','') momento_cfg
      from public.automacoes au,
           lateral jsonb_array_elements(public.automacao_mapa_executavel(au.id,null)->'automation'->'blocks') b,
           lateral jsonb_array_elements(coalesce(b->'options'->'triggers','[]'::jsonb)) t
     where t->>'name'=p_trigger
       and au.ativa is true
       and au.status='publicado'
       and coalesce(au.arquivada,false) is false
  loop
    if a.momento_cfg is not null and a.momento_cfg<>coalesce(p_momento,'') then
      continue;
    end if;
    if exists (
      select 1 from public.motor_fila f
       where f.automacao_id=a.id and f.status='pendente'
         and right(regexp_replace(coalesce(f.lead->>'telefone',''),'\D','','g'),11)=v_tel
    ) then continue; end if;
    if v_tel<>'' and exists (
      select 1 from public.motor_execucoes me
       where me.automacao_id=a.id and me.evento='entrada'
         and right(regexp_replace(coalesce(me.lead_telefone,''),'\D','','g'),11)=v_tel
         and me.criado_em>now()-interval '60 seconds'
    ) then continue; end if;

    perform public.motor_enfileirar(a.id,p_lead);
    n:=n+1;
  end loop;
  return n;
end;
$$;

revoke all on function public.motor_evento_disparar(text,jsonb,text)
  from public, anon, authenticated;
grant execute on function public.motor_evento_disparar(text,jsonb,text)
  to service_role;

create or replace function public.motor_rodar(
  p_auto_id bigint,
  p_lead jsonb,
  p_start_block text default null,
  p_depth integer default 0
) returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_ativa boolean;
  v_status text;
  v_arquivada boolean;
  v_tel text;
  v_nome text;
  v_trigger text;
  v_lead jsonb;
  v_mapa jsonb;
begin
  select a.ativa,a.status,coalesce(a.arquivada,false),a.nome
    into v_ativa,v_status,v_arquivada,v_nome
    from public.automacoes a where a.id=p_auto_id;
  if not found then
    raise exception using errcode='P0001',message='AUTOMATION_NOT_FOUND: automacao nao encontrada';
  end if;
  if v_ativa is distinct from true or v_status is distinct from 'publicado' or v_arquivada then
    raise exception using errcode='P0001',message='AUTOMATION_NOT_RUNNABLE: publique e ative a automacao antes de executar';
  end if;
  if coalesce(auth.jwt()->>'role','')='authenticated' then
    raise exception using errcode='0A000',message='AUTOMATION_SIMULATION_DISABLED: simulacao real foi desativada';
  end if;

  v_lead := public.motor_contextualizar_lead(p_auto_id,p_lead);
  v_mapa := public.automacao_mapa_executavel(
    p_auto_id,(v_lead->>'__automacao_versao_id')::bigint
  );
  if v_mapa is null then
    raise exception using errcode='P0001',message='AUTOMATION_VERSION_NOT_RUNNABLE';
  end if;
  select elem->>'id' into v_trigger
    from jsonb_array_elements(v_mapa->'automation'->'blocks') e(elem)
   where elem->>'type'='trigger' limit 1;

  v_tel := right(regexp_replace(coalesce(v_lead->>'telefone',''),'\D','','g'),11);
  if v_tel<>'' then perform pg_advisory_xact_lock(hashtext('motor_lead_'||v_tel)); end if;

  if p_start_block is null and v_tel<>'' and exists (
    select 1 from public.motor_execucoes me
     where me.automacao_id=p_auto_id and me.evento='entrada' and me.status='ok'
       and right(regexp_replace(coalesce(me.lead_telefone,''),'\D','','g'),11)=v_tel
       and me.criado_em>now()-interval '15 seconds'
  ) then
    insert into public.motor_execucoes(
      automacao_id,automacao_nome,bloco_id,evento,status,lead_nome,lead_telefone,detalhe
    ) values (
      p_auto_id,v_nome,v_trigger,'entrada','alerta',v_lead->>'nome',v_tel,
      'Webhook duplicado ignorado (mesmo telefone em menos de 15s)'
    );
    return 'Duplicata de webhook ignorada (15s) - nada executado.';
  end if;

  return public.motor_rodar_unchecked(p_auto_id,v_lead,p_start_block,p_depth);
end;
$$;

revoke all on function public.motor_rodar(bigint,jsonb,text,integer)
  from public, anon;
grant execute on function public.motor_rodar(bigint,jsonb,text,integer)
  to authenticated, service_role;

-- motor_rodar_unchecked ainda e legado e grande. Esta fase faz duas mudancas
-- cirurgicas com checksum e pos-condicao: carregar snapshot publicado e parar
-- a rota de abordagem quando preflight/envio nao produzir sucesso.
do $migration$
declare
  v_def text;
  v_new text;
begin
  select pg_get_functiondef(p.oid) into v_def
    from pg_proc p join pg_namespace n on n.oid=p.pronamespace
   where n.nspname='public' and p.proname='motor_rodar_unchecked'
     and pg_get_function_identity_arguments(p.oid)='p_auto_id bigint, p_lead jsonb, p_start_block text, p_depth integer';

  if v_def is null then raise exception 'motor_rodar_unchecked ausente'; end if;
  if md5(v_def)<>'6d4de47b7bd622ca383c3d6afef3f5e7' then
    raise exception 'motor_rodar_unchecked divergiu do corpo auditado: %',md5(v_def);
  end if;

  v_new := replace(v_def,
    $old$  _murl text; _mcap text; _ep text; _mlabel text; _body jsonb; _dist_cor bigint;$old$,
    $new$  _murl text; _mcap text; _ep text; _mlabel text; _body jsonb; _dist_cor bigint;
  _send_started timestamptz; _send_ok boolean; _send_gate jsonb; _mapa_exec jsonb;$new$);

  v_new := replace(v_new,
    $old$  select mapa->'automation'->'blocks', nome into blocks, a_nome from automacoes where id=p_auto_id;$old$,
    $new$  p_lead := public.motor_contextualizar_lead(p_auto_id,p_lead);
  _mapa_exec := public.automacao_mapa_executavel(
    p_auto_id,(p_lead->>'__automacao_versao_id')::bigint
  );
  select _mapa_exec->'automation'->'blocks',nome
    into blocks,a_nome from public.automacoes where id=p_auto_id;$new$);

  v_new := replace(v_new,
    $old$    elsif tipo='send-approach' then
      _dist_cor := null;
      if v_lead_id is not null then select corretor_id into _dist_cor from leads where id=v_lead_id; end if;
      if _dist_cor is null then
        insert into motor_execucoes(automacao_id,automacao_nome,bloco_id,evento,status,lead_nome,lead_telefone,detalhe)
        values(p_auto_id,a_nome,cur,'mensagem','alerta',p_lead->>'nome',v_tel,'Enviar abordagem: lead ainda sem corretor responsavel - coloque um bloco de Distribuicao antes');
      else
        perform motor_envia_abordagem(p_auto_id, a_nome, cur, p_lead, v_lead_id, _dist_cor,
          nullif(b#>>'{options,produtoId}','')::bigint,
          coalesce(b#>'{options,abordagemIds}','[]'::jsonb));
      end if;
      trace:=trace||E'>> Enviar abordagem (instancia do corretor dono)\n'; cur:=b#>>'{options,nextBlockId}';
$old$,
    $new$    elsif tipo='send-approach' then
      _dist_cor := null;
      if v_lead_id is not null then
        select corretor_id into _dist_cor from leads where id=v_lead_id;
      end if;
      if _dist_cor is null then
        insert into motor_execucoes(automacao_id,automacao_nome,bloco_id,evento,status,lead_nome,lead_telefone,detalhe)
        values(p_auto_id,a_nome,cur,'mensagem','erro',p_lead->>'nome',v_tel,
          'Enviar abordagem: lead sem corretor responsavel');
        trace:=trace||E'>> Abordagem falhou: sem corretor\n';
        cur:=nullif(b#>>'{options,errorNextBlockId}','');
        if cur is null then return trace||'-- interrompida --'; end if;
        continue;
      end if;

      _send_gate := public.motor_abordagem_preflight(v_lead_id,v_tel);
      if coalesce((_send_gate->>'ok')::boolean,false) is not true then
        insert into motor_execucoes(automacao_id,automacao_nome,bloco_id,evento,status,lead_nome,lead_telefone,detalhe)
        values(p_auto_id,a_nome,cur,'mensagem','alerta',p_lead->>'nome',v_tel,
          'Abordagem bloqueada: '||coalesce(_send_gate->>'motivo','motivo_nao_informado'));
        trace:=trace||E'>> Abordagem bloqueada\n';
        cur:=nullif(b#>>'{options,errorNextBlockId}','');
        if cur is null then return trace||'-- interrompida --'; end if;
        continue;
      end if;

      _send_started := clock_timestamp();
      perform motor_envia_abordagem(p_auto_id,a_nome,cur,p_lead,v_lead_id,_dist_cor,
        nullif(b#>>'{options,produtoId}','')::bigint,
        coalesce(b#>'{options,abordagemIds}','[]'::jsonb));

      select exists(
        select 1 from motor_execucoes me
         where me.automacao_id=p_auto_id and me.bloco_id=cur
           and me.evento='mensagem' and me.status='ok'
           and me.criado_em>=_send_started
      ) into _send_ok;
      if coalesce(_send_ok,false) is not true then
        insert into motor_execucoes(automacao_id,automacao_nome,bloco_id,evento,status,lead_nome,lead_telefone,detalhe)
        values(p_auto_id,a_nome,cur,'mensagem','erro',p_lead->>'nome',v_tel,
          'Abordagem nao confirmou nenhum envio; fluxo interrompido');
        trace:=trace||E'>> Abordagem falhou\n';
        cur:=nullif(b#>>'{options,errorNextBlockId}','');
        if cur is null then return trace||'-- interrompida --'; end if;
        continue;
      end if;

      trace:=trace||E'>> Abordagem enviada\n';
      cur:=b#>>'{options,nextBlockId}';
$new$);

  if v_new=v_def
     or position('automacao_mapa_executavel' in v_new)=0
     or position('Abordagem nao confirmou nenhum envio' in v_new)=0 then
    raise exception 'patch deterministico do motor nao encontrou todas as ancoras';
  end if;

  execute v_new;
end
$migration$;

revoke all on function public.motor_rodar_unchecked(bigint,jsonb,text,integer)
  from public, anon, authenticated;
grant execute on function public.motor_rodar_unchecked(bigint,jsonb,text,integer)
  to service_role;

create or replace function public.distribuicao_exige_apto(p_auto bigint,p_bloco text)
returns boolean
language sql
stable
security definer
set search_path=''
as $$
  select coalesce((b.bloco->'options'->'distribuicao'->>'onlineOnly')::boolean,true)
    from jsonb_array_elements(
      public.automacao_mapa_executavel(p_auto,null)->'automation'->'blocks'
    ) b(bloco)
   where b.bloco->>'id'=p_bloco
   limit 1;
$$;

create or replace function public.distribuicao_marcados(p_auto bigint,p_bloco text)
returns table(corretor_id bigint,peso numeric)
language sql
stable
security definer
set search_path=''
as $$
  select c.id,coalesce(nullif(e->>'peso','')::numeric,1)
    from jsonb_array_elements(
           public.automacao_mapa_executavel(p_auto,null)->'automation'->'blocks'
         ) b(bloco)
    cross join lateral jsonb_array_elements(
      coalesce(b.bloco->'options'->'distribuicao'->'items','[]'::jsonb)
    ) e
    join public.corretores c
      on public.nome_normalizado(c.nome)=public.nome_normalizado(e->>'corretor')
   where b.bloco->>'id'=p_bloco
     and coalesce((e->>'on')::boolean,true)
     and coalesce(nullif(e->>'peso','')::numeric,0)>0
     and coalesce(c.ativo,true);
$$;

revoke all on function public.distribuicao_exige_apto(bigint,text)
  from public, anon, authenticated;
revoke all on function public.distribuicao_marcados(bigint,text)
  from public, anon, authenticated;
grant execute on function public.distribuicao_exige_apto(bigint,text)
  to service_role;
grant execute on function public.distribuicao_marcados(bigint,text)
  to service_role;

-- O processador passa a registrar a causa dos erros comuns. Timeouts de toda a
-- transacao ainda exigem a fase do worker/outbox; por isso envios permanecem off.
create or replace function public.motor_processar_fila()
returns integer
language plpgsql
security definer
set search_path=''
as $$
declare
  r record;
  n integer:=0;
  claimed integer;
  v_ok boolean;
begin
  for r in
    select id,automacao_id,automacao_versao_id,bloco_id,lead
      from public.motor_fila
     where status='pendente' and due_at<=now()
     order by due_at limit 50
     for update skip locked
  loop
    select a.ativa is true and a.status='publicado'
           and not coalesce(a.arquivada,false)
      into v_ok from public.automacoes a where a.id=r.automacao_id;
    if coalesce(v_ok,false) is not true then
      update public.motor_fila
         set status='cancelado',processado_em=now(),ultimo_erro='AUTOMATION_NOT_RUNNABLE'
       where id=r.id;
      continue;
    end if;

    update public.motor_fila
       set status='processando',tentativas=tentativas+1,ultimo_erro=null
     where id=r.id and status='pendente';
    get diagnostics claimed=row_count;
    if claimed=0 then continue; end if;

    begin
      perform public.motor_rodar(
        r.automacao_id,
        (r.lead-'__automacao_versao_id')||jsonb_build_object('__automacao_versao_id',r.automacao_versao_id),
        nullif(r.bloco_id,'START'),
        case when r.bloco_id='START' then 0 else 1 end
      );
      update public.motor_fila set status='ok',processado_em=now() where id=r.id;
    exception when others then
      update public.motor_fila
         set status='erro',processado_em=now(),ultimo_erro=left(sqlstate||': '||sqlerrm,1000)
       where id=r.id;
    end;
    n:=n+1;
  end loop;
  return n;
end;
$$;

revoke all on function public.motor_processar_fila()
  from public, anon, authenticated;
grant execute on function public.motor_processar_fila()
  to service_role;

-- Um unico cron e apenas um relogio tecnico. Ele nao escolhe automacoes nem
-- executa regra de negocio: aciona as fontes de evento e o consumidor da fila.
create table if not exists public.motor_relogio_estado(
  chave text primary key,
  ultima_execucao timestamptz not null default '-infinity'::timestamptz
);

alter table public.motor_relogio_estado enable row level security;
revoke all on table public.motor_relogio_estado from public,anon,authenticated;
grant select,insert,update on table public.motor_relogio_estado to service_role;

create or replace function public.motor_relogio_central()
returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare
  v_resultado jsonb := '{}'::jsonb;
begin
  if not pg_try_advisory_xact_lock(hashtext('motor_relogio_central')) then
    return jsonb_build_object('ok',true,'ignorado','relogio_ja_em_execucao');
  end if;

  begin
    v_resultado := v_resultado || jsonb_build_object('fila',public.motor_processar_fila());
  exception when others then
    v_resultado := v_resultado || jsonb_build_object('fila_erro',sqlstate||': '||sqlerrm);
  end;

  begin
    v_resultado := v_resultado || jsonb_build_object(
      'mensagem',public.motor_evento_mensagem(150)
    );
  exception when others then
    v_resultado := v_resultado || jsonb_build_object('mensagem_erro',sqlstate||': '||sqlerrm);
  end;

  begin
    insert into public.motor_relogio_estado(chave,ultima_execucao)
    values('prazo',now())
    on conflict(chave) do update set ultima_execucao=excluded.ultima_execucao
      where public.motor_relogio_estado.ultima_execucao<=now()-interval '1 minute';
    if found then
      v_resultado := v_resultado || jsonb_build_object(
        'prazo',public.motor_evento_prazo(150)
      );
    end if;
  exception when others then
    v_resultado := v_resultado || jsonb_build_object('prazo_erro',sqlstate||': '||sqlerrm);
  end;

  begin
    insert into public.motor_relogio_estado(chave,ultima_execucao)
    values('retomar',now())
    on conflict(chave) do update set ultima_execucao=excluded.ultima_execucao
      where public.motor_relogio_estado.ultima_execucao<=now()-interval '5 minutes';
    if found then
      v_resultado := v_resultado || jsonb_build_object(
        'retomar',public.motor_evento_retomar(100)
      );
    end if;
  exception when others then
    v_resultado := v_resultado || jsonb_build_object('retomar_erro',sqlstate||': '||sqlerrm);
  end;

  begin
    insert into public.motor_relogio_estado(chave,ultima_execucao)
    values('checagem_diaria',now())
    on conflict(chave) do update set ultima_execucao=excluded.ultima_execucao
      where public.motor_relogio_estado.ultima_execucao<=now()-interval '1 hour';
    if found then
      v_resultado := v_resultado || jsonb_build_object(
        'checagem_diaria',public.sara_checagem_diaria(60)
      );
    end if;
  exception when others then
    v_resultado := v_resultado || jsonb_build_object(
      'checagem_diaria_erro',sqlstate||': '||sqlerrm
    );
  end;

  return jsonb_build_object('ok',true,'fontes',v_resultado);
end;
$$;

revoke all on function public.motor_relogio_central()
  from public,anon,authenticated;
grant execute on function public.motor_relogio_central() to service_role;
revoke all on function public.motor_evento_mensagem(integer)
  from public,anon,authenticated;
revoke all on function public.motor_evento_prazo(integer)
  from public,anon,authenticated;
revoke all on function public.motor_evento_retomar(integer)
  from public,anon,authenticated;
revoke all on function public.sara_checagem_diaria(integer)
  from public,anon,authenticated;
grant execute on function public.motor_evento_mensagem(integer) to service_role;
grant execute on function public.motor_evento_prazo(integer) to service_role;
grant execute on function public.motor_evento_retomar(integer) to service_role;
grant execute on function public.sara_checagem_diaria(integer) to service_role;

select cron.unschedule(jobname)
  from cron.job
 where jobname in (
   'motor-fila','motor-evento-mensagem','motor-evento-prazo',
   'motor-evento-retomar','checagem-diaria-funil','motor-relogio-central'
 );

select cron.schedule(
  'motor-relogio-central',
  '30 seconds',
  'select public.motor_relogio_central();'
);

commit;
