/* Validacao da inscricao de push, sem dependencia de Supabase.
 *
 * Separada da rota para poder ser testada no node, no mesmo padrao de
 * fila-operacional/logica.ts.
 */

export type Inscricao = { endpoint: string; p256dh: string; auth: string; userAgent: string | null };

/** Tamanhos exatos em base64url: 65 bytes viram 87 chars, 16 viram 22. */
const P256DH_TAM = 87;
const AUTH_TAM = 22;
const ENDPOINT_MAX = 1000;

const B64URL = /^[A-Za-z0-9_-]+$/;

/**
 * So aceita endpoint https de servico de push conhecido.
 *
 * Sem esta trava, um endpoint arbitrario transformaria a edge function num
 * proxy: qualquer pessoa logada mandaria o servidor fazer POST autenticado para
 * a URL que quisesse (SSRF). A lista fechada e o que impede isso.
 */
const HOSTS_PERMITIDOS = [
  /^fcm\.googleapis\.com$/,                  // Chrome / Android
  /^updates\.push\.services\.mozilla\.com$/, // Firefox
  /^[a-z0-9-]+\.notify\.windows\.com$/,      // Edge / Windows
  /^web\.push\.apple\.com$/,                 // Safari / iOS
];

export function endpointPermitido(bruto: string): boolean {
  let url: URL;
  try { url = new URL(bruto); } catch { return false; }
  if (url.protocol !== "https:") return false;
  return HOSTS_PERMITIDOS.some((re) => re.test(url.hostname));
}

export function validarInscricao(bruto: unknown): Inscricao | null {
  if (!bruto || typeof bruto !== "object") return null;
  const o = bruto as Record<string, unknown>;

  const endpoint = typeof o.endpoint === "string" ? o.endpoint.trim() : "";
  const p256dh = typeof o.p256dh === "string" ? o.p256dh.trim() : "";
  const auth = typeof o.auth === "string" ? o.auth.trim() : "";

  if (!endpoint || endpoint.length > ENDPOINT_MAX || !endpointPermitido(endpoint)) return null;
  if (p256dh.length !== P256DH_TAM || !B64URL.test(p256dh)) return null;
  if (auth.length !== AUTH_TAM || !B64URL.test(auth)) return null;

  const userAgent = typeof o.userAgent === "string" && o.userAgent.trim()
    ? o.userAgent.trim().slice(0, 200)
    : null;

  return { endpoint, p256dh, auth, userAgent };
}
