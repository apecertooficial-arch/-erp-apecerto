import { createServerSupabaseClient } from "../../lib/supabase/server";

export const dynamic = "force-dynamic";

/* Ficha de financiamento pública — validada pelo token do link (sem login).
   Mesmo padrão da agenda pública: RPCs SECURITY DEFINER no banco. */

const validToken = (token: string) => /^[a-f0-9]{30,80}$/i.test(token);

export async function GET(request: Request) {
  const token = new URL(request.url).searchParams.get("token")?.trim() ?? "";
  if (!validToken(token)) return Response.json({ error: "Link inválido." }, { status: 400 });
  const supabase = createServerSupabaseClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase.rpc as any)("ficha_publica_obter", { p_token: token });
  if (error) return Response.json({ error: error.message }, { status: 502 });
  if (!data) return Response.json({ error: "Esta ficha não existe mais. Peça um novo link ao seu corretor." }, { status: 404 });
  return Response.json(data);
}

export async function POST(request: Request) {
  const body = (await request.json()) as { token?: string; dados?: Record<string, unknown> };
  const token = typeof body.token === "string" ? body.token.trim() : "";
  if (!validToken(token)) return Response.json({ error: "Link inválido." }, { status: 400 });
  if (!body.dados || typeof body.dados !== "object") return Response.json({ error: "Dados inválidos." }, { status: 422 });
  const supabase = createServerSupabaseClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase.rpc as any)("ficha_publica_enviar", { p_token: token, p_dados: body.dados });
  if (error) return Response.json({ error: error.message }, { status: 502 });
  const result = (data ?? {}) as { ok?: boolean; error?: string };
  if (!result.ok) return Response.json({ error: result.error || "Não foi possível enviar." }, { status: 422 });
  return Response.json({ success: true });
}
