import { createClient } from "@supabase/supabase-js";
import { pathToFileURL } from "node:url";

import { createDispatcher, environment, sanitize } from "./runtime.mjs";

export async function main(source = process.env) {
  const config = environment(source);
  const db = createClient(config.supabaseUrl, config.serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      detectSessionInUrl: false,
      persistSession: false,
    },
    global: { headers: { "x-apecerto-worker": config.workerId } },
  });
  const controller = new AbortController();
  let stopping = false;
  const shutdown = () => {
    if (stopping) return;
    stopping = true;
    controller.abort();
    setTimeout(() => process.exit(1), config.shutdownMs).unref();
  };
  process.once("SIGINT", shutdown);
  process.once("SIGTERM", shutdown);
  return createDispatcher({ db, config }).run({ signal: controller.signal });
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  main().catch((error) => {
    const message = sanitize(error?.message ?? error, 500);
    process.stderr.write(`${JSON.stringify({ ok: false, event: "dispatcher_failed", error: message })}\n`);
    process.exitCode = 1;
  });
}
