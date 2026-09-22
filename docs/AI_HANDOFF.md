# Checkpoint ERP ApeCerto

- Objetivo: avançar pelas falhas P0/P1 comprovadas após concluir gerente → corretor → visita → feedback persistido → pendência encerrada.
- Base: `origin/main` em `965507e9`; branch `codex/agenda-hoje-sao-paulo`.
- Concluído nesta fatia: controles contextuais no Kanban — busca, limpeza e filtros aparecem somente no recorte “Em andamento”, onde realmente afetam os cartões.
- Decisão: condicionar o bloco existente à visão ativa, sem criar estado, componente ou regra paralela.
- Arquivos: `app/features/funil-2/Funil2BoardToolbar.tsx`, `tests/crm-correcao-6-2-para-10.test.mjs`.
- Verificações: a falha foi reproduzida com busca e filtros visíveis em Ganhos; 36 testes dirigidos e o lint passaram; no navegador, os controles sumiram em Ganhos e voltaram em Em andamento.
- Produção: `965507e9` publicado e confirmado antes desta fatia; o contador real percorreu “Filtros · 1”, “Filtros · 2” e “Filtros” sem loading ou alerta.
- Risco: baixo; apenas conteúdo, semântica e recuperação visual mudam, com os mesmos dados e filtros.
- Progresso conservador publicado após esta entrega:
  - Transformação completa: `[█████████░░░░░░░░░░░] 45/100`
  - CRM / Kanban: `[█████████████░░░░░░░] 67/100`
  - Identidade visual: `[████████████░░░░░░░░] 62/100`
  - Meu Dia: `[██████████████░░░░░░] 70/100`
  - Agenda / visitas: `[███████████████░░░░░] 75/100`
  - Aplicativo móvel: `[████████████░░░░░░░░] 62/100`
- Próximo passo: publicar esta fatia, validar o desktop em produção sem mutações e seguir apenas com readequação visível do CRM/Kanban antes do teto de 70%.
