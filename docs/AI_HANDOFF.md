# Checkpoint ERP ApeCerto

- Objetivo: seguir pelas falhas P0/P1 comprovadas do CRM, Meu Dia, Agenda e aplicativo.
- Base: `origin/main` em `46a81615`; branch `codex/agenda-hoje-sao-paulo`.
- Concluído nesta fatia: o nome devolvido pelo Funil deixa de repetir telefones importados, protegendo título, cartão e rótulos acessíveis no desktop e no aplicativo.
- Decisão: sanitizar uma vez na resposta canônica `/api/funil2`, preservando o telefone separado para busca e contato.
- Arquivos: `app/api/funil2/route.ts`, `app/features/funil-2/contratos.mjs`, teste comportamental e fonte do painel.
- Verificações: reprodução real em produção mostrou telefone completo no nome; 30 testes, lint e build passaram. Em produção, 65 cartões desktop e 60 móveis ficaram sem telefone no nome ou nos rótulos acessíveis.
- Produção: `2f4c9d97` publicado e confirmado por `/api/build`.
- Risco: baixo; somente apresentação do nome muda, sem alterar o cadastro nem o número usado para contato.
- Direção visual: a reformulação visual e estrutural integral ainda **não foi entregue**. A referência aprovada deve começar por uma prova completa do CRM / Meu Dia em desktop e mobile, sem ser confundida com estas correções funcionais pontuais.
- Progresso conservador publicado após esta entrega:
  - Transformação completa: `[██████████░░░░░░░░░░] 51/100`
  - CRM / Kanban: `[███████████████░░░░░] 73/100`
  - Identidade visual: `[█████████████░░░░░░░] 67/100`
  - Meu Dia: `[██████████████░░░░░░] 70/100`
  - Agenda / visitas: `[███████████████░░░░░] 75/100`
  - Aplicativo móvel: `[█████████████░░░░░░░] 66/100`
- Próximo passo: iniciar a prova visual completa do CRM / Meu Dia somente se houver margem para concluí-la, validá-la e publicar sem parcialidade.
