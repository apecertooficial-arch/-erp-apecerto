import { createServerSupabaseClient } from "../../lib/supabase/server";

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
  if (role !== "admin" && role !== "executivo") return { supabase, user: data.user, isAdmin: false as const };
  return { supabase, user: data.user, isAdmin: true as const };
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
    const { error } = await auth.supabase.from("perfis").update({ permissoes }).eq("id", perfilId);
    return error ? Response.json({ error: error.message }, { status: 502 }) : Response.json({ success: true });
  }

  if (action === "saveUserOverride") {
    const userId = clean(body.userId, 60);
    if (!userId) return Response.json({ error: "Usuário inválido." }, { status: 422 });
    const permissoes = sanitizePerms(body.permissoes);
    const { error } = await auth.supabase.from("usuarios").update({ permissoes: Object.keys(permissoes).length ? permissoes : null }).eq("id", userId);
    return error ? Response.json({ error: error.message }, { status: 502 }) : Response.json({ success: true });
  }

  if (action === "clearUserOverride") {
    const userId = clean(body.userId, 60);
    if (!userId) return Response.json({ error: "Usuário inválido." }, { status: 422 });
    const { error } = await auth.supabase.from("usuarios").update({ permissoes: null }).eq("id", userId);
    return error ? Response.json({ error: error.message }, { status: 502 }) : Response.json({ success: true });
  }

  return Response.json({ error: "Ação não reconhecida." }, { status: 400 });
}
