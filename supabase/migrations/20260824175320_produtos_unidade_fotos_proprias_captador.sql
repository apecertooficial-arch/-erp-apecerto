-- Unidade é o imóvel comercial. Fotos do empreendimento/condomínio são apenas
-- áreas comuns e nunca substituem a galeria privativa da unidade.

set lock_timeout = '5s';
set statement_timeout = '60s';

with retiradas as (
  update public.unidades u
  set publicado = false
  where u.publicado is true
    and not exists (
      select 1 from public.midias m
      where m.unidade_id = u.id
        and m.tipo = 'foto'::public.tipo_midia
    )
  returning u.id, u.codigo
)
insert into public.erp_auditoria (
  usuario_nome, acao, modulo, entidade, entidade_id, antes, depois, detalhe
)
select 'Sistema', 'despublicar_correcao_midia', 'produtos', 'unidade',
       r.id::text, jsonb_build_object('publicado', true),
       jsonb_build_object('publicado', false),
       'Unidade ' || coalesce(r.codigo, r.id::text) ||
       ' retirada do site por não possuir foto própria. Nenhuma mídia ou vínculo foi excluído.'
from retiradas r;

-- O usuário que cadastrou o produto-pai é prova suficiente somente quando
-- existe correspondência direta com um corretor. Nenhum vínculo é inferido.
with restauradas as (
  update public.unidades u
  set captador_corretor_id = c.id
  from public.empreendimentos e
  join public.corretores c on c.usuario_id = e.captado_por_usuario
  where e.id = u.empreendimento_id
    and u.captador_corretor_id is null
    and e.captado_por_usuario is not null
  returning u.id, c.id as captador_corretor_id, c.nome as captador_nome
)
insert into public.erp_auditoria (
  usuario_nome, acao, modulo, entidade, entidade_id, antes, depois, detalhe
)
select 'Sistema', 'restaurar_captador', 'produtos', 'unidade', r.id::text,
       jsonb_build_object('captador_corretor_id', null),
       jsonb_build_object('captador_corretor_id', r.captador_corretor_id,
                          'captador_nome', r.captador_nome),
       'Captador restaurado a partir do usuário comprovadamente responsável pelo cadastro do produto-pai.'
from restauradas r;

create or replace function private.produto_unidade_elegivel_site(
  p_unidade_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.unidades u
    join public.empreendimentos e on e.id = u.empreendimento_id
    where u.id = p_unidade_id
      and u.disponivel is true
      and u.aprovacao is not distinct from 'aprovado'
      and nullif(btrim(coalesce(u.numero, '')), '') is not null
      and nullif(btrim(coalesce(u.tipologia, '')), '') is not null
      and u.area_m2 > 0
      and coalesce(u.valor_promo, u.valor_tabela) is not null
      and case
        when lower(btrim(coalesce(e.finalidade, ''))) like '%alug%'
          or lower(btrim(coalesce(e.finalidade, ''))) like '%loca%'
          then coalesce(u.valor_promo, u.valor_tabela) between 500 and 500000
        else coalesce(u.valor_promo, u.valor_tabela) between 100000 and 100000000
      end
      and (u.valor_tabela is null or u.valor_promo is null
           or u.valor_promo <= u.valor_tabela)
      and exists (
        select 1 from public.midias m
        where m.unidade_id = u.id
          and m.tipo = 'foto'::public.tipo_midia
      )
      and (
        u.de_terceiros is false
        or (
          u.de_terceiros is true
          and u.captador_corretor_id is not null
          and nullif(btrim(coalesce(u.proprietario_nome, '')), '') is not null
          and nullif(btrim(coalesce(u.proprietario_contato, '')), '') is not null
          and nullif(btrim(coalesce(u.acesso_tipo, '')), '') is not null
          and nullif(btrim(coalesce(u.acesso_instrucoes, '')), '') is not null
          and (u.acesso_tipo is distinct from 'chave_digital'
               or nullif(btrim(coalesce(u.acesso_codigo, '')), '') is not null)
        )
      )
  );
$$;

revoke all on function private.produto_unidade_elegivel_site(uuid)
  from public, anon, authenticated, service_role;

comment on function private.produto_unidade_elegivel_site(uuid) is
  'Unidade só é elegível para o site com foto própria; mídia do condomínio é apenas área comum.';

