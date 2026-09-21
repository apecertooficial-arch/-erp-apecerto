import { createServerSupabaseClient } from "../../lib/supabase/server";
import { isInvalidSessionError } from "../../lib/supabase/auth-errors";

export const dynamic = "force-dynamic";

type EquipeError = { code?: string } | null | undefined;

function falhaEquipe(error: EquipeError, operacao: string) {
  console.error("equipe_operacao_falhou", {
    operacao,
    codigo: error?.code ?? "desconhecido",
  });
  return Response.json({
    error: "Não foi possível carregar sua equipe agora.",
    erro: "equipe_indisponivel",
  }, { status: 502, headers: { "Cache-Control": "private, no-store, no-cache" } });
}

async function authClient(request: Request) {
  const header = request.headers.get("authorization");
  const token = header?.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) return { status: "invalid" as const };
  const supabase = createServerSupabaseClient(token);
  const { data, error } = await supabase.auth.getUser(token);
  if (isInvalidSessionError(error)) return { status: "invalid" as const };
  if (error) return { status: "auth_error" as const, error };
  if (!data.user) return { status: "invalid" as const };
  return { status: "authorized" as const, supabase, user: data.user };
}

// Leitura da equipe (performance + VGV). O escopo é derivado no banco a partir
// do usuário logado (função equipe_visao, SECURITY DEFINER): gerente vê os
// reportes diretos + ele mesmo; diretor vê a estrutura abaixo; admin vê todos.
// Corretor comum recebe só a si — nada sensível é exposto.
export async function GET(request: Request) {
  const auth = await authClient(request);
  if (auth.status === "invalid") return Response.json({ error: "Sessão inválida ou expirada." }, { status: 401 });
  if (auth.status === "auth_error") return falhaEquipe(auth.error, "autenticar");
  const { data, error } = await auth.supabase.rpc("equipe_visao");
  if (error) return falhaEquipe(error, "carregar_equipe");
  if (!Array.isArray(data)) return falhaEquipe(null, "validar_equipe");
  return Response.json({ team: data }, { headers: { "Cache-Control": "private, no-store, no-cache" } });
}
