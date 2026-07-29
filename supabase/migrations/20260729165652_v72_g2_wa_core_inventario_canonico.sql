-- V7.2 GATE 2 — inventário canônico. Aditivo: não altera nada do legado.
create schema if not exists wa_core;
revoke all on schema wa_core from public, anon, authenticated;
grant usage on schema wa_core to service_role;
comment on schema wa_core is 'Nucleo canonico WhatsApp/D-API. NAO expor na Data API.';

create table if not exists wa_core.config (
  id int primary key default 1 check (id=1),
  modo text not null default 'observacao' check (modo in ('observacao','sombra','ativo')),
  ausencia_min_snapshots int not null default 3 check (ausencia_min_snapshots>=1),
  ausencia_min_janela interval not null default interval '30 minutes',
  frescor_maximo interval not null default interval '15 minutes',
  video_max_bytes bigint not null default 10485760,
  atualizado_em timestamptz not null default now());
insert into wa_core.config(id) values (1) on conflict do nothing;

create table if not exists wa_core.provider_account (
  id bigserial primary key, provider text not null default 'd-api', rotulo text not null,
  base_url text not null, ativa boolean not null default true,
  criado_em timestamptz not null default now(), unique (provider, rotulo));
insert into wa_core.provider_account (provider,rotulo,base_url)
values ('d-api','principal','https://api.d-api.cloud') on conflict do nothing;

create table if not exists wa_core.sessao (
  id bigserial primary key,
  provider_account_id bigint not null references wa_core.provider_account(id),
  provider_session_id text not null check (btrim(provider_session_id) <> ''),
  nome_observado text, telefone_observado text,
  estado_confirmado text not null default 'desconhecido'
    check (estado_confirmado in ('connected','disconnected','connecting','desconhecido')),
  estado_confirmado_em timestamptz, estado_origem_snapshot_id bigint,
  primeira_vista_em timestamptz, ultima_vista_em timestamptz,
  last_complete_snapshot_at timestamptz,
  snapshots_completos_sem_ver int not null default 0,
  ausencia_confirmada_em timestamptz,
  last_provider_success_at timestamptz, last_provider_error_at timestamptz, ultimo_erro_classe text,
  arquivada_em timestamptz, arquivada_motivo text,
  origem_registro text not null default 'snapshot' check (origem_registro in ('snapshot','backfill')),
  legado_instancia_id bigint,
  criado_em timestamptz not null default now(), atualizado_em timestamptz not null default now(),
  unique (provider_account_id, provider_session_id));
create index if not exists sessao_operacional_idx on wa_core.sessao (provider_account_id) where arquivada_em is null;
create index if not exists sessao_legado_idx on wa_core.sessao (legado_instancia_id) where legado_instancia_id is not null;

create table if not exists wa_core.snapshot (
  id bigserial primary key,
  provider_account_id bigint not null references wa_core.provider_account(id),
  iniciado_em timestamptz not null default now(), concluido_em timestamptz,
  http_status int, completo boolean not null default false,
  classe text not null,
  total_recebido int, total_valido int,
  prova jsonb not null default '{}'::jsonb, criado_em timestamptz not null default now());
create index if not exists snapshot_conta_idx on wa_core.snapshot (provider_account_id, id desc);

create table if not exists wa_core.sessao_vinculo (
  id bigserial primary key, sessao_id bigint not null references wa_core.sessao(id),
  corretor_id bigint not null, usuario_id uuid, finalidade text,
  vigente_de timestamptz not null default now(), vigente_ate timestamptz,
  origem text not null default 'backfill', criado_em timestamptz not null default now(),
  check (vigente_ate is null or vigente_ate > vigente_de));
create unique index if not exists sessao_vinculo_vigente_uk on wa_core.sessao_vinculo (sessao_id) where vigente_ate is null;
create index if not exists sessao_vinculo_corretor_idx on wa_core.sessao_vinculo (corretor_id) where vigente_ate is null;

create table if not exists wa_core.quarentena (
  id bigserial primary key, tipo text not null, sessao_id bigint references wa_core.sessao(id),
  chave text, detalhe jsonb not null default '{}'::jsonb,
  resolvido_em timestamptz, resolvido_por text, criado_em timestamptz not null default now());

