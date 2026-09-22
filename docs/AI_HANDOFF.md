# Checkpoint ERP ApeCerto

- Objetivo: avançar pelas falhas P0/P1 comprovadas após concluir gerente → corretor → visita → feedback persistido → pendência encerrada.
- Base: `origin/main` em `d37c3038`; branch `codex/agenda-hoje-sao-paulo`.
- Concluído nesta fatia: o convite de push rejeita uma chave pública malformada antes de tentar convertê-la ou assinar o aparelho.
- Decisão: validar que `chave` é uma string não vazia no único fetch, preservando o erro de configuração já existente.
- Arquivos: `app/features/home/AvisoNotificacoes.tsx`, `tests/push-e-avisos.test.mjs`, `tests/crm-visual-harness/main.tsx`, `tests/crm-visual-harness.test.mjs`.
- Verificações: antes da correção, `{ chave: {} }` chegava ao conversor e exibia o erro genérico do aparelho; o teste comportamental falhou; 54 testes dirigidos passaram e o lint ficou limpo; no navegador, a chave inválida mostrou o erro específico do servidor e a válida continuou confirmando o registro no aparelho.
- Produção: `d37c3038` publicado e confirmado antes desta fatia; Avisos reais carregaram sem estado de loading/erro e sem erros de console.
- Risco: baixo; respostas fora do contrato passam ao erro de configuração já existente.
- Próximo passo: publicar esta fatia, validar produção sem mutações e retomar pela próxima falha P0/P1 comprovada, respeitando a margem de uso antes de 66%.
