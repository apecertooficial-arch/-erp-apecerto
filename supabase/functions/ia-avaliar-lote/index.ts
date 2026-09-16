// Desativada na Fase 0 (15/09/2026): sem uso no ERP/site/SQL e com falhas de autorizacao.
// Codigo original: branch arquivo/edge-functions-producao-20260915, pasta supabase/functions-producao-snapshot/.
Deno.serve(() => new Response(JSON.stringify({ error: "funcao_desativada" }), { status: 410, headers: { "Content-Type": "application/json" } }));
