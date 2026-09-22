# Checkpoint ERP ApeCerto

- Objetivo: avançar pelas falhas P0/P1 comprovadas após concluir gerente → corretor → visita → feedback persistido → pendência encerrada.
- Base: `origin/main` em `b679ff9a`; branch `codex/agenda-hoje-sao-paulo`.
- Concluído nesta fatia: Avisos publica no shell a contagem real de não lidos e a reduz somente após leitura persistida.
- Decisão: usar o publisher global já existente; falha de carga ou sessão expirada preserva o badge anterior em vez de publicar zero falso.
- Arquivos: `app/features/notifications/NotificationsWorkspace.tsx`, `tests/push-e-avisos.test.mjs`, `tests/crm-visual-harness/main.tsx`, `tests/crm-visual-harness.test.mjs`.
- Verificações: o teste falhou primeiro; antes, um aviso não lido não publicava badge; depois, o harness publica 1 na carga, mantém 1 e navega em `{ok:false}`, e reduz para 0 em `{ok:true}`; 39 testes dirigidos passaram.
- Produção: `b679ff9a` publicado e confirmado antes desta fatia; Avisos carregou 100 ações reais sem clicar ou marcar leitura.
- Risco: baixo; apenas sincroniza o contador global com a lista canônica já carregada.
- Próximo passo: executar lint e build, publicar esta fatia, validar o badge em produção sem mutação e seguir para a próxima falha P0/P1 comprovada.
