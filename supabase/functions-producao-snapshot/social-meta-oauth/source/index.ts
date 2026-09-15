import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import {
  META_REQUIRED_SCOPES,
  assertExactRedirectUri,
  missingMetaScopes,
  normalizeGraphVersion,
  oauthEnabled,
  selectProfessionalAccount,
  sha256Hex,
} from "../_shared/studio-meta-contract.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const ORGANIZATION_ID = "00000000-0000-4000-8000-000000000001";
const env = {
  META_OAUTH_ENABLED: Deno.env.get("META_OAUTH_ENABLED") ?? undefined,
  META_APP_ID: Deno.env.get("META_APP_ID") ?? undefined,
  META_APP_SECRET: Deno.env.get("META_APP_SECRET") ?? undefined,
  META_OAUTH_REDIRECT_URI: Deno.env.get("META_OAUTH_REDIRECT_URI") ?? undefined,
  META_GRAPH_API_VERSION: Deno.env.get("META_GRAPH_API_VERSION") ?? undefined,
};
const studioReturnUrl = Deno.env.get("META_STUDIO_RETURN_URL") ?? "";
const service = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

type Json = Record<string, unknown>;
const json = (body: Json, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { "content-type": "application/json", "cache-control": "no-store" },
});
const safe = (value: unknown, max = 400) => String(value ?? "").replace(/[\r\n\0]/g, " ").slice(0, max);

function returnRedirect(status: "connected" | "error", reason?: string) {
  try {
    const url = new URL(assertExactRedirectUri(studioReturnUrl));
    url.searchParams.set("meta", status);
    if (reason) url.searchParams.set("reason", safe(reason, 120));
    return Response.redirect(url, 302);
  } catch {
    return json({ ok: false, error: status, reason: safe(reason) }, status === "connected" ? 200 : 400);
  }
}

function configuration() {
  if (!oauthEnabled(env)) throw new Error("Meta OAuth está desativado até as credenciais serem configuradas.");
  return {
    appId: env.META_APP_ID!,
    appSecret: env.META_APP_SECRET!,
    redirectUri: assertExactRedirectUri(env.META_OAUTH_REDIRECT_URI),
    version: normalizeGraphVersion(env.META_GRAPH_API_VERSION),
  };
}

async function authorize(request: Request) {
  const authorization = request.headers.get("authorization") ?? "";
  if (!authorization.startsWith("Bearer ")) throw new Error("Sessão necessária.");
  const userClient = createClient(SUPABASE_URL, ANON_KEY, {
    auth: { persistSession: false },
    global: { headers: { Authorization: authorization } },
  });
  const { data, error } = await userClient.auth.getUser(authorization.slice(7));
  if (error || !data.user) throw new Error("Sessão inválida.");
  const { data: allowed, error: permissionError } = await userClient.rpc("social_has_permission", {
    p_action: "configurar",
    p_organization_id: ORGANIZATION_ID,
  });
  if (permissionError || allowed !== true) throw new Error("Sem permissão para configurar o Instagram.");
  return data.user.id;
}

async function graphGet(path: string, params: Record<string, string>, token?: string) {
  const cfg = configuration();
  const url = new URL(`https://graph.facebook.com/${cfg.version}/${path.replace(/^\//, "")}`);
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
  const response = await fetch(url, {
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    signal: AbortSignal.timeout(30_000),
  });
  const payload = await response.json().catch(() => ({})) as Json;
  if (!response.ok) throw new Error(safe((payload.error as Json | undefined)?.message ?? "A Meta recusou a solicitação."));
  return payload;
}

async function exchangeOAuthToken(params: Record<string, string>) {
  const cfg = configuration();
  const response = await fetch(`https://graph.facebook.com/${cfg.version}/oauth/access_token`, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(params),
    signal: AbortSignal.timeout(30_000),
  });
  const payload = await response.json().catch(() => ({})) as Json;
  if (!response.ok) throw new Error(safe((payload.error as Json | undefined)?.message ?? "A Meta recusou a troca de credencial."));
  return payload;
}

async function start(request: Request) {
  const cfg = configuration();
  const userId = await authorize(request);
  const stateBytes = crypto.getRandomValues(new Uint8Array(32));
  const state = [...stateBytes].map((byte) => byte.toString(16).padStart(2, "0")).join("");
  const stateHash = await sha256Hex(state);
  const { error } = await service.from("social_meta_oauth_states").insert({
    organization_id: ORGANIZATION_ID,
    state_hash: stateHash,
    redirect_uri: cfg.redirectUri,
    solicitado_por: userId,
    expires_at: new Date(Date.now() + 10 * 60_000).toISOString(),
  });
  if (error) throw new Error("Não foi possível iniciar o OAuth com segurança.");
  const url = new URL(`https://www.facebook.com/${cfg.version}/dialog/oauth`);
  url.searchParams.set("client_id", cfg.appId);
  url.searchParams.set("redirect_uri", cfg.redirectUri);
  url.searchParams.set("state", state);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", META_REQUIRED_SCOPES.join(","));
  return json({ ok: true, authorization_url: url.toString(), expires_in: 600 });
}

