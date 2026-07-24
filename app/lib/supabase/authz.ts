// Resolução de acesso efetivo no servidor, compartilhada pelas rotas de API.
// Espelha a lógica do /api/session: override individual do usuário tem
// prioridade; sem override, cai no perfil do papel (role).
import { canDo, type PermissionMap } from "../permissions";
import type { createServerSupabaseClient } from "./server";

type ServerSupabase = ReturnType<typeof createServerSupabaseClient>;

export type EffectiveAccess = { role: string; permissions: PermissionMap };

export async function resolveEffectiveAccess(
  supabase: ServerSupabase,
  userId: string,
): Promise<EffectiveAccess> {
  const { data: userProfile, error } = await supabase
    .from("usuarios")
    .select("role,permissoes")
    .eq("id", userId)
    .maybeSingle();
  if (error || !userProfile) return { role: "", permissions: {} };

  const role = (userProfile as { role?: string }).role ?? "";
  let permissions = (userProfile as { permissoes?: PermissionMap | null }).permissoes ?? null;
  if (!permissions || Object.keys(permissions).length === 0) {
    const { data: roleProfile } = await supabase
      .from("perfis")
      .select("permissoes")
      .eq("id", role)
      .maybeSingle();
    permissions = (roleProfile as { permissoes?: PermissionMap | null } | null)?.permissoes ?? {};
  }
  return { role, permissions: permissions ?? {} };
}

/** true se o acesso pode executar a ação no módulo. */
export function accessCan(access: EffectiveAccess, moduleName: string, action: string): boolean {
  return canDo(access.role, access.permissions, moduleName, action);
}

/**
 * Guard para rotas: retorna uma Response 403 quando negado, ou null quando ok.
 * Aceita uma lista de pares (módulo, ação) — basta UM conceder (útil quando a
 * mesma ação faz sentido em módulos relacionados, ex.: crm/leads/pipeline).
 */
export function denyIfCannot(
  access: EffectiveAccess,
  pairs: Array<[moduleName: string, action: string]>,
  message = "Você não tem permissão para esta ação.",
): Response | null {
  const allowed = pairs.some(([moduleName, action]) => accessCan(access, moduleName, action));
  return allowed ? null : Response.json({ error: message }, { status: 403 });
}
