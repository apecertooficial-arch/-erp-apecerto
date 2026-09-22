# Checkpoint ERP ApeCerto

- Objetivo: avançar pelas falhas P0/P1 comprovadas após concluir gerente → corretor → visita → feedback persistido → pendência encerrada.
- Base: `origin/main` em `50d2e7ea`; branch `codex/agenda-hoje-sao-paulo`.
- Concluído nesta fatia: a Central só encerra replay, freio de abordagens e decisão humana da Sara depois de receber `ok: true`.
- Decisão: falhar fechado para HTTP 200 incompleto e manter a exceção visível até confirmação explícita.
- Arquivos: `app/features/automations/CentralOperationsPanel.tsx`, `tests/central-gestao-automatica.test.mjs`, `tests/crm-visual-harness/main.tsx`, `tests/crm-visual-harness.test.mjs`.
- Verificações: o contrato falhou primeiro; no navegador real com payload `{}`, o item `#91` permaneceu em quarentena e apareceu “A Central não confirmou a operação”; 28 testes dirigidos e lint passaram.
- Produção: `50d2e7ea` publicado e confirmado antes desta fatia.
- Risco: baixo; respostas antigas ou intermediárias sem confirmação explícita exigem atualização e reconciliação antes de repetir um comando operacional.
- Próximo passo: executar o build final, publicar esta fatia, validar a aplicação real sem mutações e seguir para a próxima falha P0/P1 comprovada.
