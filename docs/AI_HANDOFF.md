# Checkpoint ERP ApeCerto

- Objetivo: avançar pelas falhas P0/P1 comprovadas após concluir gerente → corretor → visita → feedback persistido → pendência encerrada.
- Base: `origin/main` em `a3e8f30d`; branch `codex/agenda-hoje-sao-paulo`.
- Concluído nesta fatia: o aplicativo só confirma “Avisos de lead novo ligados” quando a inscrição do aparelho retorna `ok: true` na interface e na rota.
- Decisão: falhar fechado para HTTP 200 com payload ausente/incompleto, preservando a inscrição do navegador e permitindo nova tentativa.
- Arquivos: `app/features/home/AvisoNotificacoes.tsx`, `app/api/ncrm/push/registrar/route.ts`, `tests/push-e-avisos.test.mjs`, `tests/crm-visual-harness/main.tsx`, `tests/crm-visual-harness.test.mjs`.
- Verificações: o teste falhou primeiro; no harness com permissão, service worker e inscrição sanitizados, `{}` mantém o convite e mostra erro, enquanto `{ok:true}` exibe a confirmação ligada; testes dirigidos passaram.
- Produção: `a3e8f30d` publicado e confirmado antes desta fatia; o menu real exibiu `99+` para 100 não lidos sem marcar aviso.
- Risco: baixo; respostas antigas sem confirmação explícita deixam de produzir sucesso falso.
- Próximo passo: executar testes finais, lint e build, publicar esta fatia, validar a tela de ativação sem registrar aparelho real e seguir para a próxima falha P0/P1 comprovada.
