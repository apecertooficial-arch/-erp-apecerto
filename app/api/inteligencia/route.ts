import { createServerSupabaseClient } from "../../lib/supabase/server";

export const dynamic = "force-dynamic";

const rolesGestao = new Set(["admin", "gerente", "diretor", "executivo"]);

export async function GET(request: Request) {
  const authorization = request.headers.get("authorization");
  const token = authorization?.startsWith("Bearer ") ? authorization.slice(7) : null;
  if (!token) return Response.json({ error: "Sessão inválida ou expirada." }, { status: 401 });

  const supabase = createServerSupabaseClient(token);
  const { data: userData, error: userError } = await supabase.auth.getUser(token);
  if (userError || !userData.user) return Response.json({ error: "Sessão inválida ou expirada." }, { status: 401 });

  const { data: me } = await supabase
    .from("usuarios")
    .select("role,ativo")
    .eq("id", userData.user.id)
    .maybeSingle();
  const role = (me as { role?: string; ativo?: boolean } | null)?.role ?? "corretor";
  if (!me?.ativo || !rolesGestao.has(role)) return Response.json({ error: "Sem permissão." }, { status: 403 });

  const requestedDays = Number(new URL(request.url).searchParams.get("days") ?? 30);
  const days = Number.isFinite(requestedDays) ? Math.max(1, Math.min(Math.round(requestedDays), 365)) : 30;
  const { data, error } = await supabase.rpc("tracking_360_ceo", { p_days: days });

  if (error) {
    console.error("tracking_360_ceo falhou:", error.message);
    return Response.json({ error: "Não foi possível carregar a Inteligência agora." }, { status: 502 });
  }

  return Response.json(
    { resumo: data },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}
