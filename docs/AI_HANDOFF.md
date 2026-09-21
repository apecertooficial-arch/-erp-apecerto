# Checkpoint ERP ApeCerto

- Objetivo: avançar pelas falhas P0/P1 comprovadas após concluir gerente → corretor → visita → feedback persistido → pendência encerrada.
- Base: `origin/main` em `79663c68`; branch `codex/agenda-hoje-sao-paulo`.
- Concluído nesta fatia: ações POST do CRM não fecham mais o formulário quando o servidor responde HTTP 200 sem a confirmação explícita `ok: true`.
- Decisão: validar o envelope canônico antes de fechar modal, mostrar sucesso ou recarregar; resposta incompleta mantém o texto digitado e mostra alerta.
- Arquivos: `app/features/funil-2/Funil2Workspace.tsx`, `tests/crm-organizacao.test.mjs`, `tests/crm-visual-harness/main.tsx`.
- Verificações: o harness reproduziu um comentário desaparecendo após `200 {}`; o teste falhou primeiro; depois da correção, o editor e o texto permanecem abertos com erro explícito.
- Produção: `79663c68` publicado e confirmado; o editor real de dados do lead abriu sem alerta e permaneceu intacto, sem qualquer gravação.
- Risco: baixo; a escrita foi simulada somente no harness local.
- Próximo passo: executar o build, publicar esta fatia, validar o CRM em produção e seguir para a próxima falha P0/P1 comprovada.
