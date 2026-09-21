# Checkpoint ERP ApeCerto

- Objetivo: avançar pelas falhas P0/P1 comprovadas após concluir gerente → corretor → visita → feedback persistido → pendência encerrada.
- Base: `origin/main` em `4ad0024c7b3f524c91a32b3d072461153d816098`; branch `codex/agenda-hoje-sao-paulo`.
- Concluído nesta fatia: o estado compartilhado de sessão expirada não envia mais quatro módulos móveis para `/login`, rota inexistente.
- Decisão: `Entrar novamente` volta para `/inicio`, onde o `ErpSessionProvider` monta a autenticação real quando não há sessão.
- Arquivos: `app/features/system/AppMobileSystem.tsx`, `tests/app-mobile-system.test.mjs`.
- Verificações: o teste falhou primeiro ao encontrar `/login`; 44 testes direcionados e lint passaram; build Vinext passou.
- Produção: `4ad0024c` publicado e confirmado; Avisos abre normalmente em 390 px, não expõe `/inteligencia` no DOM atual e não gera erros de console.
- Risco: a validação não encerrou a sessão real do navegador para evitar impacto no usuário; a rota e o estado de autenticação estão cobertos por teste e pelo shell existente.
- Próximo passo: publicar esta fatia, validar produção e seguir para a próxima falha P0/P1 comprovada.
