// Preferencias de interface por usuario.
//
// "Modo silencioso": o usuario NAO ve a central de alertas de lead (o sininho
// que abre sozinho) e NAO ve a assistente de IA (Sara).
// Para adicionar/remover alguem, edite a lista abaixo com o e-mail em minusculas.
const SILENT_USERS = new Set<string>([
  "comercialromulopedroso@gmail.com",
]);

export function isSilentUser(email?: string | null): boolean {
  return !!email && SILENT_USERS.has(email.trim().toLowerCase());
}
