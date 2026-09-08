-- Garante a invariável do Funil 2.0 no ponto de escrita: todo negócio aberto,
-- com responsável, nasce com o respectivo card antes de a transação terminar.
--
-- O cron f2_entrada_distribuicao foi aposentado pela Central de Automações.
-- O cadastro manual ainda esperava por esse cron e podia salvar lead + negócio
-- sem criar o card visível para o corretor. A função f2_entrada_direta já é
-- idempotente; o trigger apenas a chama no mesmo commit do negócio.

begin;

set local lock_timeout = '5s';
set local statement_timeout = '60s';

create or replace function public.f2_negocio_garantir_card()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_etapa text;
begin
  if new.status = 'aberto'
     and new.corretor_id is not null
     and new.pipeline_id = public.f2_pipeline_id() then
    select nullif(trim(s.chave), '')
      into v_etapa
      from public.pipeline_stages s
     where s.id = new.stage_id
       and s.pipeline_id = new.pipeline_id;

    perform public.f2_entrada_direta(new.id, coalesce(v_etapa, 'novo'));
  end if;

  return new;
end;
$function$;

revoke all on function public.f2_negocio_garantir_card()
  from public, anon, authenticated;
grant execute on function public.f2_negocio_garantir_card()
  to service_role;

drop trigger if exists f2_negocio_garantir_card on public.negocios;
create trigger f2_negocio_garantir_card
after insert or update of pipeline_id, stage_id, status, corretor_id
on public.negocios
for each row
execute function public.f2_negocio_garantir_card();

do $verify$
begin
  if not exists (
    select 1
      from pg_trigger
     where tgrelid = 'public.negocios'::regclass
       and tgname = 'f2_negocio_garantir_card'
       and not tgisinternal
  ) then
    raise exception 'F2_NEGOCIO_CARD_TRIGGER_AUSENTE';
  end if;

  if has_function_privilege('authenticated',
       'public.f2_negocio_garantir_card()'::regprocedure, 'EXECUTE') then
    raise exception 'F2_NEGOCIO_CARD_TRIGGER_EXPOSTO';
  end if;
end;
$verify$;

commit;
