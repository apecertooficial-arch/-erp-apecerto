# Checkpoint ERP ApeCerto

- Objetivo: avançar pelas falhas P0/P1 comprovadas após concluir gerente → corretor → visita → feedback persistido → pendência encerrada.
- Base: `origin/main` em `97fe215d`; branch `codex/agenda-hoje-sao-paulo`.
- Concluído nesta fatia: o drawer da Esteira não muda mais a etapa local quando a movimentação não foi confirmada pela API.
- Decisão: `move()` retorna sucesso explícito e o detalhe só atualiza após `success: true` e recarga concluída.
- Arquivos: `app/features/sales/SalesProcessWorkspace.tsx`, `tests/crm-sales-write-safety.test.mjs`, `tests/crm-visual-harness/main.tsx`.
- Verificações: o harness reproduziu o drawer em etapa nova enquanto o cartão permanecia na antiga; o teste falhou primeiro; depois da correção, a falha mantém ambos na etapa anterior e a resposta válida avança o drawer em viewport móvel, 34 testes dirigidos e lint passaram.
- Produção: `97fe215d` publicado e confirmado; a Esteira real carregou cartões sem executar mutação.
- Risco: baixo; a escrita foi simulada somente no harness local.
- Próximo passo: executar o build, publicar esta fatia, validar o Chat em produção e seguir para a próxima falha P0/P1 comprovada.
