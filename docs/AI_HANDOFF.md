# Checkpoint ERP ApeCerto

- Objetivo: avançar pelas falhas P0/P1 comprovadas após concluir gerente → corretor → visita → feedback persistido → pendência encerrada.
- Base: `origin/main` em `afa47e6f`; branch `codex/agenda-hoje-sao-paulo`.
- Concluído nesta fatia: o Meu Dia/CRM mobile rejeita nota malformada antes de filtrar as anotações da ficha.
- Decisão: validar o contrato completo e pequeno da nota, inclusive a origem canônica, sem criar normalização ou fallback especulativo.
- Arquivos: `app/features/funil-2/Funil2Mobile.tsx`, `tests/crm-organizacao.test.mjs`, `tests/crm-visual-harness/main.tsx`, `tests/crm-visual-harness.test.mjs`.
- Verificações: antes da correção, `notas: [null]` com a ficha aberta apagava toda a interface; o teste comportamental falhou; 51 testes dirigidos passaram e o lint ficou limpo; no navegador, o payload malformado abriu o erro recuperável e o válido mostrou cliente, Histórico e Notas.
- Produção: `afa47e6f` publicado e confirmado antes desta fatia; o CRM real carregou cartões e paginação sem mutações.
- Risco: baixo; nota fora do contrato passa ao estado de erro recuperável já existente.
- Próximo passo: executar o build final, publicar esta fatia, validar o Meu Dia real em produção sem mutações e seguir para a próxima falha P0/P1 comprovada.
