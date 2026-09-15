// dapi-diag — desativado. Diagnostico ja concluido; funcao neutralizada por seguranca.
Deno.serve(() => new Response(JSON.stringify({ error: "gone", detail: "diagnostico desativado" }), { status: 410, headers: { "Content-Type": "application/json" } }));
