import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  createDispatcher,
  environment,
  nextBackoff,
} from "../workers/automations-dispatcher/runtime.mjs";

const infrastructureMigration = readFileSync(
  new URL(
    "../supabase/migrations/20260828214500_central_dispatcher_persistente.sql",
    import.meta.url,
  ),
  "utf8",
);
const cutoverMigration = readFileSync(
  new URL(
    "../supabase/migrations/20260828215000_central_dispatcher_cutover_worker.sql",
    import.meta.url,
  ),
  "utf8",
);
const saraMigration = readFileSync(
  new URL(
    "../supabase/migrations/20260828203000_central_sara_evento_unico.sql",
    import.meta.url,
  ),
  "utf8",
);
const runtimeSource = readFileSync(
  new URL("../workers/automations-dispatcher/runtime.mjs", import.meta.url),
  "utf8",
);
const workerEntry = readFileSync(
  new URL("../workers/automations-dispatcher/index.mjs", import.meta.url),
  "utf8",
);
const activeRenderBlueprint = readFileSync(
  new URL("../render.yaml", import.meta.url),
  "utf8",
);
const workerBlueprint = readFileSync(
  new URL("../workers/automations-dispatcher/render.worker.example.yaml", import.meta.url),
  "utf8",
);

function fakeDb(sequence = {}) {
  const calls = [];
  const queues = new Map(
    Object.entries(sequence).map(([name, values]) => [name, [...values]]),
  );
  return {
    calls,
    async rpc(name, args) {
      calls.push({ name, args });
      const queue = queues.get(name) ?? [];
      const response = queue.shift() ?? { data: null, error: null };
      queues.set(name, queue);
      return response;
    },
  };
}

test("configuracao exige somente segredo de backend e limites seguros", () => {
  assert.throws(() => environment({}), /SUPABASE_URL/);
  assert.throws(() => environment({ SUPABASE_URL: "https:\/\/example.supabase.co" }), /SUPABASE_SERVICE_ROLE_KEY/);
  const config = environment({
    SUPABASE_URL: "https://example.supabase.co",
    SUPABASE_SERVICE_ROLE_KEY: "secret-value",
    AUTOMATIONS_DISPATCHER_WORKER_ID: "worker-a",
    AUTOMATIONS_DISPATCHER_POLL_MS: "20",
    AUTOMATIONS_DISPATCHER_LEASE_SECONDS: "5",
  });
  assert.equal(config.pollMs, 100);
  assert.equal(config.leaseSeconds, 30);
  assert.equal(config.workerId, "worker-a");
  assert.ok(!JSON.stringify(config.public).includes("secret-value"));
});

test("worker em shadow envia heartbeat mas nao reivindica item", async () => {
  const db = fakeDb({
    motor_dispatcher_heartbeat: [{ data: { modo: "shadow", saudavel: true }, error: null }],
  });
  const worker = createDispatcher({
    db,
    config: { workerId: "shadow-a", leaseSeconds: 90, heartbeatMs: 10_000 },
    sleep: async () => undefined,
    log: () => undefined,
  });
  const result = await worker.tick();
  assert.equal(result.mode, "shadow");
  assert.deepEqual(db.calls.map(({ name }) => name), ["motor_dispatcher_heartbeat"]);
});

test("item imediato e processado pelo token de lease e item futuro nao e varrido", async () => {
  const db = fakeDb({
    motor_dispatcher_heartbeat: [
      { data: { modo: "worker", saudavel: true }, error: null },
      { data: { modo: "worker", saudavel: true }, error: null },
    ],
    motor_dispatcher_claim: [
      { data: { id: 42, lease_token: "lease-42", due_at: "2026-08-28T12:00:00Z" }, error: null },
      { data: null, error: null },
    ],
    motor_dispatcher_processar: [
      { data: { ok: true, status: "ok", fila_id: 42 }, error: null },
    ],
  });
  const worker = createDispatcher({
    db,
    config: { workerId: "worker-a", leaseSeconds: 90, heartbeatMs: 10_000 },
    sleep: async () => undefined,
    log: () => undefined,
  });
  assert.equal((await worker.tick()).processed, 1);
  assert.equal((await worker.tick()).processed, 0);
  const claim = db.calls.find(({ name }) => name === "motor_dispatcher_claim");
  assert.deepEqual(claim.args, { p_worker_id: "worker-a", p_lease_seconds: 90 });
  const process = db.calls.find(({ name }) => name === "motor_dispatcher_processar");
  assert.equal(process.args.p_fila_id, 42);
  assert.equal(process.args.p_lease_token, "lease-42");
});

