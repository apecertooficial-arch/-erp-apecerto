import { createServerSupabaseClient } from "../../../lib/supabase/server";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const header = request.headers.get("authorization");
  const token = header?.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) return Response.json({ error: "Sessão inválida." }, { status: 401 });

  const supabase = createServerSupabaseClient(token);
  const { data: usuario, error: authError } = await supabase.auth.getUser(token);
  if (authError || !usuario.user) return Response.json({ error: "Sessão inválida." }, { status: 401 });

  const rpc = supabase.rpc.bind(supabase) as unknown as (
    fn: string,
  ) => Promise<{ data: unknown; error: { message: string } | null }>;
  const { data, error } = await rpc("performance_registrar_atividade");
  if (error) return Response.json({ error: error.message }, { status: 502 });
  return Response.json(data ?? { ok: true });
}
