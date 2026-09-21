# Checkpoint ERP ApeCerto

- Objetivo: avançar pelas falhas P0/P1 comprovadas após concluir gerente → corretor → visita → feedback persistido → pendência encerrada.
- Base: `origin/main` em `3a9445ac072640288593a0ba7d80e02b13be6415`; branch `codex/agenda-hoje-sao-paulo`.
- Concluído nesta fatia: o carregamento prolongado de Tarefas agora é anunciado por tecnologia assistiva.
- Decisão: manter o esqueleto visual oculto da árvore acessível e acrescentar somente um `role=status` com texto invisível reutilizando `.sr-only`.
- Arquivos: `app/features/tasks/SaraTasksMobile.tsx`, `tests/app-mobile-tarefas.test.mjs`.
- Verificações: teste falhou primeiro sem anúncio; 23 testes direcionados e lint passaram; build Vinext passou; harness em loading confirmou `Carregando tarefas…` no snapshot acessível e console limpo em 390×844 e largura ampla.
- Produção: `3a9445ac` publicado e confirmado; 423 tarefas permaneceram contabilizadas, 25 cards foram montados inicialmente e `Mostrar mais` expandiu para 50, sem erros de console e sem alterar Projetos no desktop.
- Risco: alteração apenas semântica durante loading; layout e dados não mudam.
- Próximo passo: publicar esta fatia, validar produção e seguir para a próxima falha P0/P1 comprovada.
