# Checkpoint ERP ApeCerto

- Objetivo: avançar pelas falhas P0/P1 comprovadas após concluir gerente → corretor → visita → feedback persistido → pendência encerrada.
- Base: `origin/main` em `db98e4b61a956eba57e844215085d1b23c6db870`; branch `codex/agenda-hoje-sao-paulo`.
- Concluído nesta fatia: “+ Visita” no aplicativo não transforma mais um catálogo HTTP 200 incompleto em mensagem falsa de ausência de clientes.
- Decisão: exigir os arrays `leads`, `deals`, `cards` e `products` antes de instalar o catálogo; ausência do contrato mantém o formulário bloqueado e mostra erro recuperável.
- Arquivos: `app/features/calendar/TelaAgendaMobile.tsx`, `tests/agenda-canonica.test.mjs`.
- Verificações: o harness reproduziu `{}` como `Nenhum cliente com atendimento aberto`; o teste falhou primeiro; 56 testes direcionados e lint passaram; depois da correção, o mesmo payload mostrou `Não foi possível carregar seus clientes agora`, sem erro de console, e o catálogo normal continuou válido.
- Produção: `db98e4b6` publicado e confirmado; a Agenda real abriu no desktop com 7 compromissos hoje, 23 visitas futuras e 63 pendências, sem erros de console.
- Risco: baixo; catálogo legitimamente vazio continua válido quando as quatro propriedades existem como arrays vazios.
- Próximo passo: publicar esta fatia, validar produção e seguir para a próxima falha P0/P1 comprovada.
