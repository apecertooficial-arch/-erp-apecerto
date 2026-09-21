# Checkpoint ERP ApeCerto

- Objetivo: avançar pelas falhas P0/P1 comprovadas após concluir gerente → corretor → visita → feedback persistido → pendência encerrada.
- Base: `origin/main` em `52d794cdd192def37bb53efa9da45d5cb719b990`; branch `codex/app-hoje-sao-paulo`.
- Concluído nesta fatia: “para hoje” e os grupos do Meu Dia usam a data operacional de São Paulo, independentemente do fuso do aparelho.
- Decisão: reutilizar `dataOperacao` em `venceHoje` e remover o fim do dia calculado no fuso local do celular.
- Arquivos: `app/features/funil-2/modelo.ts`, `app/features/funil-2/Funil2Mobile.tsx`, `tests/timezone-sao-paulo.test.mjs`, `tests/funil-2-mobile-operacional.test.mjs`.
- Verificações: teste sob `TZ=UTC` reproduziu tarefa de amanhã classificada como hoje; 77 testes direcionados e lint passaram; build Vinext passou; harness desktop/mobile 390×844 carregou cartões sem erro de console.
- Produção: `52d794cd` publicado e confirmado; CRM móvel mostrou histórico somente nos filtros explícitos, não nos cartões Ativos.
- Risco: datas inválidas continuam excluídas; a mudança só unifica o calendário com `America/Sao_Paulo`.
- Próximo passo: publicar esta fatia, validar produção e seguir para a próxima falha P0/P1 comprovada.
