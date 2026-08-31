-- Minha Equipe grava o vínculo em corretor_instancias, enquanto Conexões V7
-- escopa as sessões por wa_core.sessao_vinculo e o dapi-qr ainda confere
-- instancias.corretor_id. As três representações precisam mudar juntas.

create or replace function wa_core.sincronizar_vinculo_instancia(
  p_instancia bigint,
  p_account bigint default 1
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, wa_core, public
as $function$
declare
  v_sessao bigint;
  v_quantidade integer := 0;
  v_corretor bigint;
  v_usuario uuid;
  v_atual bigint;
begin
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('wa_core.sincronizar_vinculo_instancia', p_instancia)
  );

  select s.id
    into v_sessao
    from wa_core.sessao s
   where s.provider_account_id = p_account
     and s.legado_instancia_id = p_instancia
   order by (s.arquivada_em is null) desc, s.id
   limit 1;

  if v_sessao is null then
    return jsonb_build_object('ok', false, 'motivo', 'sessao_canonica_ausente');
  end if;

  with candidatos as (
    select i.corretor_id
      from public.instancias i
     where i.id = p_instancia and i.corretor_id is not null
    union
    select ci.corretor_id
      from public.corretor_instancias ci
     where ci.instancia_id = p_instancia
  )
  select count(*)::integer, min(c.corretor_id)
    into v_quantidade, v_corretor
    from candidatos c;

  select v.corretor_id
    into v_atual
    from wa_core.sessao_vinculo v
   where v.sessao_id = v_sessao
     and v.vigente_ate is null
   order by v.id desc
   limit 1;

  if v_atual is not null
     and (v_quantidade <> 1 or v_atual is distinct from v_corretor) then
    update wa_core.sessao_vinculo
       set vigente_ate = greatest(
         pg_catalog.clock_timestamp(),
         vigente_de + interval '1 microsecond'
       )
     where sessao_id = v_sessao
       and vigente_ate is null;
    v_atual := null;
  end if;

  if v_quantidade = 1 then
    select c.usuario_id
      into v_usuario
      from public.corretores c
     where c.id = v_corretor;

    if v_atual is null then
      insert into wa_core.sessao_vinculo (
        sessao_id, corretor_id, usuario_id, origem
      ) values (
        v_sessao, v_corretor, v_usuario, 'corretor_instancias'
      );
    else
      update wa_core.sessao_vinculo
         set usuario_id = v_usuario,
             origem = 'corretor_instancias'
       where sessao_id = v_sessao
         and vigente_ate is null;
    end if;
  end if;

  return jsonb_build_object(
    'ok', v_quantidade = 1,
    'instancia_id', p_instancia,
    'sessao_id', v_sessao,
    'corretor_id', case when v_quantidade = 1 then v_corretor else null end,
    'quantidade_candidatos', v_quantidade
  );
end
$function$;

revoke all on function wa_core.sincronizar_vinculo_instancia(bigint, bigint)
  from public, anon, authenticated;
grant execute on function wa_core.sincronizar_vinculo_instancia(bigint, bigint)
  to service_role;

create or replace function wa_core.trg_sincronizar_vinculo_instancia()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, wa_core, public
as $function$
declare
  v_instancia bigint;
  v_anterior bigint;
  v_quantidade integer;
  v_corretor bigint;
begin
  if tg_table_name = 'corretor_instancias' then
    if tg_op = 'DELETE' then
      v_instancia := old.instancia_id;
    else
      v_instancia := new.instancia_id;
      if tg_op = 'UPDATE' and old.instancia_id is distinct from new.instancia_id then
        v_anterior := old.instancia_id;
      end if;
    end if;

    -- corretor_instancias é a autoridade quando Minha Equipe edita o vínculo.
    select count(distinct ci.corretor_id)::integer, min(ci.corretor_id)
      into v_quantidade, v_corretor
      from public.corretor_instancias ci
     where ci.instancia_id = v_instancia;

    update public.instancias
       set corretor_id = case when v_quantidade = 1 then v_corretor else null end
     where id = v_instancia
       and corretor_id is distinct from
           (case when v_quantidade = 1 then v_corretor else null end);

    perform wa_core.sincronizar_vinculo_instancia(v_instancia, 1);

    if v_anterior is not null then
      select count(distinct ci.corretor_id)::integer, min(ci.corretor_id)
        into v_quantidade, v_corretor
        from public.corretor_instancias ci
       where ci.instancia_id = v_anterior;

      update public.instancias
         set corretor_id = case when v_quantidade = 1 then v_corretor else null end
       where id = v_anterior
         and corretor_id is distinct from
             (case when v_quantidade = 1 then v_corretor else null end);

      perform wa_core.sincronizar_vinculo_instancia(v_anterior, 1);
    end if;
  else
    v_instancia := new.id;
    perform wa_core.sincronizar_vinculo_instancia(v_instancia, 1);
  end if;

  if tg_op = 'DELETE' then return old; end if;
  return new;
end
$function$;

revoke all on function wa_core.trg_sincronizar_vinculo_instancia()
  from public, anon, authenticated;

drop trigger if exists trg_wa_core_vinculo_corretor_instancias
  on public.corretor_instancias;
create trigger trg_wa_core_vinculo_corretor_instancias
after insert or update or delete on public.corretor_instancias
for each row execute function wa_core.trg_sincronizar_vinculo_instancia();

drop trigger if exists trg_wa_core_vinculo_instancias
  on public.instancias;
create trigger trg_wa_core_vinculo_instancias
after update of corretor_id on public.instancias
for each row
when (old.corretor_id is distinct from new.corretor_id)
execute function wa_core.trg_sincronizar_vinculo_instancia();

-- O vínculo já foi escolhido em Minha Equipe; corrige o inventário e a coluna
-- legada imediatamente sem tentar deduzir a pessoa pelo nome da sessão.
with alvo as (
  select i.id
  from public.instancias i
  where i.instancia_dapi = 'Jaqueline - 4285'
  order by i.id
  limit 1
), dono as (
  select a.id, count(distinct ci.corretor_id)::integer quantidade,
         min(ci.corretor_id) corretor_id
  from alvo a
  left join public.corretor_instancias ci on ci.instancia_id = a.id
  group by a.id
)
update public.instancias i
   set corretor_id = case when d.quantidade = 1 then d.corretor_id else null end
  from dono d
 where i.id = d.id
   and i.corretor_id is distinct from
       (case when d.quantidade = 1 then d.corretor_id else null end);

select wa_core.sincronizar_vinculo_instancia(i.id, 1)
from public.instancias i
where i.instancia_dapi = 'Jaqueline - 4285';
