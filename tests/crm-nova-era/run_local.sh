#!/usr/bin/env bash
# Executa migration + testes em um Postgres LOCAL efêmero (NUNCA produção).
# Uso: bash tests/crm-nova-era/run_local.sh
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
# /root é 0700: o usuário 'pg' não atravessa. Copia os SQLs para /tmp legível.
STAGE=/tmp/ncrm_sql; rm -rf "$STAGE"; mkdir -p "$STAGE"
cp "$ROOT/supabase/migrations/20260728151548_crm_nova_era_persistent_model.sql" "$STAGE/mig.sql"
cp "$ROOT/supabase/rollbacks/20260728151548_crm_nova_era_persistent_model.down.sql" "$STAGE/down.sql"
cp "$ROOT/tests/crm-nova-era/00_local_harness.sql" "$STAGE/harness.sql"
cp "$ROOT/tests/crm-nova-era/10_tests_core.sql" "$STAGE/core.sql"
chmod -R a+rX "$STAGE"
MIG="$STAGE/mig.sql"; DOWN="$STAGE/down.sql"; HARNESS="$STAGE/harness.sql"; CORE="$STAGE/core.sql"
PGBIN=/usr/lib/postgresql/16/bin
PGDATA=/tmp/ncrm_pgdata
SOCK=/tmp/ncrm_sock
PORT=55432
DB=ncrm_test
export PGHOST=$SOCK PGPORT=$PORT PGDATABASE=$DB PGUSER=postgres

# usuário não-root para o postgres
id pg >/dev/null 2>&1 || useradd -m pg
rm -rf "$PGDATA" "$SOCK"; mkdir -p "$PGDATA" "$SOCK"; chown -R pg "$PGDATA" "$SOCK" "$ROOT/tests/crm-nova-era" 2>/dev/null || true

sudo -u pg "$PGBIN/initdb" -D "$PGDATA" -U postgres --auth=trust >/tmp/ncrm_init.log 2>&1
sudo -u pg "$PGBIN/pg_ctl" -D "$PGDATA" -o "-p $PORT -k $SOCK -c listen_addresses=''" -l /tmp/ncrm_pg.log start
sleep 2
sudo -u pg "$PGBIN/createdb" -p "$PORT" -h "$SOCK" -U postgres "$DB"

PSQL(){ sudo -u pg "$PGBIN/psql" -X -q -v ON_ERROR_STOP=1 -h "$SOCK" -p "$PORT" -U postgres -d "$DB" "$@"; }

echo "### aplica harness (local) + migration + testes core"
PSQL -f "$HARNESS"
PSQL -f "$MIG"
PSQL -f "$CORE"

echo "### #15 concorrência: mesma idempotency_key em 700 e 710 (exercita unique_violation + rollback)"
PSQL -c "SET ROLE service_role; SELECT set_config('request.jwt.claims','{}',false);
         SELECT public.ncrm_registrar_msg_automatica(700,'m700',now());
         SELECT public.ncrm_registrar_msg_automatica(710,'m710',now());"
CLAIMS='{"sub":"cccccccc-0000-0000-0000-000000000001","role":"authenticated"}'
run_rpc(){ sudo -u pg "$PGBIN/psql" -X -q -h "$SOCK" -p "$PORT" -U postgres -d "$DB" -c \
  "SELECT set_config('request.jwt.claims','$CLAIMS',false); SET ROLE authenticated;
   SELECT public.ncrm_registrar_tentativa($1,1,'whatsapp','nao_respondeu','c','tentativa_cadencia','2a', now()+interval '1 day','ui:conc');" >/dev/null 2>&1 || true; }
run_rpc 700 & run_rpc 710 & wait
PSQL -c "SELECT public.test_assert((SELECT count(*) FROM public.ncrm_evento WHERE idempotency_key='ui:conc')=1, '#15 concorrência mesma chave: exatamente 1 evento');"
PSQL -c "SELECT public.test_assert(
   ((SELECT versao FROM public.ncrm_estado WHERE negocio_id=700) + (SELECT versao FROM public.ncrm_estado WHERE negocio_id=710)) = 3,
   '#15 vencedor avançou (v=2) e perdedor revertido (v=1): unique_violation reverteu o UPDATE');"

echo "### #29 rollback remove só objetos ncrm_*"
PSQL -f "$DOWN"
PSQL -c "SELECT public.test_assert(to_regclass('public.ncrm_estado') IS NULL AND to_regclass('public.ncrm_evento') IS NULL
         AND to_regclass('public.ncrm_proposta') IS NULL AND to_regclass('public.ncrm_workflow_config') IS NULL
         AND to_regnamespace('ncrm_private') IS NULL, '#29 rollback: objetos ncrm_* removidos');"
PSQL -c "SELECT public.test_assert(to_regclass('public.negocios') IS NOT NULL AND to_regclass('public.vendas') IS NOT NULL
         AND to_regclass('public.leads') IS NOT NULL, '#29 rollback preservou objetos legados');"

echo "### #30 migration sobe novamente após rollback"
PSQL -f "$MIG"
PSQL -c "SELECT public.test_assert(to_regclass('public.ncrm_estado') IS NOT NULL AND to_regnamespace('ncrm_private') IS NOT NULL, '#30 migration reaplicada com sucesso');"

echo "### baseline de vendas (nunca deve mudar por proposta) ==> confirmação final"
PSQL -c "SELECT 'vendas_total='||count(*) FROM public.vendas;"

echo "### teardown"
sudo -u pg "$PGBIN/pg_ctl" -D "$PGDATA" stop >/dev/null 2>&1 || true
echo "OK_LOCAL_RUN_COMPLETE"
