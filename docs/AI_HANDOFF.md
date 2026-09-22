# Checkpoint ERP ApeCerto

- Objetivo: avançar pelas falhas P0/P1 comprovadas após concluir gerente → corretor → visita → feedback persistido → pendência encerrada.
- Base: `origin/main` em `dc43daab`; branch `codex/agenda-hoje-sao-paulo`.
- Concluído nesta fatia: “Adicionar cliente” rejeita identidade malformada tanto na consulta prévia de duplicidade quanto no conflito 409 da criação.
- Decisão: um único validador confere apenas os quatro campos que o alerta renderiza, sem normalizar resposta corrompida nem duplicar guards.
- Arquivos: `app/features/funil-2/AdicionarClienteModal.tsx`, `tests/crm-funcoes-canonicas.test.mjs`, `tests/crm-visual-harness/main.tsx`, `tests/crm-visual-harness.test.mjs`.
- Verificações: antes da correção, `duplicado: true, lead: {}` exibia um falso cliente `#undefined`; o teste comportamental falhou; 52 testes dirigidos passaram e o lint ficou limpo; no navegador, a resposta inválida passou ao erro recuperável sem falso duplicado e a válida preservou o formulário sem erro.
- Produção: `dc43daab` publicado e confirmado antes desta fatia; o CRM real estabilizou com o Funil e “Adicionar cliente”, sem retry ou erro.
- Risco: baixo; resposta fora do contrato não é mais publicada no estado e nenhuma escrita é repetida automaticamente.
- Próximo passo: publicar esta fatia, validar o CRM real em produção sem mutações e parar com margem antes de 66%.
