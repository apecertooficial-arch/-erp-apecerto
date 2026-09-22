# Checkpoint ERP ApeCerto

- Objetivo: avançar pelas falhas P0/P1 comprovadas após concluir gerente → corretor → visita → feedback persistido → pendência encerrada.
- Base: `origin/main` em `0717fb6f`; branch `codex/agenda-hoje-sao-paulo`.
- Concluído nesta fatia: Agenda desktop e aplicativo só encerram edição ou resultado de visita quando `success` é exatamente o booleano `true`.
- Decisão: rejeitar valores truthy como `"false"` nas três portas de escrita da Agenda.
- Arquivos: `app/features/calendar/CalendarWorkspace.tsx`, `app/features/calendar/TelaAgendaMobile.tsx`, `tests/agenda-canonica.test.mjs`, `tests/crm-visual-harness/main.tsx`, `tests/crm-visual-harness.test.mjs`.
- Verificações: o contrato falhou primeiro; no navegador, um feedback sanitizado 10/10 recebeu `{success:"false"}`, permaneceu aberto e pendente, e exibiu erro sem remover a cobrança; 41 testes dirigidos e lint passaram.
- Produção: `0717fb6f` publicado e confirmado antes desta fatia.
- Risco: baixo; respostas fora do contrato deixam de concluir visita ou feedback por coerção de tipo.
- Próximo passo: executar o build final, publicar esta fatia, validar a aplicação real sem mutações e seguir para a próxima falha P0/P1 comprovada.
