# Checkpoint ERP ApeCerto

- Objetivo: avançar pelas falhas P0/P1 comprovadas após concluir gerente → corretor → visita → feedback persistido → pendência encerrada.
- Base: `origin/main` em `7cefc5ec`; branch `codex/agenda-hoje-sao-paulo`.
- Concluído nesta fatia: a Agenda móvel envelhece localmente o prazo recebido da API e deixa de chamar uma visita já iniciada de “próximo compromisso”.
- Decisão: recalcular apenas `faltam_min` a cada 30 segundos, sem dependência nova nem leitura adicional da API.
- Arquivos: `app/features/calendar/TelaAgendaMobile.tsx`, `app/features/calendar/telaAgenda.logica.ts`, `tests/agenda-canonica.test.mjs`, `tests/crm-visual-harness/main.tsx`, `tests/crm-visual-harness.test.mjs`.
- Verificações: o teste falhou primeiro; no harness, uma visita sanitizada permaneceu incorretamente em “Próximo compromisso” antes da correção e depois migrou para “Nada à frente neste período” sem reload, preservando o item no histórico do dia; 54 testes dirigidos passaram.
- Produção: `7cefc5ec` publicado e confirmado antes desta fatia; nenhuma mutação real foi executada.
- Risco: baixo; um render local no máximo a cada 30 segundos enquanto a Agenda móvel estiver montada.
- Próximo passo: executar lint e build, publicar esta fatia, validar a Agenda em produção sem mutação e seguir para a próxima falha P0/P1 comprovada.
