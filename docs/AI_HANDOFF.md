# Checkpoint ERP ApeCerto

- Objetivo: avançar pelas falhas P0/P1 comprovadas após concluir gerente → corretor → visita → feedback persistido → pendência encerrada.
- Base: `origin/main` em `7d0f368a`; branch `codex/agenda-hoje-sao-paulo`.
- Concluído nesta fatia: a edição de visita não presume mais que o gerente está livre quando a consulta de disponibilidade falha ou vem incompleta.
- Decisão: validar HTTP e `conflitos` como array, bloquear Salvar alteração no estado não confirmado e oferecer a alternativa explícita de ir sem gerente.
- Arquivos: `app/features/calendar/CalendarWorkspace.tsx`, `tests/agenda-gerente-filtro.test.mjs`, `tests/crm-visual-harness/main.tsx`.
- Verificações: o harness reproduziu erro HTTP aparecendo como gerente livre e botão habilitado; o teste falhou primeiro; depois da correção, o erro bloqueia o salvamento e a resposta válida libera normalmente.
- Produção: `7d0f368a` publicado e confirmado; a validação anterior de carga móvel parcial foi promovida após os gates locais.
- Risco: baixo; a escrita foi simulada somente no harness local.
- Próximo passo: executar o build, publicar esta fatia, validar o CRM em produção e seguir para a próxima falha P0/P1 comprovada.
