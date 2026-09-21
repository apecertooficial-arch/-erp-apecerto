# Checkpoint ERP ApeCerto

- Objetivo: avançar pelas falhas P0/P1 comprovadas após concluir gerente → corretor → visita → feedback persistido → pendência encerrada.
- Base: `origin/main` em `eb981f13`; branch `codex/agenda-hoje-sao-paulo`.
- Concluído nesta fatia: criar visita na Agenda desktop não deixa mais a falha de rede como promessa rejeitada sem retorno visual.
- Decisão: tratar fetch, JSON inválido e envelope sem `success: true`; manter o formulário aberto no erro e fechá-lo apenas após confirmação.
- Arquivos: `app/features/calendar/CalendarWorkspace.tsx`, `tests/agenda-canonica.test.mjs`, `tests/crm-visual-harness/main.tsx`.
- Verificações: o harness reproduziu a queda de rede sem alerta; o teste falhou primeiro; depois da correção, o formulário permanece com erro e a resposta válida fecha com confirmação.
- Produção: `eb981f13` publicado e confirmado; a validação de identidade do cadastro foi promovida após fluxo local inválido e válido.
- Risco: baixo; a escrita foi simulada somente no harness local.
- Próximo passo: executar o build, publicar esta fatia, validar o CRM em produção e seguir para a próxima falha P0/P1 comprovada.
