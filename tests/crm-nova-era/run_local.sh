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
# Pos-visita: resultado da visita, dez motivos de descarte e origem da proxima acao
cp "$ROOT/supabase/migrations/20260808110000_ncrm_pos_visita_descarte_e_origem.sql" "$STAGE/mig_pv.sql"
cp "$ROOT/supabase/migrations/20260808110100_ncrm_resultado_visita_rpc.sql" "$STAGE/mig_pv_rpc.sql"
cp "$ROOT/supabase/rollbacks/20260808110000_ncrm_pos_visita_descarte_e_origem.down.sql" "$STAGE/down_pv.sql"
cp "$ROOT/tests/crm-nova-era/99c_tests_pos_visita.sql" "$STAGE/pv.sql"
# Analise da Sara pedida pelo corretor (origem 'usuario' + RPC autenticada)
cp "$ROOT/supabase/migrations/20260808120000_ncrm_sara_analise_usuario.sql" "$STAGE/mig_su.sql"
cp "$ROOT/supabase/rollbacks/20260808120000_ncrm_sara_analise_usuario.down.sql" "$STAGE/down_su.sql"
cp "$ROOT/tests/crm-nova-era/99d_tests_sara_analise_usuario.sql" "$STAGE/su.sql"
# Elegiveis com prioridade de novidade + manual operacional
cp "$ROOT/supabase/migrations/20260809100000_ncrm_elegiveis_novidade_e_manual.sql" "$STAGE/mig_em.sql"
cp "$ROOT/supabase/rollbacks/20260809100000_ncrm_elegiveis_novidade_e_manual.down.sql" "$STAGE/down_em.sql"
cp "$ROOT/tests/crm-nova-era/99e_tests_elegiveis_manual.sql" "$STAGE/em.sql"
# Programa comercial da cadencia (workflow v2, janela, reativacao, SLA)
cp "$ROOT/supabase/migrations/20260809110000_ncrm_cadencia_programa_comercial.sql" "$STAGE/mig_cp.sql"
cp "$ROOT/supabase/rollbacks/20260809110000_ncrm_cadencia_programa_comercial.down.sql" "$STAGE/down_cp.sql"
cp "$ROOT/tests/crm-nova-era/99f_tests_cadencia_programa.sql" "$STAGE/cp.sql"
cp "$ROOT/tests/crm-nova-era/10_tests_core.sql" "$STAGE/core.sql"
cp "$ROOT/tests/crm-nova-era/20_tests_correcoes.sql" "$STAGE/core2.sql"
cp "$ROOT/tests/crm-nova-era/30_tests_delta_cadencia.sql" "$STAGE/core3.sql"
cp "$ROOT/tests/crm-nova-era/40_tests_sara_decisao.sql" "$STAGE/core4.sql"
cp "$ROOT/supabase/migrations/20260728190000_ncrm_sara_decisao.sql" "$STAGE/mig_sara.sql"
# Integração final (3 migrations aditivas + downs + testes de integração)
cp "$ROOT/supabase/migrations/20260728200000_ncrm_ingest_checkpoint.sql" "$STAGE/mig_ingest.sql"
cp "$ROOT/supabase/migrations/20260728200100_ncrm_proposta_esteira.sql" "$STAGE/mig_prop.sql"
cp "$ROOT/supabase/migrations/20260728200200_ncrm_visita_atomica.sql" "$STAGE/mig_visita.sql"
cp "$ROOT/supabase/rollbacks/20260728200000_ncrm_ingest_checkpoint.down.sql" "$STAGE/down_ingest.sql"
cp "$ROOT/supabase/rollbacks/20260728200100_ncrm_proposta_esteira.down.sql" "$STAGE/down_prop.sql"
cp "$ROOT/supabase/rollbacks/20260728200200_ncrm_visita_atomica.down.sql" "$STAGE/down_visita.sql"
cp "$ROOT/tests/crm-nova-era/50_tests_integracao.sql" "$STAGE/integ.sql"
# Fase 3: Sara modo observador (migration aditiva + down + testes)
cp "$ROOT/supabase/migrations/20260728210000_ncrm_sara_observer.sql" "$STAGE/mig_sara_obs.sql"
cp "$ROOT/supabase/rollbacks/20260728210000_ncrm_sara_observer.down.sql" "$STAGE/down_sara_obs.sql"
cp "$ROOT/tests/crm-nova-era/60_tests_sara_observer.sql" "$STAGE/sara_obs.sql"
cp "$ROOT/supabase/migrations/20260728210100_ncrm_admin_status.sql" "$STAGE/mig_admin.sql"
cp "$ROOT/supabase/rollbacks/20260728210100_ncrm_admin_status.down.sql" "$STAGE/down_admin.sql"
# Fase 4: retry do ingest para motor sem negócio (corrida real) + teste
cp "$ROOT/supabase/migrations/20260729120000_ncrm_runner_status.sql" "$STAGE/mig_runner.sql"
cp "$ROOT/supabase/rollbacks/20260729120000_ncrm_runner_status.down.sql" "$STAGE/down_runner.sql"
cp "$ROOT/supabase/migrations/20260729150000_ncrm_ingest_retry_sem_negocio.sql" "$STAGE/mig_retry.sql"
cp "$ROOT/supabase/rollbacks/20260729150000_ncrm_ingest_retry_sem_negocio.down.sql" "$STAGE/down_retry.sql"
cp "$ROOT/tests/crm-nova-era/70_tests_ingest_retry.sql" "$STAGE/retry.sql"
cp "$ROOT/supabase/migrations/20260729160000_ncrm_sara_registrar_ajustes.sql" "$STAGE/mig_ajustes.sql"
cp "$ROOT/supabase/rollbacks/20260729160000_ncrm_sara_registrar_ajustes.down.sql" "$STAGE/down_ajustes.sql"
cp "$ROOT/tests/crm-nova-era/71_tests_sara_registrar_ajustes.sql" "$STAGE/ajustes.sql"
# Fase 5 (PR A): cadencia configuravel, fila, gestao, justificativa
cp "$ROOT/supabase/migrations/20260730100000_ncrm_fase5_operacao.sql" "$STAGE/mig_f5.sql"
cp "$ROOT/supabase/rollbacks/20260730100000_ncrm_fase5_operacao.down.sql" "$STAGE/down_f5.sql"
cp "$ROOT/tests/crm-nova-era/80_tests_fase5_operacao.sql" "$STAGE/f5.sql"
# Fase 6 (PR A pilotos + PR B treinamento/carteira antiga/saude)
cp "$ROOT/supabase/migrations/20260731100000_ncrm_fase6_pilotos.sql" "$STAGE/mig_f6a.sql"
cp "$ROOT/supabase/rollbacks/20260731100000_ncrm_fase6_pilotos.down.sql" "$STAGE/down_f6a.sql"
cp "$ROOT/supabase/migrations/20260801100000_ncrm_fase6b_carteira_saude.sql" "$STAGE/mig_f6b.sql"
cp "$ROOT/supabase/rollbacks/20260801100000_ncrm_fase6b_carteira_saude.down.sql" "$STAGE/down_f6b.sql"
cp "$ROOT/tests/crm-nova-era/90_tests_fase6b.sql" "$STAGE/f6b.sql"
cp "$ROOT/supabase/migrations/20260802100000_ncrm_ingest_lifecycle.sql" "$STAGE/mig_f61.sql"
cp "$ROOT/supabase/rollbacks/20260802100000_ncrm_ingest_lifecycle.down.sql" "$STAGE/down_f61.sql"
cp "$ROOT/tests/crm-nova-era/95_tests_ingest_lifecycle.sql" "$STAGE/f61.sql"
cp "$ROOT/tests/crm-nova-era/97_tests_revoke_anon.sql" "$STAGE/rev.sql"
cp "$ROOT/supabase/migrations/20260804100000_ncrm_entrada_humana.sql" "$STAGE/mig_eh.sql"
cp "$ROOT/supabase/rollbacks/20260804100000_ncrm_entrada_humana.down.sql" "$STAGE/down_eh.sql"
cp "$ROOT/supabase/migrations/20260804100100_ncrm_sara_assist_notificacoes.sql" "$STAGE/mig_sa.sql"
cp "$ROOT/supabase/rollbacks/20260804100100_ncrm_sara_assist_notificacoes.down.sql" "$STAGE/down_sa.sql"
cp "$ROOT/tests/crm-nova-era/97b_pre_stub_motor.sql" "$STAGE/prestub.sql"
cp "$ROOT/tests/crm-nova-era/98_tests_entrada_humana.sql" "$STAGE/eh.sql"
cp "$ROOT/tests/crm-nova-era/97c_infra_supabase_minima.sql" "$STAGE/infra.sql"
cp "$ROOT/supabase/migrations/20260805100000_ncrm_processar_agendadas_autentica_envio.sql" "$STAGE/p41a.sql"
cp "$ROOT/supabase/rollbacks/20260805100000_ncrm_processar_agendadas_autentica_envio.down.sql" "$STAGE/d41a.sql"
cp "$ROOT/supabase/migrations/20260805100100_ncrm_valida_token_envio_interno.sql" "$STAGE/p41b.sql"
cp "$ROOT/supabase/rollbacks/20260805100100_ncrm_valida_token_envio_interno.down.sql" "$STAGE/d41b.sql"
cp "$ROOT/supabase/migrations/20260805100200_ncrm_wrapper_pode_enviar_para_edge.sql" "$STAGE/p41c.sql"
cp "$ROOT/supabase/rollbacks/20260805100200_ncrm_wrapper_pode_enviar_para_edge.down.sql" "$STAGE/d41c.sql"
cp "$ROOT/supabase/migrations/20260805100300_ncrm_fecha_bloqueia_abordagem_para_authenticated.sql" "$STAGE/p41d.sql"
cp "$ROOT/supabase/rollbacks/20260805100300_ncrm_fecha_bloqueia_abordagem_para_authenticated.down.sql" "$STAGE/d41d.sql"
cp "$ROOT/supabase/migrations/20260805100400_ncrm_autorizacao_de_envio_por_usuario.sql" "$STAGE/p41e.sql"
cp "$ROOT/supabase/rollbacks/20260805100400_ncrm_autorizacao_de_envio_por_usuario.down.sql" "$STAGE/d41e.sql"
cp "$ROOT/supabase/migrations/20260805100500_ncrm_guarda_saidas_sql_restantes.sql" "$STAGE/p41f.sql"
cp "$ROOT/supabase/rollbacks/20260805100500_ncrm_guarda_saidas_sql_restantes.down.sql" "$STAGE/d41f.sql"
cp "$ROOT/supabase/migrations/20260806100000_ncrm_sla_primeira_abordagem_e_intencao.sql" "$STAGE/p42a.sql"
cp "$ROOT/supabase/rollbacks/20260806100000_ncrm_sla_primeira_abordagem_e_intencao.down.sql" "$STAGE/d42a.sql"
cp "$ROOT/supabase/migrations/20260806100100_ncrm_reconhece_outbound_manual_dapi.sql" "$STAGE/p42b.sql"
cp "$ROOT/supabase/rollbacks/20260806100100_ncrm_reconhece_outbound_manual_dapi.down.sql" "$STAGE/d42b.sql"
cp "$ROOT/supabase/migrations/20260806100200_ncrm_sla_criterio_canonico.sql" "$STAGE/p42c.sql"
cp "$ROOT/supabase/migrations/20260806100300_ncrm_confirmacao_no_reconciliador.sql" "$STAGE/p42d.sql"
cp "$ROOT/supabase/migrations/20260806100400_ncrm_remove_reconhecimento_negativo.sql" "$STAGE/p42e.sql"
cp "$ROOT/supabase/migrations/20260806100500_ncrm_recusa_de_contrato_e_noop.sql" "$STAGE/p42f.sql"
cp "$ROOT/supabase/migrations/20260807100000_ncrm_notificacoes_completas.sql" "$STAGE/p42g.sql"
cp "$ROOT/supabase/rollbacks/20260807100000_ncrm_notificacoes_completas.down.sql" "$STAGE/d42g.sql"
cp "$ROOT/supabase/migrations/20260807100100_ncrm_web_push.sql" "$STAGE/p42h.sql"
cp "$ROOT/supabase/rollbacks/20260807100100_ncrm_web_push.down.sql" "$STAGE/d42h.sql"
cp "$ROOT/supabase/migrations/20260807100200_ncrm_push_claim_gestao_dispositivo.sql" "$STAGE/p42i.sql"
cp "$ROOT/supabase/rollbacks/20260807100200_ncrm_push_claim_gestao_dispositivo.down.sql" "$STAGE/d42i.sql"
cp "$ROOT/tests/crm-nova-era/99b_tests_notificacoes_push.sql" "$STAGE/notif.sql"
cp "$ROOT/supabase/rollbacks/20260806100500_ncrm_recusa_de_contrato_e_noop.down.sql" "$STAGE/d42f.sql"
cp "$ROOT/supabase/rollbacks/20260806100400_ncrm_remove_reconhecimento_negativo.down.sql" "$STAGE/d42e.sql"
cp "$ROOT/supabase/rollbacks/20260806100300_ncrm_confirmacao_no_reconciliador.down.sql" "$STAGE/d42d.sql"
cp "$ROOT/supabase/rollbacks/20260806100200_ncrm_sla_criterio_canonico.down.sql" "$STAGE/d42c.sql"
cp "$ROOT/tests/crm-nova-era/99_tests_sla_canonico.sql" "$STAGE/sla.sql"
cp "$ROOT/supabase/migrations/20260810100000_ncrm_operacao_padronizada_v3.sql" "$STAGE/mig_op3.sql"
cp "$ROOT/supabase/rollbacks/20260810100000_ncrm_operacao_padronizada_v3_rollback.sql" "$STAGE/down_op3.sql"
cp "$ROOT/tests/crm-nova-era/99g_tests_operacao_padronizada_v3.sql" "$STAGE/op3.sql"
cp "$ROOT/supabase/migrations/20260810110000_ncrm_motor_operacional_meu_dia.sql" "$STAGE/mig_motor_dia.sql"
cp "$ROOT/supabase/rollbacks/20260810110000_ncrm_motor_operacional_meu_dia_rollback.sql" "$STAGE/down_motor_dia.sql"
cp "$ROOT/tests/crm-nova-era/99h_tests_motor_operacional_meu_dia.sql" "$STAGE/motor_dia.sql"
cp "$ROOT/tests/crm-nova-era/99i_pre_operacao_v4.sql" "$STAGE/pre_v4.sql"
cp "$ROOT/supabase/migrations/20260810120000_ncrm_momentos_roleta_operacao.sql" "$STAGE/mig_v4.sql"
cp "$ROOT/supabase/rollbacks/20260810120000_ncrm_momentos_roleta_operacao_rollback.sql" "$STAGE/down_v4.sql"
cp "$ROOT/tests/crm-nova-era/99i_tests_operacao_v4.sql" "$STAGE/v4.sql"
cp "$ROOT/supabase/migrations/20260810130000_ncrm_saida_humana_continuidade.sql" "$STAGE/mig_cont.sql"
cp "$ROOT/supabase/rollbacks/20260810130000_ncrm_saida_humana_continuidade_rollback.sql" "$STAGE/down_cont.sql"
cp "$ROOT/tests/crm-nova-era/99j_tests_saida_humana_continuidade.sql" "$STAGE/cont.sql"
cp "$ROOT/supabase/migrations/20260810140000_ncrm_sla_config_rls.sql" "$STAGE/mig_rls_sla.sql"
cp "$ROOT/supabase/rollbacks/20260810140000_ncrm_sla_config_rls_rollback.sql" "$STAGE/down_rls_sla.sql"
cp "$ROOT/tests/crm-nova-era/99k_tests_sla_config_rls.sql" "$STAGE/rls_sla.sql"
cp "$ROOT/supabase/migrations/20260810150000_funil_2_isolado.sql" "$STAGE/mig_f2.sql"
cp "$ROOT/supabase/rollbacks/20260810150000_funil_2_isolado.down.sql" "$STAGE/down_f2.sql"
cp "$ROOT/tests/crm-nova-era/99l_tests_funil2.sql" "$STAGE/f2.sql"
chmod -R a+rX "$STAGE"
MIG="$STAGE/mig.sql"; DOWN="$STAGE/down.sql"; HARNESS="$STAGE/harness.sql"; CORE="$STAGE/core.sql"; CORE2="$STAGE/core2.sql"; CORE3="$STAGE/core3.sql"; CORE4="$STAGE/core4.sql"; MIG_SARA="$STAGE/mig_sara.sql"
MIG_INGEST="$STAGE/mig_ingest.sql"; MIG_PROP="$STAGE/mig_prop.sql"; MIG_VISITA="$STAGE/mig_visita.sql"
DOWN_INGEST="$STAGE/down_ingest.sql"; DOWN_PROP="$STAGE/down_prop.sql"; DOWN_VISITA="$STAGE/down_visita.sql"; INTEG="$STAGE/integ.sql"
MIG_SARA_OBS="$STAGE/mig_sara_obs.sql"; DOWN_SARA_OBS="$STAGE/down_sara_obs.sql"; SARA_OBS="$STAGE/sara_obs.sql"
MIG_ADMIN="$STAGE/mig_admin.sql"; DOWN_ADMIN="$STAGE/down_admin.sql"
MIG_RUNNER="$STAGE/mig_runner.sql"; DOWN_RUNNER="$STAGE/down_runner.sql"
MIG_RETRY="$STAGE/mig_retry.sql"; DOWN_RETRY="$STAGE/down_retry.sql"; RETRY="$STAGE/retry.sql"
MIG_AJUSTES="$STAGE/mig_ajustes.sql"; DOWN_AJUSTES="$STAGE/down_ajustes.sql"; AJUSTES="$STAGE/ajustes.sql"
MIG_F5="$STAGE/mig_f5.sql"; DOWN_F5="$STAGE/down_f5.sql"; F5="$STAGE/f5.sql"
MIG_F6A="$STAGE/mig_f6a.sql"; DOWN_F6A="$STAGE/down_f6a.sql"
MIG_F6B="$STAGE/mig_f6b.sql"; DOWN_F6B="$STAGE/down_f6b.sql"; F6B="$STAGE/f6b.sql"
MIG_F61="$STAGE/mig_f61.sql"; DOWN_F61="$STAGE/down_f61.sql"; F61="$STAGE/f61.sql"
REV="$STAGE/rev.sql"
PRESTUB="$STAGE/prestub.sql"
MIG_EH="$STAGE/mig_eh.sql"; DOWN_EH="$STAGE/down_eh.sql"
MIG_SA="$STAGE/mig_sa.sql"; DOWN_SA="$STAGE/down_sa.sql"; EH="$STAGE/eh.sql"
INFRA="$STAGE/infra.sql"
P41A="$STAGE/p41a.sql"; D41A="$STAGE/d41a.sql"
P41B="$STAGE/p41b.sql"; D41B="$STAGE/d41b.sql"
P41C="$STAGE/p41c.sql"; D41C="$STAGE/d41c.sql"
P41D="$STAGE/p41d.sql"; D41D="$STAGE/d41d.sql"
P41E="$STAGE/p41e.sql"; D41E="$STAGE/d41e.sql"
P41F="$STAGE/p41f.sql"; D41F="$STAGE/d41f.sql"
P42A="$STAGE/p42a.sql"; D42A="$STAGE/d42a.sql"
P42B="$STAGE/p42b.sql"; D42B="$STAGE/d42b.sql"
P42C="$STAGE/p42c.sql"; D42C="$STAGE/d42c.sql"
P42D="$STAGE/p42d.sql"; D42D="$STAGE/d42d.sql"
P42E="$STAGE/p42e.sql"; D42E="$STAGE/d42e.sql"
P42F="$STAGE/p42f.sql"; D42F="$STAGE/d42f.sql"
P42G="$STAGE/p42g.sql"; D42G="$STAGE/d42g.sql"
P42H="$STAGE/p42h.sql"; D42H="$STAGE/d42h.sql"
P42I="$STAGE/p42i.sql"; D42I="$STAGE/d42i.sql"
NOTIF="$STAGE/notif.sql"
SLA="$STAGE/sla.sql"
MIG_RLS_SLA="$STAGE/mig_rls_sla.sql"; DOWN_RLS_SLA="$STAGE/down_rls_sla.sql"; RLS_SLA="$STAGE/rls_sla.sql"
MIG_F2="$STAGE/mig_f2.sql"; DOWN_F2="$STAGE/down_f2.sql"; F2="$STAGE/f2.sql"
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

