# Checkpoint ERP ApeCerto

- Objetivo: avançar pelas falhas P0/P1 comprovadas após concluir gerente → corretor → visita → feedback persistido → pendência encerrada.
- Base: `origin/main` em `a29e9e4e`; branch `codex/agenda-hoje-sao-paulo`.
- Concluído nesta fatia: limpeza persistente dos filtros no CRM móvel — a ação aparece com qualquer recorte ativo, não apenas quando a lista chega a zero.
- Decisão: centralizar o reset já existente em um único botão condicional e remover sua duplicação do estado vazio.
- Arquivos: `app/features/funil-2/Funil2Mobile.tsx`, `app/styles/funil.css`, `tests/crm-correcao-6-2-para-10.test.mjs`.
- Verificações: a falha real mostrou 21 clientes filtrados sem ação de limpeza; 37 testes dirigidos e o lint passaram; no navegador, o botão restaurou 60 cartões, ativou “Todas” e desapareceu.
- Produção: `a29e9e4e` publicado e confirmado antes desta fatia; o KPI real exibiu 663 e 0 com o rótulo “neste recorte”, sem loading ou alerta.
- Risco: baixo; apenas conteúdo, semântica e recuperação visual mudam, com os mesmos dados e filtros.
- Progresso conservador publicado após esta entrega:
  - Transformação completa: `[██████████░░░░░░░░░░] 48/100`
  - CRM / Kanban: `[██████████████░░░░░░] 71/100`
  - Identidade visual: `[█████████████░░░░░░░] 66/100`
  - Meu Dia: `[██████████████░░░░░░] 70/100`
  - Agenda / visitas: `[███████████████░░░░░] 75/100`
  - Aplicativo móvel: `[█████████████░░░░░░░] 64/100`
- Próximo passo: publicar esta fatia, validar o app em produção sem mutações e parar com margem antes do teto de 70%.
