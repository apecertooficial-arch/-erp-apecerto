-- Remove a ultima dependencia operacional da Sara sobre a regua aposentada.
-- Nao remove nem altera os objetos antigos; o corte fisico fica separado.

create or replace function public.f2_proximo_prazo_contato(p_de timestamptz, p_tentativa integer)
returns timestamptz language sql stable set search_path = public as $$
  select case p_tentativa
    when 1 then public.f2_soma_dias_uteis(p_de, 0)
    when 2 then public.f2_soma_dias_uteis(p_de, 1)
    when 3 then public.f2_soma_dias_uteis(p_de, 1)
    when 4 then public.f2_soma_dias_uteis(p_de, 1)
    when 5 then public.f2_soma_dias_uteis(p_de, 2)
    when 6 then public.f2_soma_dias_uteis(p_de, 1)
    else null
  end;
$$;

revoke all on function public.f2_proximo_prazo_contato(timestamptz, integer)
from public, anon, authenticated;
grant execute on function public.f2_proximo_prazo_contato(timestamptz, integer) to service_role;

do $$
declare r record;
begin
  for r in
    select p.oid, pg_get_functiondef(p.oid) as ddl
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname in ('f2_sara_ler_conversa', 'f2_sara_marcar_lido')
  loop
    execute replace(r.ddl, 'f2_cadencia_proximo_prazo', 'f2_proximo_prazo_contato');
  end loop;
end;
$$;

do $$
begin
  if exists (
    select 1
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname in ('f2_sara_ler_conversa', 'f2_sara_marcar_lido')
      and pg_get_functiondef(p.oid) ilike '%f2_cadencia_proximo_prazo%'
  ) then
    raise exception 'Sara ainda depende da regua aposentada';
  end if;
end;
$$;

comment on function public.f2_proximo_prazo_contato(timestamptz, integer) is
  'Calculo canonico de prazo da cadencia manual do Funil 2, sem tabela ou motor paralelo.';
