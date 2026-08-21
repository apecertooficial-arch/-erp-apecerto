import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const cors = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization,apikey,content-type",
  "Access-Control-Allow-Methods": "POST,OPTIONS",
};

const response = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: cors });

function requestIp(request: Request): string {
  const raw = request.headers.get("cf-connecting-ip") ??
    request.headers.get("x-real-ip") ??
    request.headers.get("x-forwarded-for") ?? "";
  return raw.split(",")[0].trim().slice(0, 60);
}

Deno.serve(async (request: Request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (request.method !== "POST") {
    return response({ ok: false, error: "METHOD_NOT_ALLOWED" }, 405);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const authorization = request.headers.get("Authorization") ?? "";
  if (!authorization.startsWith("Bearer ")) {
    return response({ ok: false, error: "AUTH_REQUIRED" }, 401);
  }

  // Nao decodifica JWT manualmente: o Auth precisa validar assinatura, prazo e
  // usuario antes que qualquer gravacao com service_role seja permitida.
  const userResult = await fetch(`${supabaseUrl}/auth/v1/user`, {
    headers: { apikey: serviceRoleKey, Authorization: authorization },
  });
  if (!userResult.ok) return response({ ok: false, error: "INVALID_SESSION" }, 401);
  const user = await userResult.json() as { id?: string };
  if (!user.id) return response({ ok: false, error: "INVALID_SESSION" }, 401);

  let body: Record<string, unknown> = {};
  try {
    body = await request.json();
  } catch {
    // Corpo vazio equivale a inspecao do IP para a tela de configuracao.
  }
  const action = String(body.action ?? "inspect");
  if (action !== "inspect" && action !== "confirm") {
    return response({ ok: false, error: "INVALID_ACTION" }, 400);
  }

  const ip = requestIp(request);
  const serviceHeaders = {
    apikey: serviceRoleKey,
    Authorization: `Bearer ${serviceRoleKey}`,
    "Content-Type": "application/json",
  };
  const configResult = await fetch(
    `${supabaseUrl}/rest/v1/escritorio_config?id=eq.1&select=ips&limit=1`,
    { headers: serviceHeaders },
  );
  if (!configResult.ok) return response({ ok: false, error: "OFFICE_CONFIG_UNAVAILABLE" }, 502);
  const rows = await configResult.json() as Array<{ ips?: string[] }>;
  const officeIps = Array.isArray(rows[0]?.ips) ? rows[0].ips! : [];
  const noEscritorio = ip.length > 0 && officeIps.some((value) => value.trim() === ip);

  if (action === "inspect") {
    return response({ ok: true, ip, no_escritorio: noEscritorio });
  }

  const registerResult = await fetch(
    `${supabaseUrl}/rest/v1/rpc/presenca_registrar_segura`,
    {
      method: "POST",
      headers: serviceHeaders,
      body: JSON.stringify({
        p_sub: user.id,
        p_no_escritorio: noEscritorio,
        p_ip: ip,
      }),
    },
  );
  const registerText = await registerResult.text();
  if (!registerResult.ok) {
    return response({ ok: false, error: "PRESENCE_REGISTER_FAILED" }, 502);
  }
  const registered = JSON.parse(registerText) as Record<string, unknown>;
  if (!noEscritorio || registered.ok !== true) {
    return response({
      ok: false,
      error: "OUTSIDE_OFFICE",
      no_escritorio: false,
    }, 409);
  }

  return response({
    ok: true,
    no_escritorio: true,
    validade_min: registered.validade_min,
  });
});
