# Checkpoint ERP ApeCerto

- Objetivo: avançar pelas falhas P0/P1 comprovadas após concluir gerente → corretor → visita → feedback persistido → pendência encerrada.
- Base: `origin/main` em `dfa882255e64d3b5356a49e9411c11f011daf1b4`; branch `codex/agenda-hoje-sao-paulo`.
- Concluído nesta fatia: o estado vazio do filtro por corretor na Agenda móvel mantém o contexto de cobrança gerencial.
- Decisão: tratar explicitamente o corretor em foco sem pendências e omitir a instrução genérica quando não há item acionável.
- Arquivos: `app/features/calendar/TelaAgendaMobile.tsx`, `tests/agenda-gerente-filtro.test.mjs`.
- Verificações: teste falhou primeiro com o título incorreto; 31 testes direcionados e lint passaram; build Vinext passou; navegador confirmou o estado vazio em 390×844, a tela gerencial desktop e console sem erros.
- Produção: `dfa88225` publicado e confirmado; Tarefas da Sara excluiu histórico e atualização manual em desktop e celular sem erro de console.
- Risco: a mudança altera somente a mensagem do filtro vazio e esconde uma instrução sem ação possível; dados e fluxo de visita permanecem intactos.
- Próximo passo: publicar esta fatia, validar produção e seguir para a próxima falha P0/P1 comprovada.
