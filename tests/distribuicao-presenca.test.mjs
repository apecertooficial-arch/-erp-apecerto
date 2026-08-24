import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";

const shell = readFileSync(new URL("../app/features/system/ErpShell.tsx", import.meta.url), "utf8");
const layout = readFileSync(new URL("../app/(erp)/layout.tsx", import.meta.url), "utf8");
const globalPresence = readFileSync(new URL("../app/components/PresencaGlobal.tsx", import.meta.url), "utf8");
const heartbeat = readFileSync(new URL("../app/features/presence/PresenceHeartbeat.tsx", import.meta.url), "utf8");
const migration = readFileSync(new URL("../supabase/migrations/20260812030000_ncrm_roleta_igualitaria_e_presenca.sql", import.meta.url), "utf8");
const fridayNightRelease = readFileSync(
  new URL("../supabase/migrations/20260822030000_liberar_operacao_sexta_noite.sql", import.meta.url),
  "utf8",
);

test("confirmação de presença é global, exclusiva do corretor e usa 15 minutos", () => {
  assert.match(layout, /<PresencaGlobal/);
  assert.match(globalPresence, /profile\?\.brokerId == null/);
  assert.match(globalPresence, /<PresenceHeartbeat/);
  assert.doesNotMatch(shell, /<PresenceHeartbeat/);
  assert.match(heartbeat, /Você ainda está conectado\?/);
  assert.match(heartbeat, /window\.setInterval\(poll, 20000\)/);
  assert.match(migration, /ativa=true[\s\S]*intervalo_min=15/);
});

test("fora do IP o ERP permanece acessível e somente a fila de leads é pausada", () => {
  assert.match(heartbeat, /if \(!estaNaRede\)[\s\S]*setPrompt\(false\)[\s\S]*sairDaFila/);
  assert.match(heartbeat, /Acesso externo liberado/);
  assert.match(heartbeat, /usar agenda e sistema normalmente/);
  assert.doesNotMatch(heartbeat, /const ehCelular/);
});

test("API geral do CRM foi aposentada; criação ocorre somente no Funil 2", () => {
  assert.equal(existsSync(new URL("../app/api/crm/route.ts", import.meta.url)), false);
});

test("roleta é igualitária e mantém as travas operacionais", () => {
  assert.match(migration, /NCRM_IGUALITARIA_V1/);
  assert.match(migration, /to_jsonb\(1\)/);
  assert.match(migration, /ultimo_recebimento_em ASC NULLS FIRST/);
  assert.match(migration, /public\.corretor_pode_receber\(p\.id\)/);
  assert.match(migration, /public\.instancia_saudavel\(p\.id\)/);
  assert.match(migration, /pg_advisory_xact_lock/);
  assert.doesNotMatch(migration, /ORDER BY[^;]*\/[^;]*peso/is);
});

test("lead sem corretor apto fica em retry e a fila histórica permanece pausada", () => {
  assert.match(migration, /ncrm_distribuicao_novo_pendente/);
  assert.match(migration, /nenhum_corretor_apto/);
  assert.match(migration, /ncrm-roleta-igualitaria-novos/);
  assert.match(migration, /fila_historica_pausada/);
  assert.match(migration, /q\.status='pendente'/);
  assert.match(migration, /recuperado_apos_correcao_da_roleta/);
  assert.match(migration, /n\.criado_em>=now\(\)-interval '3 hours'/);
  assert.match(migration, /lower\(COALESCE\(l\.origem,''\)\)='manual'/);
});

test("operação externa começa na sexta à noite sem ignorar D-API ou suspensão", () => {
  assert.match(fridayNightRelease, /extract\(isodow from v_local\)=5/);
  assert.match(fridayNightRelease, /v_local::time>=time '18:00'/);
  assert.match(fridayNightRelease, /i\.status_dapi='connected'/);
  assert.match(fridayNightRelease, /if suspenso_ate is not null then/);
  assert.match(fridayNightRelease, /feedback_visita_exigido',false/);
  assert.match(fridayNightRelease, /values\('abordagem_automatica',true,now\(\)\)/);
  assert.match(fridayNightRelease, /REPROCESSAMENTO_AUTORIZADO_OPERACAO_LIBERADA/);
});
