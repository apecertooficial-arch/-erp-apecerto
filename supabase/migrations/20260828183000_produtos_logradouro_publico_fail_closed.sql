-- Corrige a redução do endereço público quando número e complemento chegam sem vírgula.
-- Migration aditiva: não altera dados armazenados nem amplia privilégios.

create or replace function public.site_logradouro_publico(p_endereco text)
returns text
language sql
immutable
set search_path = ''
as $$
  select nullif(
    btrim(
      regexp_replace(
        split_part(coalesce(p_endereco, ''), ',', 1),
        '(?i)([0-9]|[[:space:]]+(ap(to|artamento)?\M\.?|unidade\M|bloco\M|torre\M|lote\M|complemento\M|fundos\M|casa\M|sala\M|andar\M|conjunto\M|cj\M\.?|s/?n\M|sem[[:space:]]+n(ú|u)mero\M)).*$',
        '',
        'g'
      )
    ),
    ''
  );
$$;

revoke all on function public.site_logradouro_publico(text) from public;
grant execute on function public.site_logradouro_publico(text) to anon, authenticated;
