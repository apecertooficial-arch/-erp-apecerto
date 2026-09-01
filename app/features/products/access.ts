export const PRODUCT_MANAGER_ROLES = new Set([
  "admin",
  "gestor",
  "executivo",
  "gestor_comercial",
  "gestor_equipe",
  "gerente",
]);

export function isProductManagerRole(role: string | null | undefined) {
  return Boolean(role && PRODUCT_MANAGER_ROLES.has(role));
}
