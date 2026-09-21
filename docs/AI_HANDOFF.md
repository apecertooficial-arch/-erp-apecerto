# Checkpoint ERP ApeCerto

- Objetivo: avançar pelas falhas P0/P1 comprovadas após concluir gerente → corretor → visita → feedback persistido → pendência encerrada.
- Base: `origin/main` em `483b49d9be21d3aa3ca6bbfb7070be1bdddc8883`; branch `codex/agenda-hoje-sao-paulo`.
- Concluído nesta fatia: horários de visita malformados não derrubam mais a ficha do CRM.
- Decisão: exigir `horarios` como array antes de montar filtros; contrato inválido usa o estado de erro já existente e mantém Confirmar visita desabilitado.
- Arquivos: `app/features/funil-2/HorariosVisita.tsx`, `tests/visitas-privacidade.test.mjs`, `tests/crm-visual-harness/main.tsx`.
- Verificações: o harness reproduziu queda completa com `horarios` string; o teste falhou primeiro; depois da correção, a ficha permanece aberta com alerta, enquanto o dia seguinte válido mostra 10:00 disponível.
- Produção: `483b49d9` publicado e confirmado; Iniciar negociação real carregou o catálogo sem erro.
- Risco: baixo; consulta de horários é somente leitura e nenhum agendamento foi confirmado.
- Próximo passo: executar o build, publicar esta fatia, validar o CRM em produção e seguir para a próxima falha P0/P1 comprovada.
