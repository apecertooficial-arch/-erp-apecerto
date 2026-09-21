# Checkpoint ERP ApeCerto

- Objetivo: avançar pelas falhas P0/P1 comprovadas após concluir gerente → corretor → visita → feedback persistido → pendência encerrada.
- Base: `origin/main` em `81cc48f6`; branch `codex/agenda-hoje-sao-paulo`.
- Concluído nesta fatia: a associação de tag compartilhada por desktop e aplicativo não fecha mais o editor quando recebe HTTP 200 sem `ok: true`.
- Decisão: exigir confirmação explícita antes de limpar a seleção, fechar o editor e recarregar o lead.
- Arquivos: `app/features/funil-2/AssociarTagLead.tsx`, `tests/crm-organizacao.test.mjs`, `tests/crm-visual-harness/main.tsx`, `tests/crm-visual-harness/fixtures.ts`.
- Verificações: o harness reproduziu o editor fechando após `200 {}` sem tag persistida; o teste falhou primeiro; depois da correção, a seleção permanece com alerta e o envelope válido fecha normalmente.
- Produção: `81cc48f6` publicado e confirmado; a Agenda real abriu sem erro e nenhuma edição foi enviada.
- Risco: baixo; a escrita foi simulada somente no harness local.
- Próximo passo: executar o build, publicar esta fatia, validar o CRM em produção e seguir para a próxima falha P0/P1 comprovada.
