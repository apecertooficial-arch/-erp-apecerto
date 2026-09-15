import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("Use POST", { status: 405 });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  try {
    const body = await req.json();
    const telefone = body.telefone ?? null;

    // Anti-duplicado
    if (telefone) {
      const { data: existente } = await supabase
        .from("leads").select("id").eq("telefone", telefone).limit(1);
      if (existente && existente.length > 0) {
        return new Response(JSON.stringify({ ok: false, motivo: "lead_duplicado" }),
          { status: 200, headers: { "Content-Type": "application/json" } });
      }
    }

    // 1. RECEBE E GUARDA sem corretor, status 'novo'
    const { data: lead, error } = await supabase.from("leads").insert({
      nome: body.nome ?? null, telefone, email: body.email ?? null,
      status: "novo", corretor_id: null
    }).select().single();
    if (error) throw error;

    // 2. TENTA distribuir a fila na hora (chama a outra função)
    await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/distribuir-fila`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`
      }
    });

    return new Response(JSON.stringify({ ok: true, lead_id: lead.id, status: "recebido" }),
      { status: 200, headers: { "Content-Type": "application/json" } });

  } catch (e) {
    return new Response(JSON.stringify({ ok: false, erro: String(e) }),
      { status: 500, headers: { "Content-Type": "application/json" } });
  }
});