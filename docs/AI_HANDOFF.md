# Checkpoint ERP ApeCerto

- Objetivo: avançar pelas falhas P0/P1 comprovadas após concluir gerente → corretor → visita → feedback persistido → pendência encerrada.
- Base: `origin/main` em `ed9e8838caabf50a48299d720c849f9adcf9cca9`; branch `codex/agenda-hoje-sao-paulo`.
- Concluído nesta fatia: mês da meta, vendas concluídas no mês, dias restantes e cabeçalho do Início gerencial usam a data operacional de São Paulo.
- Decisão: derivar uma data segura ao meio-dia de `hojeOperacao` e comparar datas de venda pelo prefixo `YYYY-MM`.
- Arquivos: `app/features/home/HomeWorkspace.tsx`, `tests/dashboard-hardening.test.mjs`.
- Verificações: teste falhou primeiro com o calendário local; 28 testes direcionados e lint passaram; build Vinext passou.
- Produção: `ed9e8838` publicado e confirmado; o botão “Hoje” retornou de outubro para setembro sem erro de console.
- Risco: a mudança se limita aos recortes e rótulos temporais do painel gerencial; valores e APIs financeiras permanecem inalterados.
- Próximo passo: publicar esta fatia, validar produção e seguir para a próxima falha P0/P1 comprovada.
