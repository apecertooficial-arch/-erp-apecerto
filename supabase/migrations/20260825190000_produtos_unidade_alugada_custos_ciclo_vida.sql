-- Produtos v5: a unidade continua sendo o imóvel comercial canônico.
-- Custos, condição "compre já alugado" e ciclo de vida passam a pertencer à
-- unidade. Condomínio/empreendimento permanece somente como referência.

set lock_timeout = '5s';
set statement_timeout = '60s';

alter table public.unidades
  add column if not exists compre_ja_alugado boolean not null default false,
  add column if not exists condominio_valor numeric,
  add column if not exists iptu numeric,
  add column if not exists outros_custos numeric;

update public.unidades u
set condominio_valor = coalesce(u.condominio_valor, e.condominio_valor),
    iptu = coalesce(u.iptu, e.iptu),
    outros_custos = coalesce(u.outros_custos, e.outros_custos)
from public.empreendimentos e
where e.id = u.empreendimento_id
  and (u.condominio_valor is null or u.iptu is null or u.outros_custos is null);

alter table public.unidades drop constraint if exists unidades_condominio_valor_check;
alter table public.unidades add constraint unidades_condominio_valor_check
  check (condominio_valor is null or condominio_valor >= 0);
alter table public.unidades drop constraint if exists unidades_iptu_check;
alter table public.unidades add constraint unidades_iptu_check
  check (iptu is null or iptu >= 0);
alter table public.unidades drop constraint if exists unidades_outros_custos_check;
alter table public.unidades add constraint unidades_outros_custos_check
  check (outros_custos is null or outros_custos >= 0);

comment on column public.unidades.compre_ja_alugado is
  'Imóvel vendido com contrato de locação vigente; sinalização comercial por unidade.';
comment on column public.unidades.condominio_valor is
  'Custo mensal próprio da unidade. O valor do empreendimento é apenas fallback legado.';
comment on column public.unidades.iptu is
  'IPTU próprio da unidade. O valor do empreendimento é apenas fallback legado.';
comment on column public.unidades.outros_custos is
  'Outros custos próprios da unidade. O valor do empreendimento é apenas fallback legado.';

