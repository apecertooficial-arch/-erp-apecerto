-- Remove a camada gerencial autônoma Tracking 360.
--
-- As tabelas privadas de eventos do site, atribuição de campanha e entregas
-- Meta são operacionais e compartilhadas pelo site, CRM e automações. Elas não
-- pertencem ao painel e permanecem intactas. Os três agregadores ainda úteis
-- passam a pertencer explicitamente à Central de Comando.

do $$
begin
  if to_regprocedure('public.tracking_360_dashboard(integer)') is not null
     and to_regprocedure('public.central_comando_site_marketing(integer)') is null then
    alter function public.tracking_360_dashboard(integer)
      rename to central_comando_site_marketing;
  end if;

  if to_regprocedure('public.tracking_360_attribution_scope(integer)') is not null
     and to_regprocedure('public.central_comando_atribuicao_marketing(integer)') is null then
    alter function public.tracking_360_attribution_scope(integer)
      rename to central_comando_atribuicao_marketing;
  end if;

  if to_regprocedure('public.tracking_360_quality(integer)') is not null
     and to_regprocedure('public.central_comando_qualidade_dados(integer)') is null then
    alter function public.tracking_360_quality(integer)
      rename to central_comando_qualidade_dados;
  end if;
end
$$;

drop function if exists public.tracking_360_dashboard(integer);
drop function if exists public.tracking_360_attribution_scope(integer);
drop function if exists public.tracking_360_quality(integer);
drop function if exists public.tracking_360_lead_search(text, integer);
drop function if exists public.tracking_360_lead_journey(bigint);

comment on function public.central_comando_site_marketing(integer) is
  'Indicadores agregados de site e mídia usados somente pela Central de Comando.';
comment on function public.central_comando_atribuicao_marketing(integer) is
  'Cobertura agregada de atribuição de mídia usada somente pela Central de Comando.';
comment on function public.central_comando_qualidade_dados(integer) is
  'Qualidade técnica agregada das integrações usada somente pela Central de Comando.';

-- A fonte aprovada da Sara não pode continuar orientando usuários para um item
-- de menu que deixou de existir. Limita a correção ao trecho exato do mapa.
update public.agente_fontes
set conteudo = replace(
  conteudo,
  'Menu principal: Inicio; Central de Comando; CRM - Meu Dia; Produtos; Financeiro; Tracking 360.',
  'Menu principal: Inicio; Central de Comando; CRM - Meu Dia; Produtos; Financeiro.'
)
where conteudo like '%Menu principal: Inicio; Central de Comando; CRM - Meu Dia; Produtos; Financeiro; Tracking 360.%';
