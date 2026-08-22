import { createServerSupabaseClient } from "../../lib/supabase/server";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const header = request.headers.get("authorization");
  const token = header?.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) return Response.json({ error: "Sessão necessária." }, { status: 401 });

  const supabase = createServerSupabaseClient(token);
  const { data: auth, error: authError } = await supabase.auth.getUser(token);
  if (authError || !auth.user) return Response.json({ error: "Sessão inválida." }, { status: 401 });

  const body = await request.json().catch(() => ({})) as Record<string, unknown>;
  const { data, error } = await supabase.rpc("central_atividade_heartbeat" as never, {
    p_ativo: body.ativo === true,
  } as never);

  if (error) return Response.json({ error: "Telemetria indisponível." }, { status: 502 });
  return Response.json(data ?? { ok: true }, { headers: { "Cache-Control": "no-store" } });
}