async function callback(request: Request) {
  const cfg = configuration();
  const url = new URL(request.url);
  const state = url.searchParams.get("state") ?? "";
  const code = url.searchParams.get("code") ?? "";
  if (!/^[a-f0-9]{64}$/.test(state) || !code) return returnRedirect("error", "callback_invalido");
  const stateHash = await sha256Hex(state);
  const { data: row } = await service.from("social_meta_oauth_states")
    .select("id,organization_id,redirect_uri,solicitado_por,expires_at,consumed_at")
    .eq("state_hash", stateHash).is("consumed_at", null).gt("expires_at", new Date().toISOString()).maybeSingle();
  if (!row || row.redirect_uri !== cfg.redirectUri || row.organization_id !== ORGANIZATION_ID) return returnRedirect("error", "state_invalido_ou_expirado");
  const { data: consumed, error: consumeError } = await service.from("social_meta_oauth_states")
    .update({ consumed_at: new Date().toISOString() }).eq("id", row.id).is("consumed_at", null).select("id").maybeSingle();
  if (consumeError || !consumed) return returnRedirect("error", "state_reutilizado");
  try {
    const shortToken = await exchangeOAuthToken({
      client_id: cfg.appId,
      client_secret: cfg.appSecret,
      redirect_uri: cfg.redirectUri,
      code,
    });
    const shortAccessToken = safe(shortToken.access_token, 4096);
    if (!shortAccessToken) throw new Error("Token temporário ausente.");
    const longToken = await exchangeOAuthToken({
      grant_type: "fb_exchange_token",
      client_id: cfg.appId,
      client_secret: cfg.appSecret,
      fb_exchange_token: shortAccessToken,
    });
    const userAccessToken = safe(longToken.access_token, 4096);
    if (!userAccessToken) throw new Error("Token de longa duração ausente.");
    const permissions = await graphGet("me/permissions", {}, userAccessToken);
    const missing = missingMetaScopes(permissions.data);
    if (missing.length) throw new Error(`Permissões Meta ausentes: ${missing.join(", ")}.`);
    const pages = await graphGet("me/accounts", {
      fields: "id,name,access_token,instagram_business_account{id,username,name,profile_picture_url}",
      limit: "100",
    }, userAccessToken);
    const page = selectProfessionalAccount(pages.data);
    const account = page.instagram_business_account!;
    const expiresIn = Number(longToken.expires_in ?? 0);
    const expiresAt = expiresIn > 0 ? new Date(Date.now() + expiresIn * 1000).toISOString() : null;
    const configPublica = {
      page_id: page.id,
      page_name: safe(page.name, 160),
      ig_user_id: safe(account.id, 120),
      ig_username: safe(account.username, 120),
      account_type: "professional",
      scopes: META_REQUIRED_SCOPES,
      graph_host: "graph.facebook.com",
      graph_api_version: cfg.version,
    };
    const { error: storeError } = await service.rpc("social_service_store_meta_token", {
      p_organization_id: ORGANIZATION_ID,
      p_access_token: page.access_token,
      p_config_publica: configPublica,
      p_expires_at: expiresAt,
    });
    if (storeError) throw new Error("Não foi possível guardar a credencial no Vault.");
    return returnRedirect("connected");
  } catch (reason) {
    return returnRedirect("error", reason instanceof Error ? reason.message : "falha_meta");
  }
}

async function disconnect(request: Request) {
  await authorize(request);
  const { error } = await service.rpc("social_service_disconnect_meta", { p_organization_id: ORGANIZATION_ID });
  if (error) throw new Error("Não foi possível desconectar o Instagram.");
  return json({ ok: true, status: "desativada" });
}

Deno.serve(async (request) => {
  try {
    const url = new URL(request.url);
    if (request.method === "GET" && url.searchParams.has("code")) return await callback(request);
    if (request.method !== "POST") return json({ ok: false, error: "method_not_allowed" }, 405);
    const body = await request.json().catch(() => ({})) as Json;
    if (body.action === "start") return await start(request);
    if (body.action === "disconnect") return await disconnect(request);
    return json({ ok: false, error: "unknown_action" }, 400);
  } catch (reason) {
    const message = reason instanceof Error ? reason.message : "Falha no OAuth Meta.";
    const status = /desativado|configurad/.test(message) ? 503 : /Sessão/.test(message) ? 401 : /permissão/.test(message) ? 403 : 400;
    return json({ ok: false, error: safe(message) }, status);
  }
});
