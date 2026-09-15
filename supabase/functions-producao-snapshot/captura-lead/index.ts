import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
  });

Deno.serve(async (req: Request) => {
  const url = new URL(req.url);

  // CORS preflight (formularios de site)
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
        "Access-Control-Allow-Headers": "content-type, x-webhook-token",
      },
    });
  }

  // GET: health check + handshake de verificacao do Facebook (hub.challenge)
  if (req.method === "GET") {
    const challenge = url.searchParams.get("hub.challenge");
    if (challenge) return new Response(challenge, { status: 200 });
    return json({ ok: true, status: "captura-lead online" });
  }

  if (req.method !== "POST") return json({ ok: false, erro: "metodo_nao_permitido" }, 405);

  const token = url.searchParams.get("token") || req.headers.get("x-webhook-token") || "";

  let body: Record<string, any> = {};
  try { body = await req.json(); } catch (_) { body = {}; }

  // Aceita formatos comuns de formulario (site / conectores)
  const lead = {
    nome: body.nome ?? body.name ?? body.full_name ?? body.nome_completo ?? "",
    telefone: body.telefone ?? body.phone ?? body.telefone_celular ?? body.whatsapp ?? body.celular ?? "",
    email: body.email ?? body.e_mail ?? "",
    origem: body.origem ?? body.source ?? url.searchParams.get("origem") ?? "webhook",
  };

  try {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/rpc/webhook_captura_lead`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: SERVICE_KEY,
        Authorization: `Bearer ${SERVICE_KEY}`,
      },
      body: JSON.stringify({ p_token: token, p_lead: lead }),
    });
    const out = await r.json();
    const ok = out && out.ok === true;
    return json(out, ok ? 200 : 400);
  } catch (e) {
    return json({ ok: false, erro: "falha_interna", detalhe: String(e) }, 500);
  }
});
