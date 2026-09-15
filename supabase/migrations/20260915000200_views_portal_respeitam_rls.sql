-- Onda 0.3 — as 4 views que ignoravam o RLS passam a respeita-lo, e fecham para o anon.
--
-- PROBLEMA: portal_imoveis, portal_imovel_fotos, vw_empreendimento_resumo e
-- vw_produtos_publicos foram criadas sem security_invoker, entao rodavam com os
-- privilegios do dono e IGNORAVAM o RLS das tabelas de origem. Tres delas eram
-- legiveis pelo papel `anon` e expunham nome do predio, endereco completo,
-- numero, CEP, latitude, longitude, lazer e diferenciais -- exatamente o conjunto
-- que a view site_produtos foi desenhada para esconder via
-- site_identidade_publica() e site_logradouro_publico().
--
-- Eram os 4 unicos achados de nivel ERROR do linter de seguranca do Supabase.
--
-- Depois de ligar security_invoker, as views passaram a exigir do chamador
-- SELECT nas tabelas de origem. O `anon` NAO tem SELECT em empreendimentos,
-- unidades, midias nem anuncios_site (conferido em has_table_privilege), entao
-- para o anonimo elas falhariam com "permission denied" no meio da view. Erro no
-- meio da view e pior do que negar na porta: por isso o REVOKE explicito abaixo.
--
-- VERIFICADO: nenhuma das 4 e consultada pelo site nem pelo ERP. Aparecem apenas
-- como referencia de chave estrangeira no database.types.ts. O site le o catalogo
-- por site_produtos e site_produtos_catalogo, que continuam intactas e concedidas
-- ao anon -- confirmado no trafego real depois desta migracao: 3 chamadas ao
-- /rest/v1/site_produtos* com HTTP 200.
--
-- REVERSAO:
--   alter view public.<nome> set (security_invoker = false);
--   grant select on public.<nome> to anon;

alter view public.portal_imoveis set (security_invoker = true);
alter view public.portal_imovel_fotos set (security_invoker = true);
alter view public.vw_empreendimento_resumo set (security_invoker = true);
alter view public.vw_produtos_publicos set (security_invoker = true);

revoke select on public.portal_imoveis from anon;
revoke select on public.portal_imovel_fotos from anon;
revoke select on public.vw_produtos_publicos from anon;
revoke select on public.vw_empreendimento_resumo from anon;
