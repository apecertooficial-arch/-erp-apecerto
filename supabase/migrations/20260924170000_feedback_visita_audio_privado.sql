-- Áudio privado do feedback de visita.
-- A infraestrutura nasce desligada: o cutover só ocorre depois do deploy e
-- da prova autenticada da Edge. Nada é público nem usa URL assinada persistida.

begin;

do $guard$
begin
  if to_regclass('public.f2_visita') is null
     or to_regclass('public.f2_lead') is null
     or to_regprocedure('public.current_broker_id()') is null
     or to_regprocedure('public.f2_admin()') is null
     or to_regclass('vault.decrypted_secrets') is null
     or not exists(select 1 from pg_extension where extname='pg_net')
     or not exists(select 1 from pg_extension where extname='pg_cron') then
    raise exception 'preflight_feedback_audio_incompleto';
  end if;
  if to_regclass('public.f2_visita_feedback_audio') is not null
     or to_regclass('public.f2_visita_feedback_audio_config') is not null
     or exists(select 1 from storage.buckets where id='visita-feedback-audio')
     or exists(select 1 from pg_policies where policyname in (
       'f2_feedback_audio_read','f2_feedback_audio_upload'
     ))
     or to_regprocedure('public.f2_pode_acessar_audio_visita(uuid)') is not null
     or to_regprocedure('public.f2_pode_acessar_audio_path(text)') is not null
     or to_regprocedure('public.f2_feedback_audio_reservar(uuid,uuid,text,text,integer,text)') is not null
     or to_regprocedure('public.f2_feedback_audio_marcar_enviado(uuid)') is not null
     or to_regprocedure('public.f2_feedback_audio_consultar(uuid)') is not null
     or to_regprocedure('public.f2_feedback_audio_reivindicar(uuid)') is not null
     or to_regprocedure('public.f2_feedback_audio_concluir(uuid,text,text,text)') is not null
     or to_regprocedure('public.f2_feedback_audio_tick()') is not null
     or exists(select 1 from cron.job where jobname='f2-feedback-visita-audio') then
    raise exception 'colisao_feedback_audio';
  end if;
end
$guard$;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values(
  'visita-feedback-audio','visita-feedback-audio',false,20971520,
  array['audio/ogg','audio/webm','audio/mpeg','audio/mp4','audio/wav']::text[]
);

do $bucket_guard$
declare v_bucket storage.buckets%rowtype;
begin
  select * into v_bucket from storage.buckets where id='visita-feedback-audio';
  if v_bucket.id is null or v_bucket.public is true
     or v_bucket.file_size_limit is distinct from 20971520
     or v_bucket.allowed_mime_types is distinct from
       array['audio/ogg','audio/webm','audio/mpeg','audio/mp4','audio/wav']::text[] then
    raise exception 'bucket_feedback_audio_inseguro';
  end if;
end
$bucket_guard$;

create table public.f2_visita_feedback_audio(
  id uuid primary key,
  visita_id uuid not null references public.f2_visita(id) on delete restrict,
  storage_path text not null unique,
  mime_type text not null check(mime_type in ('audio/ogg','audio/webm','audio/mpeg','audio/mp4','audio/wav')),
  bytes integer not null check(bytes between 1 and 20971520),
  sha256 text not null check(sha256 ~ '^[a-f0-9]{64}$'),
  status text not null check(status in ('reservado','enviado','transcrevendo','transcrito','falhou')),
  transcricao text,
  erro_codigo text,
  tentativas smallint not null default 0 check(tentativas between 0 and 5),
  proxima_tentativa_em timestamptz,
  despachado_em timestamptz,
  enviado_por uuid not null references auth.users(id) on delete restrict,
  reservado_em timestamptz not null default statement_timestamp(),
  enviado_em timestamptz,
  transcrito_em timestamptz,
  atualizado_em timestamptz not null default statement_timestamp(),
  unique (visita_id,sha256),
  check((status='transcrito')=(transcricao is not null and transcrito_em is not null)),
  check(status<>'falhou' or erro_codigo is not null)
);

