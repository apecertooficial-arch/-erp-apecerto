set lock_timeout = '5s';
set statement_timeout = '60s';

create or replace function public.produto_unidade_definir_disponibilidade_canonica(
  p_empreendimento_id uuid,
  p_unidade_id uuid,
  p_disponivel boolean
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_corretor_id bigint;
  v_unidade public.unidades%rowtype;
  v_gerencia boolean := false;
begin
  if v_uid is null or not exists (select 1 from public.usuarios us where us.id = v_uid and us.ativo) then
    raise insufficient_privilege using message = 'UNIT_AVAILABILITY_FORBIDDEN: perfil ativo obrigatório.';
  end if;
  v_gerencia := coalesce(public.is_product_manager(), false);
  select c.id into v_corretor_id from public.corretores c
  join public.usuarios us on us.id = c.usuario_id and us.ativo
  where c.usuario_id = v_uid limit 1;
  select u.* into v_unidade from public.unidades u
  where u.id = p_unidade_id and u.empreendimento_id = p_empreendimento_id for update;
  if not found then raise no_data_found using message = 'UNIT_NOT_FOUND: unidade não encontrada.'; end if;
  if not v_gerencia and (v_corretor_id is null or v_unidade.captador_corretor_id is distinct from v_corretor_id) then
    raise insufficient_privilege using message = 'UNIT_AVAILABILITY_FORBIDDEN: somente captador ou gestão.';
  end if;
  update public.unidades set disponivel = p_disponivel,
    publicado = case when p_disponivel then v_unidade.publicado else false end
  where id = p_unidade_id and empreendimento_id = p_empreendimento_id;
  return jsonb_build_object('ok',true,'empreendimento_id',p_empreendimento_id,'unidade_id',p_unidade_id,
    'disponivel',p_disponivel,'publicado',case when p_disponivel then v_unidade.publicado else false end);
end $$;

revoke all on function public.produto_unidade_definir_disponibilidade_canonica(uuid,uuid,boolean) from public, anon, authenticated;
grant execute on function public.produto_unidade_definir_disponibilidade_canonica(uuid,uuid,boolean) to authenticated;
revoke all on function public.produto_unidade_definir_disponibilidade(uuid,uuid,boolean) from public, anon, authenticated;
revoke all on function public.produto_unidade_excluir(uuid,uuid) from public, anon, authenticated;

do $$
begin
  if not has_function_privilege('authenticated','public.produto_unidade_definir_disponibilidade_canonica(uuid,uuid,boolean)','execute')
     or has_function_privilege('authenticated','public.produto_unidade_definir_disponibilidade(uuid,uuid,boolean)','execute')
     or has_function_privilege('authenticated','public.produto_unidade_excluir(uuid,uuid)','execute')
     or has_function_privilege('anon','public.produto_unidade_definir_disponibilidade_canonica(uuid,uuid,boolean)','execute') then
    raise exception 'RPC_POSTCHECK: privilégios canônicos/legados divergentes.';
  end if;
end $$;
