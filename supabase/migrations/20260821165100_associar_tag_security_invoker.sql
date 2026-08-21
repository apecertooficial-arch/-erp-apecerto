-- A associação não precisa elevar privilégios: leads já possui RLS por dono
-- e o Funil 2.0 já filtra a carteira do corretor. Mantemos as duas barreiras.
create or replace function public.f2_associar_tag(
  p_funil_lead_id uuid,
  p_tag_id uuid,
  p_cor text
) returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_tag public.lead_tag_catalogo%rowtype;
  v_lead_id bigint;
  v_tags jsonb;
  v_sem_duplicata jsonb;
  v_cor text := upper(btrim(coalesce(p_cor, '')));
begin
  if v_uid is null or public.f2_pode_operar_lead(p_funil_lead_id) is not true then
    return jsonb_build_object('ok', false, 'erro', 'sem_permissao');
  end if;
  if v_cor !~ '^#[0-9A-F]{6}$' then
    return jsonb_build_object('ok', false, 'erro', 'cor_invalida');
  end if;

  select * into v_tag
    from public.lead_tag_catalogo
   where id = p_tag_id and ativo = true;
  if not found then
    return jsonb_build_object('ok', false, 'erro', 'tag_invalida');
  end if;

  select n.lead_id into v_lead_id
    from public.f2_lead f
    join public.negocios n on n.id = f.origem_negocio_id
   where f.id = p_funil_lead_id;
  if v_lead_id is null then
    return jsonb_build_object('ok', false, 'erro', 'lead_nao_encontrado');
  end if;

  select coalesce(tags, '[]'::jsonb) into v_tags
    from public.leads where id = v_lead_id for update;
  if not found then
    return jsonb_build_object('ok', false, 'erro', 'lead_nao_encontrado');
  end if;
  if jsonb_typeof(v_tags) <> 'array' then v_tags := '[]'::jsonb; end if;

  select coalesce(jsonb_agg(e.item), '[]'::jsonb) into v_sem_duplicata
    from jsonb_array_elements(v_tags) e(item)
   where lower(btrim(case
     when jsonb_typeof(e.item) = 'string' then trim(both '"' from e.item::text)
     else coalesce(e.item->>'name', e.item->>'nome', '')
   end)) <> lower(btrim(v_tag.nome));

  update public.leads
     set tags = v_sem_duplicata || jsonb_build_array(jsonb_build_object(
       'id', v_tag.id, 'name', btrim(v_tag.nome), 'color', v_cor, 'source', 'manual_funil2'
     )), atualizado_em = now()
   where id = v_lead_id;

  if not found then
    return jsonb_build_object('ok', false, 'erro', 'sem_permissao');
  end if;
  return jsonb_build_object('ok', true, 'tag', btrim(v_tag.nome), 'cor', v_cor);
end;
$$;

revoke all on function public.f2_associar_tag(uuid, uuid, text) from public, anon;
grant execute on function public.f2_associar_tag(uuid, uuid, text) to authenticated;
