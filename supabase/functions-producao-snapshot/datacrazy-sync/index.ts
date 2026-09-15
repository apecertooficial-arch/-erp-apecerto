// DESATIVADO: integração DataCrazy removida. Stub inofensivo.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
Deno.serve(() => new Response(JSON.stringify({ ok: true, disabled: true, msg: "datacrazy-sync desativado" }), { headers: { "Content-Type": "application/json" } }));
