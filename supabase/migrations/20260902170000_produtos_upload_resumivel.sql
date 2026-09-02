-- Upload de mídia retomável e idempotente.
-- O mesmo arquivo selecionado novamente usa o mesmo storage_path; a restrição
-- impede que uma retomada crie duas linhas na galeria.

set lock_timeout = '5s';
set statement_timeout = '60s';

create unique index if not exists midias_storage_path_key
  on public.midias (storage_path)
  where storage_path is not null and btrim(storage_path) <> '';

comment on index public.midias_storage_path_key is
  'Garante que retries de upload não dupliquem a mesma mídia na galeria.';

-- Corrige somente preços legados cuja unidade foi salva em milhares, quando
-- o preço do produto de referência confirma exatamente a escala de 1.000x.
update public.unidades u
set valor_tabela = e.preco,
    valor_m2 = case when u.area_m2 > 0 then round(e.preco / u.area_m2, 2) else u.valor_m2 end
from public.empreendimentos e
where e.id = u.empreendimento_id
  and u.codigo in ('AP0327', 'AP0330', 'AP0334')
  and u.valor_tabela between 1 and 9999
  and e.preco >= 100000
  and round(e.preco / 1000) = round(u.valor_tabela);
