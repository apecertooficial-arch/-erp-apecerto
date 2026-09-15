// APOSENTADA. Era a sonda que descobriu quais endpoints de leitura a D-API
// realmente responde. O resultado virou a wa-agenda-do-corretor; a sonda em si
// nao tem mais uso e fica desativada em vez de continuar batendo em producao.
Deno.serve(() =>
  new Response(JSON.stringify({ error: "aposentada", use: "wa-agenda-do-corretor" }),
    { status: 410, headers: { "Content-Type": "application/json" } }));