create table public.f2_visita_feedback_audio_config(
  id boolean primary key default true check(id),
  enabled boolean not null default false,
  lote smallint not null default 5 check(lote between 1 and 10),
  atualizado_em timestamptz not null default statement_timestamp()
);
insert into public.f2_visita_feedback_audio_config(id,enabled,lote)
values(true,false,5);

alter table public.f2_visita_feedback_audio enable row level security;
revoke all on table public.f2_visita_feedback_audio from public,anon,authenticated;
grant select on table public.f2_visita_feedback_audio to authenticated,service_role;
revoke all on table public.f2_visita_feedback_audio_config from public,anon,authenticated;
grant select,update on table public.f2_visita_feedback_audio_config to service_role;

create index if not exists ix_f2_visita_feedback_audio_fila
  on public.f2_visita_feedback_audio(status,proxima_tentativa_em,reservado_em,id)
  where status in ('enviado','transcrevendo','falhou');

create or replace function public.f2_pode_acessar_audio_visita(p_visita_id uuid)
returns boolean
language sql stable security definer
set search_path to ''
as $fn$
  select exists(
    select 1
      from public.f2_visita v
      join public.f2_lead f on f.id=v.funil_lead_id
     where v.id=p_visita_id
       and (public.f2_admin() is true or f.corretor_id=public.current_broker_id())
  )
$fn$;

revoke all on function public.f2_pode_acessar_audio_visita(uuid) from public,anon;
grant execute on function public.f2_pode_acessar_audio_visita(uuid) to authenticated,service_role;

create or replace function public.f2_pode_acessar_audio_path(p_name text)
returns boolean
language plpgsql stable security definer
set search_path to ''
as $fn$
declare
  v_partes text[]:=storage.foldername(p_name);
  v_visita_id uuid;
begin
  if coalesce(v_partes[1],'')<>'visita'
     or coalesce(v_partes[2],'') !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
     or storage.filename(p_name) !~ '^[0-9a-f-]{36}[.](ogg|webm|mp3|m4a|wav)$' then
    return false;
  end if;
  v_visita_id:=v_partes[2]::uuid;
  return public.f2_pode_acessar_audio_visita(v_visita_id);
exception when others then
  return false;
end
$fn$;

revoke all on function public.f2_pode_acessar_audio_path(text) from public,anon;
grant execute on function public.f2_pode_acessar_audio_path(text) to authenticated,service_role;

do $policies$
begin
  if not exists(select 1 from pg_policies where schemaname='public' and tablename='f2_visita_feedback_audio' and policyname='f2_feedback_audio_read') then
    create policy f2_feedback_audio_read on public.f2_visita_feedback_audio
      for select to authenticated
      using(public.f2_pode_acessar_audio_visita(visita_id));
  end if;
  if not exists(select 1 from pg_policies where schemaname='storage' and tablename='objects' and policyname='f2_feedback_audio_upload') then
    create policy f2_feedback_audio_upload on storage.objects
      for insert to authenticated
      with check(
        bucket_id='visita-feedback-audio'
        and public.f2_pode_acessar_audio_path(name)
        and exists(
          select 1 from public.f2_visita_feedback_audio a
           where a.storage_path=name and a.enviado_por=auth.uid() and a.status='reservado'
        )
      );
  end if;
  if not exists(select 1 from pg_policies where schemaname='storage' and tablename='objects' and policyname='f2_feedback_audio_read') then
    create policy f2_feedback_audio_read on storage.objects
      for select to authenticated
      using(bucket_id='visita-feedback-audio' and public.f2_pode_acessar_audio_path(name));
  end if;
end
$policies$;

create or replace function public.f2_feedback_audio_reservar(
  p_id uuid,p_visita_id uuid,p_storage_path text,p_mime_type text,p_bytes integer,p_sha256 text
) returns jsonb
language plpgsql security definer
set search_path to ''
as $fn$
declare
  v_uid uuid:=(select auth.uid());
  v_existente public.f2_visita_feedback_audio%rowtype;