create or replace function public.produto_unidade_definir_disponibilidade(
  p_empreendimento_id uuid,
  p_unidade_id uuid,
  p_disponivel boolean
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_corretor_id bigint;
  v_unidade public.unidades%rowtype;
  v_gerencia boolean := false;
begin
  if v_uid is null then
    raise insufficient_privilege using
      message = 'UNIT_AVAILABILITY_FORBIDDEN: sessão inválida.';
  end if;

  v_gerencia := coalesce(public.is_product_manager(), false);
  select c.id into v_corretor_id
  from public.corretores c
  where c.usuario_id = v_uid
  limit 1;

  select u.* into v_unidade
  from public.unidades u
  where u.id = p_unidade_id
    and u.empreendimento_id = p_empreendimento_id
  for update;

  if not found then
    raise no_data_found using
      message = 'UNIT_NOT_FOUND: unidade não encontrada.';
  end if;

  if not v_gerencia
     and (v_corretor_id is null
       or v_unidade.captador_corretor_id is distinct from v_corretor_id) then
    raise insufficient_privilege using
      message = 'UNIT_AVAILABILITY_FORBIDDEN: somente o captador ou a gestão pode alterar esta unidade.';
  end if;

  update public.unidades u
  set disponivel = p_disponivel,
      -- Reativar preserva o estado fora do ar; publicar continua sendo uma
      -- decisão separada da gestão. Inativar sempre retira do site.
      publicado = case when p_disponivel then v_unidade.publicado else false end
  where u.id = p_unidade_id
    and u.empreendimento_id = p_empreendimento_id;

  return jsonb_build_object(
    'ok', true,
    'empreendimento_id', p_empreendimento_id,
    'unidade_id', p_unidade_id,
    'disponivel', p_disponivel,
    'publicado', case when p_disponivel then v_unidade.publicado else false end
  );
end;
$$;

revoke all on function public.produto_unidade_definir_disponibilidade(uuid, uuid, boolean) from public;
revoke all on function public.produto_unidade_definir_disponibilidade(uuid, uuid, boolean) from anon;
grant execute on function public.produto_unidade_definir_disponibilidade(uuid, uuid, boolean) to authenticated;

comment on function public.produto_unidade_definir_disponibilidade(uuid, uuid, boolean) is
  'Inativa/reativa uma unidade de forma auditável. Captador e gestão podem operar; inativar também despublica.';

create or replace function public.produto_unidade_excluir(
  p_empreendimento_id uuid,
  p_unidade_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_corretor_id bigint;
  v_usuario_nome text;
  v_gerencia boolean := false;
  v_unidade public.unidades%rowtype;
  v_emp public.empreendimentos%rowtype;
  v_unidades_total bigint := 0;
  v_excluir_produto boolean := false;
  v_midias_paths text[] := array[]::text[];
  v_midias_total bigint := 0;
  v_negocios bigint := 0;
  v_propostas bigint := 0;
  v_vendas bigint := 0;
  v_leads bigint := 0;
  v_anuncios bigint := 0;
  v_vinculos_unidade bigint := 0;
  v_vinculos_produto bigint := 0;
begin
  if v_uid is null then
    raise insufficient_privilege using
      message = 'UNIT_DELETE_FORBIDDEN: sessão inválida.';
  end if;

  v_gerencia := coalesce(public.is_product_manager(), false);
  select c.id into v_corretor_id
  from public.corretores c
  where c.usuario_id = v_uid
  limit 1;

  select e.* into v_emp
  from public.empreendimentos e
  where e.id = p_empreendimento_id
  for update;

  if not found then
    raise no_data_found using
      message = 'PRODUCT_NOT_FOUND: produto não encontrado.';
  end if;

  select u.* into v_unidade
  from public.unidades u
  where u.id = p_unidade_id
    and u.empreendimento_id = p_empreendimento_id
  for update;

  if not found then
    raise no_data_found using
      message = 'UNIT_NOT_FOUND: unidade não encontrada.';
  end if;

  if not v_gerencia
     and (v_unidade.de_terceiros is not true
       or v_corretor_id is null
       or v_unidade.captador_corretor_id is distinct from v_corretor_id) then
    raise insufficient_privilege using
      message = 'UNIT_DELETE_FORBIDDEN: somente o captador da unidade ou a gestão pode excluí-la.';
  end if;

  select count(*) into v_negocios from public.negocios n where n.unidade_id = p_unidade_id;
  select count(*) into v_propostas from public.ncrm_proposta p where p.unidade_id = p_unidade_id;
  select count(*) into v_vendas from public.vendas v where v.unidade_id = p_unidade_id;
  select count(*) into v_leads from public.site_leads l where l.unidade_id = p_unidade_id;
  select count(*) into v_anuncios from public.anuncios_site a where a.unidade_id = p_unidade_id;
  v_vinculos_unidade := v_negocios + v_propostas + v_vendas + v_leads + v_anuncios;

  if v_vinculos_unidade > 0 then
    raise exception using
      errcode = 'P0001',
      message = 'UNIT_HAS_LINKS: este imóvel possui histórico comercial e não pode ser excluído. Inative-o para preservar os registros.',
      detail = jsonb_build_object(
        'negocios', v_negocios,
        'propostas', v_propostas,
        'vendas', v_vendas,
        'leads_site', v_leads,
        'anuncios_site', v_anuncios
      )::text;
  end if;

  select count(*) into v_unidades_total
  from public.unidades u
  where u.empreendimento_id = p_empreendimento_id;

  v_excluir_produto := v_emp.origem = 'terceiros'
    and v_emp.condominio_id is null
    and v_unidades_total = 1;

  if v_excluir_produto then
    select
      (select count(*) from public.negocios n where n.empreendimento_id = p_empreendimento_id)
      + (select count(*) from public.vendas v where v.empreendimento_id = p_empreendimento_id)
      + (select count(*) from public.visitas v where v.empreendimento_id = p_empreendimento_id)
      + (select count(*) from public.f2_visita v where v.empreendimento_id = p_empreendimento_id)
      + (select count(*) from public.pipelines p where p.empreendimento_id = p_empreendimento_id)
      + (select count(*) from public.ncrm_proposta p where p.empreendimento_id = p_empreendimento_id)
      + (select count(*) from public.captacoes_portal c where c.empreendimento_id = p_empreendimento_id)
    into v_vinculos_produto;

    if v_vinculos_produto > 0 then
      raise exception using
        errcode = 'P0001',
        message = 'PRODUCT_HAS_LINKS: este imóvel possui histórico comercial e não pode ser excluído. Inative-o para preservar os registros.';
    end if;
  end if;

  select coalesce(array_agg(m.storage_path order by m.storage_path), array[]::text[]), count(*)
  into v_midias_paths, v_midias_total
  from public.midias m
  where m.empreendimento_id = p_empreendimento_id
    and (v_excluir_produto or m.unidade_id = p_unidade_id)
    and nullif(btrim(coalesce(m.storage_path, '')), '') is not null;

  select u.nome into v_usuario_nome
  from public.usuarios u
  where u.id = v_uid;

  insert into public.erp_auditoria (
    usuario_id, usuario_nome, acao, modulo, entidade, entidade_id,
    antes, depois, detalhe
  ) values (
    v_uid,
    v_usuario_nome,
    'excluir',
    'produtos',
    case when v_excluir_produto then 'empreendimento' else 'unidade' end,
    case when v_excluir_produto then p_empreendimento_id::text else p_unidade_id::text end,
    jsonb_build_object(
      'empreendimento_id', p_empreendimento_id,
      'unidade_id', p_unidade_id,
      'codigo', v_unidade.codigo,
      'numero', v_unidade.numero,
      'captador_corretor_id', v_unidade.captador_corretor_id,
      'publicado', v_unidade.publicado,
      'disponivel', v_unidade.disponivel,
      'midias_total', v_midias_total
    ),
    null,
    'Exclusão segura de imóvel individual; condomínio e demais unidades preservados. txid='
      || txid_current()::text
  );

  if v_excluir_produto then
    delete from public.empreendimentos e where e.id = p_empreendimento_id;
  else
    delete from public.unidades u
    where u.id = p_unidade_id and u.empreendimento_id = p_empreendimento_id;
  end if;

  if not found then
    raise serialization_failure using
      message = 'UNIT_DELETE_RACE: o imóvel mudou durante a exclusão; tente novamente.';
  end if;

  return jsonb_build_object(
    'ok', true,
    'empreendimento_id', p_empreendimento_id,
    'unidade_id', p_unidade_id,
    'produto_excluido', v_excluir_produto,
    'midias_paths', to_jsonb(v_midias_paths),
    'midias_total', v_midias_total
  );
end;
$$;

revoke all on function public.produto_unidade_excluir(uuid, uuid) from public;
revoke all on function public.produto_unidade_excluir(uuid, uuid) from anon;
grant execute on function public.produto_unidade_excluir(uuid, uuid) to authenticated;

comment on function public.produto_unidade_excluir(uuid, uuid) is
  'Exclui uma unidade sem afetar o condomínio ou irmãs. Captador pode excluir a própria captação sem histórico; gestão pode excluir qualquer unidade.';
