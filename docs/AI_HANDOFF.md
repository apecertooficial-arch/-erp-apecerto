# Checkpoint ERP ApeCerto

- Objetivo: avançar pelas falhas P0/P1 comprovadas após concluir gerente → corretor → visita → feedback persistido → pendência encerrada.
- Base: `origin/main` em `6e6acee3450ef51e4d7ed70f4ca34edb888e5e44`; branch `codex/agenda-hoje-sao-paulo`.
- Concluído nesta fatia: Adicionar cliente não libera criação após uma verificação de duplicidade incompleta.
- Decisão: exigir `duplicado` booleano e, quando positivo, o lead correspondente; resposta parcial falha fechada pelo alerta existente.
- Arquivos: `app/features/funil-2/AdicionarClienteModal.tsx`, `tests/crm-funcoes-canonicas.test.mjs`, `tests/crm-visual-harness/main.tsx`.
- Verificações: o harness reproduziu `{}` liberando o botão sem alerta; o teste falhou primeiro; depois da correção, aparece “Não foi possível verificar duplicidade”, enquanto `duplicado: false` válido segue sem bloqueio.
- Produção: `6e6acee3` publicado e confirmado; Adicionar cliente real abriu com sete responsáveis e Claudia selecionada.
- Risco: baixo; não houve POST no harness nem mutação em produção.
- Próximo passo: executar o build, publicar esta fatia, validar o CRM em produção e seguir para a próxima falha P0/P1 comprovada.