echo "### testes das CORREÇÕES (fail-closed, imutabilidade, Sara, message_id, novas RPCs, cadência, unique)"
PSQL -f "$CORE2"

echo "### testes do DELTA (cadência calculada pelo banco, última tentativa, contador, timestamps)"
PSQL -f "$CORE3"

echo "### correção auditável da Sara: aplica migration corretiva + testes de decisão humana"
PSQL -f "$MIG_SARA"
PSQL -f "$CORE4"

echo "### integração final: 3 migrations aditivas (ingest/reconciliação, proposta-esteira, visita atômica)"
PSQL -f "$MIG_INGEST"
PSQL -f "$MIG_PROP"
PSQL -f "$MIG_VISITA"

echo "### testes de INTEGRAÇÃO (visita atômica + rollback, proposta atômica + not-venda + rollback, reconciliação)"
PSQL -f "$INTEG"

echo "### Fase 3: Sara modo observador (migration aditiva) + testes"
PSQL -f "$MIG_SARA_OBS"
PSQL -f "$SARA_OBS"
PSQL -f "$MIG_ADMIN"
PSQL -c "SELECT set_config('request.jwt.claims', json_build_object('sub','aaaaaaaa-0000-0000-0000-000000000001','role','authenticated')::text, false); SET ROLE authenticated; SELECT public.test_assert((public.ncrm_admin_status()->>'ok')::boolean, 'Regra 7: ncrm_admin_status responde ok para admin'); RESET ROLE;"

