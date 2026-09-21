import { createServerSupabaseClient } from "../../lib/supabase/server";
import { isInvalidSessionError } from "../../lib/supabase/auth-errors";

export const dynamic = "force-dynamic";

type EquipeError = { code?: string } | null | undefined;
type EquipeRow = {
  corretor_id: number;
  nome: string;
  score: number;
  vgv_mes: number;
  vendas_mes: number;
  meta_vgv: number;
  is_self: boolean;
};

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

function normalizarEquipe(value: unknown): EquipeRow[] | null {
  if (!Array.isArray(value)) return null;
  const team = value.map((item) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) return null;
    const row = item as Record<string, unknown>;
    const corretorId = Number(row.corretor_id);
    const score = Number(row.score);
    const vgvMes = Number(row.vgv_mes);
    const vendasMes = Number(row.vendas_mes);
    const metaVgv = Number(row.meta_vgv);
    if (!Number.isSafeInteger(corretorId) || corretorId <= 0
      || typeof row.nome !== "string" || !row.nome.trim()
      || ![score, vgvMes, vendasMes, metaVgv].every(Number.isFinite)) return null;
    return {
      corretor_id: corretorId,
      nome: row.nome,
      score,
      vgv_mes: vgvMes,
      vendas_mes: vendasMes,
      meta_vgv: metaVgv,
      // A RPC devolve NULL quando o corretor ainda não possui usuário ligado.
      // Para a sessão atual isso significa, deterministicamente, "não é eu".
      is_self: row.is_self === true,
    };
  });
  return team.every((item): item is EquipeRow => item !== null) ? team : null;
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
  const team = normalizarEquipe(data);
  if (!team) return falhaEquipe(null, "validar_equipe");
  return Response.json({ team }, { headers: { "Cache-Control": "private, no-store, no-cache" } });
}
