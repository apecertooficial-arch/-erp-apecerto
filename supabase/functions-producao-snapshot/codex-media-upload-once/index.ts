import "jsr:@supabase/functions-js/edge-runtime.d.ts";
Deno.serve(() => Response.json({ error: "Uploader encerrado" }, { status: 410 }));