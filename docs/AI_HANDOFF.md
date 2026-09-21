# Checkpoint ERP ApeCerto

- Objetivo: avançar pelas falhas P0/P1 comprovadas após concluir gerente → corretor → visita → feedback persistido → pendência encerrada.
- Base: `origin/main` em `4f8f97774140b78dafe08883d65efbc12377154c`; branch `codex/agenda-hoje-sao-paulo`.
- Concluído nesta fatia: o Meu Dia gerencial no mobile não envia mais gestores para `/equipe`, uma área deliberadamente exclusiva do desktop.
- Decisão: mostrar ações somente quando há visita sem feedback, caso em que existem destinos resolutivos reais (`Agenda` e registro de cobrança); cartões apenas métricos continuam informativos.
- Arquivos: `app/features/home/InicioGestaoMobile.tsx`, `tests/inicio-gestao-mobile.test.mjs`, `tests/inicio-gestao-visual-harness/main.tsx`.
- Verificações: teste falhou primeiro ao encontrar `/equipe`; 41 testes direcionados e lint passaram; build Vinext passou; harness confirmou duas duplas de ações apenas nos dois cartões com visita pendente e nenhuma ação falsa no cartão urgente sem visita, em 390×844 e 1280 px, sem erros de console.
- Produção: `4f8f9777` publicado e confirmado; a fila caiu de 425 para 401 atrasos ao retirar 24 cards `pescado`, e o workspace desktop permaneceu intacto.
- Risco: corretores sem visita pendente perdem apenas botões que levavam a uma tela sem interface mobile; os indicadores continuam visíveis.
- Próximo passo: publicar esta fatia, validar produção e seguir para a próxima falha P0/P1 comprovada.
