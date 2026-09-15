// lead-instagram: porta de entrada do lead do Instagram no ERP.
// Valida o SYNC_TOKEN ANTES de tocar no banco.
// A service_role nunca sai daqui.

const SB    = Deno.env.get("SUPABASE_URL")!;
const SRV   = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const TOKEN = Deno.env.get("SYNC_TOKEN");

const json = (corpo: unknown, status = 200) =>
  new Response(JSON.stringify(corpo), {
    status,
    headers: { "content-type": "application/json", "cache-control": "no-store" },
  });

function tokenDaRequisicao(req: Request): string | null {
  const auth = req.headers.get("Authorization") ?? "";
  if (auth.toLowerCase().startsWith("bearer ")) return auth.slice(7).trim();
  return req.headers.get("x-sync-token");
}

function iguais(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let d = 0;
  for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ erro: "use POST" }, 405);
  if (!TOKEN) return json({ erro: "config", detalhe: "SYNC_TOKEN ausente" }, 503);

  const enviado = tokenDaRequisicao(req);
  if (!enviado || !iguais(enviado, TOKEN)) return json({ erro: "nao_autorizado" }, 401);

  let corpo: Record<string, unknown>;
  try { corpo = await req.json(); }
  catch { return json({ erro: "json_invalido" }, 400); }

  const idem = req.headers.get("Idempotency-Key") ?? corpo["idem"];
  if (!idem) return json({ erro: "idempotency_key_ausente" }, 400);
  corpo["idem"] = idem;

  const r = await fetch(`${SB}/rest/v1/rpc/lead_do_instagram`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      apikey: SRV,
      Authorization: `Bearer ${SRV}`,
      "Content-Profile": "integracao",
      "Accept-Profile": "integracao",
    },
    body: JSON.stringify({ p: corpo }),
  });

  if (!r.ok) {
    const detalhe = await r.text();
    return json({ ok: false, erro: "falha_no_banco", status: r.status,
                  detalhe: detalhe.slice(0, 500) }, 502);
  }

  const saida = await r.json();
  const http = typeof saida?.http === "number" ? saida.http : 200;
  return json(saida, http);
});
