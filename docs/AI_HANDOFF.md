# Checkpoint ERP ApeCerto

- Objetivo: avançar pelas falhas P0/P1 comprovadas após concluir gerente → corretor → visita → feedback persistido → pendência encerrada.
- Base: `origin/main` em `bf6617a0f2093d1cc678917e1aa3ae9fcf94e1e9`; branch `codex/agenda-hoje-sao-paulo`.
- Concluído nesta fatia: Avisos não transforma mais HTTP 200 com payload incompleto em confirmação falsa de fila zerada.
- Decisão: aceitar `notificacoes` ou o alias legado `itens`, mas exigir que o valor encontrado seja um array.
- Arquivos: `app/features/notifications/NotificationsWorkspace.tsx`, `tests/push-e-avisos.test.mjs`, `tests/crm-visual-harness/main.tsx`.
- Verificações: o harness reproduziu `Você está em dia` com `{}`; o teste falhou primeiro; 37 testes direcionados e lint passaram; build Vinext passou; após a correção, o harness mostrou erro recuperável com retry, enquanto a lista vazia legítima continuou válida, sem erros de console.
- Produção: `bf6617a0` publicado e confirmado; a Agenda real abriu normalmente em 390 px, sem erro, loading preso ou sessão expirada.
- Risco: nenhum; a lista vazia legítima continua sendo `[]`, e somente a ausência do contrato passa a falhar fechada.
- Próximo passo: publicar esta fatia, validar produção e seguir para a próxima falha P0/P1 comprovada.
