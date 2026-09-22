# Checkpoint ERP ApeCerto

- Objetivo: avançar pelas falhas P0/P1 comprovadas após concluir gerente → corretor → visita → feedback persistido → pendência encerrada.
- Base: `origin/main` em `8ca1d528`; branch `codex/agenda-hoje-sao-paulo`.
- Concluído nesta fatia: o Chat não mantém mais uma mensagem otimista como enviada quando a API retorna HTTP 200 sem `success: true`.
- Decisão: exigir confirmação explícita e, em falha, preservar a mensagem temporária marcada com status de erro e detalhe.
- Arquivos: `app/features/chat/LiveChatWorkspace.tsx`, `tests/live-chat-api-hardening.test.mjs`, `tests/crm-visual-harness/main.tsx`.
- Verificações: o harness reproduziu `{}` mantendo a mensagem sem marca de falha; o teste falhou primeiro; depois da correção, a mensagem exibe o erro canônico e `success: true` preserva o fluxo normal em viewport móvel, 41 testes dirigidos e lint passaram.
- Produção: `8ca1d528` publicado e confirmado; o Chat real carregou conversas e o compositor sem executar mutação.
- Risco: baixo; a escrita foi simulada somente no harness local.
- Próximo passo: executar o build, publicar esta fatia, validar o Chat em produção e seguir para a próxima falha P0/P1 comprovada.
