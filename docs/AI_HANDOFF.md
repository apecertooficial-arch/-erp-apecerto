# Checkpoint ERP ApeCerto

- Objetivo: avançar pelas falhas P0/P1 comprovadas após concluir gerente → corretor → visita → feedback persistido → pendência encerrada.
- Base: `origin/main` em `8efd146d`; branch `codex/agenda-hoje-sao-paulo`.
- Concluído nesta fatia: o Chat não converte mais uma resposta HTTP 200 parcial de `listScheduled` em lista vazia.
- Decisão: exigir `agendadas` como array antes de substituir o estado; em falha, preservar a distinção entre erro e vazio e oferecer nova tentativa.
- Arquivos: `app/features/chat/LiveChatWorkspace.tsx`, `tests/live-chat-api-hardening.test.mjs`, `tests/crm-visual-harness/main.tsx`.
- Verificações: o harness reproduziu `{}` exibido como “Nenhuma mensagem”; o teste falhou primeiro; depois da correção, o erro mostra nova tentativa sem falso vazio, o fluxo válido segue carregando em viewport móvel, 38 testes dirigidos e lint passaram.
- Produção: `8efd146d` publicado e confirmado; o Chat real carregou normalmente com a contagem de conversas, sem mutação.
- Risco: baixo; a escrita foi simulada somente no harness local.
- Próximo passo: executar o build, publicar esta fatia, validar o Chat em produção e seguir para a próxima falha P0/P1 comprovada.
