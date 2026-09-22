# Checkpoint ERP ApeCerto

- Objetivo: seguir pelas falhas P0/P1 comprovadas do CRM, Meu Dia, Agenda e aplicativo.
- Base: `origin/main` em `46a81615`; branch `codex/agenda-hoje-sao-paulo`.
- Concluído nesta fatia: o nome devolvido pelo Funil deixa de repetir telefones importados, protegendo título, cartão e rótulos acessíveis no desktop e no aplicativo.
- Decisão: sanitizar uma vez na resposta canônica `/api/funil2`, preservando o telefone separado para busca e contato.
- Arquivos: `app/api/funil2/route.ts`, `app/features/funil-2/contratos.mjs`, teste comportamental e fonte do painel.
- Verificações: reprodução real em produção mostrou telefone completo no nome; teste comportamental falhou antes e passou após a correção. Gates finais e validação publicada ainda pendem desta fatia.
- Produção: `46a81615` é o último hash confirmado antes desta fatia.
- Risco: baixo; somente apresentação do nome muda, sem alterar o cadastro nem o número usado para contato.
- Progresso conservador publicado após esta entrega:
  - Transformação completa: `[██████████░░░░░░░░░░] 51/100`
  - CRM / Kanban: `[███████████████░░░░░] 73/100`
  - Identidade visual: `[█████████████░░░░░░░] 67/100`
  - Meu Dia: `[██████████████░░░░░░] 70/100`
  - Agenda / visitas: `[███████████████░░░░░] 75/100`
  - Aplicativo móvel: `[█████████████░░░░░░░] 66/100`
- Próximo passo: publicar e confirmar a sanitização no CRM desktop e móvel; depois seguir para a próxima falha comprovada.
