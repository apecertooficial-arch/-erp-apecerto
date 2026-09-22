# Checkpoint ERP ApeCerto

- Objetivo: avançar pelas falhas P0/P1 comprovadas após concluir gerente → corretor → visita → feedback persistido → pendência encerrada.
- Base: `origin/main` em `33fdbb55`; branch `codex/agenda-hoje-sao-paulo`.
- Concluído nesta fatia: uma assinatura push já existente no navegador só aparece como ligada depois de ser reconciliada e confirmada pelo servidor.
- Decisão: reutilizar um único registro idempotente na montagem e no botão; se o servidor rejeitar ou esquecer a assinatura, o convite reaparece para permitir nova tentativa.
- Arquivos: `app/features/home/AvisoNotificacoes.tsx`, `tests/push-e-avisos.test.mjs`, `tests/crm-visual-harness/main.tsx`, `tests/crm-visual-harness.test.mjs`.
- Verificações: o teste falhou primeiro; no navegador real com assinatura sanitizada existente, resposta `{}` deixou de mostrar sucesso e voltou ao convite, enquanto `{ok:true}` exibiu “Avisos de lead novo ligados”; 34 testes dirigidos e lint passaram.
- Produção: `33fdbb55` publicado e confirmado antes desta fatia; nenhuma inscrição real de aparelho foi criada.
- Risco: baixo; aparelhos já inscritos fazem um POST idempotente adicional ao abrir o Meu Dia, sem novo pedido de permissão.
- Próximo passo: executar o build final, publicar esta fatia, validar a rota real sem registrar aparelho e seguir para a próxima falha P0/P1 comprovada.
