-- Fase 3 — WhatsApp sem mensagem duplicada.
--
-- Problema: dapi-enviar tratava timeout (AbortSignal 20 s -> status 0) como falha e
-- tentava a variante do 9º dígito, REENVIANDO uma mensagem que o provedor pode já
-- ter entregue. Não havia chave de idempotência: qualquer retry de chamador
-- (pg_net/http, rota do app, Sara) virava mensagem nova.
--
-- Esta migration cria o livro-razão de envios `public.wa_envios` e duas RPCs
-- atômicas usadas pela Edge Function:
--   wa_envio_reservar  -> reserva a chave ANTES da chamada ao provedor
--   wa_envio_concluir  -> grava o desfecho (enviado | falhou | incerto)
-- e faz processar_agendadas mandar uma chave estável ('agendada:<id>').
--
-- Ordem de deploy: ESTA migration -> dapi-enviar -> chamadores.
-- (A função atual ignora o campo idempotency_key, então aplicar a migration
-- primeiro não muda comportamento nenhum.)
--
-- Rollback: supabase/rollbacks/20260917120000_fase3_wa_envios_idempotencia.down.sql
-- Teste:    supabase/tests/wa_envios_idempotencia.sql (BEGIN ... ROLLBACK)

-- ---------------------------------------------------------------------------
-- Tabela
-- ---------------------------------------------------------------------------
create table if not exists public.wa_envios (
  id                  bigint generated always as identity primary key,
  idempotency_key     text        not null,
  derivada            boolean     not null default false,
  instancia           text        not null,
  telefone            text        not null,
  tipo                text        not null,
  conteudo_hash       text        not null,
  status              text        not null default 'reservado',
  provider_message_id text,
  destino             text,
  tentativas          integer     not null default 1,
  erro                text,
  resposta            jsonb,
  reservado_ate       timestamptz,
  enviado_em          timestamptz,
  criado_em           timestamptz not null default now(),
  atualizado_em       timestamptz not null default now(),
  constraint wa_envios_idempotency_key_key unique (idempotency_key),
  constraint wa_envios_status_chk check (status in ('reservado','enviado','falhou','incerto')),
  constraint wa_envios_chave_chk check (length(idempotency_key) between 8 and 220),
  constraint wa_envios_hash_chk check (conteudo_hash ~ '^[0-9a-f]{64}$'),
  constraint wa_envios_tipo_chk check (tipo in ('text','audio','image','video','document')),
  constraint wa_envios_tentativas_chk check (tentativas >= 1)
);

comment on table public.wa_envios is
  'Livro-razão de envios de WhatsApp da dapi-enviar. Uma linha por idempotency_key. '
  'status: reservado (chamada em curso) | enviado | falhou (recusa definitiva, pode tentar de novo) | '
  'incerto (timeout/5xx: pode ter sido entregue; nunca reenviado automaticamente). Só service_role.';

-- Janela deslizante das chaves derivadas: mesma mensagem ao mesmo número.
create index if not exists wa_envios_mesma_msg_idx
  on public.wa_envios (telefone, conteudo_hash, criado_em desc);
create index if not exists wa_envios_status_idx
  on public.wa_envios (status, criado_em desc) where status in ('reservado','incerto');

-- RLS fechada: nenhuma policy. anon/authenticated sem nenhum privilégio.
alter table public.wa_envios enable row level security;
revoke all on table public.wa_envios from public, anon, authenticated;
grant select, insert, update, delete on table public.wa_envios to service_role;

-- ---------------------------------------------------------------------------
-- wa_envio_reservar
--
-- Retorna jsonb { acao, registro }:
--   enviar        -> esta chamada pode falar com o provedor (linha em 'reservado')
--   devolver      -> já foi enviado; devolva o resultado anterior sem reenviar
--   em_andamento  -> outra chamada está com a reserva viva
--   incerto       -> tentativa anterior sem confirmação; não reenviar
--   conflito      -> chave já usada para outro telefone/conteúdo
--
-- p_derivada = true: a chave foi derivada pela função (sem chave do chamador).
-- Nesse caso também vale como duplicata qualquer envio da mesma mensagem ao mesmo
-- telefone nos últimos p_janela_segundos (janela deslizante, não só o balde de 2 min).
-- ---------------------------------------------------------------------------
create or replace function public.wa_envio_reservar(
  p_chave text,
  p_instancia text,
  p_telefone text,
  p_tipo text,
  p_conteudo_hash text,
  p_derivada boolean default false,
  p_lease_segundos integer default 120,
  p_janela_segundos integer default 120
) returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v public.wa_envios%rowtype;
  v_achou boolean := false;
