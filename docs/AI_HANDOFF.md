# Checkpoint ERP ApeCerto

- Objetivo: avançar pelas falhas P0/P1 comprovadas após concluir gerente → corretor → visita → feedback persistido → pendência encerrada.
- Base: `origin/main` em `90de9cabfede6ce1fe8ffd05346d592da9c72164`; branch `codex/agenda-hoje-sao-paulo`.
- Concluído nesta fatia: o destaque de hoje e o mês inicial da Agenda usam a data operacional de São Paulo, independentemente do fuso do aparelho.
- Decisão: reutilizar `hojeISO` tanto no comparativo diário quanto na âncora inicial do calendário, fixando meio-dia para evitar deslocamento na conversão local.
- Arquivos: `app/features/calendar/CalendarWorkspace.tsx`, `tests/agenda-canonica.test.mjs`.
- Verificações: teste estático reproduziu primeiro a integração ausente; 40 testes direcionados e lint passaram; build Vinext passou; harness desktop e mobile 390×844 exibiu a Agenda sem erro de console.
- Produção: `90de9cab` publicado e confirmado; CRM desktop/mobile carregou sem erro de console.
- Risco: a mudança se limita à inicialização e ao contexto de data da Agenda; navegação posterior permanece inalterada.
- Próximo passo: publicar esta fatia, validar produção e seguir para a próxima falha P0/P1 comprovada.
