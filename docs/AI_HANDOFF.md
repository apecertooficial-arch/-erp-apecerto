# Checkpoint ERP ApeCerto

- Objetivo: avançar pelas falhas P0/P1 comprovadas após concluir gerente → corretor → visita → feedback persistido → pendência encerrada.
- Base: `origin/main` em `70cce834`; branch `codex/agenda-hoje-sao-paulo`.
- Concluído nesta fatia: contador confiável de filtros no Kanban — temperatura e período alterados passam a compor o indicador visível.
- Decisão: derivar o contador diretamente das props já existentes, sem estado duplicado.
- Arquivos: `app/features/funil-2/Funil2BoardToolbar.tsx`, `tests/crm-correcao-6-2-para-10.test.mjs`.
- Verificações: o contrato falhou antes da mudança; 16 testes dirigidos e o lint passaram; no navegador, o resumo evoluiu de “Filtros · 1” para “Filtros · 2” e voltou a “Filtros” após limpar.
- Produção: `70cce834` publicado e confirmado antes desta fatia; o CRM real exibiu “Pipeline / Comercial” sem seletor, loading ou alerta.
- Risco: baixo; apenas conteúdo, semântica e recuperação visual mudam, com os mesmos dados e filtros.
- Progresso conservador publicado após esta entrega:
  - Transformação completa: `[█████████░░░░░░░░░░░] 44/100`
  - CRM / Kanban: `[█████████████░░░░░░░] 66/100`
  - Identidade visual: `[████████████░░░░░░░░] 61/100`
  - Meu Dia: `[██████████████░░░░░░] 70/100`
  - Agenda / visitas: `[███████████████░░░░░] 75/100`
  - Aplicativo móvel: `[████████████░░░░░░░░] 62/100`
- Próximo passo: publicar esta fatia, validar o desktop em produção sem mutações e seguir apenas com readequação visível do CRM/Kanban antes do teto de 70%.
