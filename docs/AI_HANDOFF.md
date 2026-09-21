# Checkpoint ERP ApeCerto

- Objetivo: avançar pelas falhas P0/P1 comprovadas após concluir gerente → corretor → visita → feedback persistido → pendência encerrada.
- Base: `origin/main` em `38305894`; branch `codex/agenda-hoje-sao-paulo`.
- Concluído nesta fatia: atualizações PATCH e movimentações do CRM não avançam mais quando o servidor responde HTTP 200 sem `ok: true`.
- Decisão: validar o envelope canônico antes de fechar seletores, recarregar ou limpar o menu; resposta incompleta mantém a escolha aberta e mostra alerta.
- Arquivos: `app/features/funil-2/Funil2Workspace.tsx`, `tests/crm-organizacao.test.mjs`, `tests/crm-visual-harness/main.tsx`.
- Verificações: o harness reproduziu o seletor de temperatura fechando após `200 {}` sem mudança persistida; o teste falhou primeiro; depois da correção, o seletor fica aberto com alerta e o envelope válido conserva o fluxo normal.
- Produção: `38305894` publicado e confirmado; o formulário real de comentário abriu sem alerta e nenhum envio foi feito.
- Risco: baixo; a escrita foi simulada somente no harness local.
- Próximo passo: executar o build, publicar esta fatia, validar o CRM em produção e seguir para a próxima falha P0/P1 comprovada.
