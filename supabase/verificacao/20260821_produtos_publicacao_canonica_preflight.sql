-- ============================================================================
-- PREFLIGHT SOMENTE LEITURA — publicacao canonica ERP -> site
--
-- Execute ANTES de 20260821190806_produtos_publicacao_canonica.sql.
-- Nenhum dado e alterado. `flags_publicado_que_serao_normalizadas` inclui
-- estados que a view já escondia; `unidades_hoje_visiveis_que_sairao` mostra o
-- impacto comercial real. Os cadastros permanecem no ERP para correção.
-- ============================================================================

select
  count(*) as flags_publicado_que_serao_normalizadas,
  count(*) filter (
    where u.disponivel is true
      and u.aprovacao is not distinct from 'aprovado'
      and e.publicado is true
      and e.rascunho is false
      and e.aprovacao is not distinct from 'aprovado'
  ) as unidades_hoje_visiveis_que_sairao,
  count(*) filter (
    where u.disponivel is not true
      or u.aprovacao is distinct from 'aprovado'
  ) as por_estado_editorial,
  count(*) filter (
    where u.disponivel is true
      and u.aprovacao is not distinct from 'aprovado'
      and (
        coalesce(u.valor_promo, u.valor_tabela) is null
        or case
          when lower(btrim(coalesce(e.finalidade, ''))) like '%alug%'
            or lower(btrim(coalesce(e.finalidade, ''))) like '%loca%'
            then coalesce(u.valor_promo, u.valor_tabela) not between 500 and 500000
          else coalesce(u.valor_promo, u.valor_tabela) not between 100000 and 100000000
        end
        or (
          u.valor_tabela is not null
          and u.valor_promo is not null
          and u.valor_promo > u.valor_tabela
        )
      )
  ) as por_preco_total,
  count(*) filter (
    where u.disponivel is true
      and u.aprovacao is not distinct from 'aprovado'
      and coalesce(u.valor_promo, u.valor_tabela) is null
  ) as por_preco_ausente,
  count(*) filter (
    where u.disponivel is true
      and u.aprovacao is not distinct from 'aprovado'
      and coalesce(u.valor_promo, u.valor_tabela) is not null
      and (
        case
          when lower(btrim(coalesce(e.finalidade, ''))) like '%alug%'
            or lower(btrim(coalesce(e.finalidade, ''))) like '%loca%'
            then coalesce(u.valor_promo, u.valor_tabela) not between 500 and 500000
          else coalesce(u.valor_promo, u.valor_tabela) not between 100000 and 100000000
        end
        or (
          u.valor_tabela is not null
          and u.valor_promo is not null
          and u.valor_promo > u.valor_tabela
        )
      )
  ) as por_preco_fora_da_faixa
from public.unidades u
join public.empreendimentos e on e.id = u.empreendimento_id
where u.publicado is true
  and (
    u.disponivel is not true
    or u.aprovacao is distinct from 'aprovado'
    or coalesce(u.valor_promo, u.valor_tabela) is null
    or case
      when lower(btrim(coalesce(e.finalidade, ''))) like '%alug%'
        or lower(btrim(coalesce(e.finalidade, ''))) like '%loca%'
        then coalesce(u.valor_promo, u.valor_tabela) not between 500 and 500000
      else coalesce(u.valor_promo, u.valor_tabela) not between 100000 and 100000000
    end
    or (
      u.valor_tabela is not null
      and u.valor_promo is not null
      and u.valor_promo > u.valor_tabela
    )
  );

select
  count(*) as empreendimentos_que_sairao_da_vitrine_por_preco
from public.empreendimentos e
where e.publicado is true
  and e.preco is not null
  and case
    when lower(btrim(coalesce(e.finalidade, ''))) like '%alug%'
      or lower(btrim(coalesce(e.finalidade, ''))) like '%loca%'
      then e.preco not between 500 and 500000
    else e.preco not between 100000 and 100000000
  end;

select
  count(*) as empreendimentos_publicados_sem_unidade_visivel
from public.empreendimentos e
where e.publicado is true
  and e.rascunho is false
  and e.aprovacao is not distinct from 'aprovado'
  and not exists (
    select 1
    from public.unidades u
    where u.empreendimento_id = e.id
      and u.publicado is true
      and u.disponivel is true
      and u.aprovacao is not distinct from 'aprovado'
  );

select
  count(*) as leads_existentes,
  count(*) filter (where context ? 'unidade_id') as contexts_legados_com_unidade_id,
  count(*) filter (
    where context is null or jsonb_typeof(context) <> 'object'
  ) as contexts_invalidos
from public.site_leads;

select
  table_name,
  grantee,
  array_agg(privilege_type order by privilege_type) as privilegios_antes_do_corte
from information_schema.role_table_grants
where table_schema = 'public'
  and table_name in (
    'anuncios_site', 'captacoes_portal', 'empreendimentos', 'unidades'
  )
  and grantee in ('anon', 'authenticated')
group by table_name, grantee
order by table_name, grantee;
