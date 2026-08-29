import { spawn } from "node:child_process";

const enabled = String(process.env.AUTOMATIONS_DISPATCHER_ENABLED ?? "") === "true";
const children = new Set();
let stopping = false;
let workerRestarts = 0;

function write(entry) {
  process.stdout.write(`${JSON.stringify({ at: new Date().toISOString(), ...entry })}\n`);
}

function start(command, args, name) {
  const child = spawn(command, args, { env: process.env, stdio: "inherit" });
  child.name = name;
  children.add(child);
  child.once("exit", (code, signal) => {
    children.delete(child);
    if (stopping) return;
    if (name === "web") {
      write({ level: "error", event: "web_exited", code, signal });
      shutdown(code ?? 1);
      return;
    }
    const delayMs = Math.min(30_000, 1_000 * (2 ** Math.min(workerRestarts++, 5)));
    write({ level: "warn", event: "dispatcher_restart_scheduled", code, signal, delayMs });
    setTimeout(startWorker, delayMs).unref();
  });
  return child;
}

function startWorker() {
  if (!enabled || stopping) return;
  start(process.execPath, ["workers/automations-dispatcher/index.mjs"], "dispatcher");
}

function shutdown(exitCode = 0) {
  if (stopping) return;
  stopping = true;
  for (const child of children) child.kill("SIGTERM");
  const timer = setTimeout(() => {
    for (const child of children) child.kill("SIGKILL");
    process.exit(exitCode);
  }, 30_000);
  timer.unref();
  Promise.all([...children].map((child) => new Promise((resolve) => child.once("exit", resolve))))
    .finally(() => process.exit(exitCode));
}

process.once("SIGINT", () => shutdown(0));
process.once("SIGTERM", () => shutdown(0));

start("./node_modules/.bin/vinext", ["start"], "web");
if (enabled) {
  write({ level: "info", event: "dispatcher_cohost_enabled" });
  startWorker();
} else {
  write({ level: "info", event: "dispatcher_cohost_disabled" });
}
