# Checkpoint ERP ApeCerto

- Objetivo: avançar pelas falhas P0/P1 comprovadas após concluir gerente → corretor → visita → feedback persistido → pendência encerrada.
- Base: `origin/main` em `895ac6097caa080b965148b0efff70537e9c02c1`; branch `codex/agenda-hoje-sao-paulo`.
- Concluído nesta fatia: o seletor de cliente do Novo negócio não transforma mais HTTP 200 incompleto em “nenhum cliente”.
- Decisão: exigir `leads` como array no componente compartilhado e reutilizar o tratamento de erro de rede já existente.
- Arquivos: `app/features/funil-2/LeadSearchPicker.tsx`, `tests/crm-correcao-6-2-para-10.test.mjs`.
- Verificações: o harness reproduziu o falso vazio após `{}`; o teste falhou primeiro; depois da correção, aparece alerta e uma resposta válida preserva os clientes selecionáveis.
- Produção: `895ac609` publicado e confirmado; a busca real por “Mar” retornou 40 clientes legados acionáveis.
- Risco: baixo; pesquisa legitimamente vazia continua válida quando a API devolve `leads: []`.
- Próximo passo: executar o build, publicar esta fatia, validar o CRM em produção e seguir para a próxima falha P0/P1 comprovada.
