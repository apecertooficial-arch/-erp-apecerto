begin;

select pg_advisory_xact_lock(hashtextextended('fixar_instancia_claudia_3785', 0));

do $migration$
declare
  v_corretor_id bigint;
  v_instancia_3785 bigint;
  v_total_alvos integer;
begin
  select c.id
    into v_corretor_id
    from public.corretores c
   where lower(trim(c.nome)) = 'claudia'
     and coalesce(c.ativo, false)
   order by c.id
   limit 1;

  if v_corretor_id is null then
    raise exception 'Corretora Claudia ativa nao encontrada';
  end if;

  select count(*), min(i.id)
    into v_total_alvos, v_instancia_3785
    from public.instancias i
   where regexp_replace(coalesce(i.numero_conectado, i.telefone, ''), '[^0-9]', '', 'g') like '%3785';

  if v_total_alvos <> 1 or v_instancia_3785 is null then
    raise exception 'Esperada exatamente uma instancia terminada em 3785; encontradas %', v_total_alvos;
  end if;

  if not exists (
    select 1
      from public.instancias i
      join public.instancias_credenciais ic on ic.instancia_id = i.id
     where i.id = v_instancia_3785
       and coalesce(i.conectada, false)
       and i.status_dapi = 'connected'
       and nullif(i.instancia_dapi, '') is not null
       and nullif(ic.apikey, '') is not null
  ) then
    raise exception 'A instancia 3785 nao esta conectada e credenciada; alteracao cancelada';
  end if;

  -- A 3785 passa a ser a unica instancia operacional da Claudia.
  update public.instancias
     set corretor_id = v_corretor_id,
         ativa = true
   where id = v_instancia_3785;

  update public.instancias
     set corretor_id = null,
         ativa = false
   where corretor_id = v_corretor_id
     and id <> v_instancia_3785;

  delete from public.corretor_instancias
   where corretor_id = v_corretor_id
     and instancia_id <> v_instancia_3785;

  insert into public.corretor_instancias(corretor_id, instancia_id)
  values (v_corretor_id, v_instancia_3785)
  on conflict do nothing;

  -- Mantem o proprietario exigido pelo inventario historico, mas impede que
  -- sessoes antigas aparecam como canais conectados da Claudia.
  update public.wa_instancias
     set status = 'desconectado',
         atualizado_em = now()
   where corretor_id = v_corretor_id
     and session_id <> (
       select i.instancia_dapi
         from public.instancias i
        where i.id = v_instancia_3785
     );

  if exists (
    select 1
      from public.instancias i
     where i.corretor_id = v_corretor_id
       and i.id <> v_instancia_3785
  ) then
    raise exception 'Claudia ainda possui outra instancia operacional';
  end if;

  if (select count(*) from public.corretor_instancias ci where ci.corretor_id = v_corretor_id) <> 1
     or not exists (
       select 1
         from public.corretor_instancias ci
        where ci.corretor_id = v_corretor_id
          and ci.instancia_id = v_instancia_3785
     ) then
    raise exception 'Vinculo exclusivo da instancia 3785 nao foi confirmado';
  end if;
end
$migration$;

commit;
