# Checkpoint ERP ApeCerto

- Objetivo: avançar pelas falhas P0/P1 comprovadas após concluir gerente → corretor → visita → feedback persistido → pendência encerrada.
- Base: `origin/main` em `dc95bb22082945200fb0ad4f0f4cac7b7ea629dd`; branch `codex/agenda-hoje-sao-paulo`.
- Concluído nesta fatia: a conversa móvel não transforma mais HTTP 200 incompleto em histórico e instância falsamente vazios.
- Decisão: exigir `mensagens` e `instancias` como arrays; falha mostra alerta próprio e suprime os dois vazios enganosos.
- Arquivos: `app/features/funil-2/Funil2ConversationDrawer.tsx`, `tests/funil-2.test.mjs`, `tests/crm-visual-harness/main.tsx`.
- Verificações: o harness móvel reproduziu os dois vazios após `{}`; o teste falhou primeiro; depois da correção, só o alerta aparece e uma resposta válida vazia preserva a instância vinculada e o vazio legítimo de mensagens.
- Produção: `dc95bb22` publicado e confirmado; o CRM real recarregou a carteira e saiu do loading normalmente.
- Risco: baixo; conversa legitimamente vazia continua válida quando a API devolve `mensagens: []` e `instancias: []`.
- Próximo passo: executar o build, publicar esta fatia, validar o CRM em produção e seguir para a próxima falha P0/P1 comprovada.
