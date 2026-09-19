# P0 — alertas repetidos da Sara

Estado: contrato e SQL de correção preparados localmente; não aplicados.

## Evidência sanitizada de produção

Consulta somente leitura em 2026-09-19, projeto `diaegvfveqezispcthwk`:

- 690 alertas `sara:acao-vencida:*` abertos na primeira leitura e 694 na
  revalidação feita minutos depois (347 por público);
- 132 cards F2 distintos;
- 154 grupos `card + público` com mais de um alerta aberto;
- máximo de 35 alertas abertos para o mesmo card e público;
- 16 alertas ligados a cards descartados;
- todos os alertas possuíam `execution_id` e análise vinculada;
- a função produtiva usa `execution_id` dentro da chave, criando uma nova
  pendência a cada checkpoint;
- a RPC de leitura calcula os totais depois do `LIMIT 100`, portanto o contador
  também pode esconder o volume real.
- a variação 690 → 694 durante a inspeção comprova crescimento ativo do ruído.

Revalidação somente leitura às 17:40:

- 744 alertas abertos, igualmente divididos entre gestão e corretores;
- 135 cards distintos;
- 168 grupos duplicados e máximo de 36 alertas no mesmo card + público;
- os 16 alertas de cards descartados continuam abertos;
- crescimento total de 54 alertas desde a primeira leitura, sem intervenção.

Nenhuma linha com nome, telefone, e-mail, mensagem ou outro dado pessoal foi
consultada ou registrada.

## Invariantes da correção

1. No máximo um alerta aberto por `funil_lead_id + público`.
2. `execution_id` audita a ocorrência; não identifica a obrigação aberta.
3. Repetição incrementa `repeticoes` e atualiza a correlação sem criar outra
   linha aberta.
4. Evidência positiva, confirmação operacional ou descarte resolve o alerta.
5. Troca de corretor fecha a cobrança pessoal antiga.
6. Histórico não é apagado; duplicatas são resolvidas com autoria automática.
7. Concorrência é fechada por lock transacional e índice único parcial.
8. A função privilegiada permanece executável somente por `service_role`.
9. O contador da central considera todo o escopo autorizado antes de limitar a
   lista visual a cem itens.
10. A leitura preserva `f2_notificacoes_sincronizar()` como no-op canônico e
    nunca reativa `ncrm_private.notificacoes_sincronizar()`.
11. O público gerencial usa o grupo canônico `gestao`, incluindo gerente e
    diretor; `can_manage_all()` sozinho excluiria esses dois papéis.

## Artefatos locais

- contrato SQL: `P0_ALERTAS_SARA_DEDUPE_DRAFT.sql`;
- teste comportamental: `tests/p0-alertas-sara-dedupe-draft.test.mjs`.

O SQL está fora de `supabase/migrations` de propósito. A CLI oficial não está
instalada e a orientação vigente exige gerar o nome com
`supabase migration new`, sem inventar timestamp. Instalação de ferramenta não
foi autorizada. Aplicação em produção também exige autorização específica.

Revisão de 2026-09-19: a primeira versão do draft chamava por engano o
sincronizador legado `ncrm_private.notificacoes_sincronizar()`. A comparação
com a definição produtiva mostrou que isso reativaria uma autoridade aposentada
e poderia recriar notificações paralelas. O draft agora preserva o no-op F2 e
há teste de regressão específico.

## Gates restantes

1. disponibilizar a CLI oficial ou um ambiente isolado equivalente;
2. criar o arquivo com `supabase migration new`;
3. aplicar em banco isolado e executar cenários positivo, duplicado,
   concorrente, descarte, troca de dono e resolução;
4. rodar advisors de segurança e desempenho;
5. apresentar contagens antes/depois e rollback;
6. obter autorização específica para a migration produtiva;
7. aplicar, validar contadores e comportamento, sem consultar PII.

## Rollback planejado

Antes da aplicação será produzido SQL de rollback que:

- restaura as definições anteriores das duas RPCs;
- remove trigger e índice novo;
- preserva as colunas aditivas e o histórico resolvido, evitando perda de
  auditoria;
- não reabre automaticamente duplicatas antigas.

Esse rollback é funcional, não uma tentativa destrutiva de recriar o ruído.
