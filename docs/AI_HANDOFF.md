# Checkpoint ERP ApeCerto

- Objetivo: avançar pelas falhas P0/P1 comprovadas após concluir gerente → corretor → visita → feedback persistido → pendência encerrada.
- Base: `origin/main` em `2b621f6a`; branch `codex/agenda-hoje-sao-paulo`.
- Concluído nesta fatia: ações rápidas do Chat não tratam mais HTTP 200 sem `success: true` como persistência confirmada.
- Decisão: exigir a confirmação explícita já definida pelo contrato da API antes de fechar o modal e anunciar sucesso.
- Arquivos: `app/features/chat/LiveChatWorkspace.tsx`, `tests/live-chat-api-hardening.test.mjs`, `tests/crm-visual-harness/main.tsx`.
- Verificações: o harness reproduziu uma observação com `{}` fechando o modal e anunciando sucesso; o teste falhou primeiro; depois da correção, a falha mantém o modal com erro e `success: true` preserva o fluxo normal em viewport móvel, 39 testes dirigidos e lint passaram.
- Produção: `2b621f6a` publicado e confirmado; o Chat real carregou conversas e agendamentos sem erro inesperado, sem mutação.
- Risco: baixo; a escrita foi simulada somente no harness local.
- Próximo passo: executar o build, publicar esta fatia, validar o Chat em produção e seguir para a próxima falha P0/P1 comprovada.
