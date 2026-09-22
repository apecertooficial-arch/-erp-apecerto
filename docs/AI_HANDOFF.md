# Checkpoint ERP ApeCerto

- Objetivo: avançar pelas falhas P0/P1 comprovadas após concluir gerente → corretor → visita → feedback persistido → pendência encerrada.
- Base: `origin/main` em `37130e64`; branch `codex/agenda-hoje-sao-paulo`.
- Concluído nesta fatia: o Meu Dia/CRM mobile rejeita item malformado na configuração de etapas antes de calcular filtros e opções.
- Decisão: validar apenas `codigo`, `rotulo`, `ativo` e `funil`, os campos realmente lidos no app, preservando metadados adicionais da API.
- Arquivos: `app/features/funil-2/Funil2Mobile.tsx`, `tests/crm-organizacao.test.mjs`, `tests/crm-visual-harness/main.tsx`, `tests/crm-visual-harness.test.mjs`.
- Verificações: antes da correção, `etapas: [null]` apagava toda a interface; o teste comportamental falhou; 48 testes dirigidos passaram e o lint ficou limpo; no navegador, o payload malformado abriu “Não deu pra carregar sua fila” com nova tentativa, enquanto o válido manteve 108 atendimentos e 24 leads novos.
- Produção: `37130e64` publicado e confirmado antes desta fatia; `/inicio` real abriu normalmente sem mutações.
- Risco: baixo; etapa fora do contrato passa ao estado de erro recuperável já existente.
- Próximo passo: executar o build final, publicar esta fatia, validar o Meu Dia real em produção sem mutações e seguir para a próxima falha P0/P1 comprovada.
