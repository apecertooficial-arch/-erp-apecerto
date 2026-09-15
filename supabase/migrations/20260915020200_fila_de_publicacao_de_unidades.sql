-- Onda 4.1 — CORRECAO DE DIAGNOSTICO e fila de trabalho.
--
-- Eu havia registrado, na avaliacao de Produtos (item PR1), que as 200 unidades
-- aprovadas estavam invisiveis no site por causa de uma migracao esquecida: o
-- segundo nivel de publicacao por unidade teria sido criado sem migrar os dados.
--
-- ISSO ESTAVA ERRADO. Tentei publica-las e o banco recusou, com razao:
--   ERROR: PRODUCT_PUBLICATION_RPC_REQUIRED -- publique pela decisao oficial de Produtos
-- Existe um portao de qualidade (private.produto_unidade_elegivel_site) e, pela
-- regra dele, ZERO das 192 unidades candidatas esta apta.
--
-- O MOTIVO REAL, medido unidade a unidade:
--   192 unidades aprovadas, disponiveis, em predio publicado, NAO publicadas
--   190 delas sao barradas por UM unico item: nao tem foto propria
--     1  sem numero, tipologia, area e preco (Landing Campo Belo)
--     1  de terceiros sem dados de proprietario completos
--   E as 70 que ESTAO no ar tem, todas, foto propria.
--
-- Ou seja: em agosto a equipe SUBIU A REGUA -- unidade so vai para o site com
-- foto dela mesma, nao com a foto da fachada. As 190 nunca receberam foto.
-- Isso nao e defeito de software: e trabalho de captacao pendente.
--
-- POR ISSO NAO PUBLIQUEI. Publicar exigiria contornar um portao de qualidade que
-- a propria equipe criou, e colocaria no ar 190 anuncios mostrando a fachada do
-- predio no lugar do apartamento -- exatamente a critica que eu mesmo escrevi no
-- item PR3 da avaliacao de Produtos.
--
-- O que entrego no lugar: a fila de trabalho, com o bloqueio exato de cada
-- unidade. "200 unidades paradas" vira "Join Vila Mariana precisa de 45 fotos".

create or replace view public.produtos_fila_para_publicar
with (security_invoker = true) as
select
  e.nome                                as empreendimento,
  e.id                                  as empreendimento_id,
  u.id                                  as unidade_id,
  u.codigo,
  u.numero,
  c.nome                                as captador,
  coalesce(u.valor_promo, u.valor_tabela) as valor,
  u.area_m2,
  (select count(*) from public.midias m where m.unidade_id = u.id and m.tipo = 'foto') fotos_proprias,
  array_remove(array[
    case when not exists (select 1 from public.midias m where m.unidade_id = u.id and m.tipo = 'foto')
         then 'sem foto propria' end,
    case when nullif(btrim(coalesce(u.numero, '')), '') is null then 'sem numero' end,
    case when nullif(btrim(coalesce(u.tipologia, '')), '') is null then 'sem tipologia' end,
    case when coalesce(u.area_m2, 0) <= 0 then 'sem area' end,
    case when coalesce(u.valor_promo, u.valor_tabela) is null then 'sem preco' end,
    case when u.de_terceiros and u.captador_corretor_id is null then 'terceiro sem captador' end,
    case when u.de_terceiros and not private.produto_unidade_proprietario_completo(u.id)
         then 'terceiro sem proprietario completo' end,
    case when u.de_terceiros and nullif(btrim(coalesce(u.acesso_tipo, '')), '') is null
         then 'terceiro sem forma de acesso' end,
    case when not e.publicado then 'predio nao publicado' end
  ], null) as bloqueios
from public.unidades u
join public.empreendimentos e on e.id = u.empreendimento_id
left join public.corretores c on c.id = u.captador_corretor_id
where u.aprovacao = 'aprovado'
  and u.disponivel
  and not u.publicado;

comment on view public.produtos_fila_para_publicar is
  'Onda 4.1: unidades aprovadas e disponiveis que NAO estao no site, com o bloqueio exato de cada uma. Em 15/09/2026: 200 unidades, 190 barradas so por falta de foto propria. Nao e defeito de software -- e captacao pendente.';

grant select on public.produtos_fila_para_publicar to authenticated, service_role;