begin
  if p_chave is null or p_instancia is null or p_telefone is null or p_tipo is null or p_conteudo_hash is null then
    raise exception 'wa_envio_reservar: parametros obrigatorios ausentes' using errcode = '22004';
  end if;

  -- Serializa chamadas concorrentes para a mesma mensagem/telefone (e para a mesma chave).
  perform pg_advisory_xact_lock(hashtextextended('wa_envios|' || p_telefone || '|' || p_conteudo_hash, 0));
  perform pg_advisory_xact_lock(hashtextextended('wa_envios_chave|' || p_chave, 0));

  select * into v from public.wa_envios where idempotency_key = p_chave for update;
  v_achou := found;

  if not v_achou and p_derivada then
    select * into v
      from public.wa_envios
     where telefone = p_telefone
       and conteudo_hash = p_conteudo_hash
       and status <> 'falhou'
       and criado_em > now() - make_interval(secs => greatest(p_janela_segundos, 0))
     order by criado_em desc
     limit 1
     for update;
    v_achou := found;
  end if;

  if not v_achou then
    insert into public.wa_envios (idempotency_key, derivada, instancia, telefone, tipo, conteudo_hash, status, tentativas, reservado_ate)
    values (p_chave, coalesce(p_derivada,false), p_instancia, p_telefone, p_tipo, p_conteudo_hash, 'reservado', 1,
            now() + make_interval(secs => greatest(p_lease_segundos, 10)))
    returning * into v;
    return jsonb_build_object('acao','enviar','registro',to_jsonb(v));
  end if;

  if v.telefone <> p_telefone or v.conteudo_hash <> p_conteudo_hash then
    return jsonb_build_object('acao','conflito','registro',jsonb_build_object('idempotency_key',v.idempotency_key));
  end if;

  if v.status = 'enviado' then
    return jsonb_build_object('acao','devolver','registro',to_jsonb(v));
  end if;

  if v.status = 'reservado' then
    if v.reservado_ate is not null and v.reservado_ate > now() then
      return jsonb_build_object('acao','em_andamento','registro',to_jsonb(v));
    end if;
    -- Reserva vencida: a execução anterior morreu no meio. Pode ter enviado.
    update public.wa_envios
       set status = 'incerto',
           erro = coalesce(erro, 'reserva expirada sem desfecho'),
           reservado_ate = null,
           atualizado_em = now()
     where id = v.id
     returning * into v;
    return jsonb_build_object('acao','incerto','registro',to_jsonb(v));
  end if;

  if v.status = 'incerto' then
    return jsonb_build_object('acao','incerto','registro',to_jsonb(v));
  end if;

  -- 'falhou': recusa definitiva do provedor; nada foi entregue. Nova tentativa permitida.
  update public.wa_envios
     set status = 'reservado',
         tentativas = tentativas + 1,
         instancia = p_instancia,
         erro = null,
         reservado_ate = now() + make_interval(secs => greatest(p_lease_segundos, 10)),
         atualizado_em = now()
   where id = v.id
   returning * into v;
  return jsonb_build_object('acao','enviar','registro',to_jsonb(v));
end;
$$;

