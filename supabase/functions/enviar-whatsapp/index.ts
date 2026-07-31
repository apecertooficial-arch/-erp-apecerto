import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

Deno.serve(async (req) => {
  try {
    const { instancia_id, to, text } = await req.json();
    if (!instancia_id || !to || !text)
      return Response.json({ erro: "faltam instancia_id, to ou text" }, { status: 400 });

    // service_role: lê as tabelas trancadas (ignora RLS com segurança)
    const supa = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: inst } = await supa
      .from("instancias").select("instancia_dapi").eq("id", instancia_id).single();
    if (!inst) return Response.json({ erro: "instância não encontrada" }, { status: 404 });

    const { data: cred } = await supa
      .from("instancias_credenciais").select("apikey").eq("instancia_id", instancia_id).single();
    if (!cred) return Response.json({ erro: "chave não cadastrada" }, { status: 404 });

    const r = await fetch("https://api.d-api.cloud/api/v1/messages/send/text", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": cred.apikey },
      body: JSON.stringify({ sessionId: inst.instancia_dapi, to, text }),
    });
    const resultado = await r.json().catch(() => ({}));
    return Response.json({ status: r.status, resultado }, { status: r.ok ? 200 : r.status });
  } catch (err) {
    return Response.json({ erro: String(err) }, { status: 500 });
  }
});
