# Checkpoint ERP ApeCerto

- Objetivo: avançar pelas falhas P0/P1 comprovadas após concluir gerente → corretor → visita → feedback persistido → pendência encerrada.
- Base: `origin/main` em `5e261ca3`; branch `codex/agenda-hoje-sao-paulo`.
- Concluído nesta fatia: Usuários só confirma alterações do corretor, do acesso e do vínculo de documento depois de receber `success: true`.
- Decisão: falhar fechado para HTTP 200 incompleto nos três caminhos administrativos, mantendo o painel aberto para reconciliação.
- Arquivos: `app/features/team/TeamWorkspace.tsx`, `tests/team-api-hardening.test.mjs`, `tests/crm-visual-harness/main.tsx`, `tests/crm-visual-harness.test.mjs`.
- Verificações: o contrato falhou primeiro; no navegador real com payload `{}`, “Alterações salvas” não apareceu e o painel mostrou “O servidor não confirmou a alteração do corretor”; 26 testes dirigidos e lint passaram.
- Produção: `5e261ca3` publicado e confirmado antes desta fatia.
- Risco: baixo; respostas antigas ou intermediárias sem confirmação explícita deixam de produzir sucesso falso em operações administrativas.
- Próximo passo: executar o build final, publicar esta fatia, validar a aplicação real sem mutações e seguir para a próxima falha P0/P1 comprovada.
