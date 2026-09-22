# Checkpoint ERP ApeCerto

- Objetivo: avançar pelas falhas P0/P1 comprovadas após concluir gerente → corretor → visita → feedback persistido → pendência encerrada.
- Base: `origin/main` em `05e8ae10`; branch `codex/agenda-hoje-sao-paulo`.
- Concluído nesta fatia: o Meu Dia mobile valida cada tarefa recebida antes de montar a fila; um item `null` ou estruturalmente incompleto agora abre o erro recuperável com nova tentativa, sem derrubar o componente.
- Decisão: validar somente os campos que a lista realmente usa, mantendo os campos de enriquecimento opcionais e sem duplicar o contrato completo do CRM.
- Arquivos: `app/features/tasks/SaraTasksMobile.tsx`, `tests/app-mobile-tarefas.test.mjs`, `tests/crm-visual-harness/main.tsx`, `tests/crm-visual-harness.test.mjs`.
- Verificações: o teste comportamental falhou primeiro; 29 testes dirigidos passaram; lint dos arquivos tocados sem erros; no navegador, `{ leads: [null] }` exibiu “Não foi possível confirmar as tarefas recebidas” e “Tentar novamente”, enquanto o payload válido manteve 90 tarefas atrasadas e paginação “Mostrar mais”.
- Produção: `05e8ae10` publicado e confirmado antes desta fatia.
- Risco: baixo; respostas intermediárias fora do contrato deixam de quebrar o Meu Dia e passam ao estado de erro já existente.
- Próximo passo: executar o build final, publicar esta fatia, validar `/tarefas` em produção sem mutações e seguir para a próxima falha P0/P1 comprovada.