echo "### Fase 4: status do runner observador (fila/retentativa) - migration aditiva"
PSQL -f "$MIG_RUNNER"

echo "### Fase 4: retry do ingest (motor sem negócio) — migration corretiva + testes"
PSQL -f "$MIG_RETRY"
PSQL -f "$RETRY"

echo "### Fase 4: ajuste do registro da Sara (hash curto) + testes"
PSQL -f "$MIG_AJUSTES"
PSQL -f "$AJUSTES"
PSQL -f "$DOWN_AJUSTES"
PSQL -f "$MIG_AJUSTES"

echo "### Fase 5 (PR A): migration + testes (janela, fila, gestao, justificativa) + rollback/reaplicacao"
PSQL -f "$MIG_F5"
PSQL -f "$F5"
PSQL -f "$DOWN_F5"
PSQL -c "SELECT public.test_assert(to_regclass('public.ncrm_cadencia_config') IS NULL AND to_regproc('public.ncrm_fila_trabalho') IS NULL, 'F5 down removeu objetos aditivos');"
PSQL -f "$MIG_F5"

echo "### Fase 6 (PR A + PR B): migrations + testes de treinamento, carteira antiga e saude"
PSQL -f "$MIG_F6A"
PSQL -f "$MIG_F6B"
PSQL -f "$F6B"
echo "### Fase 6.1: ciclo de vida da fila de ingest + testes + rollback/reaplicacao"
PSQL -f "$MIG_F61"
PSQL -f "$F61"