create table if not exists wa_core.sessao_capacidade (
  sessao_id bigint not null references wa_core.sessao(id),
  tipo text not null check (tipo in ('texto','imagem','video','audio','documento')),
  sucessos bigint not null default 0, falhas bigint not null default 0,
  ultimo_sucesso_em timestamptz, ultimo_erro_em timestamptz, ultimo_erro_classe text,
  primary key (sessao_id, tipo));

-- ---------------------------------------------------------------------
-- P0-8 — validação ESTRITA de snapshot
-- ---------------------------------------------------------------------
create or replace function wa_core.classe_http(p_status int)
returns text language sql immutable set search_path = pg_catalog as $$
  select case when p_status between 200 and 299 then 'ok'
              when p_status in (401,403) then 'nao_autenticado'
              when p_status = 429 then 'limite_taxa'
              when p_status >= 500 then 'provedor_indisponivel'
              when p_status is null or p_status = 0 then 'erro_transporte'
              else 'formato_inesperado' end $$;

create or replace function wa_core.extrair_sessoes(p_body jsonb)
returns jsonb language sql immutable set search_path = pg_catalog as $$
  select case when jsonb_typeof(p_body)='array' then p_body
              when jsonb_typeof(p_body->'sessions')='array' then p_body->'sessions'
              else null end $$;

create or replace function wa_core.ingerir_snapshot(p_account bigint, p_http_status int, p_body text)
returns bigint language plpgsql set search_path = pg_catalog, wa_core as $fn$
declare _json jsonb; _arr jsonb; _classe text; _completo boolean := false;
        _rec int; _val int; _uniq int; _snap bigint; _cfg wa_core.config%rowtype;
begin
  select * into _cfg from wa_core.config where id=1;
  _classe := wa_core.classe_http(p_http_status);

  if _classe = 'ok' then
    begin _json := p_body::jsonb; exception when others then _json := null; end;
    if _json is null then _classe := 'json_invalido';
    else
      _arr := wa_core.extrair_sessoes(_json);
      if _arr is null then _classe := 'formato_inesperado';
      else
        _rec := jsonb_array_length(_arr);
        -- item VÁLIDO = objeto com `id` texto não vazio.
        select count(*), count(distinct e->>'id') into _val, _uniq
          from jsonb_array_elements(_arr) e
         where jsonb_typeof(e)='object' and nullif(btrim(coalesce(e->>'id','')),'') is not null;
        if _rec = 0 then _classe := 'vazio';
        elsif _val <> _rec then _classe := 'itens_invalidos';   -- `[{}]` e mistura
        elsif _uniq <> _val then _classe := 'ids_duplicados';
        else _classe := 'completo'; _completo := true; end if;
      end if;
    end if;
  end if;

  insert into wa_core.snapshot(provider_account_id,concluido_em,http_status,completo,classe,
                               total_recebido,total_valido,prova)
  values (p_account, now(), p_http_status, _completo, _classe, _rec, _val,
          jsonb_build_object('bytes',length(coalesce(p_body,'')),'recebidos',_rec,'validos',_val,'unicos',_uniq))
  returning id into _snap;

  if not _completo then
    update wa_core.sessao set last_provider_error_at=now(), ultimo_erro_classe=_classe, atualizado_em=now()
     where provider_account_id=p_account and arquivada_em is null;
    return _snap;
  end if;

  with vistas as (
    select e->>'id' sid,
           nullif(e->>'status','') st,
           nullif(coalesce(e->>'name', e->>'id'),'') nome,
           nullif(e->>'phone','') fone
      from jsonb_array_elements(_arr) e)
  insert into wa_core.sessao as s (provider_account_id,provider_session_id,nome_observado,telefone_observado,
      estado_confirmado,estado_confirmado_em,estado_origem_snapshot_id,primeira_vista_em,ultima_vista_em,
      last_complete_snapshot_at,last_provider_success_at,snapshots_completos_sem_ver,origem_registro)
  select p_account, v.sid, v.nome, v.fone,
         case when v.st in ('connected','disconnected','connecting') then v.st else 'desconhecido' end,
         now(), _snap, now(), now(), now(), now(), 0, 'snapshot'
    from vistas v
  on conflict (provider_account_id, provider_session_id) do update
     set nome_observado=coalesce(excluded.nome_observado,s.nome_observado),
         telefone_observado=coalesce(excluded.telefone_observado,s.telefone_observado),
         estado_confirmado=excluded.estado_confirmado,
         estado_confirmado_em=excluded.estado_confirmado_em,
         estado_origem_snapshot_id=excluded.estado_origem_snapshot_id,
         primeira_vista_em=coalesce(s.primeira_vista_em,excluded.primeira_vista_em),
         ultima_vista_em=excluded.ultima_vista_em,
         last_complete_snapshot_at=excluded.last_complete_snapshot_at,
         last_provider_success_at=excluded.last_provider_success_at,
         snapshots_completos_sem_ver=0,
         ausencia_confirmada_em=null, arquivada_em=null, arquivada_motivo=null,
         atualizado_em=now();

  update wa_core.sessao s set snapshots_completos_sem_ver = s.snapshots_completos_sem_ver+1, atualizado_em=now()
   where s.provider_account_id=p_account and s.arquivada_em is null
     and not exists (select 1 from jsonb_array_elements(_arr) e where e->>'id'=s.provider_session_id);

  update wa_core.sessao s
     set ausencia_confirmada_em=now(), arquivada_em=now(),
         arquivada_motivo='ausente em '||s.snapshots_completos_sem_ver||' snapshots completos consecutivos',
         atualizado_em=now()
   where s.provider_account_id=p_account and s.arquivada_em is null
     and s.snapshots_completos_sem_ver >= _cfg.ausencia_min_snapshots
     and (s.last_complete_snapshot_at is null or s.last_complete_snapshot_at < now() - _cfg.ausencia_min_janela);

  return _snap;
