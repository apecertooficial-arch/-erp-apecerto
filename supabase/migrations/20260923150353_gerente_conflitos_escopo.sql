-- A disponibilidade do gerente nao pode expor clientes de carteiras alheias.
set local lock_timeout = '5s';
set local statement_timeout = '120s';

create or replace function public.gerente_conflitos(
  p_gerente bigint, p_data date, p_inicio time without time zone,
  p_fim time without time zone, p_exclude uuid default null
) returns table(
  id uuid, cliente_nome text, corretor_id bigint,
  hora_inicio time without time zone, hora_fim time without time zone
)
language plpgsql
stable
security definer
set search_path = ''
as $function$
declare
  v_corretor_id bigint;
  v_gestao boolean;
begin
  if auth.uid() is null then
    raise exception using errcode = '42501', message = 'sem_permissao';
  end if;

  v_gestao := coalesce(public.papel_no_grupo('gestao'), false);
  select c.id into v_corretor_id
    from public.corretores c
   where c.usuario_id = auth.uid() and coalesce(c.ativo, true)
   order by c.id limit 1;

  if not v_gestao and (
    v_corretor_id is null
    or p_gerente is distinct from public.corretor_gerente(v_corretor_id)
  ) then
    raise exception using errcode = '42501', message = 'sem_permissao';
  end if;

  return query
  select case when v_gestao or v.corretor_id = v_corretor_id then v.id else null end,
         case when v_gestao or v.corretor_id = v_corretor_id then v.cliente_nome else null end,
         case when v_gestao or v.corretor_id = v_corretor_id then v.corretor_id else null end,
         v.hora_inicio, v.hora_fim
    from public.visitas v
   where v.gerente_id = p_gerente
     and v.data = p_data
     and v.status = 'agendada'
     and (p_exclude is null or v.id <> p_exclude)
     and v.hora_inicio is not null
     and (p_inicio, coalesce(p_fim, (p_inicio + interval '1 hour')::time))
         overlaps (v.hora_inicio, coalesce(v.hora_fim, (v.hora_inicio + interval '1 hour')::time));
end;
$function$;

revoke all on function public.gerente_conflitos(
  bigint,date,time without time zone,time without time zone,uuid
) from public,anon;
grant execute on function public.gerente_conflitos(
  bigint,date,time without time zone,time without time zone,uuid
) to authenticated,service_role;
