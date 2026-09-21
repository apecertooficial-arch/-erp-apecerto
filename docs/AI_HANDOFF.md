# Checkpoint ERP ApeCerto

- Objetivo: avançar pelas falhas P0/P1 comprovadas após concluir gerente → corretor → visita → feedback persistido → pendência encerrada.
- Base: `origin/main` em `a88b4ba6e1b91f755344f940a946d95d248f36e3`; branch `codex/agenda-hoje-sao-paulo`.
- Concluído nesta fatia: filtros anuais e formulário de metas do Financeiro usam ano e mês operacionais de São Paulo.
- Decisão: derivar ano e mês diretamente de `hojeOperacao`, sem criar nova abstração de calendário.
- Arquivos: `app/features/finance/FinanceWorkspace.tsx`, `tests/finance-venda-atomica.test.mjs`.
- Verificações: teste falhou primeiro com o relógio local; 37 testes direcionados e lint passaram; build Vinext passou; harness produtivo carregou filtros e Metas em desktop e Financeiro em 390×844 sem erro de console.
- Produção: `a88b4ba6` publicado e confirmado; Projetos abriu o calendário em setembro de 2026 sem erro de console.
- Risco: a mudança se limita aos valores iniciais/fallbacks de período; filtros aplicados, valores e mutações financeiras permanecem inalterados.
- Próximo passo: publicar esta fatia, validar produção e seguir para a próxima falha P0/P1 comprovada.