begin
  if not exists(select 1 from public.f2_visita_feedback_audio_config where id=true and enabled) then
    return pg_catalog.jsonb_build_object('ok',false,'erro','audio_indisponivel');
  end if;
  if v_uid is null or public.f2_pode_acessar_audio_visita(p_visita_id) is not true then
    return pg_catalog.jsonb_build_object('ok',false,'erro','sem_permissao');
  end if;
  if p_id is null or p_storage_path<>pg_catalog.format('visita/%s/%s.%s',p_visita_id,p_id,
       case p_mime_type when 'audio/ogg' then 'ogg' when 'audio/webm' then 'webm'
         when 'audio/mpeg' then 'mp3' when 'audio/mp4' then 'm4a' when 'audio/wav' then 'wav' else '' end)
     or p_bytes not between 1 and 20971520 or p_sha256 !~ '^[a-f0-9]{64}$' then
    return pg_catalog.jsonb_build_object('ok',false,'erro','audio_invalido');
  end if;
  insert into public.f2_visita_feedback_audio(
    id,visita_id,storage_path,mime_type,bytes,sha256,status,enviado_por
  ) values(p_id,p_visita_id,p_storage_path,p_mime_type,p_bytes,p_sha256,'reservado',v_uid)
  on conflict(visita_id,sha256) do nothing;
  select * into v_existente from public.f2_visita_feedback_audio
   where visita_id=p_visita_id and sha256=p_sha256;
  if v_existente.enviado_por is distinct from v_uid then
    return pg_catalog.jsonb_build_object('ok',false,'erro','audio_conflito');
  end if;
  return pg_catalog.jsonb_build_object('ok',true,'id',v_existente.id,'path',v_existente.storage_path,
    'status',v_existente.status,'idempotente',v_existente.id<>p_id);
end
$fn$;

create or replace function public.f2_feedback_audio_marcar_enviado(p_id uuid)
returns jsonb
language plpgsql security definer
set search_path to ''
as $fn$
declare v_uid uuid:=(select auth.uid()); v_audio public.f2_visita_feedback_audio%rowtype;
begin
  select * into v_audio from public.f2_visita_feedback_audio where id=p_id for update;
  if v_uid is null or v_audio.id is null or v_audio.enviado_por<>v_uid
     or public.f2_pode_acessar_audio_visita(v_audio.visita_id) is not true then
    return pg_catalog.jsonb_build_object('ok',false,'erro','sem_permissao');
  end if;
  if v_audio.status='reservado' then
    update public.f2_visita_feedback_audio set status='enviado',enviado_em=statement_timestamp(),
      atualizado_em=statement_timestamp() where id=p_id;
  end if;
  return pg_catalog.jsonb_build_object('ok',true,'id',p_id,'status',
    case when v_audio.status='reservado' then 'enviado' else v_audio.status end);
end
$fn$;

create or replace function public.f2_feedback_audio_consultar(p_visita_id uuid)
returns jsonb
language plpgsql stable security definer
set search_path to ''
as $fn$
begin
  if (select auth.uid()) is null
     or public.f2_pode_acessar_audio_visita(p_visita_id) is not true then
    return pg_catalog.jsonb_build_object('ok',false,'erro','sem_permissao');
  end if;
  return pg_catalog.jsonb_build_object(
    'ok',true,
    'disponivel',true,
    'audios',coalesce((
      select pg_catalog.jsonb_agg(
        pg_catalog.jsonb_build_object(
          'id',a.id,
          'status',a.status,
          'transcricao',a.transcricao,
          'erro_codigo',a.erro_codigo,
          'criado_em',a.reservado_em,
          'atualizado_em',a.atualizado_em
        ) order by a.reservado_em desc,a.id desc
      )
      from public.f2_visita_feedback_audio a
      where a.visita_id=p_visita_id
    ),'[]'::jsonb)
  );
end
$fn$;