echo "### Hotfix de seguranca: REVOKE de anon nas 5 tabelas ncrm_ (com rollback e reaplicacao)"
PSQL -f "$REV"

echo "### Entrada pela distribuicao + primeira abordagem humana + Sara assist + notificacoes"
PSQL -f "$PRESTUB"
PSQL -f "$MIG_EH"
PSQL -f "$MIG_SA"
PSQL -f "$EH"

echo "### Protecoes de envio (PR 41) + criterio canonico de SLA (PR 42)"
PSQL -f "$INFRA"
PSQL -f "$P41A"
PSQL -f "$P41B"
PSQL -f "$P41C"
PSQL -f "$P41D"
PSQL -f "$P41E"
PSQL -f "$P41F"
PSQL -f "$P42A"
PSQL -f "$P42B"
PSQL -f "$P42C"
PSQL -f "$P42D"
PSQL -f "$P42E"
PSQL -f "$P42F"
PSQL -f "$P42G"
PSQL -f "$P42H"
PSQL -f "$P42I"
PSQL -f "$SLA"
PSQL -f "$NOTIF"

echo "### rollback e reaplicacao das protecoes e do criterio de SLA"
PSQL -f "$D42I"
PSQL -f "$D42H"
PSQL -f "$D42G"
PSQL -f "$D42F"
PSQL -f "$D42E"
PSQL -f "$D42D"
PSQL -f "$D42C"
PSQL -f "$D42B"
PSQL -f "$D42A"
PSQL -f "$D41F"
PSQL -f "$D41E"
PSQL -f "$D41D"
PSQL -f "$D41C"
PSQL -f "$D41B"
PSQL -f "$D41A"
PSQL -f "$P41A"
PSQL -f "$P41B"
PSQL -f "$P41C"
PSQL -f "$P41D"
PSQL -f "$P41E"
PSQL -f "$P41F"
PSQL -f "$P42A"
PSQL -f "$P42B"
PSQL -f "$P42C"
PSQL -f "$P42D"
PSQL -f "$P42E"
PSQL -f "$P42F"
PSQL -f "$P42G"
PSQL -f "$P42H"
PSQL -f "$P42I"
PSQL -f "$SLA"
echo "### rollback e reaplicacao (assist/notificacoes e entrada humana)"
PSQL -f "$DOWN_SA"
PSQL -c "SELECT public.test_assert(to_regclass('public.ncrm_notificacao') IS NULL AND to_regclass('public.ncrm_sara_acao') IS NULL, 'EH down: assist/notificacoes removidos');"
PSQL -c "SELECT public.test_assert((SELECT modo FROM public.ncrm_sara_config WHERE id) IN ('observer','suggest','off'), 'EH down: Sara volta para observer');"
PSQL -f "$DOWN_EH"
PSQL -c "SELECT public.test_assert(to_regclass('public.ncrm_entrada_config') IS NULL AND to_regproc('public.ncrm_registrar_primeira_humana') IS NULL, 'EH down: entrada humana removida');"
PSQL -c "SELECT public.test_assert((SELECT count(*) FROM public.ncrm_estado) > 0 AND (SELECT count(*) FROM public.ncrm_evento) > 0, 'EH down: nenhum atendimento ou evento apagado');"
PSQL -f "$MIG_EH"
PSQL -f "$MIG_SA"
PSQL -c "SELECT public.test_assert(to_regproc('public.ncrm_notificacoes') IS NOT NULL AND to_regclass('public.ncrm_entrada_config') IS NOT NULL, 'EH migrations reaplicadas');"
PSQL -f "$DOWN_F61"
PSQL -c "SELECT public.test_assert(to_regclass('public.ncrm_ingest_lifecycle_config') IS NULL
         AND to_regproc('public.ncrm_ingest_classificar_backlog') IS NULL
         AND to_regproc('public.ncrm_ingest_fila_resumo') IS NULL, 'F61 down: objetos novos removidos');"
