# Checkpoint ERP ApeCerto

- Objetivo: avançar pelas falhas P0/P1 comprovadas após concluir gerente → corretor → visita → feedback persistido → pendência encerrada.
- Base: `origin/main` em `8b56fa1864af224980abd27e8d3116723973df52`; branch `codex/app-concluidas-no-total`.
- Concluído nesta fatia: Agenda desktop e aplicativo móvel rotulam conclusões globais como “no total” quando a cobrança está filtrada por corretor, sem atribuir o resultado da equipe a uma pessoa.
- Decisão: reutilizar uma função pura de rótulo nas duas superfícies, sem criar métrica por corretor que a API não fornece.
- Arquivos: `app/features/calendar/telaAgenda.logica.ts`, `app/features/calendar/TelaAgendaMobile.tsx`, `app/features/calendar/CalendarWorkspace.tsx`, `tests/agenda-gerente-filtro.test.mjs`.
- Verificações: produção reproduziu “96 concluídas” globais ao lado da lista individual; teste vermelho confirmou a regra ausente; 34 testes direcionados e lint passaram; build Vinext passou; harness desktop/mobile 390×844 exibiu “no total” com console limpo.
- Produção: `8b56fa18` publicado e confirmado; o indicador de visitas futuras caiu de 106 para 21, mantendo 62 pendências passadas separadas.
- Risco: a UI continua exibindo a métrica global, agora explicitamente contextualizada; nenhum dado ou cálculo foi alterado.
- Próximo passo: publicar esta fatia, validar o filtro em produção e seguir para a próxima falha P0/P1 comprovada.
