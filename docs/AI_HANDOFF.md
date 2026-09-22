# Checkpoint ERP ApeCerto

- Objetivo: avançar pelas falhas P0/P1 comprovadas após concluir gerente → corretor → visita → feedback persistido → pendência encerrada.
- Base: `origin/main` em `5fdac8a7`; branch `codex/agenda-hoje-sao-paulo`.
- Concluído nesta fatia: o Meu Dia/CRM mobile rejeita evento malformado antes de filtrar e ordenar o histórico da ficha.
- Decisão: validar o registro completo do evento porque os helpers de honestidade da Sara também consomem tipo, detalhe e payload, além dos campos visuais.
- Arquivos: `app/features/funil-2/Funil2Mobile.tsx`, `tests/crm-organizacao.test.mjs`, `tests/crm-visual-harness/main.tsx`, `tests/crm-visual-harness.test.mjs`.
- Verificações: antes da correção, `eventos: [null]` com a ficha aberta apagava toda a interface; o teste comportamental falhou; 50 testes dirigidos passaram e o lint ficou limpo; no navegador, o payload malformado abriu o erro recuperável e o válido abriu o cliente com Histórico.
- Produção: `5fdac8a7` publicado e confirmado antes desta fatia; o CRM real carregou cartões e paginação sem mutações.
- Risco: baixo; evento fora do contrato passa ao estado de erro recuperável já existente.
- Próximo passo: executar o build final, publicar esta fatia, validar o Meu Dia real em produção sem mutações e seguir para a próxima falha P0/P1 comprovada.
