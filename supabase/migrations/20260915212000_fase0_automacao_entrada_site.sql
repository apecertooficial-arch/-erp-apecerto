-- Fase 0: a automacao que recebe todo lead do site se chamava "14/07 teste (copia)" no grupo de testes.
update public.automacoes set nome='Entrada Site', grupo='Campanhas de Entrada',
  mapa = replace(replace(mapa::text, 'Automacao: 14/07 teste (cópia)', 'Automacao: Entrada Site'), '"14/07 teste (cópia)"', '"Entrada Site"')::jsonb,
  mapa_rascunho = case when mapa_rascunho is null then null else replace(replace(mapa_rascunho::text, 'Automacao: 14/07 teste (cópia)', 'Automacao: Entrada Site'), '"14/07 teste (cópia)"', '"Entrada Site"')::jsonb end
where id = 42;
update public.automacao_versoes set mapa = replace(replace(mapa::text, 'Automacao: 14/07 teste (cópia)', 'Automacao: Entrada Site'), '"14/07 teste (cópia)"', '"Entrada Site"')::jsonb where id = 157;
