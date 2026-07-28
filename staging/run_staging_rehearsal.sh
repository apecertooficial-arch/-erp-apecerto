#!/usr/bin/env bash
# DRESS-REHEARSAL do pacote de STAGING em Postgres LOCAL efêmero (NUNCA produção, NUNCA o Supabase real).
# Prova que estrutura + seed + migration + smoke + rollback + reaplicação funcionam de ponta a ponta
# ANTES de o usuário criar o projeto de staging. No staging real, pula-se o 00_local_bootstrap.sql.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
STAGE=/tmp/ncrm_stg; rm -rf "$STAGE"; mkdir -p "$STAGE"
cp "$ROOT/staging/00_local_bootstrap.sql"   "$STAGE/00.sql"
cp "$ROOT/staging/01_estrutura_legado.sql"  "$STAGE/01.sql"
cp "$ROOT/staging/02_seed_ficticio.sql"     "$STAGE/02.sql"
cp "$ROOT/supabase/migrations/20260728151548_crm_nova_era_persistent_model.sql" "$STAGE/mig.sql"
cp "$ROOT/supabase/rollbacks/20260728151548_crm_nova_era_persistent_model.down.sql" "$STAGE/down.sql"
cp "$ROOT/staging/03_smoke_tests.sql"       "$STAGE/03.sql"
chmod -R a+rX "$STAGE"
PGBIN=/usr/lib/postgresql/16/bin; PGDATA=/tmp/ncrm_stg_data; SOCK=/tmp/ncrm_stg_sock; PORT=55433; DB=ncrm_stg
id pg >/dev/null 2>&1 || useradd -m pg
rm -rf "$PGDATA" "$SOCK"; mkdir -p "$PGDATA" "$SOCK"; chown -R pg "$PGDATA" "$SOCK"
sudo -u pg "$PGBIN/initdb" -D "$PGDATA" -U postgres --auth=trust >/tmp/ncrm_stg_init.log 2>&1
sudo -u pg "$PGBIN/pg_ctl" -D "$PGDATA" -o "-p $PORT -k $SOCK -c listen_addresses=''" -l /tmp/ncrm_stg_pg.log start
sleep 2
sudo -u pg "$PGBIN/createdb" -p "$PORT" -h "$SOCK" -U postgres "$DB"
PSQL(){ sudo -u pg "$PGBIN/psql" -X -q -v ON_ERROR_STOP=1 -h "$SOCK" -p "$PORT" -U postgres -d "$DB" "$@"; }

echo "### [LOCAL] bootstrap (auth/roles que o Supabase já fornece)"; PSQL -f "$STAGE/00.sql"
echo "### 01 estrutura legada + 02 seed fictício"; PSQL -f "$STAGE/01.sql"; PSQL -f "$STAGE/02.sql"

echo "### ANTES: contagens do legado e migrations"
PSQL -c "SELECT 'negocios='||count(*) FROM public.negocios;"
PSQL -c "SELECT 'leads='||count(*) FROM public.leads;"
PSQL -c "SELECT 'vendas='||count(*) FROM public.vendas;"
BEFORE=$(sudo -u pg "$PGBIN/psql" -X -t -A -h "$SOCK" -p "$PORT" -U postgres -d "$DB" -c \
  "SELECT md5(string_agg(id||':'||lead_id||':'||coalesce(corretor_id::text,'-')||':'||status, ',' ORDER BY id)) FROM public.negocios;")
echo "checksum negocios ANTES=$BEFORE"

echo "### aplica a migration APROVADA (20260728151548)"; PSQL -f "$STAGE/mig.sql"

echo "### DEPOIS: objetos ncrm_* criados; legado intacto; sem trigger em tabela legada; vendas inalterada"
PSQL -c "SELECT public.test_assert(to_regclass('public.ncrm_estado') IS NOT NULL AND to_regclass('public.ncrm_evento') IS NOT NULL AND to_regnamespace('ncrm_private') IS NOT NULL,'objetos ncrm_* criados');"
PSQL -c "SELECT public.test_assert((SELECT count(*) FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relname IN ('negocios','leads','visitas','vendas','usuarios','corretores','empreendimentos','unidades') AND NOT t.tgisinternal)=0,'nenhuma trigger adicionada a tabela legada');"
AFTER=$(sudo -u pg "$PGBIN/psql" -X -t -A -h "$SOCK" -p "$PORT" -U postgres -d "$DB" -c \
  "SELECT md5(string_agg(id||':'||lead_id||':'||coalesce(corretor_id::text,'-')||':'||status, ',' ORDER BY id)) FROM public.negocios;")
echo "checksum negocios DEPOIS=$AFTER"
[ "$BEFORE" = "$AFTER" ] && echo "PASS: legado (negocios) inalterado pela migration" || { echo "FAIL: legado mudou"; exit 1; }
PSQL -c "SELECT public.test_assert((SELECT count(*) FROM public.vendas)=0,'vendas continua 0 após migration');"

echo "### smoke tests (RLS/RPC via JWT emulado)"; PSQL -f "$STAGE/03.sql"

echo "### ROLLBACK aprovado: remove só ncrm_*; legado preservado"
PSQL -f "$STAGE/down.sql"
PSQL -c "SELECT public.test_assert(to_regclass('public.ncrm_estado') IS NULL AND to_regnamespace('ncrm_private') IS NULL,'rollback removeu objetos ncrm_*');"
PSQL -c "SELECT public.test_assert(to_regclass('public.negocios') IS NOT NULL AND to_regclass('public.vendas') IS NOT NULL AND to_regclass('public.leads') IS NOT NULL,'rollback preservou o legado');"
PSQL -c "SELECT public.test_assert((SELECT count(*) FROM public.vendas)=0,'vendas inalterada após rollback');"
FINAL=$(sudo -u pg "$PGBIN/psql" -X -t -A -h "$SOCK" -p "$PORT" -U postgres -d "$DB" -c \
  "SELECT md5(string_agg(id||':'||lead_id||':'||coalesce(corretor_id::text,'-')||':'||status, ',' ORDER BY id)) FROM public.negocios;")
echo "checksum negocios PÓS-ROLLBACK=$FINAL (transferência do smoke persiste no legado, esperado)"

echo "### reaplica migration + smoke essencial"
PSQL -f "$STAGE/mig.sql"
PSQL -c "SET ROLE service_role; SELECT set_config('request.jwt.claims','{}',false); SELECT public.ncrm_registrar_msg_automatica(1,'reaplica-1',now());"
PSQL -c "SELECT set_config('request.jwt.claims', json_build_object('sub','cccc0000-0000-4000-8000-000000000001','role','authenticated')::text, false);
         SET ROLE authenticated;
         SELECT public.test_assert((SELECT count(*) FROM public.ncrm_estado WHERE negocio_id=1)=1,'reaplicação: estado recriado e visível ao dono');"
PSQL -c "SELECT public.test_assert((SELECT count(*) FROM public.vendas)=0,'reaplicação: vendas continua 0');"

echo "### teardown"; sudo -u pg "$PGBIN/pg_ctl" -D "$PGDATA" stop >/dev/null 2>&1 || true
echo "OK_STAGING_REHEARSAL_COMPLETE"
