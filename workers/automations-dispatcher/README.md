# Dispatcher persistente da Central de Automações

Processo de infraestrutura contínuo que consome exclusivamente itens já
persistidos em `public.motor_fila`. Ele não varre leads, não é uma automação
comercial e não contém regras da Sara: a execução continua delegada ao motor
canônico do banco.

Configuração obrigatória, somente no backend:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `AUTOMATIONS_DISPATCHER_WORKER_ID` (identidade estável por réplica)

Configuração opcional:

- `AUTOMATIONS_DISPATCHER_POLL_MS` (padrão `750`, mínimo `100`)
- `AUTOMATIONS_DISPATCHER_HEARTBEAT_MS` (padrão `10000`)
- `AUTOMATIONS_DISPATCHER_LEASE_SECONDS` (padrão `90`, mínimo `30`)
- `AUTOMATIONS_DISPATCHER_SHUTDOWN_MS` (padrão `30000`)

Comando local: `node workers/automations-dispatcher/index.mjs`.

O processo nasce inerte nos modos `cron` e `shadow`. Em `shadow`, registra
heartbeat e atraso, mas não reivindica itens. A promoção para `worker` é feita
apenas pela migration de corte, que fecha se o shadow não estiver saudável por
dois minutos. Se o heartbeat expirar, o relógio de infraestrutura retorna o
modo a `cron`; leases vencidos são recuperados sem assumir sucesso.

Nunca configure `SUPABASE_SERVICE_ROLE_KEY` como variável `NEXT_PUBLIC_*` nem
no serviço web do frontend.
