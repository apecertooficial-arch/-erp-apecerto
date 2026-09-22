# Checkpoint ERP ApeCerto

- Objetivo: avançar pelas falhas P0/P1 comprovadas após concluir gerente → corretor → visita → feedback persistido → pendência encerrada.
- Base: `origin/main` em `3ab4b716`; branch `codex/agenda-hoje-sao-paulo`.
- Concluído nesta fatia: a ação rápida do Chat não presume mais gerente livre quando a consulta de disponibilidade falha ou vem incompleta.
- Decisão: validar HTTP e `conflitos` como array e bloquear o envio com gerente durante carga, erro ou conflito; sem gerente, o fluxo permanece disponível.
- Arquivos: `app/features/chat/LiveChatWorkspace.tsx`, `tests/live-chat-api-hardening.test.mjs`, `tests/crm-visual-harness/main.tsx`.
- Verificações: o harness reproduziu falha HTTP exibida como gerente livre; o teste falhou primeiro; depois da correção, o erro bloqueia o botão marcado com gerente e a resposta válida libera normalmente.
- Produção: `3ab4b716` publicado e confirmado; a confirmação canônica de visita pelo Chat foi promovida após os gates.
- Risco: baixo; a escrita foi simulada somente no harness local.
- Próximo passo: executar o build, publicar esta fatia, validar o CRM em produção e seguir para a próxima falha P0/P1 comprovada.
