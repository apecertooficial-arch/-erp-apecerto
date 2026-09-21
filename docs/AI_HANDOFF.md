# Checkpoint ERP ApeCerto

- Objetivo: avançar pelas falhas P0/P1 comprovadas após concluir gerente → corretor → visita → feedback persistido → pendência encerrada.
- Base: `origin/main` em `40fa80179dd3f4bbddaa285a0541e8080275704f`; branch `codex/agenda-hoje-sao-paulo`.
- Concluído nesta fatia: a ficha do CRM não transforma mais HTTP 200 incompleto em histórico falsamente vazio.
- Decisão: exigir `eventos` e `notas` como listas antes de substituir o histórico local; falha mostra aviso próprio e retry sem bloquear o restante da ficha.
- Arquivos: `app/features/funil-2/Funil2Workspace.tsx`, `tests/crm-organizacao.test.mjs`, `tests/crm-visual-harness/main.tsx`.
- Verificações: o harness reproduziu “Nenhuma atualização” após `{}`; o teste falhou primeiro; 67 testes direcionados e lint passaram; depois da correção, o harness mostrou erro recuperável sem falso vazio ou erro de runtime, e o histórico normal preservou as entradas.
- Produção: `40fa8017` publicado e confirmado; CRM carregou pipeline e etapas, Meu Dia abriu, sem erro de console.
- Risco: baixo; histórico legitimamente vazio continua válido quando a API devolve `eventos: []` e `notas: []`.
- Próximo passo: executar o build, publicar esta fatia, validar uma ficha em `/crm` e seguir para a próxima falha P0/P1 comprovada.
