# Checkpoint ERP ApeCerto

- Objetivo: avançar pelas falhas P0/P1 comprovadas após concluir gerente → corretor → visita → feedback persistido → pendência encerrada.
- Base: `origin/main` em `af9e99e8`; branch `codex/agenda-hoje-sao-paulo`.
- Concluído nesta fatia: a tela compartilhada de Avisos rejeita notificações malformadas antes de agrupá-las, publicar o badge ou renderizar cards.
- Decisão: validar no único fetch os dez campos do contrato `Aviso`, sem proteger separadamente cada consumidor nem normalizar dados corrompidos.
- Arquivos: `app/features/notifications/NotificationsWorkspace.tsx`, `tests/push-e-avisos.test.mjs`, `tests/crm-visual-harness/main.tsx`, `tests/crm-visual-harness.test.mjs`.
- Verificações: antes da correção, `notificacoes: [null]` apagava Avisos com `TypeError` em `resolvida_em`; o teste comportamental falhou; 52 testes dirigidos passaram e o lint ficou limpo; no navegador, o item malformado abriu o erro recuperável sem estado vazio falso, enquanto o válido preservou contador, card e ação.
- Produção: `af9e99e8` publicado e confirmado antes desta fatia; a Agenda real carregou o calendário sem erros ou mutações.
- Risco: baixo; item fora do contrato passa ao estado de erro recuperável já existente.
- Próximo passo: publicar esta fatia, validar Avisos reais em produção sem mutações e seguir para a próxima falha P0/P1 comprovada.
