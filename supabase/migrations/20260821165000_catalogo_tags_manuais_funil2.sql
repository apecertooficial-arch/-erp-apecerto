-- Catálogo enxuto para associação manual no Funil 2.0.
-- Tags de anúncio/campanha/origem continuam no lead como evidência histórica,
-- mas não poluem mais os seletores usados pelos corretores e automações.

create table if not exists public.lead_tag_catalogo (
  id uuid primary key default gen_random_uuid(),
  nome text not null check (char_length(btrim(nome)) between 2 and 80),
  cor text not null default '#FF7000' check (cor ~ '^#[0-9A-Fa-f]{6}$'),
  ativo boolean not null default true,
  criado_em timestamptz not null default now(),
  criado_por uuid null references auth.users(id)
);

create unique index if not exists lead_tag_catalogo_nome_unico
  on public.lead_tag_catalogo (lower(btrim(nome)));

alter table public.lead_tag_catalogo enable row level security;
revoke all on public.lead_tag_catalogo from anon;
revoke all on public.lead_tag_catalogo from authenticated;
grant select on public.lead_tag_catalogo to authenticated;

drop policy if exists lead_tag_catalogo_leitura on public.lead_tag_catalogo;
create policy lead_tag_catalogo_leitura on public.lead_tag_catalogo
  for select to authenticated using (ativo = true);

insert into public.lead_tag_catalogo (nome, cor)
values
  ('GRC | CARINAS', '#FDBA74'),
  ('COMPOSITE | NR', '#EA580C'),
  ('MIRUNA', '#FF7000'),
  ('Adelmo 2100', '#FF7000'),
  ('produto:Atmos Moema', '#FF7000')
on conflict ((lower(btrim(nome)))) do update
set cor = excluded.cor, ativo = true;

create or replace function public.f2_associar_tag(
  p_funil_lead_id uuid,
  p_tag_id uuid,
  p_cor text
) returns jsonb
language plpgsql
security definer
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

  update public.lead_tag_catalogo set cor = v_cor where id = v_tag.id;

  insert into public.f2_evento(funil_lead_id, tipo, titulo, detalhe, payload, criado_por)
  values (p_funil_lead_id, 'nota_adicionada', 'Tag associada ao lead', btrim(v_tag.nome),
    jsonb_build_object('tag_id', v_tag.id, 'tag', btrim(v_tag.nome), 'cor', v_cor), v_uid);

  return jsonb_build_object('ok', true, 'tag', btrim(v_tag.nome), 'cor', v_cor);
end;
$$;

revoke all on function public.f2_associar_tag(uuid, uuid, text) from public, anon;
grant execute on function public.f2_associar_tag(uuid, uuid, text) to authenticated;

-- O seletor das automações deixa de varrer milhares de leads e passa a usar
-- somente o catálogo manual aprovado.
create or replace function public.automacao_tags()
returns text[]
language sql
stable
security invoker
set search_path = ''
as $$
  select coalesce(array_agg(nome order by nome), '{}')
  from public.lead_tag_catalogo
  where ativo = true
$$;

revoke all on function public.automacao_tags() from public, anon;
grant execute on function public.automacao_tags() to authenticated, service_role;