PSQL -c "SELECT public.test_assert(to_regclass('public.ncrm_ingest_checkpoint') IS NOT NULL
         AND (SELECT count(*) FROM public.ncrm_ingest_checkpoint) > 0
         AND to_regproc('ncrm_private.reconciliar_mensagens') IS NOT NULL,
         'F61 down: fila preservada e reconciliacao anterior restaurada');"
PSQL -f "$MIG_F61"
PSQL -c "SELECT public.test_assert(to_regproc('public.ncrm_ingest_fila_resumo') IS NOT NULL, 'F61 migration reaplicada apos rollback');"

echo "### Fase 6 PR B: rollback versionado remove SO os objetos novos e reaplica"
PSQL -f "$DOWN_F6B"
PSQL -c "SELECT public.test_assert(to_regclass('public.ncrm_treinamento') IS NULL AND to_regclass('public.ncrm_migracao_item') IS NULL
         AND to_regclass('public.ncrm_migracao_analise') IS NULL AND to_regclass('public.ncrm_saude_acao_audit') IS NULL
         AND to_regproc('public.ncrm_migracao_preview') IS NULL AND to_regproc('public.ncrm_saude') IS NULL,
         'F6B down: objetos novos removidos');"
PSQL -c "SELECT public.test_assert(to_regclass('public.ncrm_estado') IS NOT NULL AND to_regclass('public.negocios') IS NOT NULL
         AND to_regclass('public.ncrm_piloto') IS NOT NULL AND to_regclass('public.vendas') IS NOT NULL,
         'F6B down: nada do legado nem das fases anteriores foi removido');"
