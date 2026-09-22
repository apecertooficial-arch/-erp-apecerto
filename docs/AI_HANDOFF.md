# Checkpoint ERP ApeCerto

- Objetivo: avançar pelas falhas P0/P1 comprovadas após concluir gerente → corretor → visita → feedback persistido → pendência encerrada.
- Base: `origin/main` em `cdcbad8a`; branch `codex/agenda-hoje-sao-paulo`.
- Concluído nesta fatia: o menu desktop renderiza o badge real de Notificações que o módulo já publica.
- Decisão: reutilizar o contador genérico recebido pelo `AppShell`, sem nova carga ou estado paralelo; valores acima de 99 aparecem como `99+`.
- Arquivos: `app/components/AppShell.tsx`, `tests/inicio-mobile.test.mjs`, `tests/crm-visual-harness/main.tsx`, `tests/crm-visual-harness.test.mjs`.
- Verificações: o teste falhou primeiro; no shell real do harness, badge publicado 1 era descartado antes da correção e passou a aparecer como `Notificações 1`, com título acessível; 39 testes dirigidos passaram.
- Produção: `cdcbad8a` publicado e confirmado antes desta fatia; a tela real carregou 100 ações/não lidos, mas o menu desktop não exibiu o contador, reproduzindo a lacuna sem mutação.
- Risco: baixo; somente apresentação de um valor já disponível no contexto.
- Próximo passo: executar lint e build, publicar esta fatia, validar o badge desktop em produção sem mutação e seguir para a próxima falha P0/P1 comprovada.
