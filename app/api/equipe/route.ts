import { createServerSupabaseClient } from "../../lib/supabase/server";

export const dynamic = "force-dynamic";

async function authClient(request: Request) {
  const header = request.headers.get("authorization");
  const token = header?.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) return null;
  const supabase = createServerSupabaseClient(token);
  const { data, error } = await supabase.auth.getUser(token);
  return error || !data.user ? null : { supabase, user: data.user };
}

// Leitura da equipe (performance + VGV). O escopo é derivado no banco a partir
// do usuário logado (função equipe_visao, SECURITY DEFINER): gerente vê os
// reportes diretos + ele mesmo; diretor vê a estrutura abaixo; admin vê todos.
// Corretor comum recebe só a si — nada sensível é exposto.
export async function GET(request: Request) {
  const auth = await authClient(request);
  if (!auth) return Response.json({ error: "Sessão inválida ou expirada." }, { status: 401 });
  const { data, error } = await auth.supabase.rpc("equipe_visao");
  if (error) return Response.json({ error: error.message }, { status: 502 });
  return Response.json({ team: data ?? [] });
}
