# Checkpoint ERP ApeCerto

- Objetivo: avançar pelas falhas P0/P1 comprovadas após concluir gerente → corretor → visita → feedback persistido → pendência encerrada.
- Base: `origin/main` em `b4f517505f90e17e0849633add0d6f080814a43b`; branch `codex/agenda-hoje-sao-paulo`.
- Concluído nesta fatia: a Agenda móvel não transforma mais pendências ausentes em fila zerada e calendário confiável.
- Decisão: exigir `itens` e `pendencias_resultado` como arrays; falha substitui toda a leitura por alerta e retry, evitando próximos compromissos e calendário falsamente vazios.
- Arquivos: `app/features/calendar/TelaAgendaMobile.tsx`, `tests/agenda-canonica.test.mjs`, `tests/crm-visual-harness/main.tsx`.
- Verificações: o harness móvel reproduziu a omissão das três pendências após payload parcial; o teste falhou primeiro; depois da correção, só o alerta aparece e o contrato válido preserva as três cobranças.
- Produção: `b4f51750` publicado e confirmado; a conversa real abriu com contrato completo e vazio legítimo.
- Risco: baixo; Agenda legitimamente vazia continua válida quando a API devolve `itens: []` e `pendencias_resultado: []`.
- Próximo passo: executar o build, publicar esta fatia, validar o CRM em produção e seguir para a próxima falha P0/P1 comprovada.
