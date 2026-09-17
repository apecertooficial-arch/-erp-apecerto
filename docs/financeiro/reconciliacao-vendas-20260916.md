# Reconciliação de vendas — 16/09/2026

> **Somente leitura.** Gerado por `SELECT` no projeto Supabase `diaegvfveqezispcthwk`
> em 16/09/2026, antes de aplicar a migration `20260916120000_fase2_venda_atomica`.
> Nenhum dado foi corrigido. Cada linha abaixo é decisão humana (financeiro):
> ajustar a comissão, o percentual, o rateio ou aceitar a diferença com motivo.

## Resumo

- Vendas no banco: **25**.
- Comissão lançada diferente da esperada (`round(VGV × %, 2)`): **16** — das quais 1 só por 1 centavo de arredondamento (`d3cc63f7`).
- Sem percentual (não dá para calcular a esperada): **2**.
- Portanto **17 de 25** vendas não fecham por mais de 1 centavo ou não têm base de cálculo; com o centavo, 18.

| Flag | Vendas |
|---|--:|
| comissão≠esperada | 15 |
| comissão >2 casas | 10 |
| corretor sem cadastro | 2 |
| sem % | 2 |
| sem comissão lançada | 2 |
| rateio≠100% | 1 |
| % com artefato float | 1 |
| pagamento>comissão | 1 |
| sem corretor | 1 |

### Como ler

- **Comissão esperada** = `round(vgv × percentual_comissao, 2)` — exatamente o que `venda_criar` passa a calcular.
- **Comissão lançada** = `sum(comissoes.valor_final)`, sem arredondar, para mostrar as casas extras que estão gravadas.
- **Diferença** = lançada − esperada, em centavos. Negativo = falta distribuir; positivo = distribuiu mais do que a bruta (a partir da migration, isso é recusado na criação).
- **Repasses** = `pagamentos_comissao` (agenda); **Caixa: comissão paga** = `lancamentos_caixa` com `natureza = 'comissao_paga'`.
- **Parcelas** = soma de `recebimentos.valor_total`.

### Flags

- `sem corretor` — nenhuma linha em `venda_corretores` (a venda some da visão do corretor e dos rankings por rateio).
- `corretor sem cadastro` — linha de rateio só com nome (`corretor_id` nulo): não dá para gerar comissão/repasse para ela.
- `rateio≠100%` — soma de `fracao` diferente de 1 (ex.: 3 × 0,3333 = 0,9999).
- `sem %` — `percentual_comissao` nulo.
- `% com artefato float` — percentual gravado com mais de 6 casas (ex.: `0.036699999999999997`, vindo de `3.67 / 100` no JavaScript).
- `comissão≠esperada` — diferença maior ou igual a 1 centavo.
- `comissão >2 casas` — alguma comissão com mais de 2 casas decimais.
- `pagamento>comissão` — repasse pago ou saída de caixa de comissão maior que a comissão lançada.
- (verificado e sem ocorrência) `vendas.corretor_id` (bigint, `corretores.id`) apontando para corretor cujo usuário (uuid) não está em `venda_corretores`.

## Por venda

