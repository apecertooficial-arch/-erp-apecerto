# Checkpoint ERP ApeCerto

- Objetivo: avançar pelas falhas P0/P1 comprovadas após concluir gerente → corretor → visita → feedback persistido → pendência encerrada.
- Base: `origin/main` em `0a7b7f927094fb3da25893f4184899abee571650`; branch `codex/agenda-hoje-sao-paulo`.
- Concluído nesta fatia: Minha Equipe não desmonta mais ao receber HTTP 200 sem as cinco listas obrigatórias.
- Decisão: validar `users`, `brokers`, `instances`, `links` e `audits` antes de substituir o estado; resposta incompleta ou falha de rede mantém ações bloqueadas e oferece retry.
- Arquivos: `app/features/team/TeamWorkspace.tsx`, `tests/team-api-hardening.test.mjs`, `tests/crm-visual-harness/main.tsx`.
- Verificações: o harness reproduziu tela desmontada e `TypeError` com `{}`; o teste falhou primeiro; 61 testes direcionados e lint passaram; após a correção, o harness manteve o shell, mostrou erro recuperável e preservou o estado vazio legítimo sem erros de console.
- Produção: `0a7b7f92` publicado e confirmado; “+ Visita” carregou clientes e empreendimentos reais em 390 px, sem erros de console.
- Risco: baixo; equipe legitimamente vazia continua válida quando as cinco propriedades existem como arrays vazios.
- Próximo passo: publicar esta fatia, validar produção e seguir para a próxima falha P0/P1 comprovada.