test("duas replicas concorrentes recebem no maximo uma claim", async () => {
  let claimed = false;
  let processed = 0;
  const calls = [];
  const db = {
    calls,
    async rpc(name, args) {
      calls.push({ name, args });
      if (name === "motor_dispatcher_heartbeat") {
        return { data: { modo: "worker", saudavel: true }, error: null };
      }
      if (name === "motor_dispatcher_claim") {
        if (claimed) return { data: null, error: null };
        claimed = true;
        return { data: { id: 91, lease_token: "one-lease" }, error: null };
      }
      if (name === "motor_dispatcher_processar") {
        processed += 1;
        return { data: { ok: true, status: "ok", fila_id: 91 }, error: null };
      }
      return { data: true, error: null };
    },
  };
  const base = {
    db,
    config: { leaseSeconds: 90, heartbeatMs: 10_000 },
    sleep: async () => undefined,
    log: () => undefined,
  };
  const workerA = createDispatcher({ ...base, config: { ...base.config, workerId: "worker-a" } });
  const workerB = createDispatcher({ ...base, config: { ...base.config, workerId: "worker-b" } });
  const results = await Promise.all([workerA.tick(), workerB.tick()]);
  assert.equal(results.reduce((sum, result) => sum + result.processed, 0), 1);
  assert.equal(processed, 1);
});

test("falha transitoria do transporte aplica backoff limitado sem logar segredo", () => {
  assert.deepEqual([0, 1, 2, 8, 99].map(nextBackoff), [250, 500, 1_000, 30_000, 30_000]);
});

test("shutdown gracioso para novas claims e devolve o modo ao cron", async () => {
  const db = fakeDb({
    motor_dispatcher_parar: [{ data: { ok: true, modo: "cron" }, error: null }],
  });
  const controller = new AbortController();
  controller.abort();
  const worker = createDispatcher({
    db,
    config: {
      workerId: "worker-stop",
      leaseSeconds: 90,
      heartbeatMs: 10_000,
      pollMs: 750,
      public: {},
    },
    sleep: async () => undefined,
    log: () => undefined,
  });
  assert.deepEqual(await worker.run({ signal: controller.signal }), { ok: true, stopped: true });
  assert.deepEqual(db.calls.map(({ name }) => name), ["motor_dispatcher_parar"]);
});

test("lease e heartbeat sao renovados durante processamento longo", () => {
  assert.match(runtimeSource, /motor_dispatcher_renovar_lease/);
  assert.match(runtimeSource, /heartbeat\(true\)/);
  assert.match(runtimeSource, /clearInterval\(renewal\)/);
  assert.match(workerEntry, /SIGINT/);
  assert.match(workerEntry, /SIGTERM/);
  assert.match(workerEntry, /AbortController/);
});

test("servico web ativo nao recebe service role e blueprint do worker fica inerte", () => {
  assert.doesNotMatch(activeRenderBlueprint, /SUPABASE_SERVICE_ROLE_KEY/);
  assert.doesNotMatch(activeRenderBlueprint, /automations-dispatcher/);
  assert.match(workerBlueprint, /type: worker/);
  assert.match(workerBlueprint, /SUPABASE_SERVICE_ROLE_KEY/);
  assert.match(workerBlueprint, /numInstances: 1/);
  assert.match(workerBlueprint, /Nao e consumido pelo render\.yaml raiz/);
});

