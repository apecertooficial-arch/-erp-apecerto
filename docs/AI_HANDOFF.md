# Checkpoint ERP ApeCerto

- Objetivo: avançar pelas falhas P0/P1 comprovadas após concluir gerente → corretor → visita → feedback persistido → pendência encerrada.
- Base: `origin/main` em `12a0cdcc`; branch `codex/agenda-hoje-sao-paulo`.
- Concluído nesta fatia: o cadastro de cliente não fecha mais quando o servidor devolve uma identidade do Funil malformada.
- Decisão: validar o UUID canônico tanto na criação imediata quanto na reconciliação e exigir `leadId` inteiro positivo quando o cartão ainda não existe.
- Arquivos: `app/features/funil-2/AdicionarClienteModal.tsx`, `tests/crm-funcoes-canonicas.test.mjs`, `tests/crm-visual-harness/main.tsx`.
- Verificações: o harness reproduziu o modal fechando com `funilLeadId` inválido; o teste falhou primeiro; depois da correção, os dados ficam preservados com alerta e o UUID válido fecha normalmente.
- Produção: `12a0cdcc` publicado e confirmado; o editor real de tags abriu sem erro e nenhuma associação foi enviada.
- Risco: baixo; a escrita foi simulada somente no harness local.
- Próximo passo: executar o build, publicar esta fatia, validar o CRM em produção e seguir para a próxima falha P0/P1 comprovada.
