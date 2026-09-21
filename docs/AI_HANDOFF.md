# Checkpoint ERP ApeCerto

- Objetivo: avançar pelas falhas P0/P1 comprovadas após concluir gerente → corretor → visita → feedback persistido → pendência encerrada.
- Base: `origin/main` em `615e3a7fa08c217d4a24dcb2922c728b1a2a3640`; branch `codex/agenda-hoje-sao-paulo`.
- Concluído nesta fatia: a busca móvel da carteira antiga não transforma mais HTTP 200 incompleto em “0 encontrado(s)”.
- Decisão: exigir `leads` como array antes de aceitar a resposta; falha mostra “Indisponível” e aviso próprio sem exibir o estado vazio global.
- Arquivos: `app/features/funil-2/Funil2Mobile.tsx`, `tests/funil-2-mobile-operacional.test.mjs`, `tests/crm-visual-harness/main.tsx`.
- Verificações: o harness móvel reproduziu o falso zero após `{}`; o teste falhou primeiro; 47 testes direcionados e lint passaram; depois da correção, “Indisponível” substituiu o falso zero e uma resposta válida preservou oito resultados acionáveis.
- Produção: `615e3a7f` publicado e confirmado; uma ficha real abriu o histórico com evento persistido, sem falso vazio.
- Risco: baixo; carteira legitimamente vazia continua válida quando a API devolve `leads: []`.
- Próximo passo: executar o build, publicar esta fatia, validar o CRM em produção e seguir para a próxima falha P0/P1 comprovada.
