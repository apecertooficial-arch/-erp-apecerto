const DEFAULT_ORIGIN = "https://apecerto-erp.onrender.com";

function allowedOrigins() {
  return new Set(
    (Deno.env.get("ERP_ALLOWED_ORIGINS") ?? DEFAULT_ORIGIN)
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean),
  );
}

export function corsHeaders(request: Request) {
  const origin = request.headers.get("origin");
  const allowed = allowedOrigins();
  return {
    ...(origin && allowed.has(origin) ? { "Access-Control-Allow-Origin": origin } : {}),
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Cache-Control": "private, no-store",
    Vary: "Origin",
  };
}

export function originAllowed(request: Request) {
  const origin = request.headers.get("origin");
  return !origin || allowedOrigins().has(origin);
}

export function json(request: Request, body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders(request), "Content-Type": "application/json; charset=utf-8" },
  });
}

export function bearer(request: Request) {
  const header = request.headers.get("authorization") ?? "";
  return header.toLowerCase().startsWith("bearer ") ? header.slice(7).trim() : "";
}

export function preflight(request: Request) {
  if (!originAllowed(request)) return json(request, { ok: false, motivo: "origem_nao_permitida" }, 403);
  return new Response("ok", { headers: corsHeaders(request) });
}
