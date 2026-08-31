import { createServerSupabaseClient } from "../../lib/supabase/server";

export const dynamic = "force-dynamic";

async function authenticatedClient(request: Request) {
  const header = request.headers.get("authorization");
  const token = header?.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) return null;

  const supabase = createServerSupabaseClient(token);
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) return null;
  return { supabase };
}

function positiveInteger(value: unknown) {
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null;
}

/**
 * A tela de conexões usa a API do próprio ERP em vez de abrir um segundo
 * fluxo de autenticação Supabase no navegador. O JWT continua sendo o do
 * usuário: wa_v7_atualizar_painel e dapi-qr mantêm o escopo do corretor no servidor.
 */
export async function GET(request: Request) {
  const auth = await authenticatedClient(request);
  if (!auth) return Response.json({ error: "Sessão inválida ou expirada." }, { status: 401 });

  const refreshed = await auth.supabase.rpc("wa_v7_atualizar_painel");
  if (!refreshed.error) {
    return Response.json({ painel: refreshed.data }, { headers: { "Cache-Control": "no-store" } });
  }

  // Se o provedor estiver indisponível, o último snapshot completo continua
  // útil. Uma falha de atualização nunca deve apagar a tela de Conexões.
  const fallback = await auth.supabase.rpc("wa_v7_painel");
  if (fallback.error) return Response.json({ error: "Não foi possível consultar suas instâncias." }, { status: 502 });
  return Response.json({ painel: fallback.data }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: Request) {
  const auth = await authenticatedClient(request);
  if (!auth) return Response.json({ error: "Sessão inválida ou expirada." }, { status: 401 });

  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  const action = body?.action === "restart" ? "restart" : body?.action === "qr" ? "qr" : null;
  const instanciaId = positiveInteger(body?.instanciaId);
  if (!action || !instanciaId) return Response.json({ error: "Ação ou instância inválida." }, { status: 422 });

  const { data, error } = await auth.supabase.functions.invoke("dapi-qr", {
    body: { action, instanciaId },
  });
  if (error) return Response.json({ error: "Não foi possível gerar o QR desta instância." }, { status: 502 });
  return Response.json({ result: data }, { headers: { "Cache-Control": "no-store" } });
}
