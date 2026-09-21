# Checkpoint ERP ApeCerto

- Objetivo: avançar pelas falhas P0/P1 comprovadas após concluir gerente → corretor → visita → feedback persistido → pendência encerrada.
- Base: `origin/main` em `e0ac81a8cf5002c43beea380aeb92de9e1f53f11`; branch `codex/app-contadores-sem-legado`.
- Concluído nesta fatia: os contadores e o filtro “Ativos” do Meu Dia móvel reutilizam a mesma regra que exclui `legado` e `atualizar_manual`, alinhando topo e fila visível.
- Decisão: reutilizar `leadOperacionalNoMeuDia`; filtros históricos explícitos do CRM permanecem disponíveis.
- Arquivos: `app/features/funil-2/Funil2Mobile.tsx`, `tests/funil-2-mobile-operacional.test.mjs`.
- Verificações: leitura do código comprovou contadores em `leads` brutos enquanto a fila ocultava legado; teste vermelho reproduziu a divergência; 58 testes direcionados e lint passaram; build Vinext passou; harness desktop/mobile 390×844 carregou cartões sem erro de console.
- Produção: `e0ac81a8` publicado e confirmado; Agenda filtrada mobile mostrou “concluídas no total” e console limpo.
- Risco: somente as duas etapas históricas saem dos contadores padrão; continuam acessíveis por filtro explícito no CRM.
- Próximo passo: publicar esta fatia, validar o app e seguir para a próxima falha P0/P1 comprovada.
