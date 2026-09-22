# Checkpoint ERP ApeCerto

- Objetivo: seguir pelas falhas P0/P1 comprovadas do CRM, Meu Dia, Agenda e aplicativo.
- Base: `origin/main` em `aaf507d3`; branch `codex/agenda-hoje-sao-paulo`.
- Concluído nesta fatia: prova visual operacional do CRM / Meu Dia em desktop e mobile, usando o shell, tokens e componentes reais; nenhuma interface paralela foi criada.
- Decisão: consolidar azul, índigo, violeta, atmosfera e profundidade nas autoridades CSS existentes, mantendo laranja nas ações principais e sem dependência nova.
- Arquivos: autoridades de identidade, shell, Funil desktop e aplicativo móvel; teste estrutural da direção visual e fonte do painel.
- Verificações: CRM e Meu Dia com dados sanitizados no navegador real; desktop e 390×844; carregamento, vazio, erro e acesso negado sem overflow; redução de movimento; console sem warnings ou erros. Gates automatizados e build devem permanecer verdes antes da publicação.
- Produção: `361b5a16` e `591dd749` publicados e confirmados por `/api/build`. CRM desktop com 65 cartões, CRM móvel com 60, sem overflow; shell e sombras computadas ativos. Painel de Progresso com um único `main`, teto de 80% e hash atualizado.
- Risco: baixo a moderado e restrito à apresentação; fluxos, dados e mutações não foram alterados.
- Direção visual: a prova está completa, mas a reformulação visual e estrutural integral ainda **não foi entregue**. Propagação para os demais módulos depende da aprovação desta prova.
- Progresso conservador publicado após esta entrega:
  - Transformação completa: `[██████████░░░░░░░░░░] 52/100`
  - CRM / Kanban: `[███████████████░░░░░] 75/100`
  - Identidade visual: `[██████████████░░░░░░] 70/100`
  - Meu Dia: `[██████████████░░░░░░] 72/100`
  - Agenda / visitas: `[███████████████░░░░░] 75/100`
  - Aplicativo móvel: `[██████████████░░░░░░] 70/100`
- Próximo passo: investigar as 65 visitas pendentes de resultado vistas na Agenda e corrigir somente a próxima falha P0/P1 comprovada; a reformulação integral continua pendente.
- Continuação: o teto semanal autorizado passou a 80%. O painel de Progresso usa o marco principal do shell e o teste global de acessibilidade voltou a passar.
