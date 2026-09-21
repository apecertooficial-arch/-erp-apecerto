# Checkpoint ERP ApeCerto

- Objetivo: avançar pelas falhas P0/P1 comprovadas após concluir gerente → corretor → visita → feedback persistido → pendência encerrada.
- Base: `origin/main` em `8b201cc93c94584fd33054aca3439ac9c7f152bb`; branch `codex/agenda-hoje-sao-paulo`.
- Concluído nesta fatia: o calendário de Projetos e Tarefas abre no mês operacional de São Paulo, alinhado aos grupos “Hoje” e “Próximas”.
- Decisão: reutilizar o helper `hoje` existente e ancorar o calendário ao meio-dia.
- Arquivos: `app/features/projects/ProjectsWorkspace.tsx`, `tests/projects-api-hardening.test.mjs`.
- Verificações: teste falhou primeiro com o mês local; 55 testes direcionados e lint passaram; build Vinext passou.
- Produção: `8b201cc9` publicado e confirmado; o Início exibiu mês, data e dias restantes operacionais sem erro de console.
- Risco: a mudança se limita ao mês inicial do calendário de projetos; prazos, agrupamentos e mutações permanecem inalterados.
- Próximo passo: publicar esta fatia, validar produção e seguir para a próxima falha P0/P1 comprovada.
