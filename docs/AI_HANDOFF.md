# Checkpoint ERP ApeCerto

- Objetivo: avançar pelas falhas P0/P1 comprovadas após concluir gerente → corretor → visita → feedback persistido → pendência encerrada.
- Base: `origin/main` em `6230f2d4`; branch `codex/agenda-hoje-sao-paulo`.
- Concluído nesta fatia: remoção do falso seletor de pipeline — “Comercial”, a única opção disponível, agora é contexto visual estático na barra do Kanban.
- Decisão: não prometer interação onde não há escolha; preservar a hierarquia com marcação semântica e tokens oficiais.
- Arquivos: `app/features/funil-2/Funil2BoardToolbar.tsx`, `app/styles/funil.css`, `tests/crm-correcao-6-2-para-10.test.mjs`.
- Verificações: o contrato falhou antes da mudança; 15 testes dirigidos e o lint passaram; no navegador, “Pipeline / Comercial” permaneceu visível sem qualquer `select` inerte.
- Produção: `6230f2d4` publicado e confirmado antes desta fatia; o CRM real limpou o recorte, restaurou 65 cartões e não apresentou loading ou alerta.
- Risco: baixo; apenas conteúdo, semântica e recuperação visual mudam, com os mesmos dados e filtros.
- Progresso conservador publicado após esta entrega:
  - Transformação completa: `[█████████░░░░░░░░░░░] 43/100`
  - CRM / Kanban: `[█████████████░░░░░░░] 65/100`
  - Identidade visual: `[████████████░░░░░░░░] 60/100`
  - Meu Dia: `[██████████████░░░░░░] 70/100`
  - Agenda / visitas: `[███████████████░░░░░] 75/100`
  - Aplicativo móvel: `[████████████░░░░░░░░] 62/100`
- Próximo passo: publicar esta fatia, validar o desktop em produção sem mutações e seguir apenas com readequação visível do CRM/Kanban antes do teto de 70%.