PSQL -f "$MIG_F6B"
PSQL -c "SELECT public.test_assert(to_regproc('public.ncrm_migracao_preview') IS NOT NULL AND to_regproc('public.ncrm_saude') IS NOT NULL,
         'F6B migration reaplicada apos rollback');"
PSQL -f "$DOWN_F61"
PSQL -f "$DOWN_F6B"
PSQL -f "$DOWN_F6A"

PSQL -f "$DOWN_RETRY"
PSQL -c "SELECT public.test_assert(to_regproc('ncrm_private.reconciliar_mensagens') IS NOT NULL, 'down retry preservou a função de reconciliação (comportamento original)');"
PSQL -f "$MIG_RETRY"

echo "### #29 rollback remove só objetos ncrm_* (downs aditivos ANTES do down principal)"
# As funcoes do criterio canonico vivem em ncrm_private e precisam sair antes
# do down principal, senao o DROP SCHEMA encontra dependentes e falha.
PSQL -f "$D42I"
PSQL -f "$D42H"
PSQL -f "$D42G"
PSQL -f "$D42F"
PSQL -f "$D42E"
PSQL -f "$D42D"
PSQL -f "$D42C"
PSQL -f "$D42B"
PSQL -f "$D42A"
PSQL -f "$D41F"
PSQL -f "$D41E"
PSQL -f "$D41D"
PSQL -f "$D41C"
PSQL -f "$D41B"
PSQL -f "$D41A"
PSQL -f "$DOWN_F5"
PSQL -f "$DOWN_ADMIN"
PSQL -f "$DOWN_RUNNER"
# Os objetos novos (ncrm_sara_acao, ncrm_notificacao) dependem de ncrm_sara_analise.
# Os rollbacks precisam correr na ordem inversa da aplicacao: primeiro os novos.
PSQL -f "$DOWN_SA"
PSQL -f "$DOWN_EH"
PSQL -f "$DOWN_SARA_OBS"
PSQL -c "SELECT public.test_assert(to_regclass('public.ncrm_sara_config') IS NULL AND to_regclass('public.ncrm_sara_analise') IS NULL AND to_regproc('public.ncrm_sara_definir_modo') IS NULL, '#29 down Sara observer: objetos removidos');"
PSQL -f "$DOWN_VISITA"
PSQL -f "$DOWN_PROP"
PSQL -f "$DOWN_INGEST"
PSQL -c "SELECT public.test_assert(to_regclass('public.ncrm_ingest_checkpoint') IS NULL
         AND to_regproc('public.ncrm_registrar_proposta_esteira') IS NULL
         AND to_regproc('public.ncrm_agendar_visita_e_encaminhar') IS NULL, '#29 downs aditivos: objetos de integração removidos');"
