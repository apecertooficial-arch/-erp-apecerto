# Checkpoint ERP ApeCerto

- Objetivo: avançar pelas falhas P0/P1 comprovadas após concluir gerente → corretor → visita → feedback persistido → pendência encerrada.
- Base: `origin/main` em `ccfb787e`; branch `codex/agenda-hoje-sao-paulo`.
- Concluído nesta fatia: a Central nunca apresenta “Operação íntegra” quando a leitura de saúde retorna HTTP 200 incompleto.
- Decisão: validar o contrato mínimo completo da saúde antes de montar indicadores, contratos e exceções.
- Arquivos: `app/features/automations/CentralOperationsPanel.tsx`, `tests/central-gestao-automatica.test.mjs`, `tests/crm-visual-harness/main.tsx`, `tests/crm-visual-harness.test.mjs`.
- Verificações: antes da correção, `{}` aparecia como “Operação íntegra” e `0/0 contratos`; depois, o navegador exibiu “A Central devolveu uma leitura incompleta” e “Tentar novamente”; 30 testes dirigidos e lint passaram.
- Produção: `ccfb787e` publicado e confirmado antes desta fatia.
- Risco: baixo; respostas antigas ou intermediárias sem o contrato completo deixam de produzir falso verde operacional.
- Próximo passo: executar o build final, publicar esta fatia, validar a aplicação real sem mutações e seguir para a próxima falha P0/P1 comprovada.
