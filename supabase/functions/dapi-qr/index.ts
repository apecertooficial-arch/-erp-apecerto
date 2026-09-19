import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const DAPI_BASE_URL = (Deno.env.get("DAPI_BASE_URL") ?? "https://api.d-api.cloud").replace(/\/$/, "");
const WEBHOOK_SECRET = Deno.env.get("DAPI_WEBHOOK_SECRET") ?? "";
const DEFAULT_ORIGIN = "https://apecerto-erp.onrender.com";
const ALLOWED_ORIGINS = new Set(
  (Deno.env.get("ERP_ALLOWED_ORIGINS") ?? DEFAULT_ORIGIN)
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean),
);

type SessaoPainel = {
  legado_instancia_id?: number | null;
};

type DapiResult = {
  ok: boolean;
  status: number;
  body: Record<string, unknown>;
};

function corsHeaders(request: Request) {
  const origin = request.headers.get("origin");
  return {
    ...(origin && ALLOWED_ORIGINS.has(origin) ? { "Access-Control-Allow-Origin": origin } : {}),
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Cache-Control": "private, no-store",
    Vary: "Origin",
  };
}

function json(request: Request, body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders(request), "Content-Type": "application/json; charset=utf-8" },
  });
}

function bearer(request: Request) {
  const header = request.headers.get("authorization") ?? "";
  return header.toLowerCase().startsWith("bearer ") ? header.slice(7).trim() : "";
}

function positiveInteger(value: unknown) {
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null;
}

async function dapi(method: "GET" | "POST", path: string, apiKey: string, body?: unknown): Promise<DapiResult> {
  const response = await fetch(`${DAPI_BASE_URL}${path}`, {
    method,
    headers: {
      Authorization: apiKey,
      Accept: "application/json",
      ...(body === undefined ? {} : { "Content-Type": "application/json" }),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(20_000),
  });
  const payload = await response.json().catch(() => ({}));
  return {
    ok: response.ok,
    status: response.status,
    body: payload && typeof payload === "object" ? payload as Record<string, unknown> : {},
  };
}

Deno.serve(async (request: Request) => {
  const origin = request.headers.get("origin");
  if (request.method === "OPTIONS") {
    if (origin && !ALLOWED_ORIGINS.has(origin)) return json(request, { error: "origem_nao_permitida" }, 403);
    return new Response("ok", { headers: corsHeaders(request) });
  }
  if (request.method !== "POST") return json(request, { error: "metodo_nao_permitido" }, 405);
  if (origin && !ALLOWED_ORIGINS.has(origin)) return json(request, { error: "origem_nao_permitida" }, 403);
  if (!SUPABASE_URL || !SERVICE_ROLE_KEY || !WEBHOOK_SECRET) {
    return json(request, { error: "conexao_nao_configurada" }, 503);
  }

  const token = bearer(request);
  if (!token) return json(request, { error: "sessao_necessaria" }, 401);

  try {
    const authorization = `Bearer ${token}`;
    const userClient = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
      global: { headers: { Authorization: authorization } },
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: auth, error: authError } = await userClient.auth.getUser(token);
    if (authError || !auth.user) return json(request, { error: "sessao_invalida" }, 401);

    const body = await request.json().catch(() => null) as Record<string, unknown> | null;
    const action = body?.action === "restart" ? "restart" : body?.action === "qr" ? "qr" : null;
    const instanciaId = positiveInteger(body?.instanciaId);
    if (!action || !instanciaId) return json(request, { error: "acao_ou_instancia_invalida" }, 422);

    // A mesma autoridade que monta a tela decide quais instancias o usuario
    // pode operar. O body e apenas um pedido, nunca a autorizacao.
    const { data: painel, error: painelError } = await userClient.rpc("wa_v7_painel");
    if (painelError) return json(request, { error: "autorizacao_indisponivel" }, 502);
    const sessoes = Array.isArray((painel as { sessoes?: unknown })?.sessoes)
      ? (painel as { sessoes: SessaoPainel[] }).sessoes
      : [];
    if (!sessoes.some((item) => Number(item.legado_instancia_id) === instanciaId)) {
      return json(request, { error: "instancia_nao_encontrada_ou_sem_acesso" }, 404);
    }

    const { data: instancia, error: instanciaError } = await admin
      .from("instancias")
      .select("id,nome,instancia_dapi")
      .eq("id", instanciaId)
      .maybeSingle();
    if (instanciaError || !instancia?.instancia_dapi) {
      return json(request, { error: "instancia_indisponivel" }, 404);
    }
    const { data: credencial, error: credencialError } = await admin
      .from("instancias_credenciais")
      .select("apikey")
      .eq("instancia_id", instanciaId)
      .maybeSingle();
    if (credencialError || !credencial?.apikey) {
      return json(request, { error: "credencial_nao_configurada" }, 422);
    }

    const sessao = encodeURIComponent(String(instancia.instancia_dapi));
    if (action === "restart") {
      const restarted = await dapi("POST", `/api/v1/sessions/${sessao}/restart`, credencial.apikey, {});
      if (!restarted.ok) return json(request, { error: "provedor_recusou_reinicio" }, 502);
    }

    const qr = await dapi("GET", `/api/v1/sessions/${sessao}/qr`, credencial.apikey);
    if (!qr.ok) return json(request, { error: "provedor_nao_gerou_qr" }, 502);
    const status = typeof qr.body.status === "string" ? qr.body.status.slice(0, 40) : "desconhecido";
    const connected = status === "connected";
    let qrCodeImage = typeof qr.body.qrCodeImage === "string" ? qr.body.qrCodeImage : null;
    if (qrCodeImage && qrCodeImage.length > 2_000_000) qrCodeImage = null;

    if (connected) {
      const webhookUrl = `${SUPABASE_URL}/functions/v1/dapi-webhook?s=${encodeURIComponent(WEBHOOK_SECRET)}`;
      const webhook = await dapi("POST", `/api/v1/sessions/${sessao}/webhook`, credencial.apikey, { webhookUrl });
      if (!webhook.ok) return json(request, { error: "webhook_nao_configurado" }, 502);
    }

    const { error: updateError } = await admin
      .from("instancias")
      .update({
        conectada: connected,
        status_dapi: status,
        ...(connected ? { conectada_em: new Date().toISOString() } : {}),
      })
      .eq("id", instanciaId);
    if (updateError) return json(request, { error: "estado_nao_persistido" }, 502);

    return json(request, {
      instanciaId,
      nome: instancia.nome,
      status,
      qrCodeImage: connected ? null : qrCodeImage,
      conectada: connected,
    });
  } catch {
    return json(request, { error: "falha_interna" }, 500);
  }
});