PSQL -c "SELECT public.test_assert(NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='ncrm_proposta' AND column_name='venda_solicitacao_id'), '#29 coluna venda_solicitacao_id removida');"
PSQL -f "$DOWN"
PSQL -c "SELECT public.test_assert(to_regclass('public.ncrm_estado') IS NULL AND to_regclass('public.ncrm_evento') IS NULL
         AND to_regclass('public.ncrm_proposta') IS NULL AND to_regclass('public.ncrm_workflow_config') IS NULL
         AND to_regnamespace('ncrm_private') IS NULL, '#29 rollback: objetos ncrm_* removidos');"
PSQL -c "SELECT public.test_assert(to_regclass('public.negocios') IS NOT NULL AND to_regclass('public.vendas') IS NOT NULL
         AND to_regclass('public.leads') IS NOT NULL, '#29 rollback preservou objetos legados');"

echo "### #30 migration sobe novamente após rollback (core + 3 aditivas)"
PSQL -f "$MIG"
PSQL -f "$MIG_INGEST"
PSQL -f "$MIG_PROP"
PSQL -f "$MIG_VISITA"
PSQL -f "$MIG_SARA_OBS"
PSQL -f "$MIG_ADMIN"
PSQL -f "$MIG_RUNNER"
PSQL -f "$MIG_F5"
PSQL -c "SELECT public.test_assert(to_regclass('public.ncrm_estado') IS NOT NULL AND to_regnamespace('ncrm_private') IS NOT NULL
         AND to_regclass('public.ncrm_ingest_checkpoint') IS NOT NULL
         AND to_regproc('public.ncrm_registrar_proposta_esteira') IS NOT NULL
         AND to_regproc('public.ncrm_agendar_visita_e_encaminhar') IS NOT NULL
         AND to_regclass('public.ncrm_sara_config') IS NOT NULL
         AND to_regproc('public.ncrm_sara_registrar_analise') IS NOT NULL, '#30 migration (core + integração + Sara observer) reaplicada com sucesso');"

# Recompõe também o caminho operacional real que existe em produção. Sem este
# bloco, a segunda metade do harness testava a operação v4 sem entrada humana,
# reconhecedor D-API e reconciliador atual — um estado que nunca existe no ERP.
PSQL -f "$MIG_F61"
PSQL -f "$MIG_EH"
PSQL -f "$MIG_SA"
PSQL -f "$P42A"
PSQL -f "$P42B"
PSQL -f "$P42C"
PSQL -f "$P42D"
PSQL -f "$P42E"
PSQL -f "$P42F"

echo "### baseline de vendas (nunca deve mudar por proposta) ==> confirmação final"
PSQL -c "SELECT 'vendas_total='||count(*) FROM public.vendas;"

echo "### pos-visita: resultado da visita, descarte com dez motivos, origem da proxima acao"
PSQL -f "$STAGE/mig_pv.sql"
PSQL -f "$STAGE/mig_pv_rpc.sql"
PSQL -f "$STAGE/pv.sql"

echo "### pos-visita: rollback limpa tudo e a migration sobe de novo"
PSQL -f "$STAGE/down_pv.sql"
PSQL -c "SELECT public.test_assert(to_regproc('public.ncrm_registrar_resultado_visita') IS NULL
         AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public'
                          AND table_name='visitas' AND column_name='resultado'),
         '#pv16 rollback removeu resultado da visita e a RPC');"
PSQL -f "$STAGE/mig_pv.sql"
PSQL -f "$STAGE/mig_pv_rpc.sql"
PSQL -c "SELECT public.test_assert(to_regproc('public.ncrm_registrar_resultado_visita') IS NOT NULL,
         '#pv17 migration do pos-visita reaplicada com sucesso');"

echo "### analise da Sara pedida pelo corretor: RPC autenticada e origem 'usuario'"
PSQL -f "$STAGE/mig_su.sql"
PSQL -f "$STAGE/su.sql"

echo "### analise do corretor: rollback devolve o CHECK do motor e a migration sobe de novo"
PSQL -f "$STAGE/down_su.sql"
PSQL -c "SELECT public.test_assert(to_regproc('public.ncrm_sara_analise_usuario') IS NULL
         AND (SELECT pg_get_constraintdef(oid) FROM pg_constraint WHERE conname='ncrm_sara_analise_origem_check')
             NOT LIKE '%usuario%',
         '#su8 rollback removeu a RPC e refechou a origem');"
PSQL -f "$STAGE/mig_su.sql"
PSQL -c "SELECT public.test_assert(to_regproc('public.ncrm_sara_analise_usuario') IS NOT NULL,
         '#su9 migration da analise do corretor reaplicada com sucesso');"

