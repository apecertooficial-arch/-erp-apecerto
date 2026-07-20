import { createServerSupabaseClient } from "../../../lib/supabase/server";

export const dynamic = "force-dynamic";

function cleanText(value: unknown, max = 1000) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

async function authenticatedClient(request: Request) {
  const authorization = request.headers.get("authorization");
  const token = authorization?.startsWith("Bearer ") ? authorization.slice(7) : null;
  if (!token) return null;
  const supabase = createServerSupabaseClient(token);
  const { data, error } = await supabase.auth.getUser(token);
  return error || !data.user ? null : { supabase };
}

export async function POST(request: Request) {
  const auth = await authenticatedClient(request);
  if (!auth) return Response.json({ error: "Sessão inválida ou expirada." }, { status: 401 });

  const body = await request.json() as Record<string, unknown>;
  const action = cleanText(body.action, 40);

  if (["list", "messages", "dapi-hist", "media"].includes(action)) {
    const { data, error } = await auth.supabase.functions.invoke("lead-chat", { body });
    if (error) return Response.json({ error: error.message }, { status: 502 });
    return Response.json(data ?? {});
  }

  if (action === "send") {
    const telefone = cleanText(body.telefone, 40).replace(/\D/g, "");
    const texto = cleanText(body.texto, 4000);
    const instanciaId = Number(body.instanciaId);
    if (telefone.length < 8 || !texto || !Number.isSafeInteger(instanciaId) || instanciaId <= 0) {
      return Response.json({ error: "Selecione a instância e escreva a mensagem." }, { status: 422 });
    }
    const { data, error } = await auth.supabase.functions.invoke("dapi-enviar", {
      body: { telefone, instancia_id: instanciaId, tipo: "texto", texto },
    });
    if (error) {
      // Desembrulha o motivo real devolvido pela função (o invoke esconde o corpo em error.context).
      let motivo = error.message || "Falha ao enviar a mensagem.";
      try {
        const ctx = (error as { context?: Response }).context;
        if (ctx && typeof ctx.json === "function") {
          const detalhe = await ctx.json() as { motivo?: string; error?: string };
          motivo = detalhe.motivo || detalhe.error || motivo;
        }
      } catch { /* mantém a mensagem padrão */ }
      return Response.json({ error: motivo }, { status: 502 });
    }
    const result = data && typeof data === "object" ? data as Record<string, unknown> : {};
    if (result.error) return Response.json({ error: cleanText((result.motivo as string) || (result.error as string), 300), detail: result.detalhe ?? null }, { status: 502 });
    return Response.json({ success: true, result });
  }

  return Response.json({ error: "Ação de conversa desconhecida." }, { status: 400 });
}
