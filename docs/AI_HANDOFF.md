# Checkpoint ERP ApeCerto

- Objetivo: avançar pelas falhas P0/P1 comprovadas após concluir gerente → corretor → visita → feedback persistido → pendência encerrada.
- Base: `origin/main` em `b4774046e0f53c790c9c8f00feceae4652a219d8`; branch `codex/agenda-hoje-sao-paulo`.
- Concluído nesta fatia: Tarefas rejeita payload 2xx sem a lista canônica e não transforma falha de contrato em fila vazia.
- Decisão: validar somente `Array.isArray(json.leads)` na fronteira já existente; erro, retry e sessão continuam no fluxo atual.
- Arquivos: `app/features/tasks/SaraTasksMobile.tsx`, `tests/app-mobile-tarefas.test.mjs`, `tests/crm-visual-harness/main.tsx`, `tests/crm-visual-harness.test.mjs`.
- Verificações: teste falhou primeiro sem validação; 20 testes direcionados e lint passaram; build Vinext passou; harness com HTTP 200 inválido mostrou alerta e retry, nunca `Fila zerada`, sem erros de console em 390×844 e largura ampla.
- Produção: `b4774046` publicado e confirmado; Tarefas carregou 25 cards na fila atrasada, sem erros de console; o anúncio de loading foi comprovado no harness determinístico.
- Risco: validação cobre a coleção obrigatória; campos de cada lead continuam sob o contrato da API canônica já usado pelo CRM.
- Próximo passo: publicar esta fatia, validar produção e seguir para a próxima falha P0/P1 comprovada.