create or replace function public.f2_feedback_audio_reivindicar(p_id uuid)
returns jsonb
language plpgsql security definer
set search_path to ''
as $fn$
declare v_audio public.f2_visita_feedback_audio%rowtype;
begin
  select * into v_audio from public.f2_visita_feedback_audio where id=p_id for update skip locked;
  if v_audio.id is null or v_audio.status not in ('enviado','transcrevendo','falhou') or v_audio.tentativas>=5 then
    return pg_catalog.jsonb_build_object('ok',false,'erro','audio_indisponivel');
  end if;
  if v_audio.status='falhou' and v_audio.proxima_tentativa_em>statement_timestamp() then
    return pg_catalog.jsonb_build_object('ok',false,'erro','retry_ainda_nao_venceu');
  end if;
  if v_audio.status='transcrevendo' and v_audio.atualizado_em>statement_timestamp()-interval '10 minutes' then
    return pg_catalog.jsonb_build_object('ok',false,'erro','audio_em_processamento');
  end if;
  update public.f2_visita_feedback_audio set status='transcrevendo',tentativas=tentativas+1,
    erro_codigo=null,proxima_tentativa_em=null,atualizado_em=statement_timestamp() where id=p_id;
  return pg_catalog.jsonb_build_object('ok',true,'id',v_audio.id,'path',v_audio.storage_path,
    'mime_type',v_audio.mime_type,'bytes',v_audio.bytes,'sha256',v_audio.sha256);
end
$fn$;

create or replace function public.f2_feedback_audio_concluir(
  p_id uuid,p_status text,p_transcricao text default null,p_erro_codigo text default null
) returns jsonb
language plpgsql security definer
set search_path to ''
as $fn$
declare v_texto text:=nullif(left(btrim(coalesce(p_transcricao,'')),5000),'');
begin
  if p_status not in ('transcrito','falhou')
     or (p_status='transcrito' and v_texto is null)
     or (p_status='falhou' and nullif(btrim(coalesce(p_erro_codigo,'')),'') is null) then
    return pg_catalog.jsonb_build_object('ok',false,'erro','resultado_invalido');
  end if;
  update public.f2_visita_feedback_audio set status=p_status,transcricao=case when p_status='transcrito' then v_texto else null end,
    erro_codigo=case when p_status='falhou' then left(p_erro_codigo,80) else null end,
    proxima_tentativa_em=case when p_status='falhou' then
      statement_timestamp()+pg_catalog.make_interval(mins=>least(60,power(2,greatest(tentativas-1,0))::integer)) else null end,
    despachado_em=case when p_status='falhou' then null else despachado_em end,
    transcrito_em=case when p_status='transcrito' then statement_timestamp() else null end,
    atualizado_em=statement_timestamp()
  where id=p_id and status='transcrevendo';
  if not found then return pg_catalog.jsonb_build_object('ok',false,'erro','estado_conflito'); end if;
  return pg_catalog.jsonb_build_object('ok',true,'id',p_id,'status',p_status);
end
$fn$;

create or replace function public.f2_feedback_audio_tick()
returns jsonb
language plpgsql security definer
set search_path to ''
as $fn$
declare
  v_cfg public.f2_visita_feedback_audio_config%rowtype;
  v_url constant text:='https://diaegvfveqezispcthwk.supabase.co/functions/v1/f2-feedback-visita-transcrever';
  v_secret text;
  v_audio record;
  v_despachados integer:=0;
  v_falhas integer:=0;
