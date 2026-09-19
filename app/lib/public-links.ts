import { createHash, createHmac } from "node:crypto";
import { createServerSupabaseServiceClient } from "./supabase/server";

export type PublicLinkScope = "agenda:read" | "financing:read" | "financing:write";

type RateLimitResult = {
  allowed?: boolean;
  retry_after_seconds?: number;
};

export function publicLinkHardeningEnabled() {
  return process.env.PUBLIC_LINK_HARDENING_ENABLED === "true";
}

function clientAddress(request: Request) {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return request.headers.get("cf-connecting-ip")?.trim()
    || request.headers.get("true-client-ip")?.trim()
    || request.headers.get("x-real-ip")?.trim()
    || forwarded
    || "unknown";
}

export function publicLinkFingerprints(request: Request, token: string) {
  const pepper = process.env.PUBLIC_LINK_RATE_LIMIT_PEPPER;
  if (!pepper || pepper.length < 32) {
    throw new Error("PUBLIC_LINK_RATE_LIMIT_PEPPER ausente ou fraco.");
  }

  const tokenFingerprint = createHash("sha256").update(token).digest("hex");
  const agent = request.headers.get("user-agent")?.slice(0, 240) ?? "unknown";
  const clientFingerprint = createHmac("sha256", pepper)
    .update(`${clientAddress(request)}\n${agent}`)
    .digest("hex");

  return { tokenFingerprint, clientFingerprint };
}

export async function consumePublicLinkRate(
  scope: PublicLinkScope,
  tokenFingerprint: string,
  clientFingerprint: string,
) {
  const service = createServerSupabaseServiceClient();
  // A função V2 é service-only e persiste a janela de forma concorrente.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (service.rpc as any)("public_link_rate_consume", {
    p_scope: scope,
    p_token_fingerprint: tokenFingerprint,
    p_client_fingerprint: clientFingerprint,
  });
  if (error) throw new Error("Falha no controle de acesso público.");
  const result = (data ?? {}) as RateLimitResult;
  return {
    allowed: result.allowed === true,
    retryAfterSeconds: Math.max(1, Number(result.retry_after_seconds) || 60),
  };
}

export function publicNoStoreHeaders(extra?: Record<string, string>) {
  return {
    "Cache-Control": "no-store, max-age=0",
    "Referrer-Policy": "no-referrer",
    "X-Content-Type-Options": "nosniff",
    ...extra,
  };
}
