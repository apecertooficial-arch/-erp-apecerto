# Checkpoint ERP ApeCerto

- Objetivo: avançar pelas falhas P0/P1 comprovadas após concluir gerente → corretor → visita → feedback persistido → pendência encerrada.
- Base: `origin/main` em `455ebcb60f8ae14d3e8025988ecfb54ecd7b96f9`; branch `codex/agenda-hoje-sao-paulo`.
- Concluído nesta fatia: CRM e Meu Dia não transformam mais HTTP 200 com payload incompleto em carteira ou fila vazia.
- Decisão: exigir apenas o array canônico `leads` no carregador compartilhado; os demais campos opcionais continuam com os fallbacks já existentes.
- Arquivos: `app/features/funil-2/Funil2Mobile.tsx`, `tests/funil-2-mobile-operacional.test.mjs`.
- Verificações: o harness reproduziu `Nenhum cliente neste filtro` com `{}`; o teste falhou primeiro; 42 testes direcionados e lint passaram; build Vinext passou; após a correção, o harness mostrou erro recuperável com retry, sem falso vazio e sem erros de console.
- Produção: `455ebcb6` publicado e confirmado; CRM real carregou 60 cards e Meu Dia permaneceu sem erro em 390 px.
- Risco: a validação é intencionalmente mínima e não exige campos opcionais que o cliente já sabe omitir com segurança.
- Próximo passo: publicar esta fatia, validar produção e seguir para a próxima falha P0/P1 comprovada.
