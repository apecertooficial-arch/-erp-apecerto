# Checkpoint ERP ApeCerto

- Objetivo: avançar pelas falhas P0/P1 comprovadas após concluir gerente → corretor → visita → feedback persistido → pendência encerrada.
- Base: `origin/main` em `d1e3cf8e`; branch `codex/agenda-hoje-sao-paulo`.
- Concluído nesta fatia: a visita criada pela ação rápida do Chat não confirma sucesso quando a Agenda responde HTTP 200 sem `success: true`.
- Decisão: validar o envelope específico da Agenda antes de recarregar o painel, publicar sucesso e fechar o modal.
- Arquivos: `app/features/chat/LiveChatWorkspace.tsx`, `tests/live-chat-api-hardening.test.mjs`, `tests/crm-visual-harness/main.tsx`.
- Verificações: o harness reproduziu o modal fechando com sucesso genérico após `200 {}`; o teste falhou primeiro; depois da correção, o modal permanece com erro e a resposta válida fecha com confirmação.
- Produção: `d1e3cf8e` publicado e confirmado; o formulário real de nova visita abriu sem erro e nenhuma visita foi submetida.
- Risco: baixo; a escrita foi simulada somente no harness local.
- Próximo passo: executar o build, publicar esta fatia, validar o CRM em produção e seguir para a próxima falha P0/P1 comprovada.