echo "### elegiveis com prioridade de novidade + manual operacional"
PSQL -f "$STAGE/mig_em.sql"
PSQL -f "$STAGE/em.sql"
PSQL -f "$STAGE/down_em.sql"
PSQL -c "SELECT public.test_assert(to_regclass('public.ncrm_manual_operacional') IS NULL, '#em8 rollback removeu o manual');"
PSQL -f "$STAGE/mig_em.sql"
PSQL -c "SELECT public.test_assert(to_regproc('public.ncrm_manual_salvar') IS NOT NULL, '#em9 migration reaplicada');"

echo "### programa comercial da cadencia: workflow v2, janela seg-sex, reativacao e SLA"
PSQL -f "$STAGE/mig_cp.sql"
PSQL -f "$STAGE/cp.sql"
PSQL -f "$STAGE/down_cp.sql"
PSQL -c "SELECT public.test_assert(NOT EXISTS (SELECT 1 FROM public.ncrm_workflow_config WHERE versao=2 AND status='publicada')
         AND to_regproc('ncrm_private.sla_redistribuir') IS NULL
         AND EXISTS (SELECT 1 FROM public.ncrm_workflow_config WHERE status='publicada' AND max_tentativas=4),
         '#cp9 rollback: v2 encerrada, regra anterior de volta, automacoes removidas');"
PSQL -f "$STAGE/mig_cp.sql"
PSQL -c "SELECT public.test_assert(EXISTS (SELECT 1 FROM public.ncrm_workflow_config WHERE versao=2),
         '#cp10 migration do programa reaplicada');"

echo "### operação padronizada v3: catálogo, SLAs e cadência D1/D2/D4/D6/D7"
PSQL -f "$STAGE/mig_op3.sql"
PSQL -f "$STAGE/op3.sql"

echo "### motor operacional: quatro momentos, dez ações e Meu Dia canônico"
PSQL -f "$STAGE/mig_motor_dia.sql"
PSQL -f "$STAGE/motor_dia.sql"

echo "### operação v4: quatro etapas, dez momentos, roleta e visitas paralelas"
PSQL -f "$STAGE/pre_v4.sql"
PSQL -f "$STAGE/mig_v4.sql"
PSQL -f "$STAGE/v4.sql"
PSQL -f "$STAGE/down_v4.sql"
PSQL -c "SELECT public.test_assert((SELECT count(*) FROM public.ncrm_momento_padrao WHERE ativo)=4
  AND NOT EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='ncrm_estado' AND column_name='momento_codigo'),
  '#v4-17 rollback restaura os quatro momentos anteriores');"
PSQL -f "$STAGE/mig_v4.sql"
PSQL -c "SELECT public.test_assert((SELECT count(*) FROM public.ncrm_momento_padrao WHERE ativo)=10,
  '#v4-18 migration reaplica depois do rollback');"

echo "### continuidade: toda saida humana real atualiza estado e reacorda a Sara"
PSQL -f "$STAGE/mig_cont.sql"
PSQL -f "$STAGE/cont.sql"
PSQL -f "$STAGE/down_cont.sql"
PSQL -c "SELECT public.test_assert(position('registrar_saida_humana_continuidade' in
  pg_get_functiondef('public.ncrm_registrar_primeira_humana(bigint,text,timestamptz)'::regprocedure))=0,
  '#cont10 rollback restaura a funcao anterior');"
PSQL -f "$STAGE/mig_cont.sql"
PSQL -c "SELECT public.test_assert(position('registrar_saida_humana_continuidade' in
  pg_get_functiondef('public.ncrm_registrar_primeira_humana(bigint,text,timestamptz)'::regprocedure))>0,
  '#cont11 migration reaplica depois do rollback');"

echo "### RLS da configuração de redistribuição por SLA"
PSQL -f "$MIG_RLS_SLA"
PSQL -f "$RLS_SLA"
PSQL -f "$DOWN_RLS_SLA"
PSQL -c "SELECT public.test_assert(NOT (SELECT relrowsecurity
  FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
  WHERE n.nspname='public' AND c.relname='ncrm_sla_redistribuicao_config'),
  '#rls6 rollback restaura o estado anterior');"
PSQL -f "$MIG_RLS_SLA"
PSQL -c "SELECT public.test_assert((SELECT relrowsecurity
  FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
  WHERE n.nspname='public' AND c.relname='ncrm_sla_redistribuicao_config'),
  '#rls7 migration reaplica depois do rollback');"

echo "### Funil 2.0 isolado: duas cópias, RLS, limite, ações e rollback"
PSQL -f "$MIG_F2"
PSQL -f "$F2"
PSQL -f "$DOWN_F2"
PSQL -c "SELECT public.test_assert(to_regclass('public.f2_lead') IS NULL
  AND to_regproc('public.f2_importar_negocio') IS NULL,
  '#f2-13 rollback remove somente o laboratório');"
PSQL -c "SELECT public.test_assert(to_regclass('public.ncrm_estado') IS NOT NULL
  AND to_regclass('public.negocios') IS NOT NULL,
  '#f2-14 rollback preserva CRM e legado');"
PSQL -f "$MIG_F2"
PSQL -c "SELECT public.test_assert((SELECT count(*) FROM public.f2_momento_config)=10,
  '#f2-15 migration reaplica limpa depois do rollback');"

echo "### teardown"
sudo -u pg "$PGBIN/pg_ctl" -D "$PGDATA" stop >/dev/null 2>&1 || true
echo "OK_LOCAL_RUN_COMPLETE"
