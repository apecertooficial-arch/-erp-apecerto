-- A edicao pode limpar o Local explicito; o espelho volta ao endereco do produto.
set local lock_timeout = '5s';
set local statement_timeout = '120s';

create or replace function public.f2_salvar_visita_local(
  p_id uuid, p_lead_id uuid, p_inicio_em timestamptz, p_imovel text,
  p_status text, p_observacao text, p_empreendimento_id uuid, p_unidade text,
  p_com_gerente boolean, p_gerente_id bigint, p_fim_em timestamptz,
  p_local text
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_result jsonb;
  v_local text := nullif(left(btrim(coalesce(p_local,'')),300),'');
begin
  v_result := public.f2_salvar_visita(
    p_id,p_lead_id,p_inicio_em,p_imovel,p_status,p_observacao,
    p_empreendimento_id,p_unidade,p_com_gerente,p_gerente_id,p_fim_em
  );
  if coalesce(v_result->>'ok','false') <> 'true' then
    return v_result;
  end if;

  update public.f2_visita set local=v_local
   where id=(v_result->>'id')::uuid and funil_lead_id=p_lead_id;
  if not found then
    raise exception 'F2_VISITA_LOCAL_NAO_PERSISTIDO';
  end if;
  return v_result;
end;
$function$;

revoke all on function public.f2_salvar_visita_local(
  uuid,uuid,timestamptz,text,text,text,uuid,text,boolean,bigint,timestamptz,text
) from public,anon;
grant execute on function public.f2_salvar_visita_local(
  uuid,uuid,timestamptz,text,text,text,uuid,text,boolean,bigint,timestamptz,text
) to authenticated,service_role;
