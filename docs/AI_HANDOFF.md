# Checkpoint ERP ApeCerto

- Objetivo: avançar pelas falhas P0/P1 comprovadas após concluir gerente → corretor → visita → feedback persistido → pendência encerrada.
- Base: `origin/main` em `741f1f84`; branch `codex/agenda-hoje-sao-paulo`.
- Concluído nesta fatia: o Chat não remove mais um agendamento localmente quando o cancelamento retorna HTTP 200 sem `success: true`.
- Decisão: exigir confirmação explícita antes de remover o item e anunciar cancelamento.
- Arquivos: `app/features/chat/LiveChatWorkspace.tsx`, `tests/live-chat-api-hardening.test.mjs`, `tests/crm-visual-harness/main.tsx`.
- Verificações: o harness reproduziu `{}` removendo o agendamento e anunciando cancelamento; o teste falhou primeiro; depois da correção, a falha preserva o item e mostra erro, enquanto `success: true` remove normalmente em viewport móvel, 40 testes dirigidos e lint passaram.
- Produção: `741f1f84` publicado e confirmado; o Chat real carregou conversas e ações rápidas sem executar mutação.
- Risco: baixo; a escrita foi simulada somente no harness local.
- Próximo passo: executar o build, publicar esta fatia, validar o Chat em produção e seguir para a próxima falha P0/P1 comprovada.
