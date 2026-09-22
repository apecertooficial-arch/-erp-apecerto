# Checkpoint ERP ApeCerto

- Objetivo: avançar pelas falhas P0/P1 comprovadas após concluir gerente → corretor → visita → feedback persistido → pendência encerrada.
- Base: `origin/main` em `f87ed4ce`; branch `codex/agenda-hoje-sao-paulo`.
- Concluído nesta fatia: a ficha do Meu Dia/CRM mobile rejeita eventos ou notas malformados no histórico detalhado antes de entregar a linha do tempo à interface.
- Decisão: reaproveitar os validadores de evento e nota do payload principal no único ponto de entrada do histórico, sem criar contrato paralelo ou fallback especulativo.
- Arquivos: `app/features/funil-2/Funil2Mobile.tsx`, `tests/crm-organizacao.test.mjs`, `tests/crm-visual-harness/main.tsx`, `tests/crm-visual-harness.test.mjs`.
- Verificações: antes da correção, `eventos: [null]` apagava a ficha ao abrir “Histórico” com `TypeError` em `titulo`; o teste comportamental falhou; 53 testes dirigidos passaram e o lint ficou limpo; no navegador, o payload malformado preservou a ficha e exibiu “Histórico indisponível”, enquanto o válido continuou mostrando a linha do tempo.
- Produção: `f87ed4ce` publicado e confirmado antes desta fatia; o CRM real carregou cartões e paginação sem mutações.
- Risco: baixo; item fora do contrato passa ao estado de erro recuperável já existente.
- Próximo passo: publicar esta fatia, validar o Meu Dia real em produção sem mutações e seguir para a próxima falha P0/P1 comprovada.
