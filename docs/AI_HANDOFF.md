# Checkpoint ERP ApeCerto

- Objetivo: avançar pelas falhas P0/P1 comprovadas após concluir gerente → corretor → visita → feedback persistido → pendência encerrada.
- Base: `origin/main` em `f8555819`; branch `codex/agenda-hoje-sao-paulo`.
- Concluído nesta fatia: prioridade móvel fiel ao recorte — o indicador agora conta apenas clientes visíveis com ação vencida.
- Decisão: reutilizar `visiveis`, `leadOperacionalNoMeuDia` e o mesmo prazo já canônico, sem estado ou predicado paralelo.
- Arquivos: `app/features/funil-2/Funil2Mobile.tsx`, `tests/crm-correcao-6-2-para-10.test.mjs`.
- Verificações: a falha real mostrou 21 clientes visíveis e prioridade global 108; 37 testes dirigidos e o lint passaram; no navegador, “Quente” mostrou visíveis 21/prioridade 21 e a limpeza restaurou 108/108.
- Produção: `f8555819` publicado e confirmado antes desta fatia; a limpeza móvel foi validada localmente com 21 → 60 cartões e sem duplicação.
- Risco: baixo; apenas conteúdo, semântica e recuperação visual mudam, com os mesmos dados e filtros.
- Progresso conservador publicado após esta entrega:
  - Transformação completa: `[██████████░░░░░░░░░░] 49/100`
  - CRM / Kanban: `[██████████████░░░░░░] 72/100`
  - Identidade visual: `[█████████████░░░░░░░] 66/100`
  - Meu Dia: `[██████████████░░░░░░] 70/100`
  - Agenda / visitas: `[███████████████░░░░░] 75/100`
  - Aplicativo móvel: `[█████████████░░░░░░░] 66/100`
- Próximo passo: publicar esta fatia e, havendo margem segura, criar o painel administrativo `/progresso` com fonte versionada e fail-closed.
