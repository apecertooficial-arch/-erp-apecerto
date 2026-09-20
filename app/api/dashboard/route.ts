import { createServerSupabaseClient } from "../../lib/supabase/server";
import { papelNoGrupo } from "../../lib/papeis";

export const dynamic = "force-dynamic";

const headers = { "Cache-Control": "private, no-store, no-cache, must-revalidate" };
const json = (body: unknown, status = 200) => Response.json(body, { status, headers });

function falhaDashboard(error: { code?: string } | null, secao: string, codigo = "falha_banco") {
  console.error("dashboard_consulta_falhou", { secao, codigo: error?.code ?? codigo });
  return json({ error: "Não foi possível carregar os indicadores no momento.", erro: codigo }, 502);
}

function respostaConfirmada(data: unknown) {
  return Boolean(data && typeof data === "object" && !Array.isArray(data));
}

export async function GET(request: Request) {
  const authorization = request.headers.get("authorization");
  const token = authorization?.startsWith("Bearer ") ? authorization.slice(7) : null;
  if (!token) return json({ error: "Sessão inválida ou expirada." }, 401);
  const supabase = createServerSupabaseClient(token);
  const { data: userData, error: userError } = await supabase.auth.getUser(token);
  if (userError || !userData.user) return json({ error: "Sessão inválida ou expirada." }, 401);

  const { data: me, error: profileError } = await supabase.from("usuarios").select("role").eq("id", userData.user.id).maybeSingle();
  if (profileError) return falhaDashboard(profileError, "perfil", "falha_perfil");
  const role = (me as { role?: string } | null)?.role;
  if (!papelNoGrupo(role, "dashboard_gerencial")) {
    return json({ error: "Sem permissão." }, 403);
  }

  const section = new URL(request.url).searchParams.get("section");
  if (section && !["financeiro", "funil", "namesa", "rodagem"].includes(section)) {
    return json({ error: "Seção inválida." }, 400);
  }
  if (section === "financeiro") {
    const { data, error } = await supabase.rpc("admin_dashboard_financeiro");
    if (error) return falhaDashboard(error, "financeiro");
    if (!respostaConfirmada(data)) return falhaDashboard(null, "financeiro", "resposta_invalida");
    return json({ financeiro: data });
  }
  if (section === "funil") {
    const { data, error } = await supabase.rpc("admin_dashboard_funil");
    if (error) return falhaDashboard(error, "funil");
    if (!respostaConfirmada(data)) return falhaDashboard(null, "funil", "resposta_invalida");
    return json({ funil: data });
  }
  if (section === "namesa") {
    const { data, error } = await supabase.rpc("admin_dashboard_na_mesa");
    if (error) return falhaDashboard(error, "namesa");
    if (!respostaConfirmada(data)) return falhaDashboard(null, "namesa", "resposta_invalida");
    return json({ naMesa: data });
  }

  const { data, error } = await supabase.rpc("admin_dashboard_rodagem");
  if (error) return falhaDashboard(error, "rodagem");
  if (!respostaConfirmada(data)) return falhaDashboard(null, "rodagem", "resposta_invalida");
  return json({ rodagem: data });
}
