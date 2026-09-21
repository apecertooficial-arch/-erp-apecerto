# Checkpoint ERP ApeCerto

- Objetivo: avançar pelas falhas P0/P1 comprovadas após concluir gerente → corretor → visita → feedback persistido → pendência encerrada.
- Base: `origin/main` em `85c8d888d4bfd5179eaa7d4dad02183779e2b620`; branch `codex/meu-dia-sem-legado`.
- Concluído nesta fatia: o Meu Dia deixa de contar e promover registros `legado`/`atualizar_manual` como ações operacionais; o histórico continua disponível em Todos os Leads.
- Decisão: uma função compartilhada filtra a fila antes dos contadores e da ordenação, sem alterar banco, API ou dados.
- Arquivos: `app/features/funil-2/modelo.ts`, `app/features/funil-2/Funil2Workspace.tsx`, `tests/funil-2.test.mjs`.
- Verificações: produção reproduziu carteira legada como primeiro item acionável; teste vermelho confirmou a regra ausente; 78 testes direcionados e lint passaram; build Vinext passou; harness desktop/mobile 390×844 carregou CRM sem erro de console.
- Produção: `85c8d888` publicado e confirmado por `/api/build`; Agenda desktop e mobile 390×844 carregaram a fila filtrada, responsável e qualidade com console limpo.
- Risco: somente etapas explicitamente históricas são removidas do Meu Dia; nenhuma etapa comercial ativa muda de comportamento.
- Próximo passo: publicar esta fatia, validar que o primeiro item de produção não é histórico e seguir para a próxima falha P0/P1 de Meu Dia/Agenda/aplicativo.
