# Checkpoint ERP ApeCerto

- Objetivo: avançar pelas falhas P0/P1 comprovadas após concluir gerente → corretor → visita → feedback persistido → pendência encerrada.
- Base: `origin/main` em `cb8b345e39c3206f4134a3c1bfa235bc41d14618`; branch `codex/agenda-hoje-sao-paulo`.
- Concluído nesta fatia: Perfis e Permissões não transforma mais HTTP 200 incompleto em editor aparentemente zerado com gravação disponível.
- Decisão: exigir `perfis` e `usuarios` como arrays, manter o erro até uma recarga válida e desabilitar as duas ações de gravação enquanto a autoridade estiver indisponível.
- Arquivos: `app/features/permissions/PermissionsWorkspace.tsx`, `tests/permissions-api-hardening.test.mjs`, `tests/crm-visual-harness/main.tsx`.
- Verificações: o harness reproduziu `{}` como todos os módulos em “Sem acesso” com `Salvar perfil` ativo; o teste falhou primeiro; 68 testes direcionados e lint passaram; após a correção, há erro recuperável, atributo `disabled` na gravação e vazio legítimo preservado, sem erros de console.
- Produção: `cb8b345e` publicado e confirmado; `/usuarios` carregou 9 usuários e vínculos reais sem erros de console; `/equipe` permaneceu íntegra.
- Risco: baixo; respostas legitimamente vazias continuam válidas quando contêm os dois arrays.
- Próximo passo: publicar esta fatia, validar produção e seguir para a próxima falha P0/P1 comprovada.
