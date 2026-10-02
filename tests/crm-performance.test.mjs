import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const route = readFileSync(new URL("../app/api/funil2/route.ts", import.meta.url), "utf8");
const mobile = readFileSync(new URL("../app/features/funil-2/Funil2Mobile.tsx", import.meta.url), "utf8");
const desktop = readFileSync(new URL("../app/features/funil-2/Funil2Workspace.tsx", import.meta.url), "utf8");
const migration = readFileSync(new URL("../supabase/migrations/20261002200000_crm_carga_inicial_performance.sql", import.meta.url), "utf8");

test("carga inicial não conta todo o laboratório da Sara", () => {
  assert.doesNotMatch(route, /from\("f2_sara_analise"\)\.select\("id", \{ count: "exact", head: true \}\)/);
  assert.match(route, /analisesNoLaboratorio: \(leads \?\? \[\]\)\.filter/);
});

test("consultas independentes de lotes são executadas em paralelo", () => {
  assert.match(route, /function lotesDe/);
  assert.match(route, /Promise\.all\(lotesDe\(negociosIds, 500\)/);
  assert.match(route, /Promise\.all\(lotesDe\(leadsOriginaisIds, 500\)/);
});

test("resolução da instância preserva a última mensagem sem varrer todas por lead", () => {
  assert.match(migration, /join lateral[\s\S]*order by m\.criado_em desc[\s\S]*limit 1/i);
  assert.match(migration, /distinct on \(c\.funil_lead_id\)/i);
  assert.doesNotMatch(migration, /join public\.wa_mensagens m on m\.conversa_id = cv\.id\s+left join/s);
});

test("aplicativo não recarrega a carteira pesada a cada 45 segundos", () => {
  assert.doesNotMatch(mobile, /setInterval\(recarregar, 45_000\)/);
  assert.match(mobile, /document\.visibilityState === "visible"/);
  assert.match(mobile, /300_000/);
});

test("desktop e aplicativo encerram carga travada com mensagem recuperável", () => {
  assert.match(desktop, /AbortSignal\.timeout\(25_000\)/);
  assert.match(mobile, /AbortSignal\.timeout\(25_000\)/);
});
