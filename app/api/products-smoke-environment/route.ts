export const dynamic = "force-dynamic";

const HEX64 = /^[0-9a-f]{64}$/i;
const CHALLENGE = /^[0-9a-f]{32,128}$/i;

async function sha256(value: string) {
  const bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(bytes), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function hmac(secret: string, value: string) {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(value));
  return Array.from(new Uint8Array(signature), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function GET(request: Request) {
  if (process.env.PRODUCTS_ISOLATED_SMOKE_ENABLED !== "true") return Response.json({ error: "Não encontrado." }, { status: 404 });
  const challenge = new URL(request.url).searchParams.get("challenge") ?? "";
  const expectedHash = process.env.PRODUCTS_ISOLATED_PROJECT_REF_SHA256 ?? "";
  const secret = process.env.PRODUCTS_ISOLATED_SMOKE_PROOF_SECRET ?? "";
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  let projectRef = "";
  try { projectRef = new URL(supabaseUrl).hostname.split(".")[0] ?? ""; } catch { /* falha fechada abaixo */ }
  if (!CHALLENGE.test(challenge) || !HEX64.test(expectedHash) || secret.length < 32 || !projectRef) {
    return Response.json({ error: "Prova indisponível." }, { status: 503 });
  }
  const projectRefHash = await sha256(projectRef);
  if (projectRefHash !== expectedHash.toLowerCase()) return Response.json({ error: "Ambiente não autorizado." }, { status: 403 });
  const isolated = true;
  const signature = await hmac(secret, `${challenge}|${projectRefHash}|${isolated}`);
  return Response.json({ isolated, projectRefHash, signature }, { headers: { "Cache-Control": "private, no-store" } });
}
