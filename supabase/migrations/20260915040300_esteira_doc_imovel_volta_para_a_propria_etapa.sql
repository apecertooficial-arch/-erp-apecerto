-- ESTEIRA — a etapa "Documentacao do imovel" existia sem funcao.
--
-- DEFEITO: a etapa 'doc_vend' (ordem 4) declarava liberar tres blocos --
-- partes_vendedor, docs_vendedor e TAMBEM docs_imovel. A etapa 'doc_imovel'
-- (ordem 5) declara liberar exatamente docs_imovel.
--
-- Em app/lib/esteira.ts, etapaDoBloco() devolve a PRIMEIRA etapa na ordem que
-- libera o bloco. Como doc_vend vem antes, ela ficava com docs_imovel, e a
-- etapa 'Documentacao do imovel' aparecia no quadro sem liberar nada -- uma
-- coluna por onde o processo passa sem ter o que fazer.
--
-- CORRECAO: docs_imovel sai de doc_vend e fica so na etapa que leva seu nome.
--   doc_vend   -> partes_vendedor, docs_vendedor
--   doc_imovel -> docs_imovel
--
-- CONFERIDO DEPOIS, simulando etapaDoBloco() para os 7 blocos:
--   condicoes -> proposta | comissao -> proposta
--   partes_comprador -> doc_comp | docs_comprador -> doc_comp
--   partes_vendedor -> doc_vend  | docs_vendedor  -> doc_vend
--   docs_imovel -> doc_imovel
--
-- NAO MEXO, de proposito, em 'registrada' (ordem 10), que libera os 7 blocos.
-- Ela e a etapa terminal (conclui_venda = true) e concentra 18 dos 22 processos.
-- Liberar tudo na etapa final contraria a logica da cascata, MAS e hoje o unico
-- caminho para corrigir um dado depois que a venda fechou. Tirar isso sem antes
-- definir como se corrige uma venda registrada travaria a operacao. Fica
-- registrado como decisao de processo pendente.
--
-- REVERSAO:
--   update public.esteira_etapas
--   set libera = array['partes_vendedor','docs_vendedor','docs_imovel']::text[]
--   where slug = 'doc_vend';

update public.esteira_etapas
set libera = array['partes_vendedor','docs_vendedor']::text[]
where slug = 'doc_vend';
