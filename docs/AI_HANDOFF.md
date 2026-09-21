# Checkpoint ERP ApeCerto

- Objetivo: avançar pelas falhas P0/P1 comprovadas após concluir gerente → corretor → visita → feedback persistido → pendência encerrada.
- Base: `origin/main` em `2a458d0f0c084d11d39a079ad7db3797106f3c14`; branch `codex/agenda-hoje-sao-paulo`.
- Concluído nesta fatia: Tarefas da Sara abre na fila atrasada, antes das próximas ações, seguindo a prioridade já exibida na navegação.
- Decisão: trocar apenas o estado inicial de `agora` para `atrasadas`; classificações, contagens e dados permanecem canônicos.
- Arquivos: `app/features/tasks/SaraTasksMobile.tsx`, `tests/app-mobile-tarefas.test.mjs`, `tests/crm-visual-harness/main.tsx`.
- Verificações: teste falhou primeiro com a fila inicial incorreta; 28 testes direcionados, 15 testes finais e lint passaram; build Vinext passou; navegador confirmou `Atrasadas` ativa, cards vencidos e console limpo em 390×844 e largura ampla.
- Produção: `2a458d0f` publicado e confirmado; o filtro vazio da Agenda móvel manteve o contexto gerencial sem erros de console.
- Risco: a mudança só altera a aba selecionada na primeira abertura; filtros seguintes e ações continuam iguais.
- Próximo passo: publicar esta fatia, validar produção e seguir para a próxima falha P0/P1 comprovada.
