# Checkpoint ERP ApeCerto

- Objetivo: avançar pelas falhas P0/P1 comprovadas após concluir gerente → corretor → visita → feedback persistido → pendência encerrada.
- Base: `origin/main` em `b814bec557e8a21ff494d70ea6e9a5b802bf742d`; branch `codex/agenda-hoje-sao-paulo`.
- Concluído nesta fatia: a tela móvel Tarefas exclui registros históricos e de atualização manual da fila operacional.
- Decisão: reutilizar `leadOperacionalNoMeuDia`, a mesma regra vigente no CRM e no Meu Dia.
- Arquivos: `app/features/tasks/SaraTasksMobile.tsx`, `tests/app-mobile-tarefas.test.mjs`.
- Verificações: teste falhou primeiro sem o filtro operacional; 61 testes direcionados e lint passaram; build Vinext passou.
- Produção: `b814bec5` publicado e confirmado; cabeçalho móvel mostrou 21 de setembro no Início sem erro de console.
- Risco: a mudança só remove da lista operacional etapas que já são explicitamente históricas; dados e histórico permanecem preservados.
- Próximo passo: publicar esta fatia, validar produção e seguir para a próxima falha P0/P1 comprovada.
