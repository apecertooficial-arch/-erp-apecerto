-- Corrige o cadastro legado AP0052/AP0330 da Edrisia.
-- A unidade registra 45 m² e o valor_m2 armazenado confirma que 710 foi
-- digitado em milhares (R$ 15.777,78/m²), mas o valor cheio não foi convertido.

set lock_timeout = '5s';
set statement_timeout = '30s';

update public.unidades
set valor_tabela = 710000,
    valor_m2 = round(710000::numeric / 45, 2)
where codigo = 'AP0330'
  and valor_tabela = 710
  and area_m2 = 45;

update public.empreendimentos
set preco = 710000,
    area_util = 45
where codigo = 'AP0052'
  and preco = 710
  and area_util = 14
  and exists (
    select 1 from public.unidades u
    where u.empreendimento_id = empreendimentos.id
      and u.codigo = 'AP0330'
      and u.valor_tabela = 710000
      and u.area_m2 = 45
  );
