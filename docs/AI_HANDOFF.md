# Checkpoint ERP ApeCerto

- Objetivo: avançar pelas falhas P0/P1 comprovadas após concluir gerente → corretor → visita → feedback persistido → pendência encerrada.
- Base: `origin/main` em `dfff9f07`; branch `codex/agenda-hoje-sao-paulo`.
- Concluído nesta fatia: contador “Em andamento” fiel ao recorte — busca, temperatura e período passam a afetar o KPI e as colunas pela mesma coleção.
- Decisão: derivar `leadsVisiveisNoQuadro` uma única vez e reutilizá-la, preservando o contador global do módulo.
- Arquivos: `app/features/funil-2/Funil2Workspace.tsx`, `tests/crm-correcao-6-2-para-10.test.mjs`.
- Verificações: a falha real mostrou KPI 108 com zero cartões; 37 testes dirigidos e o lint passaram; no navegador, a busca vazia resultou em KPI 0 e a limpeza restaurou KPI 108.
- Produção: `dfff9f07` publicado e confirmado antes desta fatia; Ganhos expôs `[false, true, false, false]` sem loading ou alerta.
- Risco: baixo; apenas conteúdo, semântica e recuperação visual mudam, com os mesmos dados e filtros.
- Progresso conservador publicado após esta entrega:
  - Transformação completa: `[█████████░░░░░░░░░░░] 47/100`
  - CRM / Kanban: `[██████████████░░░░░░] 70/100`
  - Identidade visual: `[█████████████░░░░░░░] 64/100`
  - Meu Dia: `[██████████████░░░░░░] 70/100`
  - Agenda / visitas: `[███████████████░░░░░] 75/100`
  - Aplicativo móvel: `[████████████░░░░░░░░] 62/100`
- Próximo passo: publicar esta fatia, validar o desktop em produção sem mutações e seguir apenas com readequação visível do CRM/Kanban antes do teto de 70%.
