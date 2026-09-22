# Checkpoint ERP ApeCerto

- Objetivo: avançar pelas falhas P0/P1 comprovadas após concluir gerente → corretor → visita → feedback persistido → pendência encerrada.
- Base: `origin/main` em `11d2f8f5`; branch `codex/agenda-hoje-sao-paulo`.
- Concluído nesta fatia: a criação de venda na Esteira não fecha mais o modal quando a API retorna HTTP 200 sem `success: true`.
- Decisão: exigir confirmação explícita do contrato antes de recarregar e fechar o formulário.
- Arquivos: `app/features/sales/SalesProcessWorkspace.tsx`, `tests/crm-sales-write-safety.test.mjs`, `tests/crm-visual-harness/main.tsx`.
- Verificações: o harness reproduziu `{}` fechando o modal sem erro; o teste falhou primeiro; depois da correção, a falha mantém o formulário e a resposta válida fecha normalmente em viewport móvel, 33 testes dirigidos e lint passaram.
- Produção: `11d2f8f5` publicado e confirmado; a Esteira real carregou completamente sem executar mutação.
- Risco: baixo; a escrita foi simulada somente no harness local.
- Próximo passo: executar o build, publicar esta fatia, validar o Chat em produção e seguir para a próxima falha P0/P1 comprovada.
