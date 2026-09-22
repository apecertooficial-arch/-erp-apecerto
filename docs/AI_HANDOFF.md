# Checkpoint ERP ApeCerto

- Objetivo: avançar pelas falhas P0/P1 comprovadas após concluir gerente → corretor → visita → feedback persistido → pendência encerrada.
- Base: `origin/main` em `e33160ca`; branch `codex/agenda-hoje-sao-paulo`.
- Concluído nesta fatia: Avisos só remove o indicador “não lido” quando o POST confirma persistência com `ok: true`.
- Decisão: aguardar a confirmação antes da atualização local, mantendo a navegação para a ação mesmo quando a marcação falha.
- Arquivos: `app/features/notifications/NotificationsWorkspace.tsx`, `tests/push-e-avisos.test.mjs`, `tests/crm-visual-harness/main.tsx`, `tests/crm-visual-harness.test.mjs`.
- Verificações: o teste falhou primeiro; no harness, HTTP 200 com `{ok:false}` removia falsamente o ponto antes da correção; depois, a rejeição preserva “não lido” e ainda navega para `/crm`, enquanto `ok:true` remove o ponto e navega; 49 testes dirigidos passaram.
- Produção: `e33160ca` publicado e confirmado antes desta fatia; a Agenda real carregou em leitura sem mutação.
- Risco: baixo; o toque aguarda somente a resposta curta de marcação antes de navegar.
- Próximo passo: executar lint e build, publicar esta fatia, validar Avisos em produção sem mutação e seguir para a próxima falha P0/P1 comprovada.
