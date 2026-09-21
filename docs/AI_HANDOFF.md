# Checkpoint ERP ApeCerto

- Objetivo: avançar pelas falhas P0/P1 comprovadas após concluir gerente → corretor → visita → feedback persistido → pendência encerrada.
- Base: `origin/main` em `20a2d09157c0895860618ddad4ea449a8b6ca63b`; branch `codex/agenda-hoje-sao-paulo`.
- Concluído nesta fatia: a Agenda desktop não exibe mais totais de pendências sem as respectivas cobranças.
- Decisão: incluir `pendencias_resultado` no contrato obrigatório do workspace; payload parcial cai no erro recuperável já existente.
- Arquivos: `app/features/calendar/CalendarWorkspace.tsx`, `tests/agenda-canonica.test.mjs`, `tests/crm-visual-harness/main.tsx`.
- Verificações: o harness desktop reproduziu “3 visitas precisam de resultado” sem nenhuma cobrança; o teste falhou primeiro; depois da correção, a resposta incompleta mostra erro e retry, enquanto a válida preserva total e três clientes.
- Produção: `20a2d091` publicado e confirmado; a Agenda real carregou compromissos da equipe.
- Risco: baixo; fila legitimamente vazia continua válida quando a API devolve `pendencias_resultado: []`.
- Próximo passo: executar o build, publicar esta fatia, validar o CRM em produção e seguir para a próxima falha P0/P1 comprovada.
