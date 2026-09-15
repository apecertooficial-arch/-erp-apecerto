// DESATIVADO: movimentação agora é nativa (RPC mover_negocio). Stub inofensivo.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
Deno.serve(() => new Response(JSON.stringify({ ok: true, disabled: true, msg: "crm-mover desativado; use RPC mover_negocio" }), { headers: { "Content-Type": "application/json" } }));
