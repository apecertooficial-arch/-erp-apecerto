# Checkpoint ERP ApeCerto

- Objetivo: avançar pelas falhas P0/P1 comprovadas após concluir gerente → corretor → visita → feedback persistido → pendência encerrada.
- Base: `origin/main` em `72da52321ce776819168479f9d83564fb76a5d85`; branch `codex/agenda-hoje-sao-paulo`.
- Concluído nesta fatia: filas extensas de Tarefas montam 25 cards por vez e preservam acesso progressivo ao restante.
- Decisão: limitar apenas a renderização, sem truncar dados nem contagens; `Mostrar mais` adiciona 25 itens e a troca de faixa reinicia o lote.
- Arquivos: `app/features/tasks/SaraTasksMobile.tsx`, `app/styles/app-mobile-aprovado.css`, `tests/app-mobile-tarefas.test.mjs`, `tests/crm-visual-harness/main.tsx`.
- Verificações: teste falhou primeiro sem o limite; 23 testes direcionados e lint passaram; build Vinext passou; harness com 32 tarefas confirmou 25 cards iniciais, 32 após `Mostrar mais` e console limpo em 390×844 e largura ampla.
- Produção: `72da5232` publicado e confirmado; Tarefas abriu em `Atrasadas`, mostrou a fila vencida e preservou Projetos no desktop sem erros de console.
- Risco: a carga da API ainda traz a coleção completa; esta fatia reduz custo de DOM e pintura, não o volume de rede.
- Próximo passo: publicar esta fatia, validar produção e seguir para a próxima falha P0/P1 comprovada.
