# Checkpoint ERP ApeCerto

- Objetivo: avançar pelas falhas P0/P1 comprovadas após concluir gerente → corretor → visita → feedback persistido → pendência encerrada.
- Base: `origin/main` em `32354be5858cc53ccf1358f780aea373a3277b15`; branch `codex/agenda-hoje-sao-paulo`.
- Concluído nesta fatia: a ficha móvel do CRM não transforma mais HTTP 200 incompleto em histórico falsamente vazio.
- Decisão: espelhar no aplicativo a validação desktop de `eventos` e `notas`; falha mostra aviso próprio e retry sem bloquear as demais áreas da ficha.
- Arquivos: `app/features/funil-2/Funil2Mobile.tsx`, `tests/funil-2-mobile-operacional.test.mjs`, `tests/crm-visual-harness/main.tsx`.
- Verificações: o harness móvel reproduziu “Ainda não há atualização” após `{}`; o teste falhou primeiro; 46 testes direcionados e lint passaram; depois da correção, erro e retry substituíram o falso vazio, sem erro de runtime, e o histórico normal preservou as entradas.
- Produção: `32354be5` publicado e confirmado; uma ficha real abriu a linha do tempo sem erro ou falso vazio no desktop.
- Risco: baixo; histórico móvel legitimamente vazio continua válido quando a API devolve `eventos: []` e `notas: []`.
- Próximo passo: executar o build, publicar esta fatia, validar `/crm` no formato móvel e seguir para a próxima falha P0/P1 comprovada.
