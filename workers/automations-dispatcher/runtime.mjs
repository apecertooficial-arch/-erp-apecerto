const clamp = (value, minimum, maximum, fallback) => {
  const parsed = Number.parseInt(String(value ?? ""), 10);
  return Number.isFinite(parsed) ? Math.min(maximum, Math.max(minimum, parsed)) : fallback;
};

export const sanitize = (value, max = 500) => String(value ?? "")
  .replace(/[\r\n\0]/g, " ")
  .replace(/(?:eyJ|sb_(?:secret|publishable)_)[A-Za-z0-9._-]+/g, "[redacted]")
  .slice(0, max);

export function environment(source = process.env) {
  const supabaseUrl = source.SUPABASE_URL;
  const serviceRoleKey = source.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl) throw new Error("Dispatcher desativado: SUPABASE_URL ausente.");
  if (!serviceRoleKey) throw new Error("Dispatcher desativado: SUPABASE_SERVICE_ROLE_KEY ausente.");

  const workerId = sanitize(
    source.AUTOMATIONS_DISPATCHER_WORKER_ID
      ?? `automations-${source.RENDER_INSTANCE_ID ?? "local"}`,
    120,
  );
  if (!/^[a-zA-Z0-9][a-zA-Z0-9._:-]{2,119}$/.test(workerId)) {
    throw new Error("Dispatcher desativado: AUTOMATIONS_DISPATCHER_WORKER_ID inválido.");
  }

  const config = {
    supabaseUrl,
    serviceRoleKey,
    workerId,
    pollMs: clamp(source.AUTOMATIONS_DISPATCHER_POLL_MS, 100, 30_000, 750),
    heartbeatMs: clamp(source.AUTOMATIONS_DISPATCHER_HEARTBEAT_MS, 2_000, 30_000, 10_000),
    maintenanceMs: clamp(source.AUTOMATIONS_DISPATCHER_MAINTENANCE_MS, 10_000, 300_000, 30_000),
    leaseSeconds: clamp(source.AUTOMATIONS_DISPATCHER_LEASE_SECONDS, 30, 300, 90),
    shutdownMs: clamp(source.AUTOMATIONS_DISPATCHER_SHUTDOWN_MS, 5_000, 120_000, 30_000),
  };
  config.public = Object.freeze({
    workerId: config.workerId,
    pollMs: config.pollMs,
    heartbeatMs: config.heartbeatMs,
    maintenanceMs: config.maintenanceMs,
    leaseSeconds: config.leaseSeconds,
    shutdownMs: config.shutdownMs,
  });
  return Object.freeze(config);
}

export function nextBackoff(attempt) {
  return Math.min(30_000, 250 * (2 ** Math.max(0, Math.min(10, attempt))));
}

function rpcError(name, error) {
  const code = sanitize(error?.code ?? "RPC_FAILED", 80);
  const message = sanitize(error?.message ?? error, 320);
  return new Error(`${name} falhou (${code}): ${message}`);
}

const defaultSleep = (milliseconds, signal) => new Promise((resolve) => {
  if (signal?.aborted) return resolve();
  const timer = setTimeout(resolve, milliseconds);
  signal?.addEventListener("abort", () => {
    clearTimeout(timer);
    resolve();
  }, { once: true });
});

export function createDispatcher({
  db,
  config,
  sleep = defaultSleep,
  log = (entry) => process.stdout.write(`${JSON.stringify(entry)}\n`),
  now = () => new Date().toISOString(),
  clock = () => Date.now(),
}) {
  if (!db?.rpc) throw new Error("Cliente Supabase do dispatcher não configurado.");

  let stopped = false;
  let active = null;
  let lastHealth = null;
  let lastHeartbeatAt = 0;
  let lastMaintenanceAt = clock();

  async function rpc(name, args) {
    const { data, error } = await db.rpc(name, args);
    if (error) throw rpcError(name, error);
    return data;
  }

  async function heartbeat(force = false) {
    if (!force && lastHealth && clock()-lastHeartbeatAt<config.heartbeatMs) {
      return lastHealth;
    }
    lastHealth = await rpc("motor_dispatcher_heartbeat", {
      p_worker_id: config.workerId,
      p_lease_seconds: config.leaseSeconds,
    });
    lastHeartbeatAt = clock();
    return lastHealth;
  }

  async function tick() {
    const health = await heartbeat();
    const mode = health?.modo ?? "cron";
    if (mode !== "worker") return { ok: true, mode, processed: 0 };

    if (clock()-lastMaintenanceAt >= (config.maintenanceMs ?? 30_000)) {
      await rpc("motor_dispatcher_manutencao_tick", { p_worker_id: config.workerId });
      lastMaintenanceAt = clock();
    }

    const item = await rpc("motor_dispatcher_claim", {
      p_worker_id: config.workerId,
      p_lease_seconds: config.leaseSeconds,
    });
    if (!item?.id) return { ok: true, mode, processed: 0 };

    active = { id: item.id, leaseToken: item.lease_token };
    const renewalEvery = Math.max(
      2_000,
      Math.min(config.heartbeatMs, Math.floor(config.leaseSeconds * 1_000 / 3)),
    );
    const renewal = setInterval(() => {
      Promise.all([
        rpc("motor_dispatcher_renovar_lease", {
          p_fila_id: item.id,
          p_worker_id: config.workerId,
          p_lease_token: item.lease_token,
          p_lease_seconds: config.leaseSeconds,
        }),
        heartbeat(true),
      ]).catch((error) => log({
        level: "warn",
        event: "lease_renew_failed",
        at: now(),
        filaId: item.id,
        error: sanitize(error?.message),
      }));
    }, renewalEvery);
    renewal.unref?.();

    try {
      const result = await rpc("motor_dispatcher_processar", {
        p_fila_id: item.id,
        p_worker_id: config.workerId,
        p_lease_token: item.lease_token,
      });
      log({
        level: "info",
        event: "queue_item_processed",
        at: now(),
        filaId: item.id,
        status: result?.status ?? "unknown",
      });
      return { ok: true, mode, processed: 1, filaId: item.id, result };
    } finally {
      clearInterval(renewal);
      active = null;
    }
  }

  async function stop() {
    stopped = true;
    await rpc("motor_dispatcher_parar", { p_worker_id: config.workerId }).catch((error) => {
      log({ level: "warn", event: "shutdown_not_reported", at: now(), error: sanitize(error?.message) });
    });
  }

  async function run({ signal } = {}) {
    let failures = 0;
    log({ level: "info", event: "dispatcher_started", at: now(), ...config.public });
    while (!stopped && !signal?.aborted) {
      try {
        const result = await tick();
        failures = 0;
        if (!result.processed) await sleep(config.pollMs, signal);
      } catch (error) {
        const backoffMs = nextBackoff(failures++);
        log({
          level: "error",
          event: "dispatcher_tick_failed",
          at: now(),
          backoffMs,
          activeFilaId: active?.id ?? null,
          error: sanitize(error?.message),
        });
        await sleep(backoffMs, signal);
      }
    }
    await stop();
    log({ level: "info", event: "dispatcher_stopped", at: now() });
    return { ok: true, stopped: true };
  }

  return { heartbeat, run, stop, tick };
}
