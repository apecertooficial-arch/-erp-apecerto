import { createServerSupabaseClient } from "../../lib/supabase/server";

export const dynamic = "force-dynamic";

async function authClient(request: Request) {
  const header = request.headers.get("authorization");
  const token = header?.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) return null;
  const supabase = createServerSupabaseClient(token);
  const { data, error } = await supabase.auth.getUser(token);
  return error || !data.user ? null : { supabase };
}

/* GET: devolve o link compartilhável da agenda (qualquer usuário logado). */
export async function GET(request: Request) {
  const auth = await authClient(request);
  if (!auth) return Response.json({ error: "Sessão inválida ou expirada." }, { status: 401 });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (auth.supabase.rpc as any)("agenda_link_token");
  if (error) return Response.json({ error: error.message }, { status: 502 });
  if (!data) return Response.json({ error: "Sem permissão." }, { status: 403 });
  return Response.json({ token: data });
}

/* POST: regenera o código (invalida o link antigo) — apenas administradores. */
export async function POST(request: Request) {
  const auth = await authClient(request);
  if (!auth) return Response.json({ error: "Sessão inválida ou expirada." }, { status: 401 });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (auth.supabase.rpc as any)("agenda_link_regenerar");
  if (error) return Response.json({ error: error.message }, { status: 502 });
  return Response.json({ token: data });
}
