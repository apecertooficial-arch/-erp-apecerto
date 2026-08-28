-- O alias legado contém identidade operacional e só deve ser resolvido na
-- camada server-side do site. O contrato público continua expondo apenas o
-- slug neutro retornado pela função.
revoke all on function public.site_produto_resolver_slug_legado(text)
  from public, anon, authenticated;

grant execute on function public.site_produto_resolver_slug_legado(text)
  to service_role;

comment on function public.site_produto_resolver_slug_legado(text) is
  'Resolver server-side de aliases legados para slugs públicos neutros; não exposto a anon/authenticated.';
