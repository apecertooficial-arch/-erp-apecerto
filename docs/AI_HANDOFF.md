# Checkpoint ERP ApeCerto

- Objetivo: avançar pelas falhas P0/P1 comprovadas após concluir gerente → corretor → visita → feedback persistido → pendência encerrada.
- Base: `origin/main` em `5b61d914ccf90a83578e1183c55e8ded933aee6f`; branch `codex/agenda-contagem-futura`.
- Concluído nesta fatia: o resumo da Agenda conta como futuras somente visitas de hoje em diante com status `agendada` ou `confirmada`; visitas passadas deixam de inflar o indicador.
- Decisão: centralizar a definição em uma função pura já no módulo lógico da Agenda, sem alterar banco, API ou dados.
- Arquivos: `app/features/calendar/telaAgenda.logica.ts`, `app/features/calendar/CalendarWorkspace.tsx`, `tests/agenda-canonica.test.mjs`.
- Verificações: produção mostrou 106 “visitas futuras” enquanto mantinha 62 visitas passadas pendentes; teste vermelho confirmou a regra ausente; 37 testes direcionados e lint passaram; build Vinext passou; harness desktop/mobile 390×844 carregou Agenda sem erro de console.
- Produção: `5b61d914` publicado e confirmado; o primeiro item do Meu Dia não é mais histórico e o console ficou limpo.
- Risco: o indicador inclui hoje e visitas confirmadas, coerente com a agenda futura; estados encerrados continuam excluídos.
- Próximo passo: publicar esta fatia, confirmar a contagem da Agenda em produção e seguir para a próxima falha P0/P1 do aplicativo.
