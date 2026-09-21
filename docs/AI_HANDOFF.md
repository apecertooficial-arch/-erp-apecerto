# Checkpoint ERP ApeCerto

- Objetivo: avançar pelas falhas P0/P1 comprovadas após concluir gerente → corretor → visita → feedback persistido → pendência encerrada.
- Base: `origin/main` em `a9b21b5697690fcaee6df059ca62dd1a42738c11`; branch `codex/agenda-hoje-sao-paulo`.
- Concluído nesta fatia: a Agenda móvel não transforma mais HTTP 200 com payload incompleto em dia vazio.
- Decisão: exigir apenas o array canônico `itens`; resumo, pendências e métricas continuam opcionais e usam os fallbacks existentes.
- Arquivos: `app/features/calendar/TelaAgendaMobile.tsx`, `tests/agenda-canonica.test.mjs`, `tests/crm-visual-harness/main.tsx`.
- Verificações: o harness reproduziu `Nada marcado neste dia` com `{}`; o teste falhou primeiro; 39 testes direcionados e lint passaram; build Vinext passou; após a correção, o harness mostrou erro recuperável, sem falso vazio, e Agenda normal ficou íntegra em 390 e 1280 px, sem erros de console.
- Produção: `a9b21b56` publicado e confirmado; CRM real carregou 60 cards em 390 px, sem falso vazio ou erros de console.
- Risco: campos auxiliares permanecem opcionais para manter compatibilidade com respostas parciais que ainda preservam a lista canônica de compromissos.
- Próximo passo: publicar esta fatia, validar produção e seguir para a próxima falha P0/P1 comprovada.
