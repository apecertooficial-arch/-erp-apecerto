# Checkpoint ERP ApeCerto

- Objetivo: avançar pelas falhas P0/P1 comprovadas após concluir gerente → corretor → visita → feedback persistido → pendência encerrada.
- Base: `origin/main` em `c6d4acc1`; branch `codex/agenda-hoje-sao-paulo`.
- Concluído nesta fatia: o Meu Dia/CRM mobile valida cada lead recebido antes de calcular filas e cartões; a mesma validação essencial agora é compartilhada com Tarefas.
- Decisão: centralizar no modelo apenas os nove campos estruturais realmente consumidos, mantendo enriquecimentos opcionais e evitando dois contratos divergentes.
- Arquivos: `app/features/funil-2/modelo.ts`, `app/features/funil-2/Funil2Mobile.tsx`, `app/features/tasks/SaraTasksMobile.tsx`, `tests/app-mobile-tarefas.test.mjs`, `tests/crm-organizacao.test.mjs`, `tests/crm-visual-harness/main.tsx`, `tests/crm-visual-harness.test.mjs`.
- Verificações: antes da correção, seis coleções válidas com `leads: [null]` apagavam o Meu Dia; o teste comportamental falhou; 56 testes dirigidos passaram e o lint ficou limpo; no navegador, o mesmo payload abriu “Não deu pra carregar sua fila” com nova tentativa, enquanto o payload válido manteve 108 atendimentos e 24 leads novos.
- Produção: `c6d4acc1` publicado e confirmado antes desta fatia; `/tarefas` real abriu normalmente sem mutações.
- Risco: baixo; item de lead fora do contrato deixa de quebrar o app e passa ao estado de erro recuperável já existente.
- Próximo passo: executar o build final, publicar esta fatia, validar o Meu Dia real em produção sem mutações e seguir para a próxima falha P0/P1 comprovada.
