# Checkpoint ERP ApeCerto

- Objetivo: avançar pelas falhas P0/P1 comprovadas após concluir gerente → corretor → visita → feedback persistido → pendência encerrada.
- Base: `origin/main` em `793fd1e6`; branch `codex/agenda-hoje-sao-paulo`.
- Concluído nesta fatia: recuperação unificada do recorte desktop — a barra do Kanban exibe “Limpar filtros” quando busca, temperatura ou período alteram a visão.
- Decisão: reutilizar os três estados já existentes e restaurar os padrões em um único handler, sem abstração ou estado novo.
- Arquivos: `app/features/funil-2/Funil2BoardToolbar.tsx`, `app/features/funil-2/Funil2Workspace.tsx`, `app/styles/funil.css`, `tests/crm-correcao-6-2-para-10.test.mjs`.
- Verificações: o contrato falhou antes da mudança; 33 testes dirigidos e o lint passaram; no navegador, a ação apareceu com seis colunas vazias, restaurou 72 cartões e desapareceu após limpar.
- Produção: `793fd1e6` publicado e confirmado antes desta fatia; o CRM real exibiu os seis estados vazios contextuais sem alerta.
- Risco: baixo; apenas conteúdo, semântica e recuperação visual mudam, com os mesmos dados e filtros.
- Progresso conservador publicado após esta entrega:
  - Transformação completa: `[████████░░░░░░░░░░░░] 42/100`
  - CRM / Kanban: `[█████████████░░░░░░░] 64/100`
  - Identidade visual: `[████████████░░░░░░░░] 58/100`
  - Meu Dia: `[██████████████░░░░░░] 70/100`
  - Agenda / visitas: `[███████████████░░░░░] 75/100`
  - Aplicativo móvel: `[████████████░░░░░░░░] 62/100`
- Próximo passo: publicar esta fatia, validar o desktop em produção sem mutações e seguir apenas com readequação visível do CRM/Kanban antes do teto de 70%.
