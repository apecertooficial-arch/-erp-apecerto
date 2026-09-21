# Checkpoint ERP ApeCerto

- Objetivo: avançar pelas falhas P0/P1 comprovadas após concluir gerente → corretor → visita → feedback persistido → pendência encerrada.
- Base: `origin/main` em `b56f86311811fdac0ab1ce4d984eecd68e5c5951`; branch `codex/agenda-hoje-sao-paulo`.
- Concluído nesta fatia: Tarefas não transforma card `pescado` com prazo antigo em obrigação atrasada.
- Decisão: excluir `pescado` somente da fila de Tarefas; o atalho de primeira chamada no Meu Dia continua intacto.
- Arquivos: `app/features/tasks/SaraTasksMobile.tsx`, `tests/app-mobile-tarefas.test.mjs`, `tests/crm-visual-harness/main.tsx`.
- Verificações: teste falhou primeiro sem a exclusão; 37 testes direcionados e lint passaram; build Vinext passou; harness com 32 registros confirmou 31 obrigações, 25 cards iniciais e nenhum pescado em 390×844 e largura ampla, sem erros de console.
- Produção: `b56f8631` publicado e confirmado; payload legítimo carregou a fila normal sem falso erro e Projetos permaneceu no desktop.
- Risco: o card pescado continua disponível no CRM e no atalho de primeira chamada; apenas deixa de contaminar a fila com prazo.
- Próximo passo: publicar esta fatia, validar produção e seguir para a próxima falha P0/P1 comprovada.