begin
  select * into v_cfg from public.f2_visita_feedback_audio_config where id=true;
  if v_cfg.enabled is not true then
    return pg_catalog.jsonb_build_object('ok',true,'motivo','desligado','despachados',0);
  end if;
  begin
    select decrypted_secret into v_secret
      from vault.decrypted_secrets
      where name='ncrm_sara_cron_secret'
      limit 1;
  exception when others then
    return pg_catalog.jsonb_build_object('ok',false,'erro','vault_indisponivel','despachados',0);
  end;
  if length(coalesce(v_secret,''))<32 then
    return pg_catalog.jsonb_build_object('ok',false,'erro','configuracao_incompleta','despachados',0);
  end if;

  for v_audio in
    with candidatos as (
      select a.id
      from public.f2_visita_feedback_audio a
      where a.tentativas<5 and (
        (a.status='enviado' and (a.despachado_em is null or a.despachado_em<statement_timestamp()-interval '2 minutes'))
        or (a.status='falhou' and a.proxima_tentativa_em<=statement_timestamp()
          and (a.despachado_em is null or a.despachado_em<statement_timestamp()-interval '2 minutes'))
        or (a.status='transcrevendo' and a.atualizado_em<statement_timestamp()-interval '10 minutes'
          and (a.despachado_em is null or a.despachado_em<statement_timestamp()-interval '10 minutes'))
      )
      order by coalesce(a.proxima_tentativa_em,a.enviado_em,a.reservado_em),a.id
      limit v_cfg.lote
      for update skip locked
    ), marcados as (
      update public.f2_visita_feedback_audio a
         set despachado_em=statement_timestamp()
        from candidatos c
       where a.id=c.id
      returning a.id
    )
    select id from marcados
  loop
    begin
      perform net.http_post(
        url:=v_url,
        headers:=pg_catalog.jsonb_build_object(
          'Content-Type','application/json',
          'x-cron-secret',v_secret
        ),
        body:=pg_catalog.jsonb_build_object('audio_id',v_audio.id),
        timeout_milliseconds:=145000
      );
      v_despachados:=v_despachados+1;
    exception when others then
      update public.f2_visita_feedback_audio set despachado_em=null where id=v_audio.id;
      v_falhas:=v_falhas+1;
    end;
  end loop;
  return pg_catalog.jsonb_build_object('ok',v_falhas=0,'despachados',v_despachados,'falhas',v_falhas);
end
$fn$;

revoke all on function public.f2_feedback_audio_reservar(uuid,uuid,text,text,integer,text) from public,anon;
revoke all on function public.f2_feedback_audio_marcar_enviado(uuid) from public,anon;
revoke all on function public.f2_feedback_audio_consultar(uuid) from public,anon;
grant execute on function public.f2_feedback_audio_reservar(uuid,uuid,text,text,integer,text) to authenticated,service_role;
grant execute on function public.f2_feedback_audio_marcar_enviado(uuid) to authenticated,service_role;
grant execute on function public.f2_feedback_audio_consultar(uuid) to authenticated,service_role;

revoke all on function public.f2_feedback_audio_reivindicar(uuid) from public,anon,authenticated;
revoke all on function public.f2_feedback_audio_concluir(uuid,text,text,text) from public,anon,authenticated;
revoke all on function public.f2_feedback_audio_tick() from public,anon,authenticated;
grant execute on function public.f2_feedback_audio_reivindicar(uuid) to service_role;
grant execute on function public.f2_feedback_audio_concluir(uuid,text,text,text) to service_role;
grant execute on function public.f2_feedback_audio_tick() to service_role;

select cron.schedule(
  'f2-feedback-visita-audio','* * * * *',
  $cron$select public.f2_feedback_audio_tick();$cron$
);

do $assert$
begin
  if exists(select 1 from storage.buckets where id='visita-feedback-audio' and public) then
    raise exception 'bucket_publico';
  end if;
  if exists(select 1 from public.f2_visita_feedback_audio_config where enabled) then
    raise exception 'dispatcher_audio_ligado_sem_cutover';
  end if;
  if exists(select 1 from information_schema.role_table_grants where table_schema='public'
    and table_name='f2_visita_feedback_audio' and grantee='authenticated'
    and privilege_type in ('INSERT','UPDATE','DELETE')) then
    raise exception 'gravacao_direta_exposta';
  end if;
  if exists(select 1 from pg_policies where schemaname='storage' and tablename='objects'
    and policyname like 'f2_feedback_audio_%' and cmd in ('UPDATE','DELETE')) then
    raise exception 'mutacao_storage_exposta';
  end if;
end
$assert$;

-- ROLLBACK MANUAL ANTES DO CUTOVER (somente se bucket/tabela ainda vazios):
-- select cron.unschedule('f2-feedback-visita-audio');
-- revoke execute on function public.f2_feedback_audio_* ...;
-- drop policies f2_feedback_audio_*;
-- drop functions e tabela; delete bucket apenas após provar zero objetos.

commit;
