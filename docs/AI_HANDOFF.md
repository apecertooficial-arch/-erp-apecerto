# Checkpoint ERP ApeCerto

- Objetivo: avançar pelas falhas P0/P1 comprovadas após concluir gerente → corretor → visita → feedback persistido → pendência encerrada.
- Base: `origin/main` em `c4ef2137`; branch `codex/agenda-hoje-sao-paulo`.
- Concluído nesta fatia: o Chat rejeita payload inicial HTTP 200 parcial em vez de publicar estado inválido e deixar a tela em branco.
- Decisão: validar as coleções obrigatórias e o mapa `latest` antes de atualizar o estado; em falha, exibir o alerta recuperável já existente.
- Arquivos: `app/features/chat/LiveChatWorkspace.tsx`, `tests/live-chat-api-hardening.test.mjs`, `tests/crm-visual-harness/main.tsx`.
- Verificações: o harness reproduziu a tela em branco com `{}`; o teste falhou primeiro; depois da correção, desktop e viewport móvel exibem erro com tentativa novamente, o payload válido segue carregando, 37 testes dirigidos e lint passaram.
- Produção: `c4ef2137` publicado e confirmado; o Chat real carregou e bloqueou corretamente uma visita sem negócio vinculado, sem mutação.
- Risco: baixo; a escrita foi simulada somente no harness local.
- Próximo passo: executar o build, publicar esta fatia, validar o Chat em produção e seguir para a próxima falha P0/P1 comprovada.
