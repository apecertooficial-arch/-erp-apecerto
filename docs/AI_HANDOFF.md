# Checkpoint ERP ApeCerto

- Objetivo: avançar pelas falhas P0/P1 comprovadas após concluir gerente → corretor → visita → feedback persistido → pendência encerrada.
- Base: `origin/main` em `97cecba0`; branch `codex/agenda-hoje-sao-paulo`.
- Concluído nesta fatia: o CRM móvel não transforma mais uma carga parcial em fila aparentemente válida.
- Decisão: exigir como arrays todos os conjuntos usados pela tela — leads, momentos, eventos, notas, tags e etapas — antes de publicar os dados no estado.
- Arquivos: `app/features/funil-2/Funil2Mobile.tsx`, `tests/crm-organizacao.test.mjs`, `tests/crm-visual-harness/main.tsx`.
- Verificações: o harness reproduziu uma fila carregada sem `momentos`; o teste falhou primeiro; depois da correção, a fila parcial é ocultada com erro e o payload completo continua exibindo clientes e momentos.
- Produção: `97cecba0` publicado e confirmado; as mutações móveis estritas foram promovidas após validação local em fluxo móvel inválido e válido.
- Risco: baixo; a escrita foi simulada somente no harness local.
- Próximo passo: executar o build, publicar esta fatia, validar o CRM em produção e seguir para a próxima falha P0/P1 comprovada.