| Data | Venda | Status | Empreendimento | VGV | % (fração gravada) | Comissão esperada | Comissão lançada | Diferença | Repasses agendados | Repasses pagos | Caixa: comissão paga | Parcelas | Corretores | Soma rateio | Flags |
|---|---|---|---|--:|--:|--:|--:|--:|--:|--:|--:|--:|--:|--:|---|
| 2026-01-05 | `d72f953e` | pago | Clube Line | 362.500,00 | 0.04 | 14.500,00 | 14500.000 | 0,00 | 0,00 | 0,00 | 0,00 | 14.005,80 | 1 | 1.0 | comissão >2 casas |
| 2026-01-09 | `7ace3ed4` | pago | AP Moema | 650.000,00 | 0.045 | 29.250,00 | 29250.0 | 0,00 | 0,00 | 0,00 | 0,00 | 39.000,00 | 3 | 0.9999 | corretor sem cadastro, rateio≠100% |
| 2026-01-15 | `22b5739e` | pago | Composite | 450.000,00 | 0.045 | 20.250,00 | 16000.0 | -4.250,00 | 0,00 | 0,00 | 0,00 | 17.000,00 | 1 | 1.0 | comissão≠esperada |
| 2026-01-17 | `6fd39f53` | pago | Composite | 485.000,00 | 0.0597 | 28.954,50 | 24954.50 | -4.000,00 | 0,00 | 0,00 | 0,00 | 29.100,00 | 1 | 1.0 | comissão≠esperada |
| 2026-01-18 | `fa11f8d5` | pago | Bios | 430.000,00 | 0.04 | 17.200,00 | 17200.0 | 0,00 | 0,00 | 0,00 | 0,00 | 16.856,00 | 2 | 1.0 | corretor sem cadastro |
| 2026-02-02 | `991df278` | pago | Composite | 509.000,00 | 0.0392 | 19.952,80 | 20000.0 | 47,20 | 0,00 | 0,00 | 0,00 | 20.000,00 | 1 | 1.0 | comissão≠esperada |
| 2026-03-13 | `3a59affb` | pago | Kronos Moema | 515.000,00 | 0.06 | 30.900,00 | 26910.0 | -3.990,00 | 0,00 | 0,00 | 0,00 | 30.900,00 | 1 | 1.0 | comissão≠esperada |
| 2026-04-19 | `decd0f96` | pago | Composite | 425.422,50 | 0.045 | 19.144,01 | 19144.0125 | 0,00 | 0,00 | 0,00 | 0,00 | 17.016,90 | 1 | 1.0 | comissão >2 casas |
| 2026-04-20 | `d3cc63f7` | pago | Composite | 501.625,00 | 0.045 | 22.573,13 | 22573.125 | -0,01 | 0,00 | 0,00 | 0,00 | 20.065,00 | 1 | 1.0 | comissão >2 casas |
| 2026-04-24 | `b198f665` | pago | Clube Line | 280.000,00 | 0.045 | 12.600,00 | 12600.0 | 0,00 | 0,00 | 0,00 | 0,00 | 0,00 | 2 | 1.0 | — |
| 2026-04-29 | `e5f55c06` | pendente | Composite | 515.000,00 | 0.04 | 20.600,00 | 20600.0 | 0,00 | 0,00 | 0,00 | 0,00 | 0,00 | 1 | 1.0 | — |
| 2026-05-20 | `bb18ac7d` | pago | Autoral Moema | 370.000,00 | 0.04 | 14.800,00 | 14574.00 | -226,00 | 0,00 | 0,00 | 0,00 | 14.574,00 | 1 | 1.0 | comissão≠esperada |
| 2026-05-26 | `29b094c1` | pago | Terrare | 426.000,00 | 0.03899 | 16.609,74 | 16440.520 | -169,22 | 0,00 | 0,00 | 0,00 | 0,00 | 1 | 1.0 | comissão≠esperada, comissão >2 casas |
| 2026-05-26 | `bc6eaa56` | pago | Terrare | 426.000,00 | 0.03899 | 16.609,74 | 16440.520 | -169,22 | 0,00 | 0,00 | 0,00 | 0,00 | 1 | 1.0 | comissão≠esperada, comissão >2 casas |
| 2026-05-26 | `e5538e8c` | pago | Terrare | 426.000,00 | 0.03899 | 16.609,74 | 16440.520 | -169,22 | 0,00 | 0,00 | 0,00 | 0,00 | 1 | 1.0 | comissão≠esperada, comissão >2 casas |
| 2026-06-10 | `2a140286` | pago | AP Moema | 400.000,00 | 0.05 | 20.000,00 | 19450.000 | -550,00 | 0,00 | 0,00 | 0,00 | 20.000,00 | 2 | 1.0 | comissão≠esperada, comissão >2 casas |
| 2026-06-11 | `1130cddb` | pago | Terrare | 456.694,59 | 0.03899 | 17.806,52 | 17629.7620656 | -176,76 | 0,00 | 0,00 | 0,00 | 17.629,76 | 1 | 1.0 | comissão≠esperada, comissão >2 casas |
| 2026-06-12 | `629ca746` | pago | Claris | 580.000,00 | 0.025862 | 14.999,96 | 14299.9600 | -700,00 | 0,00 | 0,00 | 0,00 | 15.000,00 | 3 | 1.0 | comissão≠esperada, comissão >2 casas |
| 2026-06-14 | `e566660a` | pago | Terrare | 415.000,00 | 0.036699999999999997 | 15.230,50 | 15030.5000 | -200,00 | 375,76 | 375,76 | 375,76 | 0,00 | 1 | 1.0 | % com artefato float, comissão≠esperada, comissão >2 casas |
| 2026-06-16 | `38707d98` | pago | Claris | 538.100,00 | 0.04 | 21.524,00 | 21524.0 | 0,00 | 0,00 | 0,00 | 0,00 | 21.524,00 | 1 | 1.0 | — |
| 2026-07-04 | `a19a1417` | pago | Kronos Moema | 590.000,00 | 0.0584 | 34.456,00 | 9809.93 | -24.646,07 | 0,00 | 0,00 | 0,00 | 34.456,00 | 1 | 1 | comissão≠esperada |
| 2026-07-24 | `4d5a91be` | concluido | Moema Studium | 410.000,00 | — | — | — | — | 0,00 | 0,00 | 0,00 | 0,00 | 1 | 1 | sem %, sem comissão lançada |
| 2026-07-24 | `64669a62` | concluido | Kronos Moema | 530.000,00 | — | — | — | — | 0,00 | 0,00 | 0,00 | 0,00 | 1 | 1 | sem %, sem comissão lançada |
| 2026-07-30 | `ea33edf3` | pago | Claris | 499.000,00 | 0.04 | 19.960,00 | 499 | -19.461,00 | 11.069,00 | 11.069,00 | 11.069,00 | 19.960,00 | 1 | 1 | comissão≠esperada, pagamento>comissão |
| 2026-08-21 | `480f3a57` | concluido | Edu | 440.000,00 | 0.06 | 26.400,00 | 8417.5 | -17.982,50 | 0,00 | 0,00 | 0,00 | 0,00 | 0 | — | sem corretor, comissão≠esperada |