create or replace function private.produto_validacao_publicacao(
  p_empreendimento_id uuid,
  p_unidade_id uuid default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_emp public.empreendimentos%rowtype;
  v_unidade public.unidades%rowtype;
  v_bloqueios text[] := array[]::text[];
  v_aluguel boolean;
  v_preco_min numeric;
  v_preco_max numeric;
  v_preco numeric;
  v_area numeric;
  v_unidades_validas integer := 0;
  v_fotos_pai integer := 0;
  v_fotos_unidade integer := 0;
  v_capa_pai boolean := false;
  v_capa_unidade boolean := false;
begin
  select e.* into v_emp from public.empreendimentos e
  where e.id = p_empreendimento_id;
  if not found then
    raise no_data_found using message = 'PRODUCT_NOT_FOUND: empreendimento não encontrado.';
  end if;

  v_aluguel := lower(btrim(coalesce(v_emp.finalidade, ''))) like '%alug%'
    or lower(btrim(coalesce(v_emp.finalidade, ''))) like '%loca%';
  v_preco_min := case when v_aluguel then 500 else 100000 end;
  v_preco_max := case when v_aluguel then 500000 else 100000000 end;

  select count(*)::integer, coalesce(bool_or(m.is_capa), false)
    into v_fotos_pai, v_capa_pai
  from public.midias m
  where m.empreendimento_id = p_empreendimento_id
    and m.unidade_id is null
    and m.tipo = 'foto'::public.tipo_midia;

  if p_unidade_id is not null then
    select u.* into v_unidade from public.unidades u
    where u.id = p_unidade_id and u.empreendimento_id = p_empreendimento_id;
    if not found then
      raise no_data_found using message = 'UNIT_NOT_FOUND: unidade não encontrada neste empreendimento.';
    end if;

    select count(*)::integer, coalesce(bool_or(m.is_capa), false)
      into v_fotos_unidade, v_capa_unidade
    from public.midias m
    where m.empreendimento_id = p_empreendimento_id
      and m.unidade_id = p_unidade_id
      and m.tipo = 'foto'::public.tipo_midia;

    v_preco := coalesce(v_unidade.valor_promo, v_unidade.valor_tabela);
    v_area := v_unidade.area_m2;
    v_unidades_validas := case when v_unidade.disponivel is true then 1 else 0 end;

    if nullif(btrim(coalesce(v_unidade.numero, '')), '') is null
       or nullif(btrim(coalesce(v_unidade.tipologia, '')), '') is null then
      v_bloqueios := array_append(v_bloqueios, 'Informar número e tipologia da unidade');
    end if;
    if v_unidade.disponivel is not true then
      v_bloqueios := array_append(v_bloqueios, 'Marcar a unidade como disponível');
    end if;
    if v_fotos_unidade < 1 then
      v_bloqueios := array_append(v_bloqueios, 'Adicionar ao menos uma foto própria da unidade');
    end if;
    if v_unidade.de_terceiros is true then
      if v_unidade.captador_corretor_id is null then
        v_bloqueios := array_append(v_bloqueios, 'Vincular o corretor captador da unidade');
      end if;
      if nullif(btrim(coalesce(v_unidade.proprietario_nome, '')), '') is null
         or nullif(btrim(coalesce(v_unidade.proprietario_contato, '')), '') is null then
        v_bloqueios := array_append(v_bloqueios, 'Completar proprietário e contato da unidade');
      end if;
      if nullif(btrim(coalesce(v_unidade.acesso_tipo, '')), '') is null
         or nullif(btrim(coalesce(v_unidade.acesso_instrucoes, '')), '') is null
         or (v_unidade.acesso_tipo = 'chave_digital'
             and nullif(btrim(coalesce(v_unidade.acesso_codigo, '')), '') is null) then
        v_bloqueios := array_append(v_bloqueios, 'Completar instruções de acesso da unidade');
      end if;
    end if;
  else
    select count(*)::integer, min(coalesce(u.valor_promo, u.valor_tabela)), min(u.area_m2)
      into v_unidades_validas, v_preco, v_area
    from public.unidades u
    where u.empreendimento_id = p_empreendimento_id
      and private.produto_unidade_elegivel_site(u.id) is true;
    v_preco := coalesce(v_emp.preco, v_preco);
    v_area := coalesce(v_emp.area_util, v_area);
    if v_fotos_pai < 6 then
      v_bloqueios := array_append(v_bloqueios, 'Adicionar pelo menos 6 fotos de áreas comuns do empreendimento');
    end if;
    if not v_capa_pai then
      v_bloqueios := array_append(v_bloqueios, 'Definir a capa do empreendimento');
    end if;
  end if;

  if nullif(btrim(coalesce(v_emp.nome, '')), '') is null then
    v_bloqueios := array_append(v_bloqueios, 'Informar o nome do imóvel');
  end if;
  if char_length(btrim(coalesce(v_emp.descricao, ''))) < 80 then
    v_bloqueios := array_append(v_bloqueios, 'Escrever uma descrição com pelo menos 80 caracteres');
  end if;
  if nullif(btrim(coalesce(v_emp.endereco, '')), '') is null
     or nullif(btrim(coalesce(v_emp.bairro, '')), '') is null
     or nullif(btrim(coalesce(v_emp.cidade, '')), '') is null then
    v_bloqueios := array_append(v_bloqueios, 'Completar endereço, bairro e cidade');
  end if;
  if nullif(btrim(coalesce(v_emp.finalidade, '')), '') is null then
    v_bloqueios := array_append(v_bloqueios, 'Informar a finalidade do imóvel');
  end if;
  if v_area is null or v_area <= 0 then
    v_bloqueios := array_append(v_bloqueios, 'Informar a área útil');
  end if;
  if v_preco is null or v_preco not between v_preco_min and v_preco_max then
    v_bloqueios := array_append(v_bloqueios,
      case when v_aluguel then 'Corrigir o aluguel mensal total em reais'
           else 'Corrigir o preço total em reais (ex.: 710000 para R$ 710 mil)' end);
  end if;
  if v_unidades_validas = 0 then
    v_bloqueios := array_append(v_bloqueios,
      'Cadastrar ao menos uma unidade aprovada, disponível e com foto própria');
  end if;

  return jsonb_build_object(
    'pronto', cardinality(v_bloqueios) = 0,
    'bloqueios', to_jsonb(v_bloqueios),
    'preco_interpretado', v_preco,
    'preco_minimo', v_preco_min,
    'preco_maximo', v_preco_max,
    'area_interpretada', v_area,
    'fotos_empreendimento', v_fotos_pai,
    'fotos_unidade', v_fotos_unidade,
    'capa_definida', case when p_unidade_id is null then v_capa_pai else v_capa_unidade end,
    'unidades_disponiveis', v_unidades_validas
  );
end;
$$;

revoke all on function private.produto_validacao_publicacao(uuid, uuid)
  from public, anon, authenticated, service_role;

create or replace function private.produto_impedir_publicacao_sem_foto_propria()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.publicado is true and not exists (
    select 1 from public.midias m
    where m.unidade_id = new.id and m.tipo = 'foto'::public.tipo_midia
  ) then
    raise check_violation using
      message = 'UNIT_OWN_PHOTO_REQUIRED: adicione ao menos uma foto própria da unidade antes de publicar.',
      hint = 'Fotos do condomínio são áreas comuns e não substituem a galeria do imóvel.';
  end if;
  return new;
end;
$$;

revoke all on function private.produto_impedir_publicacao_sem_foto_propria()
  from public, anon, authenticated, service_role;
drop trigger if exists trg_unidades_exigir_foto_propria_publicacao on public.unidades;
create trigger trg_unidades_exigir_foto_propria_publicacao
before insert or update of publicado on public.unidades
for each row execute function private.produto_impedir_publicacao_sem_foto_propria();

create or replace function private.produto_despublicar_ao_perder_ultima_foto()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_unidade_id uuid := old.unidade_id;
begin
  if v_unidade_id is not null and old.tipo = 'foto'::public.tipo_midia
     and not exists (
       select 1 from public.midias m
       where m.unidade_id = v_unidade_id and m.tipo = 'foto'::public.tipo_midia
     ) then
    update public.unidades set publicado = false
    where id = v_unidade_id and publicado is true;
  end if;
  return coalesce(new, old);
end;
$$;

revoke all on function private.produto_despublicar_ao_perder_ultima_foto()
  from public, anon, authenticated, service_role;
drop trigger if exists trg_midias_despublicar_unidade_sem_foto on public.midias;
create trigger trg_midias_despublicar_unidade_sem_foto
after delete or update of unidade_id, tipo on public.midias
for each row execute function private.produto_despublicar_ao_perder_ultima_foto();

create or replace function private.produto_preservar_captador_unidade()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.captador_corretor_id is not null and new.captador_corretor_id is null then
    raise check_violation using
      message = 'UNIT_CAPTOR_REQUIRED: o captador da unidade não pode ser removido.',
      hint = 'Se o vínculo estiver incorreto, substitua pelo corretor correto em vez de deixar a unidade sem responsável.';
  end if;
  return new;
end;
$$;

revoke all on function private.produto_preservar_captador_unidade()
  from public, anon, authenticated, service_role;
drop trigger if exists trg_unidades_preservar_captador on public.unidades;
create trigger trg_unidades_preservar_captador
before update of captador_corretor_id on public.unidades
for each row execute function private.produto_preservar_captador_unidade();

comment on function private.produto_preservar_captador_unidade() is
  'Impede que uma edição ou conversão de condomínio apague o corretor já vinculado à unidade.';
