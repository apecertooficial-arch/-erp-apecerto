import { createServerSupabaseClient } from "../../lib/supabase/server";
import { papelNoGrupo } from "../../lib/papeis";

export const dynamic = "force-dynamic";

type Perms = Record<string, string[]>;

async function adminClient(request: Request) {
  const header = request.headers.get("authorization");
  const token = header?.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) return null;
  const supabase = createServerSupabaseClient(token);
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) return null;
  const { data: profile } = await supabase.from("usuarios").select("role").eq("id", data.user.id).maybeSingle();
  const role = (profile as { role?: string } | null)?.role;
  if (!papelNoGrupo(role, "acesso_total")) return { supabase, user: data.user, isAdmin: false as const };
  return { supabase, user: data.user, isAdmin: true as const };
}

/* Onda 5.1 — alteracao de permissao passa a deixar rastro.
 *
 * Ate 14/09/2026 esta rota era a UNICA que mexia em acesso sem registrar nada:
 * /api/team audita as tres acoes dela, esta nao auditava nenhuma. Na pratica,
 * dava para se conceder acesso ao Financeiro, usar e devolver sem deixar
 * historico. O padrao abaixo e o mesmo de /api/team, de proposito.
 */
type AuditInput = { acao: string; entidade?: string; entidadeId?: string | null; antes?: unknown; depois?: unknown; detalhe?: string };
async function audit(supabase: ReturnType<typeof createServerSupabaseClient>, event: AuditInput) {
  await supabase.rpc("registrar_auditoria", {
    p_acao: event.acao,
    p_modulo: "Usuários",
    p_entidade: event.entidade ?? undefined,
    p_entidade_id: event.entidadeId ?? undefined,
    p_antes: (event.antes ?? undefined) as never,
    p_depois: (event.depois ?? undefined) as never,
    p_detalhe: event.detalhe ?? undefined,
  }).then(() => undefined, () => undefined);
}

const clean = (value: unknown, max = 60) => (typeof value === "string" ? value.trim().slice(0, max) : "");

// Aceita { modulo: string[] } com chaves/acoes saneadas
function sanitizePerms(input: unknown): Perms {
  if (!input || typeof input !== "object" || Array.isArray(input)) return {};
  const out: Perms = {};
  for (const [rawKey, rawVal] of Object.entries(input as Record<string, unknown>)) {
    const key = clean(rawKey, 40).toLowerCase().replace(/[^a-z0-9_]/g, "");
    if (!key || !Array.isArray(rawVal)) continue;
    const acoes = [...new Set(rawVal.map((a) => clean(a, 40).toLowerCase().replace(/[^a-z0-9_]/g, "")).filter(Boolean))];
    if (acoes.length) out[key] = acoes;
  }
  return out;
}

export async function GET(request: Request) {
  const auth = await adminClient(request);
  if (!auth) return Response.json({ error: "Sessão inválida ou expirada." }, { status: 401 });
  if (!auth.isAdmin) return Response.json({ error: "Acesso restrito a administradores." }, { status: 403 });

  const [perfis, usuarios] = await Promise.all([
    auth.supabase.from("perfis").select("id,nome,is_system,permissoes,atualizado_em").order("id"),
    auth.supabase.from("usuarios").select("id,nome,role,ativo,permissoes").order("nome"),
  ]);
  const firstError = [perfis, usuarios].find((r) => r.error)?.error;
  if (firstError) return Response.json({ error: firstError.message }, { status: 502 });
  return Response.json({ perfis: perfis.data ?? [], usuarios: usuarios.data ?? [] });
}

export async function PATCH(request: Request) {
  const auth = await adminClient(request);
  if (!auth) return Response.json({ error: "Sessão inválida ou expirada." }, { status: 401 });
  if (!auth.isAdmin) return Response.json({ error: "Acesso restrito a administradores." }, { status: 403 });

  const body = (await request.json()) as Record<string, unknown>;
  const action = clean(body.action, 40);

  if (action === "saveProfile") {
    const perfilId = clean(body.perfilId, 40).toLowerCase().replace(/[^a-z0-9_]/g, "");
    if (!perfilId) return Response.json({ error: "Perfil inválido." }, { status: 422 });
    const permissoes = sanitizePerms(body.permissoes);
    const { data: antes } = await auth.supabase.from("perfis").select("id,nome,permissoes").eq("id", perfilId).maybeSingle();
    const { error } = await auth.supabase.from("perfis").update({ permissoes }).eq("id", perfilId);
    if (error) return Response.json({ error: error.message }, { status: 502 });
    await audit(auth.supabase, { acao: "editar_perfil_permissoes", entidade: "perfil", entidadeId: perfilId, antes: antes ?? undefined, depois: { id: perfilId, permissoes }, detalhe: `Permissões do perfil ${antes?.nome ?? perfilId} alteradas` });
    return Response.json({ success: true });
  }

  if (action === "saveUserOverride") {
    const userId = clean(body.userId, 60);
    if (!userId) return Response.json({ error: "Usuário inválido." }, { status: 422 });
    const permissoes = sanitizePerms(body.permissoes);
    const { data: antes } = await auth.supabase.from("usuarios").select("id,nome,role,permissoes").eq("id", userId).maybeSingle();
    const depois = Object.keys(permissoes).length ? permissoes : null;
    const { error } = await auth.supabase.from("usuarios").update({ permissoes: depois }).eq("id", userId);
    if (error) return Response.json({ error: error.message }, { status: 502 });
    await audit(auth.supabase, { acao: "editar_permissoes_usuario", entidade: "usuario", entidadeId: userId, antes: antes ?? undefined, depois: { id: userId, permissoes: depois }, detalhe: `Permissões individuais de ${antes?.nome ?? userId} alteradas` });
    return Response.json({ success: true });
  }

  if (action === "clearUserOverride") {
    const userId = clean(body.userId, 60);
    if (!userId) return Response.json({ error: "Usuário inválido." }, { status: 422 });
    const { data: antes } = await auth.supabase.from("usuarios").select("id,nome,role,permissoes").eq("id", userId).maybeSingle();
    const { error } = await auth.supabase.from("usuarios").update({ permissoes: null }).eq("id", userId);
    if (error) return Response.json({ error: error.message }, { status: 502 });
    await audit(auth.supabase, { acao: "limpar_permissoes_usuario", entidade: "usuario", entidadeId: userId, antes: antes ?? undefined, depois: { id: userId, permissoes: null }, detalhe: `Override de permissões de ${antes?.nome ?? userId} removido (volta ao perfil do papel)` });
    return Response.json({ success: true });
  }

  return Response.json({ error: "Ação não reconhecida." }, { status: 400 });
}
