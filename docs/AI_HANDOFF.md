# Checkpoint ERP ApeCerto

- Objetivo: avançar pelas falhas P0/P1 comprovadas após concluir gerente → corretor → visita → feedback persistido → pendência encerrada.
- Base: `origin/main` em `9a5329b06f81d1f83620e4d863276ecf15a870ed`; branch `codex/agenda-hoje-sao-paulo`.
- Concluído nesta fatia: a data do cabeçalho global do aplicativo usa o dia operacional de São Paulo.
- Decisão: configurar `timeZone` no formatador existente, sem helper ou estado adicional.
- Arquivos: `app/features/system/ErpShell.tsx`, `tests/inicio-mobile.test.mjs`.
- Verificações: teste falhou primeiro sem fuso explícito; 31 testes direcionados e lint passaram; build Vinext passou; shell real carregou em desktop e 390×844 sem erro de console.
- Produção: `9a5329b0` publicado e confirmado; Financeiro abriu com ano 2026 e Metas com setembro/2026 em desktop e 390×844, sem erro de console.
- Risco: a mudança afeta apenas o rótulo de data do cabeçalho móvel; navegação, sessão e conteúdo permanecem inalterados.
- Próximo passo: publicar esta fatia, validar produção e seguir para a próxima falha P0/P1 comprovada.