test("SQL reivindica somente due_at vencido, usa SKIP LOCKED e recupera lease expirado", () => {
  assert.match(infrastructureMigration, /status='pendente'\s+and due_at<=clock_timestamp\(\)/);
  assert.match(infrastructureMigration, /for update skip locked/);
  assert.match(infrastructureMigration, /lease_ate<clock_timestamp\(\)/);
  assert.match(infrastructureMigration, /motor_dispatcher_recuperar_leases\(20\)/);
  assert.match(infrastructureMigration, /lease_token=gen_random_uuid\(\)/);
  assert.match(infrastructureMigration, /worker_id=p_worker_id/);
  assert.match(infrastructureMigration, /tentativas=tentativas\+1/);
  assert.match(infrastructureMigration, /AUTOMATION_RETRY:/);
  assert.match(infrastructureMigration, /make_interval\(secs=>v_delay\)/);
  assert.match(infrastructureMigration, /mod\(r\.tentativas,30\)=0/);
});

test("concorrencia e idempotencia permanecem no banco", () => {
  assert.match(infrastructureMigration, /pg_try_advisory_xact_lock/);
  assert.match(infrastructureMigration, /lease_token=p_lease_token/);
  assert.match(infrastructureMigration, /status='processando'/);
  assert.match(infrastructureMigration, /LEASE_LOST/);
  assert.match(saraMigration, /motor_fila_sara_checkpoint_ativo_uniq/);
  assert.match(saraMigration, /motor_fila_sara_checkpoint_evento_uniq/);
});

test("mensagem concorrente e checkpoint substituido nao sao coalescidos pelo worker", () => {
  assert.doesNotMatch(infrastructureMigration, /from public\.f2_lead|from public\.leads/);
  assert.doesNotMatch(infrastructureMigration, /update public\.f2_lead|update public\.leads/);
  assert.doesNotMatch(infrastructureMigration, /__sara_source_id.*set lead/);
  assert.match(infrastructureMigration, /from public\.motor_fila/);
  assert.match(infrastructureMigration, /motor_rodar\(/);
});

test("corte so ocorre com shadow saudavel e fallback restaura cron se worker morrer", () => {
  assert.match(cutoverMigration, /modo<>'shadow'/);
  assert.match(cutoverMigration, /heartbeat_em<clock_timestamp\(\)-interval '45 seconds'/);
  assert.match(cutoverMigration, /shadow_desde>clock_timestamp\(\)-interval '2 minutes'/);
  assert.match(cutoverMigration, /set modo='worker'/);
  assert.match(cutoverMigration, /v_sem_checkpoint>0/);
  assert.match(cutoverMigration, /leads ativos ainda nao possuem checkpoint duravel/);
  assert.match(cutoverMigration, /motor_dispatcher_cron_tick\(\)/);
  const clockBody = cutoverMigration.match(
    /create or replace function public\.motor_relogio_central\(\)[\s\S]*?as \$function\$([\s\S]*?)\$function\$;/,
  )?.[1] ?? "";
  assert.doesNotMatch(clockBody, /public\.motor_processar_fila\(\)/);
  assert.doesNotMatch(clockBody, /public\.motor_evento_prazo\(150\)/);
  assert.match(clockBody, /public\.motor_dispatcher_cron_tick\(\)/);
  assert.match(infrastructureMigration, /worker_heartbeat_expirado/);
  assert.match(infrastructureMigration, /v_modo:='cron'/);
  assert.match(infrastructureMigration, /leases_recuperados/);
  assert.match(infrastructureMigration, /public\.motor_processar_fila\(\)/);
  assert.match(infrastructureMigration, /public\.motor_evento_prazo\(150\)/);
});

test("RPCs ficam fechadas para service role e schema privado nao e exposto", () => {
  for (const signature of [
    "motor_dispatcher_heartbeat(text,integer)",
    "motor_dispatcher_claim(text,integer)",
    "motor_dispatcher_renovar_lease(bigint,text,uuid,integer)",
    "motor_dispatcher_processar(bigint,text,uuid)",
    "motor_dispatcher_parar(text)",
    "motor_dispatcher_diagnostico()",
  ]) {
    assert.match(
      infrastructureMigration,
      new RegExp(`revoke all on function public\\.${signature.replace(/[()]/g, "\\$&")}\\s+from public,anon,authenticated`),
    );
    assert.match(
      infrastructureMigration,
      new RegExp(`grant execute on function public\\.${signature.replace(/[()]/g, "\\$&")} to service_role`),
    );
  }
  assert.doesNotMatch(infrastructureMigration, /grant execute[\s\S]{0,100}authenticated/);
});
