import {
  consumePublicLinkRate,
  publicLinkFingerprints,
  publicLinkHardeningEnabled,
  publicNoStoreHeaders,
} from "../../lib/public-links";
import { createServerSupabaseClient, createServerSupabaseServiceClient } from "../../lib/supabase/server";

export const dynamic = "force-dynamic";

const json = (body: unknown, status = 200, headers?: Record<string, string>) =>
  Response.json(body, { status, headers: publicNoStoreHeaders(headers) });

function requestToken(request: Request) {
  const header = request.headers.get("x-apecerto-public-token")?.trim();
  return header || new URL(request.url).searchParams.get("token")?.trim() || "";
}

/* Agenda pública (somente leitura) — validada pelo código secreto do link. */
export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const token = requestToken(request);
  if (!/^[a-f0-9]{40,80}$/i.test(token)) {
    return json({ error: "Link inválido." }, 400);
  }
  const dia = (v: string | null) => v && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null;
  const hardened = publicLinkHardeningEnabled();
  let supabase = createServerSupabaseClient();
  let rpcName = "agenda_publica";
  let rpcArgs: Record<string, unknown> = {
    p_token: token,
    p_de: dia(params.get("de")),
    p_ate: dia(params.get("ate")),
  };

  if (hardened) {
    try {
      const fingerprints = publicLinkFingerprints(request, token);
      const rate = await consumePublicLinkRate("agenda:read", fingerprints.tokenFingerprint, fingerprints.clientFingerprint);
      if (!rate.allowed) {
        return json(
          { error: "Muitas tentativas. Aguarde e tente novamente." },
          429,
          { "Retry-After": String(rate.retryAfterSeconds) },
        );
      }
      supabase = createServerSupabaseServiceClient();
      rpcName = "agenda_publica_v2";
      rpcArgs = { ...rpcArgs, p_client_fingerprint: fingerprints.clientFingerprint };
    } catch {
      return json({ error: "A agenda pública está temporariamente indisponível." }, 503);
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase.rpc as any)(rpcName, rpcArgs);
  if (error) return json({ error: "Não foi possível abrir a agenda." }, 502);
  if (!data) return json({ error: "Este link de agenda não existe mais. Peça o link atualizado." }, 404);
  const result = data as { ok?: boolean; data?: unknown; code?: string };
  if (hardened && result.ok !== true) {
    const expired = result.code === "EXPIRED" || result.code === "REVOKED";
    return json({ error: expired ? "Este link expirou. Peça um link atualizado." : "Link inválido." }, expired ? 410 : 404);
  }
  return json(hardened ? result.data : data);
}
