# Checkpoint ERP ApeCerto

- Objetivo: avançar pelas falhas P0/P1 comprovadas após concluir gerente → corretor → visita → feedback persistido → pendência encerrada.
- Base: `origin/main` em `fbb3982f`; branch `codex/agenda-hoje-sao-paulo`.
- Concluído nesta fatia: a criação de visita na Agenda móvel rejeita itens malformados nas coleções de clientes, negócios, cards e produtos antes de montar o formulário.
- Decisão: validar no fetch tardio os quatro contratos pequenos já declarados, compartilhando apenas o predicado de objeto e sem normalizar dados corrompidos.
- Arquivos: `app/features/calendar/TelaAgendaMobile.tsx`, `tests/agenda-canonica.test.mjs`, `tests/crm-visual-harness/main.tsx`, `tests/crm-visual-harness.test.mjs`.
- Verificações: antes da correção, `leads: [null]` apagava a Agenda ao abrir “+ Visita” com `TypeError` em `id`; o teste comportamental falhou; 52 testes dirigidos passaram e o lint ficou limpo; no navegador, o catálogo malformado preservou o diálogo com erro operacional, enquanto o válido preservou o estado vazio legítimo, produto e formulário.
- Produção: `fbb3982f` publicado e confirmado antes desta fatia; a Agenda real carregou o calendário sem erros ou mutações.
- Risco: baixo; item fora do contrato passa ao estado de erro recuperável já existente.
- Próximo passo: publicar esta fatia, validar a Agenda real em produção sem mutações e seguir para a próxima falha P0/P1 comprovada.