end $fn$;

-- coleta o snapshot direto do provedor (mesma chamada que o cron legado já faz)
create or replace function wa_core.coletar_snapshot(p_account bigint default 1)
returns bigint language plpgsql set search_path = pg_catalog, wa_core, public, extensions as $fn$
declare _key text; _st int; _ct text; _base text;
begin
  select base_url into _base from wa_core.provider_account where id=p_account;
  select apikey into _key from public.instancias_credenciais where apikey is not null
   group by apikey order by count(*) desc limit 1;
  if _key is null then return wa_core.ingerir_snapshot(p_account, null, ''); end if;
  begin
    begin perform extensions.http_set_curlopt('CURLOPT_TIMEOUT_MS','10000'); exception when others then null; end;
    select h.status, h.content into _st, _ct from extensions.http((
      'GET', _base||'/api/v1/sessions',
      ARRAY[extensions.http_header('Authorization',_key)], NULL, NULL)::extensions.http_request) h;
  exception when others then _st := null; _ct := ''; end;
  return wa_core.ingerir_snapshot(p_account, _st, _ct);
end $fn$;

create or replace view wa_core.v_sessao_operacional as
select s.id sessao_id, s.provider_account_id, s.provider_session_id, s.nome_observado,
       s.estado_confirmado, s.estado_confirmado_em, s.last_complete_snapshot_at,
       s.last_provider_error_at, s.ultimo_erro_classe,
       v.corretor_id corretor_operacional_id, v.usuario_id usuario_operacional_id,
       s.legado_instancia_id,
       (s.last_complete_snapshot_at is not null
        and s.last_complete_snapshot_at > now() - (select frescor_maximo from wa_core.config where id=1)) sincronizacao_fresca,
       exists (select 1 from wa_core.quarentena q where q.sessao_id=s.id and q.resolvido_em is null) em_quarentena
  from wa_core.sessao s
  left join wa_core.sessao_vinculo v on v.sessao_id=s.id and v.vigente_ate is null
 where s.arquivada_em is null;

create or replace function wa_core.contagens(p_account bigint default 1)
returns table (total int, conectadas int, conectando int, desconectadas int, desconhecidas int,
               arquivadas int, em_quarentena int, sincronizacao_fresca boolean,
               ultimo_snapshot_completo_em timestamptz)
language sql stable set search_path = pg_catalog, wa_core as $$
  select count(*)::int,
         count(*) filter (where o.estado_confirmado='connected')::int,
         count(*) filter (where o.estado_confirmado='connecting')::int,
         count(*) filter (where o.estado_confirmado='disconnected')::int,
         count(*) filter (where o.estado_confirmado='desconhecido')::int,
         (select count(*) from wa_core.sessao a where a.provider_account_id=p_account and a.arquivada_em is not null)::int,
         count(*) filter (where o.em_quarentena)::int,
         coalesce(bool_and(o.sincronizacao_fresca), false),
         (select max(sn.concluido_em) from wa_core.snapshot sn where sn.provider_account_id=p_account and sn.completo)
    from wa_core.v_sessao_operacional o where o.provider_account_id=p_account $$;

