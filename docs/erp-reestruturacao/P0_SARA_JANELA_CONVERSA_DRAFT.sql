-- P0 — Sara espera a conversa esfriar antes de classificar.
-- Ensaio reversivel: valida a producao observada, aplica dentro da transacao,
-- comprova o contrato e SEMPRE desfaz. Nao executar como migration definitiva.

begin;

set local statement_timeout = '60s';
set local lock_timeout = '5s';
select pg_advisory_xact_lock(hashtextextended('p0_sara_janela_conversa_draft', 0));

do $preflight$
declare
  v_hash text;
  v_quiet smallint;
  v_maximum smallint;
begin
  select encode(extensions.digest(pg_get_functiondef(
    'private.sara_enfileirar_mensagem(uuid)'::regprocedure
  ), 'sha256'), 'hex') into v_hash;

  if v_hash <> 'c12a68df57a7dac2e0f8733decfd054bec8e8dfe65ca7495f62cef0c17876b71' then
    raise exception 'PREFLIGHT_FAILED: sara_enfileirar_mensagem divergiu: %', v_hash;
  end if;

  if not exists (
    select 1 from pg_constraint
     where conrelid = 'public.f2_sara_config'::regclass
       and conname = 'f2_sara_config_quiet_window_seconds_check'
       and pg_get_constraintdef(oid) =
         'CHECK (((quiet_window_seconds >= 1) AND (quiet_window_seconds <= 15)))'
  ) then
    raise exception 'PREFLIGHT_FAILED: constraint quiet_window_seconds divergiu';
  end if;

  if not exists (
    select 1 from pg_constraint
     where conrelid = 'public.f2_sara_config'::regclass
       and conname = 'f2_sara_config_max_batch_wait_seconds_check'
       and pg_get_constraintdef(oid) =
         'CHECK (((max_batch_wait_seconds >= 5) AND (max_batch_wait_seconds <= 30)))'
  ) then
    raise exception 'PREFLIGHT_FAILED: constraint max_batch_wait_seconds divergiu';
  end if;

  select quiet_window_seconds, max_batch_wait_seconds
    into v_quiet, v_maximum
    from public.f2_sara_config where id;
  if v_quiet <> 6 or v_maximum <> 15 then
    raise exception 'PREFLIGHT_FAILED: configuracao observada mudou: quiet=%, max=%',
      v_quiet, v_maximum;
  end if;
end
$preflight$;

alter table public.f2_sara_config
  drop constraint f2_sara_config_quiet_window_seconds_check,
  drop constraint f2_sara_config_max_batch_wait_seconds_check;

alter table public.f2_sara_config
  alter column quiet_window_seconds set default 90,
  alter column max_batch_wait_seconds set default 600;

update public.f2_sara_config
   set quiet_window_seconds = 90,
       max_batch_wait_seconds = 600
 where id;

alter table public.f2_sara_config
  add constraint f2_sara_config_quiet_window_seconds_check
    check (quiet_window_seconds between 30 and 300),
  add constraint f2_sara_config_max_batch_wait_seconds_check
    check (max_batch_wait_seconds between 60 and 900),
  add constraint f2_sara_config_batch_window_order_check
    check (max_batch_wait_seconds >= quiet_window_seconds);

do $patch_function$
declare
  v_def text := pg_get_functiondef(
    'private.sara_enfileirar_mensagem(uuid)'::regprocedure
  );
  v_new text;
  v_old_quiet constant text :=
    'v_silencio:=greatest(1,least(coalesce(v_silencio,6),15));';
  v_new_quiet constant text :=
    'v_silencio:=greatest(30,least(coalesce(v_silencio,90),300));';
  v_old_maximum constant text :=
    'v_maximo:=greatest(v_silencio,least(coalesce(v_maximo,15),30));';
  v_new_maximum constant text :=
    'v_maximo:=greatest(v_silencio,least(coalesce(v_maximo,600),900));';
begin
  if position(v_old_quiet in v_def) = 0
     or position(v_old_maximum in v_def) = 0 then
    raise exception 'PATCH_FAILED: ancoras da janela nao correspondem ao preflight';
  end if;
  v_new := replace(replace(v_def, v_old_quiet, v_new_quiet),
                   v_old_maximum, v_new_maximum);
  if v_new = v_def then
    raise exception 'PATCH_FAILED: definicao permaneceu igual';
  end if;
  execute v_new;
end
$patch_function$;

do $verify$
declare
  v_def text := pg_get_functiondef(
    'private.sara_enfileirar_mensagem(uuid)'::regprocedure
  );
  v_quiet smallint;
  v_maximum smallint;
begin
  select quiet_window_seconds, max_batch_wait_seconds
    into v_quiet, v_maximum
    from public.f2_sara_config where id;
  if v_quiet <> 90 or v_maximum <> 600 then
    raise exception 'VERIFY_FAILED: configuracao nao aplicada no ensaio';
  end if;
  if position(
    'v_silencio:=greatest(30,least(coalesce(v_silencio,90),300));' in v_def
  ) = 0 or position(
    'v_maximo:=greatest(v_silencio,least(coalesce(v_maximo,600),900));' in v_def
  ) = 0 then
    raise exception 'VERIFY_FAILED: funcao nao usa a nova janela';
  end if;
end
$verify$;

rollback;
