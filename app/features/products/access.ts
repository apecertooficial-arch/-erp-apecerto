import { GRUPOS, papelNoGrupo } from "../../lib/papeis";

/** Gestão de Produtos = grupo `produtos` (espelho de public.is_product_manager). */
export const PRODUCT_MANAGER_ROLES: ReadonlySet<string> = new Set(GRUPOS.produtos);

export function isProductManagerRole(role: string | null | undefined) {
  return papelNoGrupo(role, "produtos");
}

/** Alçada de Produtos por papel canônico ou concessão individual dedicada. */
export function isProductManagerAccess(
  role: string | null | undefined,
  dedicatedAccess = false,
) {
  return dedicatedAccess === true || isProductManagerRole(role);
}
