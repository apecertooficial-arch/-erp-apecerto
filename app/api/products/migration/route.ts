import { createServerSupabaseClient } from "../../../lib/supabase/server";
import { isProductManagerAccess } from "../../../features/products/access";

export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const noStore = { "Cache-Control": "private, no-store, no-cache" };

function failure(error: { code?: string } | null | undefined, operation: string) {
  console.error("produtos_migracao_operacao_falhou", {
    operacao: operation,
    codigo: error?.code ?? "desconhecido",
  });
  return Response.json({ error: "Não foi possível atualizar a lista de migração." }, { status: 502, headers: noStore });
}

export async function POST(request: Request) {
  const authorization = request.headers.get("authorization");
  const accessToken = authorization?.startsWith("Bearer ") ? authorization.slice(7) : null;
  if (!accessToken) return Response.json({ error: "Sessão necessária." }, { status: 401, headers: noStore });

  const body = await request.json().catch(() => null) as { unitId?: unknown; selected?: unknown } | null;
  if (!body || typeof body.unitId !== "string" || !UUID.test(body.unitId) || typeof body.selected !== "boolean") {
    return Response.json({ error: "Seleção inválida." }, { status: 400, headers: noStore });
  }

  const supabase = createServerSupabaseClient(accessToken);
  const { data: authData, error: authError } = await supabase.auth.getUser(accessToken);
  if (authError || !authData.user) return Response.json({ error: "Sessão inválida ou expirada." }, { status: 401, headers: noStore });

  const [{ data: canSelect, error: permissionError }, { data: profile, error: profileError }] = await Promise.all([
    supabase.rpc("has_perm", { p_modulo: "produtos", p_acao: "selecionar_migracao" }),
    supabase.from("usuarios").select("role,gestor_produtos").eq("id", authData.user.id).maybeSingle(),
  ]);
  if (permissionError || profileError) return failure(permissionError ?? profileError, "confirmar_permissao");
  const manager = isProductManagerAccess(profile?.role, profile?.gestor_produtos === true);
  if (canSelect !== true && !manager) {
    return Response.json({ error: "Você não tem permissão para preparar a migração de Produtos." }, { status: 403, headers: noStore });
  }

  if (body.selected) {
    const { error } = await supabase.from("produto_migracao_selecoes").insert({
      unidade_id: body.unitId,
      selecionado_por: authData.user.id,
    });
    if (error && error.code !== "23505") return failure(error, "selecionar_unidade");
  } else {
    const { error } = await supabase.from("produto_migracao_selecoes").delete().eq("unidade_id", body.unitId);
    if (error) return failure(error, "remover_unidade");
  }

  return Response.json({ ok: true, unitId: body.unitId, selected: body.selected }, { headers: noStore });
}