## Pontos que chamam atenção (para a conversa com o financeiro)

- `a19a1417` (Kronos Moema, 04/07): esperada 34.456,00, lançada 9.809,93 — não há comissão `apecerto`; parcelas somam a comissão cheia.
- `ea33edf3` (Claris, 30/07): só a comissão de executivo (499,00) foi lançada, mas já saíram **11.069,00** de repasse pago/caixa. É o único caso `pagamento>comissão`.
- `480f3a57` (Edu, 21/08): sem corretor no rateio e sem comissão `apecerto`; falta 17.982,50.
- `4d5a91be` e `64669a62` (24/07, vieram da Esteira): concluídas sem percentual e sem comissão.
- `29b094c1`, `bc6eaa56`, `e5538e8c` (Terrare, 26/05): três vendas com mesmo VGV, data, percentual e corretor (divisões entre corretor/apecerto diferentes) — conferir se são três unidades ou a mesma venda lançada três vezes.
- `7ace3ed4`: rateio 0,3333 × 3 e um corretor ("Victor") sem cadastro.

## Consulta usada

```sql
with base as (
  select v.id, v.data_venda, v.status::text status, coalesce(e.nome, v.empreendimento_nome, '-') empreendimento,
    v.vgv, v.percentual_comissao pct, v.corretor_id,
    round(v.vgv * v.percentual_comissao, 2) esperada,
    (select sum(c.valor_final) from comissoes c where c.venda_id = v.id) lancada,
    (select count(*) from comissoes c where c.venda_id = v.id and scale(c.valor_final) > 2) com_mais_2_casas,
    (select count(*) from venda_corretores vc where vc.venda_id = v.id) n_corretores,
    (select sum(vc.fracao) from venda_corretores vc where vc.venda_id = v.id) soma_fracao,
    (select count(*) from venda_corretores vc where vc.venda_id = v.id and vc.corretor_id is null) corretor_sem_cadastro,
    (select coalesce(sum(p.valor),0) from pagamentos_comissao p where p.venda_id = v.id) repasses_agendados,
    (select coalesce(sum(p.valor),0) from pagamentos_comissao p where p.venda_id = v.id and p.status='pago') repasses_pagos,
    (select coalesce(sum(l.valor),0) from lancamentos_caixa l where l.venda_id = v.id and l.natureza = 'comissao_paga') caixa_comissao_paga,
    (select coalesce(sum(r.valor_total),0) from recebimentos r where r.venda_id = v.id) parcelas,
    (v.corretor_id is not null and not exists (
       select 1 from corretores co join venda_corretores vc on vc.corretor_id = co.usuario_id
        where co.id = v.corretor_id and vc.venda_id = v.id)) corretor_principal_divergente
  from vendas v left join empreendimentos e on e.id = v.empreendimento_id
)
select to_char(data_venda,'YYYY-MM-DD') data, left(id::text,8) venda, status, empreendimento, vgv, pct, esperada, lancada,
  round(coalesce(lancada,0) - coalesce(esperada,0), 2) diferenca,
  repasses_agendados, repasses_pagos, caixa_comissao_paga, parcelas, n_corretores, soma_fracao,
  concat_ws(', ',
    case when n_corretores = 0 then 'sem corretor' end,
    case when corretor_sem_cadastro > 0 then 'corretor sem cadastro' end,
    case when n_corretores > 0 and soma_fracao <> 1 then 'rateio≠100%' end,
    case when pct is null then 'sem %' end,
    case when pct is not null and scale(pct) > 6 then '% com artefato float' end,
    case when lancada is null then 'sem comissão lançada' end,
    case when esperada is not null and lancada is not null and round(lancada,2) <> esperada then 'comissão≠esperada' end,
    case when com_mais_2_casas > 0 then 'comissão >2 casas' end,
    case when greatest(repasses_pagos, caixa_comissao_paga) > coalesce(lancada,0) then 'pagamento>comissão' end,
    case when corretor_principal_divergente then 'vendas.corretor_id fora de venda_corretores' end
  ) flags
from base order by data_venda, id;
```
