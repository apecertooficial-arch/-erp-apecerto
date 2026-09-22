# Checkpoint ERP ApeCerto

- Objetivo: avançar pelas falhas P0/P1 comprovadas após concluir gerente → corretor → visita → feedback persistido → pendência encerrada.
- Base: `origin/main` em `253507eb`; branch `codex/agenda-hoje-sao-paulo`.
- Concluído nesta fatia: Perfis e Permissões só anuncia uma alteração depois de receber `success: true`, igual ao contrato da API.
- Decisão: falhar fechado para HTTP 200 incompleto tanto ao salvar perfil quanto ao salvar/remover override de usuário.
- Arquivos: `app/features/permissions/PermissionsWorkspace.tsx`, `tests/permissions-api-hardening.test.mjs`, `tests/crm-visual-harness/main.tsx`, `tests/crm-visual-harness.test.mjs`.
- Verificações: o contrato falhou primeiro; no navegador real com payload `{}`, “Perfil salvo” não apareceu e a interface mostrou “O servidor não confirmou a alteração de permissões”; 23 testes dirigidos e lint passaram.
- Produção: `253507eb` publicado e confirmado antes desta fatia.
- Risco: baixo; respostas antigas ou intermediárias sem confirmação explícita passam a exigir reconciliação em vez de produzir sucesso falso.
- Próximo passo: executar o build final, publicar esta fatia, validar a aplicação real sem mutações e seguir para a próxima falha P0/P1 comprovada.
