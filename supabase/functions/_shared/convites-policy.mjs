const TOKEN_RE = /^[A-Za-z0-9_-]{40,160}$/;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export function normalizarTokenConvite(value) {
  const token = String(value ?? "").trim();
  return TOKEN_RE.test(token) ? token : "";
}

export async function sha256Hex(value) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(String(value ?? "")));
  return Array.from(new Uint8Array(digest)).map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function tokenArmazenado(value) {
  const token = normalizarTokenConvite(value);
  return token ? `sha256:${await sha256Hex(token)}` : "";
}

// O segundo valor existe apenas para links legados, emitidos antes de o banco
// passar a guardar somente o hash. Novos convites nunca persistem o token cru.
export async function candidatosToken(value) {
  const token = normalizarTokenConvite(value);
  return token ? [await tokenArmazenado(token), token] : [];
}

export function gerarTokenConvite() {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return Array.from(bytes).map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

export function normalizarEmail(value) {
  const email = String(value ?? "").normalize("NFKC").trim().toLowerCase();
  return email.length <= 254 && EMAIL_RE.test(email) ? email : "";
}

export function problemaSenha(value) {
  if (typeof value !== "string" || value.length < 8) return "senha_curta";
  if (value.length > 72) return "senha_longa";
  return null;
}

export function uuidValido(value) {
  const id = String(value ?? "").trim();
  return UUID_RE.test(id) ? id : null;
}

export function papelAutocadastroValido(value) {
  return value === "corretor";
}
