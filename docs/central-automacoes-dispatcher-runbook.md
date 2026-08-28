# Runbook — dispatcher persistente da Central de Automações

## Escopo

O dispatcher é infraestrutura. Ele consome somente `public.motor_fila`, chama
o motor canônico e não aparece como terceira automação. Não varre leads, não
contém regra da Sara e não substitui os dois tipos visíveis definidos pelo
produto: Entrada de campanha e Inteligência/Ciclo de Vida Sara.

Este documento prepara uma publicação futura. Nenhuma etapa abaixo foi
executada em produção neste marco.

## Segredos e processo

O processo contínuo é `workers/automations-dispatcher/index.mjs`. Ele requer
`SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` e uma identidade estável em
`AUTOMATIONS_DISPATCHER_WORKER_ID`. A service role fica somente no serviço de
backend; nunca deve usar prefixo `NEXT_PUBLIC_` nem ser copiada ao serviço web.

O arquivo `workers/automations-dispatcher/render.worker.example.yaml` é apenas
um exemplo isolado e não altera o `render.yaml` ativo.

## Publicação em ordem segura

1. Confirmar os hashes/preflights da migration canônica da Sara e aplicar
   `20260828203000_central_sara_evento_unico.sql` em janela controlada.
2. Aplicar `20260828214500_central_dispatcher_persistente.sql`. O modo inicial
   continua `cron`; o relógio vigente não é alterado nessa etapa.
3. Criar e iniciar uma única réplica do worker com os segredos de backend. Em
   `cron`, ele registra heartbeat, mas não reivindica itens.
4. Confirmar o diagnóstico sanitizado por
   `select public.motor_dispatcher_diagnostico();` e promover para observação:
   `select public.motor_dispatcher_definir_modo('shadow','<worker-id>');`.
5. Observar por pelo menos dois minutos: heartbeat abaixo de 45 s, lag até
   60 s, nenhum lease expirado e nenhuma divergência na fila. O cron continua
   sendo o único consumidor em `shadow`.
6. Confirmar que todo lead ativo já possui exatamente um checkpoint durável.
   A migration de corte fecha se houver qualquer lacuna; não contornar esse
   bloqueio com replay ou varredura livre.
7. Aplicar `20260828215000_central_dispatcher_cutover_worker.sql`. A promoção e
   a troca do relógio ocorrem na mesma transação. Em worker saudável, o relógio
   não chama diretamente fila nem prazo.
8. Repetir o diagnóstico e verificar logs sanitizados do worker, itens
   imediatos, itens futuros, retries e ausência de duplicidade.

## Fallback e rollback

Se o heartbeat passar de 45 s, o próximo tick do relógio muda atomicamente o
modo para `cron` e volta a consumir fila/prazo. Itens com lease ativo não são
reivindicados pelo cron; lease expirado só é recuperado quando nenhum
processador detém o advisory lock do item.

Rollback operacional explícito, sem desfazer schema:

1. `select public.motor_dispatcher_definir_modo('cron','<worker-id>');`
2. confirmar `modo=cron` em `motor_dispatcher_diagnostico()`;
3. encerrar o worker graciosamente;
4. confirmar que `cron_consumiu=true` no resultado do relógio e que o atraso
   da fila volta ao SLA.

As colunas de lease e a tabela privada podem permanecer inertes. Não remover
colunas enquanto houver item `processando`; não apagar histórico de fila.

## Critérios de abortar o corte

- heartbeat ausente ou acima de 45 s;
- menos de dois minutos em shadow;
- lag acima de 60 s;
- item de worker em processamento durante shadow;
- lead ativo sem checkpoint durável;
- versão divergente de `motor_processar_fila` ou `motor_relogio_central`;
- qualquer segredo visível em log ou variável pública.
