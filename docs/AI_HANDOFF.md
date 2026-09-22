# Checkpoint ERP ApeCerto

- Objetivo: avançar pelas falhas P0/P1 comprovadas após concluir gerente → corretor → visita → feedback persistido → pendência encerrada.
- Base: `origin/main` em `9a2f1d19`; branch `codex/agenda-hoje-sao-paulo`.
- Concluído nesta fatia: o Meu Dia/CRM mobile rejeita tag malformada antes de entregar o catálogo à ação “Adicionar tag”; todas as seis coleções do payload principal agora validam seus itens.
- Decisão: validar apenas `id`, `nome` e `cor`, exatamente o contrato pequeno do catálogo, sem normalização ou fallback especulativo.
- Arquivos: `app/features/funil-2/Funil2Mobile.tsx`, `tests/crm-organizacao.test.mjs`, `tests/crm-visual-harness/main.tsx`, `tests/crm-visual-harness.test.mjs`.
- Verificações: antes da correção, `tagCatalogo: [null]` apagava toda a interface ao clicar “Adicionar tag”; o teste comportamental falhou; 52 testes dirigidos passaram e o lint ficou limpo; no navegador, o payload malformado abriu o erro recuperável e o válido abriu o seletor de tag com associação inicialmente desabilitada.
- Produção: `9a2f1d19` publicado e confirmado antes desta fatia; o CRM real carregou cartões e paginação sem mutações.
- Risco: baixo; tag fora do contrato passa ao estado de erro recuperável já existente.
- Próximo passo: executar o build final, publicar esta fatia, validar o Meu Dia real em produção sem mutações e seguir para a próxima falha P0/P1 comprovada.
