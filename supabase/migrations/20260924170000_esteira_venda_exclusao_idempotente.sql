-- Esteira: retry da exclusão recupera o tombstone e os paths sem repetir efeitos.

alter table public.venda_exclusoes
  add column if not exists request_id uuid,
  add column if not exists request_payload jsonb,
  add column if not exists resultado jsonb;

create unique index if not exists venda_exclusoes_request_uidx
  on public.venda_exclusoes(request_id)
  where request_id is not null;

drop policy if exists vexcl_update_owner on public.venda_exclusoes;
create policy vexcl_update_owner on public.venda_exclusoes
  for update to authenticated
  using (excluido_por=auth.uid() and exists (
    select 1 from public.usuarios u
    where u.id=auth.uid() and u.role::text in ('admin','diretor')
  ))
  with check (excluido_por=auth.uid() and exists (
    select 1 from public.usuarios u
    where u.id=auth.uid() and u.role::text in ('admin','diretor')
  ));

create or replace function public.esteira_venda_excluir(
  p_processo uuid,
  p_motivo text,
  p_forcar boolean,
  p_descartar_lead boolean,
  p_request_id uuid
)
returns jsonb
language plpgsql
security invoker
set search_path=public,pg_temp
as $function$
declare
  v_uid uuid:=auth.uid();
  v_role text;
  v_payload jsonb;
  v_existente public.venda_exclusoes;
  v_tombstone_id uuid;
  v_resultado jsonb;
begin
  select u.role::text into v_role from public.usuarios u where u.id=v_uid;
  if v_uid is null or v_role is null or v_role not in ('admin','diretor') then
    raise exception 'ESTEIRA_EXCLUSAO_SEM_PERMISSAO: Apenas administrador ou diretor pode excluir uma venda.' using errcode='42501';
  end if;
  if p_processo is null or p_request_id is null then
    raise exception 'ESTEIRA_EXCLUSAO_DADOS_INVALIDOS: Venda ou identificador inválido.';
  end if;
  v_payload:=jsonb_build_object(
    'processo_id',p_processo,
    'motivo',nullif(btrim(coalesce(p_motivo,'')),''),
    'forcar',coalesce(p_forcar,false),
    'descartar_lead',coalesce(p_descartar_lead,false)
  );

  perform pg_advisory_xact_lock(hashtextextended(p_request_id::text,0));
  select * into v_existente
  from public.venda_exclusoes
  where request_id=p_request_id;
  if found then
    if v_existente.excluido_por=v_uid and v_existente.request_payload=v_payload then
      return coalesce(v_existente.resultado,'{}'::jsonb)
        ||jsonb_build_object('ok',true,'idempotente',true);
    end if;
    raise exception 'ESTEIRA_EXCLUSAO_REQUEST_CONFLITANTE: Esta solicitação já foi usada com outra exclusão. Atualize a tela.';
  end if;

  v_resultado:=public.excluir_venda_esteira(
    p_processo,p_motivo,coalesce(p_forcar,false),coalesce(p_descartar_lead,false)
  );
  if not coalesce((v_resultado->>'ok')::boolean,false) then
    return v_resultado;
  end if;

  select e.id into v_tombstone_id
  from public.venda_exclusoes e
  where e.processo_id=p_processo and e.excluido_por=v_uid and e.request_id is null
  order by e.excluido_em desc,e.id desc
  limit 1
  for update;
  if v_tombstone_id is null then
    raise exception 'ESTEIRA_EXCLUSAO_TOMBSTONE_AUSENTE: A venda foi excluída, mas o comprovante não foi localizado. A transação foi revertida.';
  end if;

  update public.venda_exclusoes set
    request_id=p_request_id,request_payload=v_payload,resultado=v_resultado
  where id=v_tombstone_id;
  return v_resultado||jsonb_build_object('idempotente',false);
end
$function$;

comment on function public.esteira_venda_excluir(uuid,text,boolean,boolean,uuid) is
  'Exclui venda pela rotina canônica e preserva tombstone/paths para retry idempotente. SECURITY INVOKER.';
revoke all on function public.esteira_venda_excluir(uuid,text,boolean,boolean,uuid) from public,anon;
grant execute on function public.esteira_venda_excluir(uuid,text,boolean,boolean,uuid) to authenticated,service_role;
notify pgrst,'reload schema';
