import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import test from "node:test";

function read(path) {
  return readFileSync(new URL(path, import.meta.url), "utf8");
}

function md5(value) {
  return createHash("md5").update(value).digest("hex");
}

const realtime = read("../supabase/migrations/20260829042905_sara_tempo_real_eficiente.sql");
const budget = read("../supabase/migrations/20260829043401_sara_orcamento_a_partir_da_ativacao.sql");
const checkpointEvidence = read("../supabase/migrations/20260901183229_sara_checkpoint_preservado_sem_evidencia_nova.sql");
const checkpointStage = read("../supabase/migrations/20260901183732_sara_checkpoint_preservado_etapa_protegida.sql");

test("fontes recuperadas correspondem ao SQL registrado em produção", () => {
  assert.equal(md5(realtime), "4cb009e86766025254472b47310ebb5e");
  assert.equal(md5(budget), "9ec0fab8eb8fc3fc6acaae460054cf5b");
  assert.equal(md5(checkpointEvidence.replace(/\n$/, "")), "3fd8113ac2545c489276a70a5bdad14c");
  assert.equal(md5(checkpointStage.replace(/\n$/, "")), "38cb2431533cd64093261cfb399112f6");
});

test("cada mensagem fica auditada, mas a Sara espera a rajada terminar", () => {
  assert.match(realtime, /create table private\.sara_evento_mensagem/);
  assert.match(realtime, /unique \(funil_lead_id,mensagem_id\)/);
  assert.match(realtime, /motor_fila_sara_batch_pendente_uniq/);
  assert.match(realtime, /quiet_window_seconds between 1 and 15/);
  assert.match(realtime, /max_batch_wait_seconds between 5 and 30/);
  assert.match(realtime, /clock_timestamp\(\)\+make_interval\(secs=>v_silencio\)/);
  assert.match(realtime, /due_at=least\([\s\S]*v_primeira\+make_interval\(secs=>v_maximo\)[\s\S]*clock_timestamp\(\)\+make_interval\(secs=>v_silencio\)/);
  assert.match(realtime, /'__sara_message_ids'.*jsonb_build_array\(p_mensagem_id::text\)/s);
});

test("economia de IA é explícita e possui teto auditável", () => {
  assert.match(realtime, /modelo='gpt-5\.6-luna'/);
  assert.match(realtime, /'max_tokens',900/);
  assert.match(realtime, /'reasoning_effort','low'/);
  assert.match(realtime, /monthly_budget_usd numeric\(10,2\) not null default 30/);
  assert.match(realtime, /daily_budget_usd numeric\(10,2\) not null default 1\.50/);
  assert.match(budget, /budget_started_at timestamptz not null/);
  assert.match(budget, /e\.criado_em>=v_inicio_mes/);
});

test("mensagem do corretor renova checkpoint sem fabricar nova evidência", () => {
  assert.match(checkpointEvidence, /p_origem='deterministica'/);
  assert.match(checkpointEvidence, /p_momento_codigo=v_lead\.momento_codigo/);
  assert.match(checkpointEvidence, /p_temperatura is not distinct from v_lead\.temperatura/);
  assert.match(checkpointStage, /v_m\.etapa=v_lead\.etapa/);
  assert.match(checkpointStage, /v_m\.etapa=v_f\.etapa/);
  assert.match(checkpointStage, /v_a\.temperatura_sugerida is not distinct from v_f\.temperatura/);
});
