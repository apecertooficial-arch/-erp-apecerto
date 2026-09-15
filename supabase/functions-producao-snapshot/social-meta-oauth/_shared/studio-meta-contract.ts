export const META_REQUIRED_SCOPES = [
  "pages_show_list",
  "instagram_basic",
  "instagram_content_publish",
  "pages_read_engagement",
] as const;

export type MetaPageAccount = {
  id: string;
  name: string;
  access_token: string;
  instagram_business_account?: {
    id?: string;
    username?: string;
    name?: string;
    profile_picture_url?: string;
  } | null;
};

export function normalizeGraphVersion(value: unknown) {
  const version = String(value ?? "").trim();
  if (!/^v\d{1,2}\.\d{1,2}$/.test(version)) throw new Error("META_GRAPH_API_VERSION inválida.");
  return version;
}

export function assertExactRedirectUri(value: unknown) {
  const raw = String(value ?? "").trim();
  const url = new URL(raw);
  if (url.protocol !== "https:" && !(url.protocol === "http:" && ["127.0.0.1", "localhost"].includes(url.hostname))) {
    throw new Error("Redirect URI Meta precisa usar HTTPS (ou localhost em homologação).");
  }
  if (url.hash || url.username || url.password) throw new Error("Redirect URI Meta inválida.");
  return url.toString();
}

export function missingMetaScopes(rows: unknown) {
  const granted = new Set(
    Array.isArray(rows)
      ? rows.filter((row): row is { permission?: string; status?: string } => Boolean(row && typeof row === "object"))
        .filter((row) => row.status === "granted")
        .map((row) => String(row.permission ?? ""))
      : [],
  );
  return META_REQUIRED_SCOPES.filter((scope) => !granted.has(scope));
}

export function selectProfessionalAccount(rows: unknown): MetaPageAccount {
  if (!Array.isArray(rows)) throw new Error("A Meta não devolveu as Páginas administradas.");
  const account = rows.find((row): row is MetaPageAccount => {
    if (!row || typeof row !== "object") return false;
    const candidate = row as Partial<MetaPageAccount>;
    return Boolean(candidate.id && candidate.access_token && candidate.instagram_business_account?.id);
  });
  if (!account) throw new Error("Nenhuma conta profissional do Instagram vinculada a uma Página foi encontrada.");
  return account;
}

export async function sha256Hex(value: string) {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

export function oauthEnabled(env: Record<string, string | undefined>) {
  return env.META_OAUTH_ENABLED === "true"
    && Boolean(env.META_APP_ID && env.META_APP_SECRET && env.META_OAUTH_REDIRECT_URI && env.META_GRAPH_API_VERSION);
}

