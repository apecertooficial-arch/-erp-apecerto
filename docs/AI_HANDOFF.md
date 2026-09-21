# Checkpoint ERP ApeCerto

- Objetivo: avançar pelas falhas P0/P1 comprovadas após concluir gerente → corretor → visita → feedback persistido → pendência encerrada.
- Base: `origin/main` em `c63750a504a02c768ba7eed790bf8a623f008461`; branch `codex/agenda-hoje-sao-paulo`.
- Concluído nesta fatia: Todos os Leads não esconde mais falha da carteira antiga como busca vazia.
- Decisão: validar status e `leads` no limite da busca; manter os cards atuais disponíveis, mas mostrar “indisponível” e alerta na seção legada sem o vazio contraditório.
- Arquivos: `app/features/funil-2/Funil2Workspace.tsx`, `tests/crm-organizacao.test.mjs`.
- Verificações: o harness desktop reproduziu a seção ausente após `{}`; o teste falhou primeiro; depois da correção, o erro fica explícito sem “Nada na carteira antiga”, e a resposta válida preserva oito resultados acionáveis.
- Produção: `c63750a5` publicado e confirmado; a Agenda desktop real carregou calendário sem erro.
- Risco: baixo; busca legitimamente vazia continua válida quando a API devolve `leads: []`.
- Próximo passo: executar o build, publicar esta fatia, validar o CRM em produção e seguir para a próxima falha P0/P1 comprovada.
