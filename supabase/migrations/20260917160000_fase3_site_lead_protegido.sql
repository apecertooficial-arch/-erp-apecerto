-- Fase 3 — lead do site por caminho protegido (Edge Function `site-lead`).
--
-- Problema: o formulário público (comprador/proprietário) grava direto em
-- public.site_leads com a chave anon. Não há limite de envios nem idempotência:
-- um duplo clique, um retry de rede ou um robô viram leads repetidos no CRM e
-- disparos repetidos da automação 42 "Entrada Site".
--
-- Esta migration:
--   1. adiciona site_leads.request_id (uuid gerado no navegador por envio) com
--      índice único parcial — um mesmo envio nunca cria duas linhas, venha ele
--      pela Edge Function ou pelo fallback REST;
--   2. amplia os escopos de private.site_financing_lead_rate_usage (a mesma
--      tabela do limite do financiamento) com 'lead_ip' e 'lead_phone', e cria
--      private.site_lead_rate_take — irmã de site_financing_rate_take, que NÃO é
--      alterada;
--   3. cria public.site_lead_ingest (SECURITY DEFINER, só service_role):
--      idempotência por request_id -> limite por IP (10/h) e por telefone (3/h)
--      -> validação -> deduplicação de 30 min (mesmo telefone + tipo + imóvel)
--      -> insert em site_leads (os triggers de CRM/automação continuam iguais);
--   4. adiciona a policy RESTRICTIVE site_leads_insert_anon_tipos para o papel
--      anon. A policy permissiva site_leads_insert_anon JÁ limita lead_type a
--      ('comprador','proprietario') — exatamente o que o analytics.js aceita
--      ('financiamento' tem endpoint próprio). A restritiva só garante que isso
--      continue verdade se a permissiva for alterada.
--
-- O QUE NÃO MUDA AGORA: a policy anon site_leads_insert_anon continua ativa para
-- páginas em cache (analytics.js é versionado e servido com cache imutável) e
-- como fallback do próprio JS quando a Edge Function estiver indisponível.
--
-- PASSO FUTURO (>= 7 dias depois do deploy do site com a Edge Function, e sem
-- linhas novas com request_id nulo e origem 'site' vindas do anon):
--   select count(*) from public.site_leads
--    where origem = 'site' and request_id is null and criado_em > now() - interval '7 days';
--   -- se 0 (ou só inserts de captacoes_portal), remover o caminho anon:
--   drop policy site_leads_insert_anon on public.site_leads;
--   drop policy site_leads_insert_anon_tipos on public.site_leads;
--   revoke insert on public.site_leads from anon;
--   -- e retirar o fallback REST de window.apecertoSubmitSiteLead no site.
--
-- Ordem de deploy: ESTA migration -> Edge Function site-lead -> site (analytics.js).
-- Aplicar primeiro não muda comportamento: a coluna nova é opcional e nada chama
-- a RPC ainda.
--
-- Rollback: supabase/rollbacks/20260917160000_fase3_site_lead_protegido.down.sql
-- Teste:    supabase/tests/site_lead_protegido.sql (BEGIN ... ROLLBACK)

-- ---------------------------------------------------------------------------
-- 1. Idempotência
-- ---------------------------------------------------------------------------
alter table public.site_leads add column if not exists request_id uuid;

create unique index if not exists site_leads_request_id_key
  on public.site_leads (request_id)
  where request_id is not null;

comment on column public.site_leads.request_id is
  'UUID gerado no navegador por envio do formulário. Único: retries do mesmo envio não duplicam o lead.';

-- ---------------------------------------------------------------------------
-- 2. Limite de envios (reaproveita a tabela do financiamento)
-- ---------------------------------------------------------------------------
alter table private.site_financing_lead_rate_usage
  drop constraint if exists site_financing_lead_rate_usage_scope_check;
alter table private.site_financing_lead_rate_usage
  add constraint site_financing_lead_rate_usage_scope_check
  check (scope = any (array['ip', 'client', 'lead_ip', 'lead_phone']));

create or replace function private.site_lead_rate_take(
  p_scope text,
  p_client_hash text,
  p_window_seconds integer,
  p_limit integer
)
returns boolean
language plpgsql
set search_path to ''
as $function$
declare
  v_window timestamptz;
  v_requests integer;
begin
  if p_scope not in ('lead_ip', 'lead_phone')
     or p_client_hash is null
     or p_client_hash !~ '^[0-9a-f]{64}$'
     or p_window_seconds not between 60 and 86400
     or p_limit not between 1 and 100 then
    return false;
  end if;

  v_window := to_timestamp(
    floor(extract(epoch from clock_timestamp()) / p_window_seconds)
    * p_window_seconds
  );

  insert into private.site_financing_lead_rate_usage (
    scope, client_hash, window_start, requests, last_request_at
  ) values (
    p_scope, p_client_hash, v_window, 1, now()
  )
  on conflict (scope, client_hash, window_start) do update
    set requests = private.site_financing_lead_rate_usage.requests + 1,
        last_request_at = now()
    where private.site_financing_lead_rate_usage.requests < p_limit
  returning requests into v_requests;

  return v_requests is not null and v_requests <= p_limit;
end;
$function$;

revoke all on function private.site_lead_rate_take(text, text, integer, integer)
  from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 3. Ingest
