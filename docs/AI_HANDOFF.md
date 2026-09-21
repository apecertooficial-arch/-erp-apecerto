# Checkpoint ERP ApeCerto

- Objetivo: avançar pelas falhas P0/P1 comprovadas após concluir gerente → corretor → visita → feedback persistido → pendência encerrada.
- Base: `origin/main` em `27c8a6bd290efdb6fcea3e4a289ac7cb6ef77158`; branch `codex/agenda-hoje-sao-paulo`.
- Concluído nesta fatia: CRM/Meu Dia desktop não transforma mais HTTP 200 incompleto em carteira falsamente vazia.
- Decisão: validar em um único helper os treze conjuntos operacionais antes de instalar o estado nos dois caminhos de carga; contrato inválido mostra mensagem humana e retry.
- Arquivos: `app/features/funil-2/Funil2Workspace.tsx`, `tests/crm-organizacao.test.mjs`.
- Verificações: o harness reproduziu Negócios e Meu Dia com zero itens após `{}`; o teste falhou primeiro; 70 testes direcionados e lint passaram; depois da correção, o harness mostrou erro recuperável, sem falso vazio ou erro de runtime, e o estado normal preservou o quadro.
- Produção: `27c8a6bd` publicado e confirmado; Financeiro carregou os dados reais sem erro de console.
- Risco: baixo; carteira legitimamente vazia continua válida quando a API devolve os treze conjuntos como listas vazias.
- Próximo passo: executar o build, publicar esta fatia, validar `/crm` em produção e seguir para a próxima falha P0/P1 comprovada.
