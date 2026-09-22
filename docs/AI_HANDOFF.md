# Checkpoint ERP ApeCerto

- Objetivo: avançar pelas falhas P0/P1 comprovadas após concluir gerente → corretor → visita → feedback persistido → pendência encerrada.
- Base: `origin/main` em `6c5f629c`; branch `codex/agenda-hoje-sao-paulo`.
- Concluído nesta fatia: rótulo fiel do KPI “Em andamento”, que agora descreve a quantidade como “neste recorte”.
- Decisão: ajustar apenas o texto já existente, sem componente, estado ou estilo novo.
- Arquivos: `app/features/funil-2/Funil2BoardToolbar.tsx`, `tests/crm-correcao-6-2-para-10.test.mjs`.
- Verificações: o contrato falhou com “etapas visíveis”; 18 testes dirigidos e o lint passaram; no navegador, o KPI exibiu 108 e 0 com o mesmo rótulo correto “neste recorte”.
- Produção: `6c5f629c` publicado e confirmado antes desta fatia; busca vazia mostrou KPI 0/cartões 0 e a limpeza restaurou o total real sem loading ou alerta.
- Risco: baixo; apenas conteúdo, semântica e recuperação visual mudam, com os mesmos dados e filtros.
- Progresso conservador publicado após esta entrega:
  - Transformação completa: `[█████████░░░░░░░░░░░] 47/100`
  - CRM / Kanban: `[██████████████░░░░░░] 70/100`
  - Identidade visual: `[█████████████░░░░░░░] 65/100`
  - Meu Dia: `[██████████████░░░░░░] 70/100`
  - Agenda / visitas: `[███████████████░░░░░] 75/100`
  - Aplicativo móvel: `[████████████░░░░░░░░] 62/100`
- Próximo passo: publicar esta fatia, validar o desktop em produção sem mutações e seguir apenas com readequação visível do CRM/Kanban antes do teto de 70%.
