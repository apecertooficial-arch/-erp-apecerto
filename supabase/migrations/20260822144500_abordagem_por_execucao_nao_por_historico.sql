-- A excecao a conversa antiga e estritamente limitada as duas entradas de
-- campanha, a cards frescos e a uma execucao real identificada na fila.

begin;

create or replace function public.motor_abordagem_preflight_execucao(
  p_automacao_id bigint,
  p_lead_id bigint,
  p_telefone text,
  p_execution_id text
) returns jsonb
language plpgsql
stable
security definer
set search_path=''
as $fn$
declare
  v_padrao jsonb;
  v_exec bigint;
begin
  v_padrao:=public.motor_abordagem_preflight(p_lead_id,p_telefone);
  if coalesce((v_padrao->>'ok')::boolean,false) then
    return v_padrao;
  end if;
  if v_padrao->>'motivo'<>'conversa_existente' then
    return v_padrao;
  end if;

  -- Nenhuma outra automacao recebe a excecao.
  if p_automacao_id not in (65,66) or coalesce(p_execution_id,'')!~'^[1-9][0-9]*$' then
    return v_padrao;
  end if;
  v_exec:=p_execution_id::bigint;

  -- A identidade precisa pertencer a esta automacao e a versao publicada.
  if not exists(
    select 1
      from public.motor_fila mf
      join public.automacoes a on a.id=mf.automacao_id
     where mf.id=v_exec and mf.automacao_id=p_automacao_id
       and mf.automacao_versao_id=a.versao_publicada_id
  ) then
    return v_padrao;
  end if;

  -- Somente a captacao fresca, materializada no Funil 2.0 apos o corte.
  if not exists(
    select 1
      from public.f2_lead f
      join public.negocios n on n.id=f.origem_negocio_id
     where n.lead_id=p_lead_id
       and public.f2_lead_automatico_elegivel(f.id)
  ) then
    return v_padrao;
  end if;

  return jsonb_build_object(
    'ok',true,'status','apto',
    'motivo','captacao_fresca_com_execucao_idempotente',
    'execution_id',v_exec
  );
end
$fn$;

revoke all on function public.motor_abordagem_preflight_execucao(bigint,bigint,text,text)
  from public,anon,authenticated;
grant execute on function public.motor_abordagem_preflight_execucao(bigint,bigint,text,text)
  to service_role;

do $patch_runtime$
declare v_def text;v_new text;
begin
  select pg_get_functiondef(p.oid) into v_def from pg_proc p
  join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='public' and p.proname='motor_rodar_unchecked' limit 1;
  v_new:=replace(v_def,
    '_send_gate := public.motor_abordagem_preflight(v_lead_id,v_tel);',
    '_send_gate := public.motor_abordagem_preflight_execucao(p_auto_id,v_lead_id,v_tel,p_lead->>''__motor_execution_id'');');
  if v_new=v_def then raise exception 'PREFLIGHT_EXECUCAO_SEM_ANCORA'; end if;
  execute v_new;
end
$patch_runtime$;

do $verify$
begin
  if not exists (
    select 1 from pg_constraint c join pg_class t on t.oid=c.conrelid
    join pg_namespace n on n.oid=t.relnamespace
    where n.nspname='public' and t.relname='motor_mensagem_partes' and c.contype='u'
      and pg_get_constraintdef(c.oid) ilike '%execution_id%automacao_id%bloco_id%parte%'
  ) then raise exception 'IDEMPOTENCIA_DA_MENSAGEM_AUSENTE'; end if;
end
$verify$;

commit;
