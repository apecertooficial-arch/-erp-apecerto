import "jsr:@supabase/functions-js/edge-runtime.d.ts";
// DESATIVADA — avaliação unificada no ia-avaliar-lote (uma única IA avalia a conversa
// e alimenta lead_avaliacoes + ia_notas_atendimento na mesma passada).
Deno.serve(() => new Response(JSON.stringify({ ok:false, motivo:"unificado_no_ia-avaliar-lote" }), { headers: { "Content-Type":"application/json" } }));
