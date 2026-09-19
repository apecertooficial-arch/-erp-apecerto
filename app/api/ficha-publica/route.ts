import {
  consumePublicLinkRate,
  publicLinkFingerprints,
  publicLinkHardeningEnabled,
  publicNoStoreHeaders,
} from "../../lib/public-links";
import { createServerSupabaseClient, createServerSupabaseServiceClient } from "../../lib/supabase/server";

export const dynamic = "force-dynamic";

/* Ficha de financiamento pública — validada pelo token do link (sem login).
   Mesmo padrão da agenda pública: RPCs SECURITY DEFINER no banco. */

const validToken = (token: string) => /^[a-f0-9]{30,80}$/i.test(token);
const json = (body: unknown, status = 200, headers?: Record<string, string>) =>
  Response.json(body, { status, headers: publicNoStoreHeaders(headers) });
const requestToken = (request: Request, bodyToken?: unknown) =>
  request.headers.get("x-apecerto-public-token")?.trim()
  || (typeof bodyToken === "string" ? bodyToken.trim() : "")
  || new URL(request.url).searchParams.get("token")?.trim()
  || "";

async function hardenedContext(request: Request, token: string, scope: "financing:read" | "financing:write") {
  const fingerprints = publicLinkFingerprints(request, token);
  const rate = await consumePublicLinkRate(scope, fingerprints.tokenFingerprint, fingerprints.clientFingerprint);
  return { fingerprints, rate };
}

export async function GET(request: Request) {
  const token = requestToken(request);
  if (!validToken(token)) return json({ error: "Link inválido." }, 400);
  const hardened = publicLinkHardeningEnabled();
  let supabase = createServerSupabaseClient();
  let rpcName = "ficha_publica_obter";
  let rpcArgs: Record<string, unknown> = { p_token: token };
  if (hardened) {
    try {
      const { fingerprints, rate } = await hardenedContext(request, token, "financing:read");
      if (!rate.allowed) return json({ error: "Muitas tentativas. Aguarde e tente novamente." }, 429, { "Retry-After": String(rate.retryAfterSeconds) });
      supabase = createServerSupabaseServiceClient();
      rpcName = "ficha_publica_obter_v2";
      rpcArgs = { ...rpcArgs, p_client_fingerprint: fingerprints.clientFingerprint };
    } catch {
      return json({ error: "A ficha está temporariamente indisponível." }, 503);
    }
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase.rpc as any)(rpcName, rpcArgs);
  if (error) return json({ error: "Não foi possível abrir a ficha." }, 502);
  if (!data) return json({ error: "Esta ficha não existe mais. Peça um novo link ao seu corretor." }, 404);
  const result = data as { ok?: boolean; data?: unknown; code?: string };
  if (hardened && result.ok !== true) {
    const gone = ["EXPIRED", "REVOKED", "ALREADY_USED"].includes(result.code ?? "");
    return json({ error: gone ? "Este link expirou ou já foi utilizado. Peça um novo link ao seu corretor." : "Link inválido." }, gone ? 410 : 404);
  }
  return json(hardened ? result.data : data);
}

export async function POST(request: Request) {
  const contentLength = Number(request.headers.get("content-length") || 0);
  if (contentLength > 32_768) return json({ error: "Dados excedem o tamanho permitido." }, 413);
  if (!request.headers.get("content-type")?.toLowerCase().startsWith("application/json")) {
    return json({ error: "Formato inválido." }, 415);
  }
  const rawBody = await request.text();
  if (new TextEncoder().encode(rawBody).byteLength > 32_768) {
    return json({ error: "Dados excedem o tamanho permitido." }, 413);
  }
  let body: { token?: string; dados?: Record<string, unknown> };
  try {
    body = JSON.parse(rawBody) as { token?: string; dados?: Record<string, unknown> };
  } catch {
    return json({ error: "JSON inválido." }, 400);
  }
  const token = requestToken(request, body.token);
  if (!validToken(token)) return json({ error: "Link inválido." }, 400);
  if (!body.dados || typeof body.dados !== "object" || Array.isArray(body.dados)) return json({ error: "Dados inválidos." }, 422);
  const hardened = publicLinkHardeningEnabled();
  let supabase = createServerSupabaseClient();
  let rpcName = "ficha_publica_enviar";
  let rpcArgs: Record<string, unknown> = { p_token: token, p_dados: body.dados };
  if (hardened) {
    try {
      const { fingerprints, rate } = await hardenedContext(request, token, "financing:write");
      if (!rate.allowed) return json({ error: "Muitas tentativas. Aguarde e tente novamente." }, 429, { "Retry-After": String(rate.retryAfterSeconds) });
      supabase = createServerSupabaseServiceClient();
      rpcName = "ficha_publica_enviar_v2";
      rpcArgs = { ...rpcArgs, p_client_fingerprint: fingerprints.clientFingerprint };
    } catch {
      return json({ error: "A ficha está temporariamente indisponível." }, 503);
    }
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase.rpc as any)(rpcName, rpcArgs);
  if (error) return json({ error: "Não foi possível enviar." }, 502);
  const result = (data ?? {}) as { ok?: boolean; error?: string; code?: string };
  if (!result.ok) {
    const gone = hardened && ["EXPIRED", "REVOKED", "ALREADY_USED"].includes(result.code ?? "");
    return json({ error: gone ? "Este link expirou ou já foi utilizado." : result.error || "Não foi possível enviar." }, gone ? 410 : 422);
  }
  return json({ success: true });
}
