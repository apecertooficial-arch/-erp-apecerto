import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync(new URL("../supabase/migrations/20260820175550_presenca_deterministica_fail_closed.sql", import.meta.url), "utf8");
const cutover = readFileSync(new URL("../supabase/migrations/20260820180208_presenca_fechar_fluxos_legados.sql", import.meta.url), "utf8");
const edge = readFileSync(new URL("../supabase/functions/presenca/index.ts", import.meta.url), "utf8");
const supabaseConfig = readFileSync(new URL("../supabase/config.toml", import.meta.url), "utf8");
const heartbeat = readFileSync(new URL("../app/features/presence/PresenceHeartbeat.tsx", import.meta.url), "utf8");
const route = readFileSync(new URL("../app/api/presenca/route.ts", import.meta.url), "utf8");

const eligibility = migration.match(/CREATE OR REPLACE FUNCTION public\.ncrm_corretor_elegibilidade[\s\S]*?\n\$fn\$;/)?.[0] ?? "";
const cleanup = migration.match(/CREATE OR REPLACE FUNCTION public\.presenca_derrubar_expirados[\s\S]*?\n\$fn\$;/)?.[0] ?? "";

test("elegibilidade exige presença atual e nunca usa comparecimento histórico", () => {
  assert.match(eligibility, /c\.no_escritorio/);
  assert.match(eligibility, /c\.ultima_presenca > p_agora-make_interval/);
  assert.match(eligibility, /presenca_expirada/);
  assert.doesNotMatch(eligibility, /corretor_presencas|compareceu|c\.online,false\) THEN apto/);
});

test("cron de limpeza usa o timestamp real sem depender de estado de prompt", () => {
  assert.match(cleanup, /ultima_presenca <= now\(\)-make_interval/);
  assert.match(cleanup, /online=false/);
  assert.match(cleanup, /no_escritorio=false/);
  assert.doesNotMatch(cleanup, /presenca_estado|aguardando_desde|prazo_em/);
});

test("crons que inferiam presença são removidos e o cleanup não decide elegibilidade", () => {
  assert.match(migration, /cron\.unschedule\(v_job\)/);
  assert.match(migration, /jobname='escritorio-ip-autoaprender'/);
  assert.match(migration, /jobname='presenca_registrar_dia'/);
  assert.match(migration, /jobname='presenca_derrubar_expirados'/);
});

test("confirmação valida sessão e IP na borda antes de usar service role", () => {
  assert.match(edge, /\/auth\/v1\/user/);
  assert.match(edge, /presenca_registrar_segura/);
  assert.match(edge, /OUTSIDE_OFFICE/);
  assert.doesNotMatch(edge, /atob\(|split\("\."\)|payload\.sub/);
  assert.match(heartbeat, /\/functions\/v1\/presenca/);
  assert.match(heartbeat, /data\.no_escritorio !== true/);
  assert.match(heartbeat, /setNaRedeDoEscritorio\(estaNaRede\)/);
  assert.match(heartbeat, /if \(!estaNaRede\)[\s\S]*setPrompt\(false\)[\s\S]*sairDaFila/);
  assert.doesNotMatch(route, /rpc\("presenca_confirmar"/);
  assert.match(supabaseConfig, /\[functions\.presenca\][\s\S]*verify_jwt = true/);
});

test("RPCs que aceitavam presença fornecida pelo cliente ficam fechados", () => {
  assert.match(cutover, /REVOKE ALL ON FUNCTION public\.presenca_confirmar\(boolean,text\)/);
  assert.match(cutover, /REVOKE ALL ON FUNCTION public\.registrar_presenca\(uuid,boolean\)/);
  assert.match(cutover, /TO service_role/);
  assert.match(migration, /presenca_ip_confere/);
  assert.match(route, /rpc\("presenca_ip_confere"/);
});