create or replace function wa_core.backfill(p_account bigint default 1)
returns jsonb language plpgsql set search_path = pg_catalog, wa_core, public as $fn$
declare _s int:=0; _v int:=0;
begin
  insert into wa_core.sessao as s (provider_account_id,provider_session_id,nome_observado,telefone_observado,
                                   estado_confirmado,legado_instancia_id,origem_registro)
  select p_account, i.instancia_dapi, i.nome, i.telefone, 'desconhecido', i.id, 'backfill'
    from public.instancias i where coalesce(btrim(i.instancia_dapi),'') <> ''
  on conflict (provider_account_id,provider_session_id) do update
     set legado_instancia_id=coalesce(s.legado_instancia_id,excluded.legado_instancia_id),
         nome_observado=coalesce(s.nome_observado,excluded.nome_observado), atualizado_em=now();
  get diagnostics _s = row_count;

  insert into wa_core.quarentena (tipo,sessao_id,chave,detalhe)
  select 'session_id_duplicado', s.id, d.instancia_dapi, jsonb_build_object('instancias_legado', d.ids)
    from (select i.instancia_dapi, array_agg(i.id order by i.id) ids from public.instancias i
           where coalesce(btrim(i.instancia_dapi),'')<>'' group by 1 having count(*)>1) d
    join wa_core.sessao s on s.provider_account_id=p_account and s.provider_session_id=d.instancia_dapi
   where not exists (select 1 from wa_core.quarentena q where q.tipo='session_id_duplicado'
                      and q.chave=d.instancia_dapi and q.resolvido_em is null);

  with cand as (
    select s.id sessao_id, i.corretor_id from wa_core.sessao s
      join public.instancias i on i.id=s.legado_instancia_id
     where s.provider_account_id=p_account and i.corretor_id is not null
    union
    select s.id, ci.corretor_id from wa_core.sessao s
      join public.corretor_instancias ci on ci.instancia_id=s.legado_instancia_id
     where s.provider_account_id=p_account),
  ag as (select sessao_id, array_agg(distinct corretor_id order by corretor_id) cs from cand group by 1),
  un as (select sessao_id, cs[1] corretor_id from ag where array_length(cs,1)=1)
  insert into wa_core.sessao_vinculo (sessao_id,corretor_id,usuario_id,origem)
  select u.sessao_id, u.corretor_id, (select c.usuario_id from public.corretores c where c.id=u.corretor_id), 'backfill'
    from un u
   where not exists (select 1 from wa_core.sessao_vinculo v where v.sessao_id=u.sessao_id and v.vigente_ate is null);
  get diagnostics _v = row_count;

  insert into wa_core.quarentena (tipo,sessao_id,chave,detalhe)
  select 'vinculo_divergente', g.sessao_id, s.provider_session_id, jsonb_build_object('corretores', g.cs)
    from (select sessao_id, array_agg(distinct corretor_id order by corretor_id) cs from (
            select s.id sessao_id, i.corretor_id from wa_core.sessao s join public.instancias i on i.id=s.legado_instancia_id
             where s.provider_account_id=p_account and i.corretor_id is not null
            union
            select s.id, ci.corretor_id from wa_core.sessao s join public.corretor_instancias ci on ci.instancia_id=s.legado_instancia_id
             where s.provider_account_id=p_account) x
          group by 1 having array_length(array_agg(distinct corretor_id),1)>1) g
    join wa_core.sessao s on s.id=g.sessao_id
   where not exists (select 1 from wa_core.quarentena q where q.tipo='vinculo_divergente'
                      and q.sessao_id=g.sessao_id and q.resolvido_em is null);

  insert into wa_core.quarentena (tipo,chave,detalhe)
  select 'legado_sem_sessao', w.session_id, jsonb_build_object('tabela','wa_instancias','corretor_id',w.corretor_id)
    from public.wa_instancias w
   where not exists (select 1 from wa_core.sessao s where s.provider_account_id=p_account and s.provider_session_id=w.session_id)
     and not exists (select 1 from wa_core.quarentena q where q.tipo='legado_sem_sessao'
                      and q.chave=w.session_id and q.resolvido_em is null);

  return jsonb_build_object('sessoes',_s,'vinculos',_v,
    'quarentena_aberta',(select count(*) from wa_core.quarentena where resolvido_em is null));
end $fn$;
