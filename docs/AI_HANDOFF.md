# Checkpoint ERP ApeCerto

- Objetivo: avançar pelas falhas P0/P1 comprovadas após concluir gerente → corretor → visita → feedback persistido → pendência encerrada.
- Base: `origin/main` em `24282667c558e4b5b4ceba8fd9a2ec0cdeca0ab4`; branch `codex/agenda-hoje-sao-paulo`.
- Concluído nesta fatia: o Chat ao Vivo não converte mais uma resposta HTTP 200 malformada em histórico falsamente vazio.
- Decisão: exigir `messages` como lista antes de instalar o histórico; falha de contrato recebe mensagem humana e retry, e o estado vazio fica oculto enquanto a carga falhou.
- Arquivos: `app/features/chat/LiveChatWorkspace.tsx`, `tests/live-chat-api-hardening.test.mjs`, `tests/live-chat-visual-harness/main.tsx`.
- Verificações: o harness reproduziu `{}` aparecendo como “Nenhuma mensagem encontrada”; o teste falhou primeiro; 46 testes direcionados e lint passaram; depois da correção, o harness mostrou erro recuperável sem falso vazio, e o estado normal preservou as duas mensagens.
- Produção: `24282667` publicado e confirmado; Disparos carregou dados reais em desktop e mobile, sem erros de console.
- Risco: baixo; um histórico legitimamente vazio continua válido quando a API devolve `messages: []`.
- Próximo passo: executar o build, publicar esta fatia, validar `/chat` em produção e seguir para a próxima falha P0/P1 comprovada.
