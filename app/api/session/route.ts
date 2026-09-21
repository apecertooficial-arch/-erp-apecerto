import { createServerSupabaseClient } from "../../lib/supabase/server";
import { papelDeSessao } from "../../lib/papeis";
import { isInvalidSessionError } from "../../lib/supabase/auth-errors";

export const dynamic = "force-dynamic";

type SessionError = { code?: string } | null | undefined;

function falhaSessao(error: SessionError, operacao: string) {
  console.error("sessao_operacao_falhou", {
    operacao,
    codigo: error?.code ?? "desconhecido",
  });
  return Response.json({
    error: "Não foi possível confirmar seu acesso agora. Tente novamente.",
    erro: "sessao_indisponivel",
  }, { status: 502, headers: { "Cache-Control": "private, no-store, no-cache" } });
}

export async function GET(request: Request) {
  const authorization = request.headers.get("authorization");
  const accessToken = authorization?.startsWith("Bearer ") ? authorization.slice(7) : null;
  if (!accessToken) return Response.json({ error: "Sessão necessária." }, { status: 401 });

  const supabase = createServerSupabaseClient(accessToken);
  const { data: authData, error: authError } = await supabase.auth.getUser(accessToken);
  if (authError && isInvalidSessionError(authError)) return Response.json({ error: "Sessão inválida ou expirada." }, { status: 401 });
  if (authError) return falhaSessao(authError, "autenticar");
  if (!authData.user) return Response.json({ error: "Sessão inválida ou expirada." }, { status: 401 });

  const [{ data: profile, error: profileError }, { data: broker, error: brokerError }] = await Promise.all([
    supabase.from("usuarios").select("id,nome,role,ativo,permissoes").eq("id", authData.user.id).maybeSingle(),
    supabase.from("corretores").select("id,nome,email,usuario_id,ativo,online").eq("usuario_id", authData.user.id).maybeSingle(),
  ]);
  if (profileError) return falhaSessao(profileError, "carregar_perfil");
  if (brokerError) return falhaSessao(brokerError, "carregar_corretor");

  const individualPermissions = (profile as { permissoes?: Record<string, string[]> | null } | null)?.permissoes ?? null;
  let effectivePermissions = individualPermissions;
  if ((!effectivePermissions || Object.keys(effectivePermissions).length === 0) && profile?.role) {
    const { data: roleProfile, error: roleProfileError } = await supabase.from("perfis").select("permissoes").eq("id", profile.role).maybeSingle();
    if (roleProfileError) return falhaSessao(roleProfileError, "carregar_permissoes_papel");
    effectivePermissions = (roleProfile as { permissoes?: Record<string, string[]> | null } | null)?.permissoes ?? null;
  }
  /* Classe de sessão vem de app/lib/papeis.ts (grupo `gestao`): admin, gestor
     (executivo, diretor, gerente) ou corretor. Onda 5.8 já tinha incluído
     "diretor"; a lista local com papéis inexistentes deixou de existir. */
  const role = papelDeSessao(profile?.role);
  return Response.json({
    userId: authData.user.id,
    email: authData.user.email ?? broker?.email ?? "",
    name: profile?.nome || broker?.nome || authData.user.email?.split("@")[0] || "Corretor",
    role,
    perfil: profile?.role ?? null, // papel bruto (gerente/diretor/…) — o campo `role` acima é normalizado
    active: profile?.ativo !== false && broker?.ativo !== false,
    brokerId: broker?.id ?? null,
    online: broker?.online ?? false,
    permissoes: effectivePermissions,
  }, { headers: { "Cache-Control": "private, no-store, no-cache" } });
}
