# Checkpoint ERP ApeCerto

- Objetivo: avançar pelas falhas P0/P1 comprovadas após concluir gerente → corretor → visita → feedback persistido → pendência encerrada.
- Base: `origin/main` em `40d0ac418ec89690ade63c7578364c81d7ed59df`; branch `codex/agenda-hoje-sao-paulo`.
- Concluído nesta fatia: Abordagens não desmonta mais ao receber HTTP 200 sem as listas de abordagens e produtos.
- Decisão: exigir `approaches` e `products` como arrays antes de marcar a biblioteca como pronta; a mesma validação protege carga inicial e atualização após mutação.
- Arquivos: `app/features/approaches/ApproachesWorkspace.tsx`, `tests/approaches-api-hardening.test.mjs`, `tests/crm-visual-harness/main.tsx`.
- Verificações: o harness reproduziu tela desmontada e `TypeError` com `{}`; o teste falhou primeiro; 57 testes direcionados passaram; lint sem erros (uma advertência preexistente de `<img>`); após a correção, o harness mostrou erro recuperável e preservou o vazio legítimo, sem erros de console.
- Produção: `40d0ac41` publicado e confirmado; `/permissoes` carregou oito perfis reais, manteve `Salvar perfil` habilitado no estado válido e não apresentou erros de console.
- Risco: baixo; biblioteca legitimamente vazia continua válida quando contém os dois arrays.
- Próximo passo: publicar esta fatia, validar produção e seguir para a próxima falha P0/P1 comprovada.
