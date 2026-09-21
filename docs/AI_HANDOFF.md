# Checkpoint ERP ApeCerto

- Objetivo: avançar pelas falhas P0/P1 comprovadas após concluir gerente → corretor → visita → feedback persistido → pendência encerrada.
- Base: `origin/main` em `70efa82731f7dbc88abc42d45bfd48e4c4fb8fc7`; branch `codex/agenda-hoje-sao-paulo`.
- Concluído nesta fatia: o Financeiro não desmonta mais ao receber HTTP 200 sem os dez conjuntos obrigatórios do painel.
- Decisão: validar vendas, detalhes, comissões, recebimentos, caixa, usuários, corretores, metas, leads e negócios antes de instalar o estado; contrato inválido recebe mensagem humana e retry.
- Arquivos: `app/features/finance/FinanceWorkspace.tsx`, `tests/finance-venda-atomica.test.mjs`, `tests/finance-visual-harness/main.tsx`.
- Verificações: o harness reproduziu página em branco e `TypeError` com `{}`; o teste falhou primeiro; 27 testes direcionados e lint passaram; depois da correção, o harness mostrou erro recuperável sem erro de runtime, e o estado normal preservou VGV e venda concluída.
- Produção: `70efa827` publicado e confirmado; Chat ao Vivo carregou duas conversas e o histórico real selecionado, sem logs de console.
- Risco: baixo; painel legitimamente vazio continua válido quando contém os dez conjuntos como listas vazias.
- Próximo passo: executar o build, publicar esta fatia, validar `/financeiro` em produção e seguir para a próxima falha P0/P1 comprovada.
