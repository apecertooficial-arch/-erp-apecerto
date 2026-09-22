# Checkpoint ERP ApeCerto

- Objetivo: avançar pelas falhas P0/P1 comprovadas após concluir gerente → corretor → visita → feedback persistido → pendência encerrada.
- Base: `origin/main` em `24975bda`; branch `codex/agenda-hoje-sao-paulo`.
- Concluído nesta fatia: a busca da carteira antiga no CRM mobile rejeita itens malformados antes de entregar a lista à interface.
- Decisão: validar no único ponto de ingestão os nove campos do contrato já tipado da RPC, sem proteger cada leitura na renderização nem criar normalização silenciosa.
- Arquivos: `app/features/funil-2/Funil2Mobile.tsx`, `tests/crm-organizacao.test.mjs`, `tests/crm-visual-harness/main.tsx`, `tests/crm-visual-harness.test.mjs`.
- Verificações: antes da correção, `leads: [null]` apagava o CRM ao buscar com `TypeError` em `nome`; o teste comportamental falhou; 54 testes dirigidos passaram e o lint ficou limpo; no navegador, o item malformado preservou o CRM e exibiu “Indisponível”, enquanto o payload válido listou oito clientes e a ação “Trazer para o funil”.
- Produção: `24975bda` publicado e confirmado antes desta fatia; o CRM real carregou cartões e paginação sem mutações.
- Risco: baixo; item fora do contrato passa ao estado de erro recuperável já existente.
- Próximo passo: publicar esta fatia, validar o CRM real em produção sem mutações e seguir para a próxima falha P0/P1 comprovada.