-- ---------------------------------------------------------------------------
-- wa_envio_concluir
--
-- 'enviado' pode sobrescrever 'reservado' ou 'incerto' (a confirmação chegou depois
-- da reserva vencer). 'falhou' e 'incerto' só saem de 'reservado'. Nunca rebaixa
-- um 'enviado'. Retorna true se gravou.
-- ---------------------------------------------------------------------------
create or replace function public.wa_envio_concluir(
  p_chave text,
  p_status text,
  p_provider_message_id text default null,
  p_destino text default null,
  p_erro text default null,
  p_resposta jsonb default null
) returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  n integer;
begin
  if p_status not in ('enviado','falhou','incerto') then
    raise exception 'wa_envio_concluir: status invalido %', p_status using errcode = '22023';
  end if;

  update public.wa_envios
     set status = p_status,
         provider_message_id = coalesce(p_provider_message_id, provider_message_id),
         destino = coalesce(p_destino, destino),
         erro = case when p_status = 'enviado' then null else left(p_erro, 1000) end,
         resposta = p_resposta,
         reservado_ate = null,
         enviado_em = case when p_status = 'enviado' then now() else enviado_em end,
         atualizado_em = now()
   where idempotency_key = p_chave
     and (status = 'reservado' or (p_status = 'enviado' and status = 'incerto'));
  get diagnostics n = row_count;
  return n > 0;
end;
$$;

revoke all on function public.wa_envio_reservar(text,text,text,text,text,boolean,integer,integer) from public, anon, authenticated;
revoke all on function public.wa_envio_concluir(text,text,text,text,text,jsonb) from public, anon, authenticated;
grant execute on function public.wa_envio_reservar(text,text,text,text,text,boolean,integer,integer) to service_role;
grant execute on function public.wa_envio_concluir(text,text,text,text,text,jsonb) to service_role;

-- ---------------------------------------------------------------------------
-- processar_agendadas: idêntica à versão de produção (pg_get_functiondef em
-- 2026-09-17), com UMA mudança: manda idempotency_key = 'agendada:<id>'.
-- Se o http estourar o timeout local (5 s) e a linha for reprocessada no futuro,
-- dapi-enviar devolve o resultado anterior em vez de mandar de novo.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.processar_agendadas()
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
declare r record; v_body text; v_resp extensions.http_response; n int:=0; v_token text;
begin
  select decrypted_secret into v_token
    from vault.decrypted_secrets where name = 'ncrm_envio_interno_token';
  if v_token is null or length(v_token) < 16 then
    raise warning 'processar_agendadas: token de envio interno ausente; nenhuma mensagem foi enviada';
    return 0;
  end if;

  for r in
    select * from mensagens_agendadas
     where status in ('pendente','agendado') and quando <= now()
     order by quando
     limit 50
  loop
    v_body := jsonb_strip_nulls(jsonb_build_object(
      'to',r.telefone,'tipo',r.tipo,'texto',r.texto,'url',r.url,
      'instancia_id',r.instancia_id,'corretor_nome',r.corretor_nome,
      'fileName',r.file_name,'mimetype',r.mimetype,
      'idempotency_key','agendada:'||r.id
    ))::text;
    begin
      perform extensions.http_set_curlopt(
        'CURLOPT_TIMEOUT_MS',
        case when lower(coalesce(r.tipo, '')) = 'video' then '30000' else '5000' end
      );
      v_resp := extensions.http(('POST','https://diaegvfveqezispcthwk.supabase.co/functions/v1/dapi-enviar',
        array[extensions.http_header('Content-Type','application/json'),
              extensions.http_header('x-envio-interno', v_token)],'application/json',v_body)::extensions.http_request);
      perform extensions.http_set_curlopt('CURLOPT_TIMEOUT_MS','5000');
      if v_resp.status between 200 and 299 then
        update mensagens_agendadas set status='enviado', resultado=left(v_resp.content,200) where id=r.id;
      else
        update mensagens_agendadas set status='erro', resultado='HTTP '||v_resp.status||' '||left(v_resp.content,180) where id=r.id;
      end if;
      n:=n+1;
    exception when others then
      perform extensions.http_set_curlopt('CURLOPT_TIMEOUT_MS','5000');
      update mensagens_agendadas set status='erro', resultado=left(sqlerrm,180) where id=r.id;
    end;
  end loop;
  return n;
end $function$;

revoke all on function public.processar_agendadas() from public, anon, authenticated;
grant execute on function public.processar_agendadas() to service_role;

notify pgrst, 'reload schema';
