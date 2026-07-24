import { createServerSupabaseClient } from "../../lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const authorization = request.headers.get("authorization");
  const token = authorization?.startsWith("Bearer ") ? authorization.slice(7) : null;
  if (!token) return Response.json({ error: "Sessão inválida ou expirada." }, { status: 401 });
  const supabase = createServerSupabaseClient(token);
  const { data: userData, error: userError } = await supabase.auth.getUser(token);
  if (userError || !userData.user) return Response.json({ error: "Sessão inválida ou expirada." }, { status: 401 });

  const { data: me } = await supabase.from("usuarios").select("role").eq("id", userData.user.id).maybeSingle();
  const role = (me as { role?: string } | null)?.role ?? "corretor";
  if (!["admin", "gestor", "executivo"].includes(role)) {
    return Response.json({ error: "Sem permissão." }, { status: 403 });
  }

  const section = new URL(request.url).searchParams.get("section");
  if (section === "financeiro") {
    const { data, error } = await supabase.rpc("admin_dashboard_financeiro");
    if (error) return Response.json({ error: error.message }, { status: 502 });
    return Response.json({ financeiro: data });
  }
  if (section === "funil") {
    const { data, error } = await supabase.rpc("admin_dashboard_funil");
    if (error) return Response.json({ error: error.message }, { status: 502 });
    return Response.json({ funil: data });
  }

  const { data, error } = await supabase.rpc("admin_dashboard_rodagem");
  if (error) return Response.json({ error: error.message }, { status: 502 });
  return Response.json({ rodagem: data });
}
