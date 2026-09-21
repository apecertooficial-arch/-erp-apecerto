# Checkpoint ERP ApeCerto

- Objetivo: avançar pelas falhas P0/P1 comprovadas após concluir gerente → corretor → visita → feedback persistido → pendência encerrada.
- Base: `origin/main` em `2430b5dc91c952b06f7f1e80ada2e15cc192743f`; branch `codex/agenda-hoje-sao-paulo`.
- Concluído nesta fatia: Avisos deixa de traduzir deep links legados `/gestao/*` para a Central de Comando exclusiva do desktop.
- Decisão: levar alertas gerenciais legados ao resumo operacional móvel em `/inicio`, preservando os destinos específicos de CRM, Agenda e Configurações.
- Arquivos: `app/features/notifications/telaAvisos.logica.ts`, `tests/push-e-avisos.test.mjs`.
- Verificações: o teste falhou primeiro ao receber `/inteligencia`; 53 testes direcionados e lint passaram; build Vinext passou.
- Produção: `2430b5dc` publicado e confirmado; Ajuda mostra três destinos válidos e zero desktop-only em 390 px, e todos os seis em 1280 px, sem erros de console.
- Risco: o segmento específico do deep link gerencial continua sem página própria no app, mas agora o toque abre o painel móvel real em vez de uma interface desktop.
- Próximo passo: publicar esta fatia, validar produção e seguir para a próxima falha P0/P1 comprovada.
