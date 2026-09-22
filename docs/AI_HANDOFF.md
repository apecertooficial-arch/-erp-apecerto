# Checkpoint ERP ApeCerto

- Objetivo: avançar pelas falhas P0/P1 comprovadas após concluir gerente → corretor → visita → feedback persistido → pendência encerrada.
- Base: `origin/main` em `dd4b5ab7`; branch `codex/agenda-hoje-sao-paulo`.
- Concluído nesta fatia: a Esteira do CRM rejeita carga HTTP 200 parcial em vez de deixar a área em branco.
- Decisão: validar as seis coleções obrigatórias antes de publicar o estado e usar o alerta recuperável existente.
- Arquivos: `app/features/sales/SalesProcessWorkspace.tsx`, `tests/crm-sales-write-safety.test.mjs`, `tests/crm-visual-harness/main.tsx`.
- Verificações: o harness reproduziu `{}` deixando a Esteira em branco; o teste falhou primeiro; depois da correção, desktop exibe erro com nova tentativa e o payload válido abre em viewport móvel, 25 testes dirigidos e lint passaram.
- Produção: `dd4b5ab7` publicado e confirmado; o Chat real carregou conversas e o compositor sem executar mutação.
- Risco: baixo; a escrita foi simulada somente no harness local.
- Próximo passo: executar o build, publicar esta fatia, validar o Chat em produção e seguir para a próxima falha P0/P1 comprovada.
