# Checkpoint ERP ApeCerto

- Objetivo: avançar pelas falhas P0/P1 comprovadas após concluir gerente → corretor → visita → feedback persistido → pendência encerrada.
- Base: `origin/main` em `1594217f`; branch `codex/agenda-hoje-sao-paulo`.
- Concluído nesta fatia: primeira readequação visível do CRM/Kanban — KPIs acionáveis no desktop e resumo real da carteira no app móvel, preservando o pipeline e as APIs existentes.
- Decisão: reaproveitar contagens já calculadas (`negociosVisiveis`, ganhos, perdidos, triagem, carteira, recorte e prioridade) e os tokens oficiais, sem dashboard paralelo, endpoint ou schema novo.
- Arquivos: `app/features/funil-2/Funil2BoardToolbar.tsx`, `app/features/funil-2/Funil2Mobile.tsx`, `app/styles/funil.css`, `tests/crm-correcao-6-2-para-10.test.mjs`, `tests/crm-p3-estrutura.test.mjs`, `tests/funil-2-mobile-operacional.test.mjs`.
- Verificações: o contrato visual falhou antes da mudança; 31 testes dirigidos passaram e o lint ficou limpo; no navegador, desktop exibiu KPIs, pipeline e colunas reais, o móvel exibiu carteira/recorte/prioridade e preservou loading, vazio e erro com retry.
- Produção: `1594217f` publicado e confirmado antes desta fatia; CRM real carregou cards e “Adicionar cliente” sem loading preso, retry ou erro.
- Risco: baixo; apenas hierarquia e semântica visual mudam, com os mesmos dados, filtros e handlers.
- Progresso conservador publicado após esta entrega:
  - Transformação completa: `[████████░░░░░░░░░░░░] 40/100`
  - CRM / Kanban: `[████████████░░░░░░░░] 60/100`
  - Identidade visual: `[███████████░░░░░░░░░] 55/100`
  - Meu Dia: `[██████████████░░░░░░] 70/100`
  - Agenda / visitas: `[███████████████░░░░░] 75/100`
  - Aplicativo móvel: `[████████████░░░░░░░░] 60/100`
- Próximo passo: publicar esta fatia, validar desktop e móvel em produção sem mutações e parar com margem antes de 66%.
