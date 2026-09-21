# Checkpoint ERP ApeCerto

- Objetivo: avançar pelas falhas P0/P1 comprovadas após concluir gerente → corretor → visita → feedback persistido → pendência encerrada.
- Base: `origin/main` em `ffe0c295c65109f12e6c6e7966851f55d7d7c2a0`; branch `codex/agenda-hoje-sao-paulo`.
- Concluído nesta fatia: a Agenda desktop não quebra mais ao receber HTTP 200 sem as seis listas obrigatórias do workspace.
- Decisão: validar `brokers`, `leads`, `deals`, `products`, `visits` e `tasks` antes de substituir o estado; resposta incompleta ou falha de rede mostra erro recuperável com retry.
- Arquivos: `app/features/calendar/CalendarWorkspace.tsx`, `tests/agenda-canonica.test.mjs`.
- Verificações: o harness reproduziu tela desmontada e `TypeError` com `{}`; o teste falhou primeiro; 55 testes direcionados e lint passaram; após a correção, o harness mostrou `Não foi possível carregar a agenda` com retry, e o estado normal preservou calendário, pendências e filtros.
- Produção: `ffe0c295` publicado e confirmado; Avisos carregou 100 itens reais em 390 px, com paginação e sem erros de console.
- Risco: baixo; payload vazio legítimo continua sendo composto por seis arrays vazios, e somente ausência do contrato passa a falhar fechada.
- Próximo passo: publicar esta fatia, validar produção e seguir para a próxima falha P0/P1 comprovada.
