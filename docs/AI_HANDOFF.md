# Checkpoint ERP ApeCerto

- Objetivo: avançar pelas falhas P0/P1 comprovadas após concluir gerente → corretor → visita → feedback persistido → pendência encerrada.
- Base: `origin/main` em `051243dc`; branch `codex/agenda-hoje-sao-paulo`.
- Concluído nesta fatia: as escritas do detalhe da Esteira não limpam mais formulários quando a API retorna HTTP 200 sem `success: true`.
- Decisão: endurecer o helper comum `api()` para proteger observações, condições, comissão, partes e documentos na mesma fronteira.
- Arquivos: `app/features/sales/SalesProcessWorkspace.tsx`, `tests/crm-sales-write-safety.test.mjs`, `tests/crm-visual-harness/main.tsx`.
- Verificações: o harness reproduziu `{}` apagando uma observação não persistida; o teste falhou primeiro; depois da correção, a falha preserva o texto e mostra erro, enquanto `success: true` limpa normalmente em viewport móvel, 35 testes dirigidos e lint passaram.
- Produção: `051243dc` publicado e confirmado; a Esteira real carregou cartões e controles sem executar mutação.
- Risco: baixo; a escrita foi simulada somente no harness local.
- Próximo passo: executar o build, publicar esta fatia, validar o Chat em produção e seguir para a próxima falha P0/P1 comprovada.
