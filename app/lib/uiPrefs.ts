// Preferencias de interface por usuario.
//
// "Modo silencioso": o usuario NAO ve a assistente de IA (Sara) nem o alerta de
// desconexao. Para adicionar/remover alguem, edite a lista abaixo (e-mail minusculo).
const SILENT_USERS = new Set<string>([
  "comercialromulopedroso@gmail.com",
]);

export function isSilentUser(email?: string | null): boolean {
  return !!email && SILENT_USERS.has(email.trim().toLowerCase());
}

// Central de atencao (sininho): controlada separadamente do modo silencioso.
// So quem estiver nesta lista NAO ve a central. Vazio = todos veem.
const ATTENTION_HIDDEN_USERS = new Set<string>([]);

export function showsAttentionCenter(email?: string | null): boolean {
  return !(email && ATTENTION_HIDDEN_USERS.has(email.trim().toLowerCase()));
}
