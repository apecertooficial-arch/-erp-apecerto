# Checkpoint ERP ApeCerto

- Objetivo: avançar pelas falhas P0/P1 comprovadas após concluir gerente → corretor → visita → feedback persistido → pendência encerrada.
- Base: `origin/main` em `e92b099fbdc09357121d8d439cc827bf9f429275`; branch `codex/agenda-hoje-sao-paulo`.
- Concluído nesta fatia: o botão “Hoje” da Agenda também retorna à data operacional de São Paulo, independentemente do fuso do aparelho.
- Decisão: reutilizar a mesma âncora `hojeISO` ao meio-dia já adotada na abertura do calendário.
- Arquivos: `app/features/calendar/CalendarWorkspace.tsx`, `tests/agenda-canonica.test.mjs`.
- Verificações: teste falhou primeiro com o retorno no fuso local; 40 testes direcionados e lint passaram; build Vinext passou; no navegador, avançar para outubro e clicar em “Hoje” retornou a setembro sem erro de console.
- Produção: `e92b099f` publicado e confirmado; Agenda desktop/mobile carregou sem erro de console.
- Risco: a mudança se limita à ação do botão “Hoje”; navegação anterior/seguinte permanece inalterada.
- Próximo passo: publicar esta fatia, validar produção e seguir para a próxima falha P0/P1 comprovada.
