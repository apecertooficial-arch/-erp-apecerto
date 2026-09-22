# Checkpoint ERP ApeCerto

- Objetivo: avançar pelas falhas P0/P1 comprovadas após concluir gerente → corretor → visita → feedback persistido → pendência encerrada.
- Base: `origin/main` em `040adda5`; branch `codex/agenda-hoje-sao-paulo`.
- Concluído nesta fatia: a Agenda móvel rejeita compromissos malformados antes de entregar as listas às regras de calendário e cobrança.
- Decisão: validar no único fetch todos os campos do contrato `Compromisso`, sem espalhar proteções pelas funções de calendário nem normalizar dados corrompidos.
- Arquivos: `app/features/calendar/TelaAgendaMobile.tsx`, `tests/agenda-canonica.test.mjs`, `tests/crm-visual-harness/main.tsx`, `tests/crm-visual-harness.test.mjs`.
- Verificações: antes da correção, `itens: [null]` apagava a Agenda com `TypeError` em `faltam_min`; o teste comportamental falhou; 51 testes dirigidos passaram e o lint ficou limpo; no navegador, o item malformado abriu o erro recuperável com nova tentativa, enquanto o payload válido preservou pendências, períodos e calendário.
- Produção: `040adda5` publicado e confirmado antes desta fatia; o CRM real carregou cartões e paginação sem mutações.
- Risco: baixo; item fora do contrato passa ao estado de erro recuperável já existente.
- Próximo passo: publicar esta fatia, validar a Agenda real em produção sem mutações e seguir para a próxima falha P0/P1 comprovada.
