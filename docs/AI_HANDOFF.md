# Checkpoint ERP ApeCerto

- Objetivo: avançar pelas falhas P0/P1 comprovadas após concluir gerente → corretor → visita → feedback persistido → pendência encerrada.
- Base: `origin/main` em `8b9b8e69`; branch `codex/agenda-hoje-sao-paulo`.
- Concluído nesta fatia: o drawer de conversa rejeita mensagens ou instâncias malformadas antes de renderizar o histórico.
- Decisão: validar no único fetch os campos do contrato já tipado, compartilhando apenas o predicado trivial de texto nulo e sem adicionar normalização silenciosa.
- Arquivos: `app/features/funil-2/Funil2ConversationDrawer.tsx`, `tests/crm-organizacao.test.mjs`, `tests/crm-visual-harness/main.tsx`, `tests/crm-visual-harness.test.mjs`.
- Verificações: antes da correção, `mensagens: [null]` apagava a interface ao abrir “Ver conversa” com `TypeError` em `direcao`; o teste comportamental falhou; 56 testes dirigidos passaram e o lint ficou limpo; no navegador, o item malformado preservou ficha e drawer com erro recuperável, enquanto o payload válido mostrou a instância e o estado vazio.
- Produção: `8b9b8e69` publicado e confirmado antes desta fatia; o CRM real carregou cartões e paginação sem mutações.
- Risco: baixo; item fora do contrato passa ao estado de erro recuperável já existente.
- Próximo passo: publicar esta fatia, validar o CRM real em produção sem mutações e seguir para a próxima falha P0/P1 comprovada.
