# Checkpoint ERP ApeCerto

- Objetivo: avançar pelas falhas P0/P1 comprovadas após concluir gerente → corretor → visita → feedback persistido → pendência encerrada.
- Base: `origin/main` em `77688b57`; branch `codex/agenda-hoje-sao-paulo`.
- Concluído nesta fatia: estado selecionado acessível nos quatro recortes acionáveis do pipeline.
- Decisão: expor com `aria-pressed` o mesmo estado que já controla classe e conteúdo, sem lógica duplicada.
- Arquivos: `app/features/funil-2/Funil2BoardToolbar.tsx`, `tests/crm-correcao-6-2-para-10.test.mjs`.
- Verificações: o contrato falhou antes da mudança; 18 testes dirigidos e o lint passaram; no navegador, Ganhos ficou `aria-pressed=true` e os outros três recortes ficaram `false`.
- Produção: `77688b57` publicado e confirmado antes desta fatia; busca e filtros somem em Ganhos e retornam em Em andamento sem loading ou alerta.
- Risco: baixo; apenas conteúdo, semântica e recuperação visual mudam, com os mesmos dados e filtros.
- Progresso conservador publicado após esta entrega:
  - Transformação completa: `[█████████░░░░░░░░░░░] 46/100`
  - CRM / Kanban: `[██████████████░░░░░░] 68/100`
  - Identidade visual: `[█████████████░░░░░░░] 63/100`
  - Meu Dia: `[██████████████░░░░░░] 70/100`
  - Agenda / visitas: `[███████████████░░░░░] 75/100`
  - Aplicativo móvel: `[████████████░░░░░░░░] 62/100`
- Próximo passo: publicar esta fatia, validar o desktop em produção sem mutações e seguir apenas com readequação visível do CRM/Kanban antes do teto de 70%.
