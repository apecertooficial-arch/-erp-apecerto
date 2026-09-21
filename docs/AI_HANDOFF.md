# Checkpoint ERP ApeCerto

- Objetivo: avançar pelas falhas P0/P1 comprovadas após concluir gerente → corretor → visita → feedback persistido → pendência encerrada.
- Base: `origin/main` em `5717d00b`; branch `codex/agenda-hoje-sao-paulo`.
- Concluído nesta fatia: as sete mutações do CRM móvel não avançam mais quando o servidor responde HTTP 200 sem `ok: true`.
- Decisão: exigir o envelope canônico em visita, momento, negociação, nota, descarte, temperatura e importação da carteira antes de fechar controles ou limpar dados digitados.
- Arquivos: `app/features/funil-2/Funil2Mobile.tsx`, `tests/crm-organizacao.test.mjs`, `tests/crm-visual-harness/main.tsx`.
- Verificações: o harness móvel reproduziu o seletor de temperatura fechando após `200 {}` sem mudança persistida; o teste falhou primeiro; depois da correção, o seletor fica aberto com alerta e o envelope válido conserva o fluxo normal.
- Produção: `5717d00b` publicado e confirmado; o seletor real de temperatura abriu com suas opções e nenhuma alteração foi enviada.
- Risco: baixo; a escrita foi simulada somente no harness local.
- Próximo passo: executar o build, publicar esta fatia, validar o CRM em produção e seguir para a próxima falha P0/P1 comprovada.
