# Checkpoint ERP ApeCerto

- Objetivo: avançar pelas falhas P0/P1 comprovadas após concluir gerente → corretor → visita → feedback persistido → pendência encerrada.
- Base: `origin/main` em `1760aaec3f95ffc54c24bec9ff8b22ef473cd4b0`; branch `codex/agenda-hoje-sao-paulo`.
- Concluído nesta fatia: Disparos não desmonta mais ao receber HTTP 200 sem as nove listas do painel.
- Decisão: validar `leads`, `deals`, `stages`, `approaches`, `products`, `recent`, `instances`, `brokers` e `instanceLinks` antes de instalar o estado; contrato inválido recebe mensagem humana e retry.
- Arquivos: `app/features/campaigns/CampaignWorkspace.tsx`, `tests/campaigns-api-hardening.test.mjs`, `tests/campaigns-visual-harness/main.tsx`.
- Verificações: o harness reproduziu página em branco e `TypeError` com `{}`; o teste falhou primeiro; 55 testes direcionados e lint passaram; depois da correção, o harness mostrou erro recuperável e o estado normal preservou segmentação, cadência e ações, sem erros de console.
- Produção: `1760aaec` publicado e confirmado; Abordagens carregou cinco empreendimentos e quatro modelos gerais em desktop e 390 px, sem erros de console.
- Risco: baixo; painel legitimamente vazio continua válido quando contém as nove listas vazias.
- Próximo passo: publicar esta fatia, validar produção e seguir para a próxima falha P0/P1 comprovada.
