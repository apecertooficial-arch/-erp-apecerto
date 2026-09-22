# Checkpoint ERP ApeCerto

- Objetivo: avançar pelas falhas P0/P1 comprovadas após concluir gerente → corretor → visita → feedback persistido → pendência encerrada.
- Base: `origin/main` em `d6b0ddb4`; branch `codex/agenda-hoje-sao-paulo`.
- Concluído nesta fatia: “Adicionar cliente” rejeita responsáveis malformados antes de publicar a coleção no estado e renderizar o seletor.
- Decisão: validar os três campos usados de cada responsável no único fetch de opções, sem criar parser ou abstração nova.
- Arquivos: `app/features/funil-2/AdicionarClienteModal.tsx`, `tests/crm-funcoes-canonicas.test.mjs`, `tests/crm-visual-harness/main.tsx`, `tests/crm-visual-harness.test.mjs`.
- Verificações: antes da correção, `corretores: [null]` derrubava o diálogo inteiro sem mensagem; o teste comportamental falhou; 50 testes dirigidos passaram e o lint ficou limpo; no navegador, a resposta inválida manteve o diálogo aberto com erro operacional e a válida preservou formulário e responsável. A conexão atual não expôs controle de viewport; este fluxo existe apenas no CRM desktop canônico desde o revert documentado nos testes.
- Produção: `d6b0ddb4` publicado e confirmado antes desta fatia; Notificações reais carregaram sem loading preso ou estado de retry.
- Risco: baixo; item fora do contrato passa ao erro recuperável já existente e o formulário continua bloqueado pelo responsável obrigatório.
- Próximo passo: publicar esta fatia, validar o CRM real em produção sem mutações e parar com margem antes de 66% se o uso tiver avançado.
