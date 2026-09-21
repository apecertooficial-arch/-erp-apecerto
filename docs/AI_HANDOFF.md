# Checkpoint ERP ApeCerto

- Objetivo: fechar a jornada gerente → corretor → visita → feedback persistido → pendência encerrada; sucesso só pode ser anunciado após releitura do registro gravado.
- Base: `origin/main` em `166ddecabce96336a9fdd4a8d4b2e9087fb32826`; branch `codex/feedback-persistencia-confirmada`.
- Concluído nesta fatia: as APIs Agenda e Funil 2.0 agora conferem `status`, `resultado_codigo`, `resultado_justificativa` e `resultado_em` após a RPC; divergência ou falha de leitura retorna 502 e mantém a pendência aberta.
- Decisão: reutilizar uma função compartilhada em `app/lib/supabase/autorizarResultadoVisita.ts`; nenhum schema, migration ou dado de produção foi alterado.
- Arquivos: `app/api/agenda/route.ts`, `app/api/funil2/route.ts`, `app/lib/supabase/autorizarResultadoVisita.ts`, `tests/agenda-resultados-visita.test.mjs`.
- Verificações: teste vermelho reproduziu export/contrato ausente; 37 testes direcionados passaram; lint dos arquivos tocados passou; build Vinext passou; harness real desktop/mobile mostrou fila filtrada, pendências e console vazio.
- Produção: ainda em `166ddeca`; esta fatia ainda não foi publicada.
- Risco: a confirmação acrescenta uma leitura após a RPC e falha fechada se RLS ou conectividade impedirem comprovar a escrita.
- Próximo passo: publicar a fatia após revisão final, acompanhar `/api/build`, validar produção somente leitura e então buscar a próxima falha P0/P1 comprovada sem inventário amplo.
