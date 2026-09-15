-- ESTEIRA — a ordem das colunas do quadro era ambigua.
--
-- DEFEITO: duas etapas dividiam a ordem 4 ('doc_imovel' e 'doc_vend'). O quadro
-- e a cascata usam `order by ordem`, e sem desempate o Postgres pode devolver
-- as duas em qualquer sequencia entre execucoes. Resultado: a coluna do quadro
-- podia trocar de lugar sozinha, e `etapaDoBloco()` -- que pega a PRIMEIRA
-- etapa na ordem que libera um bloco -- podia apontar para etapas diferentes em
-- momentos diferentes. Isso e nao-determinismo em regra de negocio.
--
-- CORRECAO: renumeracao 1..10 sem empate, mantendo todos os slugs (nenhum
-- processo fica orfao) e pondo a documentacao na sequencia que a operacao usa:
-- comprador -> vendedor -> imovel.
--
-- E passa a existir indice unico em `ordem` entre as etapas ativas, para o
-- empate nao voltar.

update public.esteira_etapas set ordem = 1  where slug = 'inicio';
update public.esteira_etapas set ordem = 2  where slug = 'proposta';
update public.esteira_etapas set ordem = 3  where slug = 'doc_comp';
update public.esteira_etapas set ordem = 4  where slug = 'doc_vend';
update public.esteira_etapas set ordem = 5  where slug = 'doc_imovel';
update public.esteira_etapas set ordem = 6  where slug = 'contrato';
update public.esteira_etapas set ordem = 7  where slug = 'minuta_cnd';
update public.esteira_etapas set ordem = 8  where slug = 'minuta_env';
update public.esteira_etapas set ordem = 9  where slug = 'pagamento';
update public.esteira_etapas set ordem = 10 where slug = 'registrada';

create unique index if not exists esteira_etapas_ordem_unica_ativa
  on public.esteira_etapas (ordem) where ativo;
