# Checkpoint ERP ApeCerto

- Objetivo: avançar pelas falhas P0/P1 comprovadas após concluir gerente → corretor → visita → feedback persistido → pendência encerrada.
- Base: `origin/main` em `53aa187e8d15a21a0fcc51bbc676e7fae55d5e39`; branch `codex/agenda-hoje-sao-paulo`.
- Concluído nesta fatia: CRM e Meu Dia reconhecem 401 no carregador móvel compartilhado e exibem a recuperação de sessão do app.
- Decisão: tratar a expiração uma vez em `useFunil2Mobile`, preservando o erro recuperável genérico para falhas que não sejam de autenticação.
- Arquivos: `app/features/funil-2/Funil2Mobile.tsx`, `tests/funil-2-mobile-operacional.test.mjs`, `tests/crm-visual-harness/main.tsx`.
- Verificações: o teste falhou primeiro pela ausência do estado; 42 testes direcionados e lint passaram; build Vinext passou; harness em 390 px mostrou `/inicio`, sem erro genérico ou retry, e CRM desktop normal ficou íntegro em 1280 px, sem erros de console.
- Produção: `53aa187e` publicado e confirmado; a recuperação compartilhada aponta para a rota real do login.
- Risco: mutações abertas após a expiração ainda mostram o erro específico de cada formulário; esta fatia corrige o carregamento principal comum a CRM e Meu Dia.
- Próximo passo: publicar esta fatia, validar produção e seguir para a próxima falha P0/P1 comprovada.
