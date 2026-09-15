// Recebe eventos de movimentacao de negocio do DataCrazy e grava em
// portado_do_datacrazy."movimentacoes -PORTADO DATACRAZY" via RPC public.dc_registrar_movimentacao.
import { createClient } from "jsr:@supabase/supabase-js@2";

const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "*", "Access-Control-Allow-Methods": "POST, GET, OPTIONS" };
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method === "GET") return json({ ok: true, note: "webhook de movimentacao ativo. Configure este URL (POST) no DataCrazy." });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  const url = new URL(req.url);
  const secret = url.searchParams.get("s") ?? req.headers.get("x-webhook-secret") ?? "";

  let payload: any = {};
  try { payload = await req.json(); } catch { try { payload = { raw: await req.text() }; } catch (_) {} }

  try {
    const { data, error } = await admin.rpc("dc_registrar_movimentacao", { p_payload: payload, p_secret: secret });
    if (error) return json({ ok: false, error: String(error.message) }, 200);
    return json(data);
  } catch (e) {
    return json({ ok: false, error: String(e) }, 200);
  }
});