-- ---------------------------------------------------------------------------
create or replace function public.site_lead_ingest(
  p_request_id uuid,
  p_ip_hash text,
  p_phone_hash text,
  p_lead_type text,
  p_nome text,
  p_telefone text,
  p_email text,
  p_empreendimento_id uuid,
  p_unidade_id uuid,
  p_empreendimento_nome text,
  p_preferencia_horario text,
  p_page_view_id uuid,
  p_tracking jsonb,
  p_context jsonb
)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_id uuid;
begin
  if p_request_id is null
     or p_ip_hash is null or p_ip_hash !~ '^[0-9a-f]{64}$'
     or p_phone_hash is null or p_phone_hash !~ '^[0-9a-f]{64}$'
     or p_lead_type is null or p_lead_type not in ('comprador', 'proprietario') then
    return jsonb_build_object('accepted', false, 'code', 'invalid_request');
  end if;

  -- Retries do mesmo envio: serializa e devolve o lead já criado sem gastar
  -- limite.
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('site-lead:request:' || p_request_id::text, 0)
  );

  select s.id into v_id from public.site_leads s where s.request_id = p_request_id;
  if found then
    return jsonb_build_object('accepted', true, 'duplicate', true,
      'id', v_id, 'request_id', p_request_id);
  end if;

  delete from private.site_financing_lead_rate_usage
   where window_start < now() - interval '48 hours';

  if private.site_lead_rate_take('lead_ip', p_ip_hash, 3600, 10) is not true then
    return jsonb_build_object('accepted', false, 'code', 'rate_limited');
  end if;
  if private.site_lead_rate_take('lead_phone', p_phone_hash, 3600, 3) is not true then
    return jsonb_build_object('accepted', false, 'code', 'rate_limited');
  end if;

  -- Defesa em profundidade: a Edge Function já valida tudo isto.
  if char_length(btrim(coalesce(p_nome, ''))) not between 2 and 120
     or p_telefone is null or p_telefone !~ '^55[1-9][0-9]{9,10}$'
     or (p_email is not null and (
          char_length(p_email) not between 3 and 254
          or p_email !~* '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$'))
     or (p_unidade_id is not null and p_empreendimento_id is null)
     or char_length(coalesce(p_empreendimento_nome, '')) > 200
     or char_length(coalesce(p_preferencia_horario, '')) > 200
     or jsonb_typeof(p_tracking) is distinct from 'object'
     or octet_length(p_tracking::text) > 12000
     or jsonb_typeof(p_context) is distinct from 'object'
     or octet_length(p_context::text) > 8000 then
    return jsonb_build_object('accepted', false, 'code', 'invalid_request');
  end if;

  -- Deduplicação comercial: o mesmo telefone pedindo o mesmo tipo de contato
  -- para o mesmo imóvel em 30 minutos (outro request_id: duplo clique em outra
  -- aba, recarga da página) não cria outro lead nem outro disparo da automação.
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('site-lead:phone:' || p_phone_hash, 0)
  );

  select s.id into v_id
    from public.site_leads s
   where s.lead_type = p_lead_type
     and s.origem = 'site'
     and s.criado_em >= clock_timestamp() - interval '30 minutes'
     and regexp_replace(s.telefone, '[^0-9]', '', 'g') in (p_telefone, substr(p_telefone, 3))
     and s.empreendimento_id is not distinct from p_empreendimento_id
     and s.unidade_id is not distinct from p_unidade_id
   order by s.criado_em desc
   limit 1;
  if found then
    return jsonb_build_object('accepted', true, 'duplicate', true,
      'id', v_id, 'request_id', p_request_id);
  end if;

  insert into public.site_leads (
    request_id, nome, telefone, email, origem, lead_type,
    empreendimento_id, unidade_id, empreendimento_nome, preferencia_horario,
    page_view_id, tracking, context
  ) values (
    p_request_id, btrim(p_nome), p_telefone, lower(btrim(p_email)), 'site', p_lead_type,
    p_empreendimento_id, p_unidade_id, nullif(btrim(p_empreendimento_nome), ''),
    nullif(btrim(p_preferencia_horario), ''),
    p_page_view_id, p_tracking, p_context
  ) returning id into v_id;

  return jsonb_build_object('accepted', true, 'duplicate', false,
    'id', v_id, 'request_id', p_request_id);
exception
  when check_violation or foreign_key_violation or invalid_text_representation then
    -- unidade não publicada, contexto fora da lista fechada etc.
    return jsonb_build_object('accepted', false, 'code', 'invalid_request');
end;
$function$;

revoke all on function public.site_lead_ingest(
  uuid, text, text, text, text, text, text, uuid, uuid, text, text, uuid, jsonb, jsonb
) from public, anon, authenticated;
grant execute on function public.site_lead_ingest(
  uuid, text, text, text, text, text, text, uuid, uuid, text, text, uuid, jsonb, jsonb
) to service_role;

-- ---------------------------------------------------------------------------
-- 4. Caminho anon: só os tipos que o analytics.js envia
-- ---------------------------------------------------------------------------
drop policy if exists site_leads_insert_anon_tipos on public.site_leads;
create policy site_leads_insert_anon_tipos on public.site_leads
  as restrictive
  for insert
  to anon
  with check (lead_type in ('comprador', 'proprietario') and origem = 'site');
